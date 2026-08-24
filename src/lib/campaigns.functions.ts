import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CampaignBrief, CreatorForMatching, MatchResult, MatchWeights } from "@/lib/matching";

export type CampaignRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "closed";
  compensation_type: "paid" | "barter" | "hybrid";
  budget_min: number | null;
  budget_max: number | null;
  created_at: string;
  published_at: string | null;
  brief: CampaignBrief | null;
  brand_name?: string;
  match_count?: number;
};

export type MatchCard = {
  id: string;
  creator_id: string;
  score: number;
  fit: "strong" | "good" | "potential" | "weak";
  reasons: string[];
  gaps: string[];
  signals: Record<string, number>;
  invited: boolean;
  creator_interested: boolean | null;
  creator: {
    id: string;
    display_name: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string | null;
    creator_types: string[];
    categories: string[];
    starting_price_inr: number | null;
    verification: string;
  };
};

function one<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/** Batch-load learned preference weights for a set of brands, keyed by brand_id. */
async function fetchMatchWeights(
  supabase: any,
  brandIds: string[],
): Promise<Map<string, MatchWeights>> {
  const ids = [...new Set(brandIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("match_weights")
    .select("brand_id, category_weights, tone_weights")
    .in("brand_id", ids);
  return new Map(
    (data ?? []).map((r: any) => [
      r.brand_id,
      { category_weights: r.category_weights ?? {}, tone_weights: r.tone_weights ?? {} },
    ]),
  );
}

async function brandIdFor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Create your brand profile first.");
  return data.id as string;
}

async function creatorIdFor(supabase: any, userId: string) {
  const { data } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Create your creator profile first.");
  return data.id as string;
}

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      prompt: string;
      compensation_type: "paid" | "barter" | "hybrid";
      budget_min: number | null;
      budget_max: number | null;
      categories?: string[];
    }) => {
      const categories = Array.from(
        new Set((input.categories ?? []).map((c) => c.trim()).filter(Boolean)),
      );
      if (!categories.length) throw new Error("Pick at least one target category.");
      if (categories.length > 3) throw new Error("Pick a maximum of 3 target categories.");
      return { ...input, categories };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brandId = await brandIdFor(supabase, userId);
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    await checkRateLimit(supabase, userId, "generate_campaign_brief", {
      windowSeconds: 3600,
      max: 20,
    });

    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("brand_name, industry, about, campaign_categories")
      .eq("id", brandId)
      .maybeSingle();

    const { generateJson, campaignBriefSchema, CAMPAIGN_BRIEF_SYSTEM } =
      await import("@/lib/ai.server");
    const { data: brief, model } = await generateJson<CampaignBrief>({
      system: CAMPAIGN_BRIEF_SYSTEM,
      prompt: [
        `Brand: ${JSON.stringify(brand)}`,
        `Campaign title: ${data.title}`,
        `Target categories for this campaign (use exactly these): ${JSON.stringify(data.categories)}`,
        `Compensation: ${data.compensation_type}, budget range INR ${data.budget_min ?? "n/a"} - ${data.budget_max ?? "n/a"}`,
        `Brand's own words:\n${data.prompt}`,
      ].join("\n"),
      schemaName: "campaign_brief",
      schema: campaignBriefSchema,
    });

    const briefWithCategories = { ...brief, categories: data.categories } as CampaignBrief;

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        brand_id: brandId,
        title: data.title,
        raw_prompt: data.prompt,
        status: "draft",
        compensation_type: data.compensation_type,
        budget_min: data.budget_min,
        budget_max: data.budget_max,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: briefError } = await supabase
      .from("campaign_briefs")
      .insert({ campaign_id: campaign.id, data: briefWithCategories, model });
    if (briefError) throw new Error(briefError.message);

    return { campaignId: campaign.id as string, brief: briefWithCategories };
  });

export const updateBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; brief: CampaignBrief }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaign_briefs")
      .update({ data: data.brief, edited_by_brand: true })
      .eq("campaign_id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Edit a campaign draft: title, prompt, compensation, budget and target
 * categories. Optionally regenerates the AI brief from the edited prompt. */
export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      campaignId: string;
      title: string;
      prompt: string;
      compensation_type: "paid" | "barter" | "hybrid";
      budget_min: number | null;
      budget_max: number | null;
      categories: string[];
      regenerateBrief?: boolean;
    }) => {
      if (!input.title.trim()) throw new Error("Give the campaign a title.");
      const categories = Array.from(
        new Set((input.categories ?? []).map((c) => c.trim()).filter(Boolean)),
      );
      if (!categories.length) throw new Error("Pick at least one target category.");
      if (categories.length > 3) throw new Error("Pick a maximum of 3 target categories.");
      return { ...input, title: input.title.trim(), categories };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brandId = await brandIdFor(supabase, userId);

    const { data: existing, error: loadError } = await supabase
      .from("campaigns")
      .select("id, status, brand_id, campaign_briefs(data)")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!existing || (existing as any).brand_id !== brandId) throw new Error("Campaign not found.");
    if ((existing as any).status === "closed") throw new Error("This campaign is closed.");

    const { error } = await supabase
      .from("campaigns")
      .update({
        title: data.title,
        raw_prompt: data.prompt,
        compensation_type: data.compensation_type,
        budget_min: data.budget_min,
        budget_max: data.budget_max,
      })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);

    let brief = (one<any>((existing as any).campaign_briefs)?.data ?? null) as CampaignBrief | null;
    let model: string | null = null;

    if (data.regenerateBrief) {
      const { checkRateLimit } = await import("@/lib/rate-limit.server");
      await checkRateLimit(supabase, userId, "generate_campaign_brief", {
        windowSeconds: 3600,
        max: 20,
      });

      const { data: brand } = await supabase
        .from("brand_profiles")
        .select("brand_name, industry, about, campaign_categories")
        .eq("id", brandId)
        .maybeSingle();
      const { generateJson, campaignBriefSchema, CAMPAIGN_BRIEF_SYSTEM } =
        await import("@/lib/ai.server");
      const generated = await generateJson<CampaignBrief>({
        system: CAMPAIGN_BRIEF_SYSTEM,
        prompt: [
          `Brand: ${JSON.stringify(brand)}`,
          `Campaign title: ${data.title}`,
          `Target categories for this campaign (use exactly these): ${JSON.stringify(data.categories)}`,
          `Compensation: ${data.compensation_type}, budget range INR ${data.budget_min ?? "n/a"} - ${data.budget_max ?? "n/a"}`,
          `Brand's own words:\n${data.prompt}`,
        ].join("\n"),
        schemaName: "campaign_brief",
        schema: campaignBriefSchema,
      });
      brief = generated.data;
      model = generated.model;
    }

    const nextBrief = {
      ...(brief ?? ({} as CampaignBrief)),
      categories: data.categories,
    } as CampaignBrief;

    const { data: briefRow } = await supabase
      .from("campaign_briefs")
      .select("id")
      .eq("campaign_id", data.campaignId)
      .maybeSingle();

    if (briefRow) {
      const { error: bErr } = await supabase
        .from("campaign_briefs")
        .update({
          data: nextBrief,
          edited_by_brand: !data.regenerateBrief,
          ...(model ? { model } : {}),
        })
        .eq("campaign_id", data.campaignId);
      if (bErr) throw new Error(bErr.message);
    } else {
      const { error: bErr } = await supabase
        .from("campaign_briefs")
        .insert({ campaign_id: data.campaignId, data: nextBrief, model });
      if (bErr) throw new Error(bErr.message);
    }

    return { ok: true, brief: nextBrief };
  });

export const listBrandCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const brandId = await brandIdFor(supabase, userId);
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, title, status, compensation_type, budget_min, budget_max, created_at, published_at, campaign_briefs(data), matches(count)",
      )
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      compensation_type: row.compensation_type,
      budget_min: row.budget_min,
      budget_max: row.budget_max,
      created_at: row.created_at,
      published_at: row.published_at,
      brief: one<any>(row.campaign_briefs)?.data ?? null,
      match_count: Array.isArray(row.matches)
        ? (row.matches[0]?.count ?? 0)
        : (row.matches?.count ?? 0),
    })) as CampaignRow[];
  });

export const runMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { scoreCreator, FIT_ORDER } = await import("@/lib/matching");

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(
        "id, brand_id, status, compensation_type, budget_min, budget_max, campaign_briefs(data)",
      )
      .eq("id", data.campaignId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Campaign not found.");
    if ((campaign as any).status !== "published") {
      throw new Error("Publish the campaign first — matchmaking runs only on published campaigns.");
    }
    const brief = one<any>((campaign as any).campaign_briefs)?.data as CampaignBrief | undefined;
    if (!brief) throw new Error("This campaign has no brief yet.");

    const weights = await fetchMatchWeights(supabase, [(campaign as any).brand_id]);

    const { data: creators, error: creatorError } = await supabase
      .from("creator_profiles")
      .select(
        "id, display_name, headline, bio, location, languages, creator_types, categories, starting_price_inr, open_to_paid, open_to_barter, creator_dna(data)",
      )
      .eq("is_public", true)
      .eq("onboarding_completed", true);
    if (creatorError) throw new Error(creatorError.message);

    const scored = (creators ?? []).map((row: any) => {
      const creator: CreatorForMatching = { ...row, dna: one<any>(row.creator_dna)?.data ?? null };
      const result: MatchResult = scoreCreator(
        {
          brief,
          compensation_type: (campaign as any).compensation_type,
          budget_min: (campaign as any).budget_min,
          budget_max: (campaign as any).budget_max,
        },
        creator,
        undefined,
        weights.get((campaign as any).brand_id) ?? null,
      );
      return { creator_id: row.id, ...result };
    });

    scored.sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || b.score - a.score);
    const top = scored.slice(0, 15);

    if (top.length) {
      const { error: upsertError } = await supabase.from("matches").upsert(
        top.map((m) => ({
          campaign_id: data.campaignId,
          creator_id: m.creator_id,
          score: m.score,
          fit: m.fit,
          signals: m.signals,
          reasons: m.reasons,
          gaps: m.gaps,
        })),
        { onConflict: "campaign_id,creator_id" },
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    return { matched: top.length };
  });

export const publishCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Brands can close a running campaign and reopen it later. */
export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; status: "closed" | "published" }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .update(
        data.status === "published"
          ? { status: "published" as const, published_at: new Date().toISOString() }
          : { status: "closed" as const },
      )
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true, status: data.status };
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(
        "id, title, status, compensation_type, budget_min, budget_max, created_at, published_at, raw_prompt, campaign_briefs(data), brand_profiles(brand_name)",
      )
      .eq("id", data.campaignId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!campaign) throw new Error("Campaign not found.");

    const { data: matches } = await supabase
      .from("matches")
      .select(
        "id, creator_id, score, fit, reasons, gaps, signals, invited, creator_interested, creator_profiles(id, display_name, headline, bio, location, avatar_url, creator_types, categories, starting_price_inr, verification)",
      )
      .eq("campaign_id", data.campaignId)
      .order("score", { ascending: false });

    const { data: pitches } = await supabase
      .from("pitches")
      .select(
        "id, creator_id, message, portfolio_url, proposed_price_inr, status, created_at, creator_profiles(id, display_name, headline, location, avatar_url, creator_types, categories, starting_price_inr, verification)",
      )
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: false });

    return {
      campaign: {
        id: (campaign as any).id,
        title: (campaign as any).title,
        status: (campaign as any).status,
        compensation_type: (campaign as any).compensation_type,
        budget_min: (campaign as any).budget_min,
        budget_max: (campaign as any).budget_max,
        created_at: (campaign as any).created_at,
        published_at: (campaign as any).published_at,
        raw_prompt: (campaign as any).raw_prompt,
        brand_name: one<any>((campaign as any).brand_profiles)?.brand_name ?? "",
        brief: (one<any>((campaign as any).campaign_briefs)?.data ?? null) as CampaignBrief | null,
      },
      matches: (matches ?? []).map((m: any) => ({
        id: m.id,
        creator_id: m.creator_id,
        score: m.score,
        fit: m.fit,
        reasons: m.reasons ?? [],
        gaps: m.gaps ?? [],
        signals: (m.signals ?? {}) as Record<string, number>,
        invited: m.invited,
        creator_interested: m.creator_interested,
        creator: one<any>(m.creator_profiles),
      })) as MatchCard[],
      pitches: (pitches ?? []).map((p: any) => ({
        id: p.id,
        creator_id: p.creator_id,
        message: p.message,
        portfolio_url: p.portfolio_url,
        proposed_price_inr: p.proposed_price_inr,
        status: p.status,
        created_at: p.created_at,
        // Self-nominated creators who never surfaced in the ranked match list.
        outside_match: !(matches ?? []).some((m: any) => m.creator_id === p.creator_id),
        creator: one<any>(p.creator_profiles),
      })),
    };
  });

/* Brand invites a creator to a campaign. The invite always lands in the single
 * ongoing thread between the brand and the creator, as a campaign brief card the
 * creator can accept or reject — negotiation then continues in the same chat. */
export const inviteCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("matches")
      .update({ invited: true })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);

    const { data: match } = await supabase
      .from("matches")
      .select(
        "id, campaign_id, creator_id, creator_profiles(user_id, display_name), campaigns(id, title, compensation_type, budget_min, budget_max, brand_id, campaign_briefs(data), brand_profiles(user_id, brand_name))",
      )
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) return { ok: true, conversationId: null as string | null };

    const campaign = one<any>((match as any).campaigns);
    const creator = one<any>((match as any).creator_profiles);
    const brand = one<any>(campaign?.brand_profiles);
    const brief = one<any>(campaign?.campaign_briefs)?.data ?? null;
    if (!campaign || !creator?.user_id || !brand?.user_id)
      return { ok: true, conversationId: null };

    const { threadBetween, notifyUsers } = await import("@/lib/messaging.server");
    const conversationId = await threadBetween(supabase, {
      creatorId: (match as any).creator_id,
      brandId: campaign.brand_id,
      creatorUserId: creator.user_id,
      brandUserId: brand.user_id,
      requestedBy: userId,
      subject: campaign.title,
    });

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      kind: "campaign",
      body: JSON.stringify({
        inviteId: crypto.randomUUID(),
        campaignId: campaign.id,
        title: campaign.title,
        objective: brief?.objective ?? null,
        deliverables: brief?.deliverables ?? [],
        categories: brief?.categories ?? [],
        compensationType: campaign.compensation_type,
        budgetMin: campaign.budget_min,
        budgetMax: campaign.budget_max,
      }),
    });

    await notifyUsers([creator.user_id], {
      kind: "deal",
      title: "New campaign request",
      body: `${brand.brand_name ?? "A brand"} invited you to “${campaign.title}”.`,
      link: `/messages?c=${conversationId}`,
    });

    return { ok: true, conversationId };
  });

/* Brand withdraws an invite — only while it's still pending. Once the creator has
 * accepted (creator_interested = true) this is locked, enforced by
 * enforce_match_update_scope (DB trigger), not just this check. */
export const withdrawInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("matches")
      .update({ invited: false })
      .eq("id", data.matchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Brand accepts (invite) or rejects a ranked match. Nudges this brand's learned
 * category/tone weights, applied over the creator's OWN tags (never the campaign's),
 * so the preference actually carries to other campaigns later. A rejection reason is
 * mandatory — an unexplained reject only fires a diffuse, untargeted nudge across every
 * one of the creator's tags, which is barely a signal at all. */
export const submitMatchFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { matchId: string; action: "accepted" | "rejected"; reasonText?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const brandId = await brandIdFor(supabase, userId);
    if (data.action === "rejected" && !data.reasonText?.trim()) {
      throw new Error("Add a quick reason so this actually improves future matches.");
    }

    const { data: match } = await supabase
      .from("matches")
      .select(
        "id, creator_id, campaigns(brand_id), creator_profiles(categories, creator_dna(data))",
      )
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Error("Match not found.");
    const campaign = one<any>((match as any).campaigns);
    if (!campaign || campaign.brand_id !== brandId) throw new Error("Not your match.");

    const creatorRow = one<any>((match as any).creator_profiles);
    const categories: string[] = creatorRow?.categories ?? [];
    const toneTags: string[] = one<any>(creatorRow?.creator_dna)?.data?.content_style ?? [];

    const { data: existing } = await supabase
      .from("match_weights")
      .select("category_weights, tone_weights")
      .eq("brand_id", brandId)
      .maybeSingle();
    const categoryWeights: Record<string, number> = {
      ...((existing as any)?.category_weights ?? {}),
    };
    const toneWeights: Record<string, number> = { ...((existing as any)?.tone_weights ?? {}) };

    let directions: Record<string, -1 | 0 | 1> = {};
    if (data.reasonText?.trim()) {
      try {
        const { checkRateLimit } = await import("@/lib/rate-limit.server");
        await checkRateLimit(supabase, userId, "classify_feedback_reason", {
          windowSeconds: 3600,
          max: 60,
        });
        const { classifyFeedbackReason } = await import("@/lib/classification.server");
        directions = (await classifyFeedbackReason(data.reasonText, [...categories, ...toneTags]))
          .adjustments;
      } catch {
        // Rate-limited or AI unavailable — fall through to the unconditional nudge below.
      }
    }

    // Rejection weighs more than acceptance — a stated reason is a clean signal,
    // acceptance is noisy (price, availability may have decided it, not fit).
    const nudge = data.action === "rejected" ? 0.15 : 0.05;
    const defaultSign = data.action === "rejected" ? -1 : 1;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const apply = (tags: string[], weights: Record<string, number>) => {
      for (const tag of tags) {
        const key = tag.trim().toLowerCase();
        if (!key) continue;
        const dir = directions[tag] ?? defaultSign;
        weights[key] = clamp((weights[key] ?? 0) + dir * nudge);
      }
    };
    apply(categories, categoryWeights);
    apply(toneTags, toneWeights);

    const { error } = await supabase.rpc("apply_match_feedback", {
      p_match_id: data.matchId,
      p_brand_id: brandId,
      p_creator_id: (match as any).creator_id,
      p_action: data.action,
      p_reason_text: data.reasonText ?? null,
      p_category_weights: categoryWeights,
      p_tone_weights: toneWeights,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Debug/demo surface for the learning loop (PLAN.md's GET /brands/{id}/weights). */
export const getBrandWeights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const brandId = await brandIdFor(supabase, userId);
    const { data } = await supabase
      .from("match_weights")
      .select("category_weights, tone_weights, updated_at")
      .eq("brand_id", brandId)
      .maybeSingle();
    return data ?? { category_weights: {}, tone_weights: {}, updated_at: null };
  });

/* Creator accepts or rejects a campaign request from inside the thread. */
export const respondToCampaignInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      conversationId: string;
      campaignId: string;
      inviteId?: string | null;
      action: "accept" | "decline";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const creatorId = await creatorIdFor(supabase, userId);

    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("campaign_id", data.campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (match) {
      await supabase
        .from("matches")
        .update({ creator_interested: data.action === "accept" })
        .eq("id", (match as any).id);
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("title, brand_profiles(user_id)")
      .eq("id", data.campaignId)
      .maybeSingle();
    const title = (campaign as any)?.title ?? "the campaign";

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body:
        data.action === "accept"
          ? `Campaign request accepted for “${title}” — negotiation is open. (ref:${data.inviteId || data.campaignId})`
          : `Campaign request declined for “${title}”. (ref:${data.inviteId || data.campaignId})`,
    });
    if (error) throw new Error(error.message);

    const brandUserId = one<any>((campaign as any)?.brand_profiles)?.user_id;
    if (brandUserId) {
      const { notifyUsers } = await import("@/lib/messaging.server");
      await notifyUsers([brandUserId], {
        kind: "deal",
        title: data.action === "accept" ? "Campaign request accepted" : "Campaign request declined",
        body: `A creator ${data.action === "accept" ? "accepted" : "declined"} your request for ${title}.`,
        link: `/messages?c=${data.conversationId}`,
      });
    }

    return { ok: true };
  });

/* Brand accepts or declines a creator's self-nominated pitch. On accept, this opens the
 * same brand↔creator thread inviteCreator uses (or reuses it if one already exists) so
 * accepting a pitch actually connects the two sides, the same way accepting a ranked
 * match does — previously this only flipped a status column with no way to talk. */
export const respondToPitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pitchId: string; status: "accepted" | "declined" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("pitches")
      .update({ status: data.status })
      .eq("id", data.pitchId);
    if (error) throw new Error(error.message);
    if (data.status !== "accepted") return { ok: true, conversationId: null as string | null };

    const { data: pitch } = await supabase
      .from("pitches")
      .select(
        "creator_id, message, campaigns(id, title, compensation_type, budget_min, budget_max, brand_id, campaign_briefs(data), brand_profiles(user_id, brand_name)), creator_profiles(user_id, display_name)",
      )
      .eq("id", data.pitchId)
      .maybeSingle();
    if (!pitch) return { ok: true, conversationId: null };

    const campaign = one<any>((pitch as any).campaigns);
    const creator = one<any>((pitch as any).creator_profiles);
    const brand = one<any>(campaign?.brand_profiles);
    if (!campaign || !creator?.user_id || !brand?.user_id)
      return { ok: true, conversationId: null };

    const { threadBetween, notifyUsers } = await import("@/lib/messaging.server");
    const conversationId = await threadBetween(supabase, {
      creatorId: (pitch as any).creator_id,
      brandId: campaign.brand_id,
      creatorUserId: creator.user_id,
      brandUserId: brand.user_id,
      requestedBy: userId,
      subject: campaign.title,
    });

    const brief = one<any>(campaign?.campaign_briefs)?.data ?? null;
    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      kind: "campaign",
      body: JSON.stringify({
        inviteId: crypto.randomUUID(),
        campaignId: campaign.id,
        title: campaign.title,
        objective: brief?.objective ?? null,
        deliverables: brief?.deliverables ?? [],
        categories: brief?.categories ?? [],
        compensationType: campaign.compensation_type,
        budgetMin: campaign.budget_min,
        budgetMax: campaign.budget_max,
      }),
    });

    await notifyUsers([creator.user_id], {
      kind: "deal",
      title: "Pitch accepted",
      body: `${brand.brand_name ?? "A brand"} accepted your pitch for “${campaign.title}”.`,
      link: `/messages?c=${conversationId}`,
    });

    return { ok: true, conversationId };
  });

export const listCreatorOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const creatorId = await creatorIdFor(supabase, userId);
    const { scoreCreator, FIT_ORDER } = await import("@/lib/matching");

    const { data: profileRow } = await supabase
      .from("creator_profiles")
      .select(
        "id, display_name, headline, bio, location, languages, creator_types, categories, starting_price_inr, open_to_paid, open_to_barter, creator_dna(data)",
      )
      .eq("id", creatorId)
      .maybeSingle();
    const creator: CreatorForMatching = {
      ...(profileRow as any),
      dna: one<any>((profileRow as any)?.creator_dna)?.data ?? null,
    };

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(
        "id, brand_id, title, status, compensation_type, budget_min, budget_max, published_at, campaign_briefs(data), brand_profiles(brand_name), matches(id, fit, reasons, gaps, invited, creator_id)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: myPitches } = await supabase
      .from("pitches")
      .select("id, campaign_id, status")
      .eq("creator_id", creatorId);
    const pitched = new Map(
      (myPitches ?? []).map((p: any) => [p.campaign_id, { id: p.id, status: p.status }]),
    );
    const weights = await fetchMatchWeights(
      supabase,
      (campaigns ?? []).map((row: any) => row.brand_id),
    );

    const rows = (campaigns ?? [])
      .map((row: any) => {
        const brief = one<any>(row.campaign_briefs)?.data as CampaignBrief | undefined;
        if (!brief) return null;
        const stored = (row.matches ?? []).find((m: any) => m.creator_id === creatorId);
        const computed = scoreCreator(
          {
            brief,
            compensation_type: row.compensation_type,
            budget_min: row.budget_min,
            budget_max: row.budget_max,
          },
          creator,
          undefined,
          weights.get(row.brand_id) ?? null,
        );
        return {
          campaign_id: row.id,
          title: row.title,
          brand_name: one<any>(row.brand_profiles)?.brand_name ?? "",
          compensation_type: row.compensation_type,
          budget_min: row.budget_min,
          budget_max: row.budget_max,
          published_at: row.published_at,
          brief,
          fit: (stored?.fit ?? computed.fit) as "strong" | "good" | "potential" | "weak",
          reasons: stored?.reasons?.length ? stored.reasons : computed.reasons,
          gaps: stored?.gaps?.length ? stored.gaps : computed.gaps,
          score: computed.score,
          invited: Boolean(stored?.invited),
          shortlisted: Boolean(stored),
          pitch_id: pitched.get(row.id)?.id ?? null,
          pitch_status: pitched.get(row.id)?.status ?? null,
        };
      })
      .filter(Boolean) as Array<{
      campaign_id: string;
      title: string;
      brand_name: string;
      compensation_type: string;
      budget_min: number | null;
      budget_max: number | null;
      published_at: string | null;
      brief: CampaignBrief;
      fit: "strong" | "good" | "potential" | "weak";
      reasons: string[];
      gaps: string[];
      score: number;
      invited: boolean;
      shortlisted: boolean;
      pitch_id: string | null;
      pitch_status: string | null;
    }>;

    rows.sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || b.score - a.score);
    return rows;
  });

export const sendPitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      campaignId: string;
      message: string;
      portfolioUrl: string;
      proposedPrice: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const creatorId = await creatorIdFor(supabase, userId);
    const { error } = await supabase.from("pitches").insert({
      campaign_id: data.campaignId,
      creator_id: creatorId,
      message: data.message,
      portfolio_url: data.portfolioUrl || null,
      proposed_price_inr: data.proposedPrice,
      status: "sent",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Creator withdraws their own pending pitch — the mirror of a brand withdrawing an
 * invite. Only "sent" -> "withdrawn" is allowed, enforced by enforce_pitch_update_scope
 * (DB trigger), not just this check — RLS lets either party update a pitch row they're
 * party to, so the trigger is the actual authority on who may set which status. */
export const withdrawPitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { pitchId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pitches")
      .update({ status: "withdrawn" })
      .eq("id", data.pitchId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Creator self-nominates for a campaign straight from the brand profile.
 * Recorded as a pitch so the brand sees them while shortlisting even when the
 * category match never ranked them. */
export const expressInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; message?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const creatorId = await creatorIdFor(supabase, userId);

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, title, status, brand_id, brand_profiles(user_id)")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!campaign) throw new Error("Campaign not found.");
    if ((campaign as any).status !== "published")
      throw new Error("This campaign is not open right now.");

    const { data: existing } = await supabase
      .from("pitches")
      .select("id, status")
      .eq("campaign_id", data.campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (existing) return { ok: true, status: (existing as any).status as string, already: true };

    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("display_name, portfolio_links, starting_price_inr")
      .eq("id", creatorId)
      .maybeSingle();

    const links = (profile as any)?.portfolio_links;
    const portfolio =
      Array.isArray(links) && links.length
        ? typeof links[0] === "string"
          ? links[0]
          : (links[0]?.url ?? null)
        : null;

    const { error } = await supabase.from("pitches").insert({
      campaign_id: data.campaignId,
      creator_id: creatorId,
      message:
        data.message?.trim() ||
        `Interested in “${(campaign as any).title}” — happy to share ideas and references.`,
      portfolio_url: portfolio,
      proposed_price_inr: (profile as any)?.starting_price_inr ?? null,
      status: "sent",
    });
    if (error) throw new Error(error.message);

    const brandUserId = one<any>((campaign as any).brand_profiles)?.user_id;
    if (brandUserId) {
      const { notifyUsers } = await import("@/lib/messaging.server");
      await notifyUsers([brandUserId], {
        kind: "deal",
        title: "A creator is interested",
        body: `${(profile as any)?.display_name ?? "A creator"} showed interest in ${(campaign as any).title}.`,
        link: `/campaigns/${data.campaignId}`,
      });
    }

    return { ok: true, status: "sent", already: false };
  });

/* Creator accepts a brand invite: marks interest, opens (or reuses) the thread
 * with the brand and flags the creator as shortlisted inside it. */
export const acceptCampaignInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const creatorId = await creatorIdFor(supabase, userId);

    const { data: match } = await supabase
      .from("matches")
      .select("id, invited")
      .eq("campaign_id", data.campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (!match) throw new Error("This invite is no longer available.");
    if (!(match as any).invited) throw new Error("You haven't been invited to this campaign.");

    await supabase
      .from("matches")
      .update({ creator_interested: true })
      .eq("id", (match as any).id);

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, title, brand_id, brand_profiles(user_id, brand_name)")
      .eq("id", data.campaignId)
      .maybeSingle();
    const brand = one<any>((campaign as any)?.brand_profiles);
    if (!brand?.user_id) throw new Error("Brand not available.");

    const { threadBetween, notifyUsers } = await import("@/lib/messaging.server");
    const conversationId = await threadBetween(supabase, {
      creatorId,
      brandId: (campaign as any).brand_id,
      creatorUserId: userId,
      brandUserId: brand.user_id,
      requestedBy: userId,
      subject: (campaign as any).title,
    });

    await supabase.from("conversation_messages").insert({
      conversation_id: conversationId,
      sender_id: userId,
      kind: "system",
      body: `Shortlisted by the brand — invite accepted for “${(campaign as any).title}”. Negotiation is open. (ref:${data.campaignId})`,
    });

    await notifyUsers([brand.user_id], {
      kind: "deal",
      title: "Invite accepted",
      body: `A creator accepted your invite for ${(campaign as any).title}.`,
      link: `/messages?c=${conversationId}`,
    });

    return { conversationId };
  });

export const listPublicCreators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { categories?: string[] } | undefined) => ({
    categories: (input?.categories ?? []).slice(0, 3),
  }))
  .handler(async ({ data: filters, context }) => {
    let query = context.supabase
      .from("creator_profiles")
      .select(
        "id, display_name, headline, location, avatar_url, creator_types, categories, primary_category, starting_price_inr, verification, open_to_paid, open_to_barter, creator_dna(data)",
      )
      .eq("is_public", true)
      .eq("onboarding_completed", true);
    if (filters.categories.length) query = query.in("primary_category", filters.categories);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: any) => ({
      ...row,
      dna: one<any>(row.creator_dna)?.data ?? null,
    }));
  });
