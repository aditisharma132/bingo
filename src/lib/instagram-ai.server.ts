/**
 * Turns a stored Instagram snapshot into reviewable profile suggestions.
 * Nothing is written to the profile until the user applies a suggestion.
 */
import type { IgSnapshot } from "@/lib/instagram.server";

type Db = any;

const stringArray = { type: "array", items: { type: "string" } };

const creatorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "bio", "categories", "creator_types", "content_style", "audience_signals", "custom_tags", "notes"],
  properties: {
    headline: { type: "string" },
    bio: { type: "string" },
    categories: stringArray,
    creator_types: stringArray,
    content_style: stringArray,
    audience_signals: stringArray,
    custom_tags: stringArray,
    notes: { type: "string" },
  },
};

const brandSchema = {
  type: "object",
  additionalProperties: false,
  required: ["about", "industry", "campaign_categories", "tone_of_voice", "target_audience", "content_themes", "custom_tags", "notes"],
  properties: {
    about: { type: "string" },
    industry: { type: "string" },
    campaign_categories: stringArray,
    tone_of_voice: stringArray,
    target_audience: stringArray,
    content_themes: stringArray,
    custom_tags: stringArray,
    notes: { type: "string" },
  },
};

function describeSnapshot(snapshot: IgSnapshot) {
  const p = snapshot.profile;
  const insights = snapshot.insights.map((i) => `${i.name}: ${i.value ?? "n/a"}`).join(", ");
  const posts = (snapshot.media ?? [])
    .slice(0, 12)
    .map(
      (m, i) =>
        `${i + 1}. [${m.media_type ?? "POST"}] likes ${m.like_count ?? "?"} comments ${m.comments_count ?? "?"} — ${(
          m.caption ?? ""
        )
          .replace(/\s+/g, " ")
          .slice(0, 220)}`,
    )
    .join("\n");
  return [
    `Instagram @${p.username ?? "unknown"} (${p.account_type ?? "unknown type"})`,
    `Followers: ${p.followers_count ?? "n/a"} · Following: ${p.follows_count ?? "n/a"} · Posts: ${p.media_count ?? "n/a"}`,
    `Average engagement rate on recent posts: ${snapshot.engagement_rate ?? "n/a"}%`,
    insights ? `Account insights (last day): ${insights}` : "Account insights: not available",
    "Recent posts:",
    posts || "(no posts returned)",
  ].join("\n");
}

async function loadSnapshot(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("social_accounts")
    .select("profile_data, connected_via_oauth")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .maybeSingle();
  if (!data?.profile_data || !data.connected_via_oauth) throw new Error("Connect Instagram first, then run the analysis.");
  return data.profile_data as IgSnapshot;
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export async function buildInstagramSuggestions(supabase: Db, userId: string) {
  const { generateJson } = await import("@/lib/ai.server");
  const { CATEGORIES, CREATOR_TYPES, INDUSTRIES } = await import("@/lib/taxonomy");
  const snapshot = await loadSnapshot(supabase, userId);

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("id, headline, bio, categories, creator_types")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: brand } = creator
    ? { data: null }
    : await supabase.from("brand_profiles").select("id, about, industry, campaign_categories").eq("user_id", userId).maybeSingle();

  if (!creator && !brand) throw new Error("Finish onboarding before running the analysis.");

  const isBrand = !creator;
  const context = describeSnapshot(snapshot);

  const suggestions: Array<{
    field: string;
    label: string;
    current_value: unknown;
    suggested_value: unknown;
    rationale: string;
  }> = [];

  if (!isBrand) {
    const { data: ai } = await generateJson<any>({
      system: [
        "You improve creator profiles on a creator-brand marketplace using their real Instagram data.",
        "Judge by content and craft, not follower count. Never invent metrics or brand partnerships.",
        "headline: max 90 characters. bio: 2-3 sentences, first person, concrete about what they make.",
        "categories and creator_types must be chosen ONLY from the provided lists.",
        "custom_tags: up to 6 short niche tags (2-3 words) not covered by the lists.",
        "Keep every list item under 12 words.",
      ].join(" "),
      prompt: [
        context,
        "",
        `Allowed categories: ${CATEGORIES.join(", ")}`,
        `Allowed creator types: ${CREATOR_TYPES.join(", ")}`,
        `Current headline: ${creator.headline ?? "(empty)"}`,
        `Current bio: ${creator.bio ?? "(empty)"}`,
        `Current categories: ${(creator.categories ?? []).join(", ") || "(none)"}`,
        `Current creator types: ${(creator.creator_types ?? []).join(", ") || "(none)"}`,
      ].join("\n"),
      schemaName: "creator_profile_boost",
      schema: creatorSchema,
    });

    const rationale = ai.notes || "Derived from your recent Instagram content and engagement.";
    const cats = (ai.categories ?? []).filter((c: string) => CATEGORIES.includes(c as never)).slice(0, 6);
    const types = (ai.creator_types ?? []).filter((c: string) => CREATOR_TYPES.includes(c as never)).slice(0, 4);

    if (ai.headline) suggestions.push({ field: "headline", label: "Headline", current_value: creator.headline, suggested_value: ai.headline, rationale });
    if (ai.bio) suggestions.push({ field: "bio", label: "About / bio", current_value: creator.bio, suggested_value: ai.bio, rationale });
    if (cats.length) suggestions.push({ field: "categories", label: "Categories", current_value: creator.categories, suggested_value: cats, rationale });
    if (types.length) suggestions.push({ field: "creator_types", label: "Creator types", current_value: creator.creator_types, suggested_value: types, rationale });
    if ((ai.custom_tags ?? []).length)
      suggestions.push({ field: "custom_tags", label: "Custom tags", current_value: [], suggested_value: ai.custom_tags.slice(0, 6), rationale });
    if ((ai.content_style ?? []).length || (ai.audience_signals ?? []).length)
      suggestions.push({
        field: "dna",
        label: "Creator DNA signals",
        current_value: null,
        suggested_value: { content_style: ai.content_style ?? [], audience_signals: ai.audience_signals ?? [] },
        rationale,
      });
  } else {
    const { data: ai } = await generateJson<any>({
      system: [
        "You improve brand profiles on a creator-brand marketplace using the brand's real Instagram data.",
        "Never invent results, budgets or audience numbers. about: 2-3 sentences.",
        "industry must be chosen from the provided list. campaign_categories only from the provided categories.",
        "custom_tags: up to 6 short niche tags. Keep every list item under 12 words.",
      ].join(" "),
      prompt: [
        context,
        "",
        `Allowed industries: ${INDUSTRIES.join(", ")}`,
        `Allowed categories: ${CATEGORIES.join(", ")}`,
        `Current about: ${brand.about ?? "(empty)"}`,
        `Current industry: ${brand.industry ?? "(empty)"}`,
        `Current campaign categories: ${(brand.campaign_categories ?? []).join(", ") || "(none)"}`,
      ].join("\n"),
      schemaName: "brand_profile_boost",
      schema: brandSchema,
    });

    const rationale = ai.notes || "Derived from your recent Instagram content and engagement.";
    const cats = (ai.campaign_categories ?? []).filter((c: string) => CATEGORIES.includes(c as never)).slice(0, 6);

    if (ai.about) suggestions.push({ field: "about", label: "About us", current_value: brand.about, suggested_value: ai.about, rationale });
    if (ai.industry && INDUSTRIES.includes(ai.industry as never))
      suggestions.push({ field: "industry", label: "Industry", current_value: brand.industry, suggested_value: ai.industry, rationale });
    if (cats.length)
      suggestions.push({ field: "campaign_categories", label: "Campaign categories", current_value: brand.campaign_categories, suggested_value: cats, rationale });
    if ((ai.custom_tags ?? []).length)
      suggestions.push({ field: "custom_tags", label: "Custom tags", current_value: [], suggested_value: ai.custom_tags.slice(0, 6), rationale });
    if ((ai.tone_of_voice ?? []).length || (ai.content_themes ?? []).length)
      suggestions.push({
        field: "dna",
        label: "Brand DNA signals",
        current_value: null,
        suggested_value: {
          tone_of_voice: ai.tone_of_voice ?? [],
          target_audience: ai.target_audience ?? [],
          content_themes: ai.content_themes ?? [],
        },
        rationale,
      });
  }

  const fresh = suggestions.filter((s) => !sameValue(s.current_value, s.suggested_value));

  await supabase.from("ai_profile_suggestions").delete().eq("user_id", userId).eq("status", "pending");
  if (fresh.length) {
    const { error } = await supabase.from("ai_profile_suggestions").insert(
      fresh.map((s) => ({
        user_id: userId,
        entity_type: isBrand ? "brand" : "creator",
        source: "instagram",
        field: s.field,
        label: s.label,
        current_value: s.current_value as never,
        suggested_value: s.suggested_value as never,
        rationale: s.rationale,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return { count: fresh.length };
}

async function addCustomTags(supabase: Db, userId: string, entityType: "creator" | "brand", entityId: string, labels: string[]) {
  for (const raw of labels) {
    const label = String(raw).trim().slice(0, 40);
    if (label.length < 2) continue;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data: existing } = await supabase.from("tags").select("id").eq("slug", slug).maybeSingle();
    let tagId = existing?.id as string | undefined;
    if (!tagId) {
      const { data: created } = await supabase
        .from("tags")
        .insert({ slug, label, kind: "label", created_by: userId, related: [] })
        .select("id")
        .single();
      tagId = created?.id as string | undefined;
    }
    if (!tagId) continue;
    await supabase
      .from("entity_tags")
      .upsert({ tag_id: tagId, entity_type: entityType, entity_id: entityId, owner_id: userId }, { onConflict: "tag_id,entity_type,entity_id" });
  }
}

export async function applySuggestion(supabase: Db, userId: string, id: string, action: "apply" | "dismiss") {
  const { data: row, error } = await supabase
    .from("ai_profile_suggestions")
    .select("id, field, entity_type, suggested_value")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Suggestion not found.");

  if (action === "dismiss") {
    await supabase.from("ai_profile_suggestions").update({ status: "dismissed" }).eq("id", id);
    return { ok: true };
  }

  const isBrand = row.entity_type === "brand";
  const table = isBrand ? "brand_profiles" : "creator_profiles";
  const { data: profile } = await supabase.from(table).select("id").eq("user_id", userId).maybeSingle();
  if (!profile) throw new Error("Profile not found.");

  const value = row.suggested_value;

  if (row.field === "custom_tags") {
    await addCustomTags(supabase, userId, isBrand ? "brand" : "creator", profile.id, (value as string[]) ?? []);
  } else if (row.field === "dna") {
    const dnaTable = isBrand ? "brand_dna" : "creator_dna";
    const key = isBrand ? "brand_id" : "creator_id";
    const { data: existing } = await supabase.from(dnaTable).select("id, data").eq(key, profile.id).maybeSingle();
    const merged = { ...((existing?.data as Record<string, unknown>) ?? {}), ...(value as Record<string, unknown>) };
    if (existing) await supabase.from(dnaTable).update({ data: merged as never }).eq("id", existing.id);
    else await supabase.from(dnaTable).insert({ [key]: profile.id, data: merged as never } as never);
  } else {
    await supabase
      .from(table)
      .update({ [row.field]: value } as never)
      .eq("id", profile.id);
  }

  await supabase.from("ai_profile_suggestions").update({ status: "applied" }).eq("id", id);
  return { ok: true };
}
