import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeHttpUrl } from "@/lib/safe-url";
import type { BrandDNA, CreatorDNA } from "@/lib/taxonomy";

export type CreatorKind = "content_creator" | "ugc_creator" | "other";

export type CreatorOnboardingInput = {
  creator_kind?: CreatorKind;
  display_name: string;
  headline: string;
  bio: string;
  location: string;
  languages: string[];
  creator_types: string[];
  categories: string[];
  instagram: string;
  starting_price_inr: number | null;
  open_to_paid: boolean;
  open_to_barter: boolean;
  preferred_categories: string[];
  portfolio_links: string[];
};

export type BrandOnboardingInput = {
  brand_name: string;
  website: string;
  instagram: string;
  industry: string;
  about: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  campaign_categories: string[];
  mission?: string;
  demographics?: string;
  goals?: string;
  markets?: string;
  price_point?: string;
};

function composeBrandAbout(data: BrandOnboardingInput) {
  const sections: Array<[string, string | undefined]> = [
    ["Mission", data.mission],
    ["Target demographics", data.demographics],
    ["Campaign goals", data.goals],
    ["Key markets", data.markets],
    ["Price point", data.price_point],
  ];
  const extra = sections
    .filter(([, value]) => value && value.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join("\n");
  return [data.about.trim(), extra].filter(Boolean).join("\n\n");
}

export const saveCreatorOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatorOnboardingInput) => ({
    ...input,
    portfolio_links: (input.portfolio_links ?? [])
      .map((link) => normalizeHttpUrl(link, "Portfolio link"))
      .filter((link): link is string => !!link),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "creator" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    // Creators pick at most 2 categories; the third slot is the AI-contributed (or
    // creator-overridden) ai_category, preserved across saves instead of getting wiped.
    const { data: existing } = await supabase
      .from("creator_profiles")
      .select("ai_category")
      .eq("user_id", userId)
      .maybeSingle();
    const ownCategories = data.categories.slice(0, 2);
    const aiCategory = (existing as any)?.ai_category as string | null | undefined;
    const categories =
      aiCategory && !ownCategories.includes(aiCategory)
        ? [...ownCategories, aiCategory]
        : ownCategories;

    const { data: row, error } = await supabase
      .from("creator_profiles")
      .upsert(
        {
          user_id: userId,
          display_name: data.display_name,
          headline: data.headline || null,
          bio: data.bio || null,
          location: data.location || null,
          languages: data.languages,
          creator_kind: data.creator_kind ?? "content_creator",
          ...(data.creator_kind === "other" ? { verification: "pending" as const } : {}),
          creator_types: data.creator_types,
          categories,
          starting_price_inr: data.starting_price_inr,
          open_to_paid: data.open_to_paid,
          open_to_barter: data.open_to_barter,
          preferred_categories: data.preferred_categories,
          portfolio_links: data.portfolio_links,
          onboarding_completed: true,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.instagram.trim()) {
      await supabase.from("social_accounts").upsert(
        {
          user_id: userId,
          platform: "instagram",
          handle: data.instagram.replace(/^@/, "").trim(),
          connected_via_oauth: false,
        },
        { onConflict: "user_id,platform" },
      );
    }

    return { creatorId: row.id, needsApproval: data.creator_kind === "other" };
  });

export const saveBrandOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BrandOnboardingInput) => ({
    ...input,
    website: normalizeHttpUrl(input.website, "Website") ?? "",
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "brand" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    const { data: row, error } = await supabase
      .from("brand_profiles")
      .upsert(
        {
          user_id: userId,
          brand_name: data.brand_name,
          website: data.website || null,
          instagram: data.instagram || null,
          industry: data.industry || null,
          about: composeBrandAbout(data) || null,
          campaign_categories: data.campaign_categories,
          onboarding_completed: true,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: contactError } = await supabase.from("brand_contacts").upsert(
      {
        brand_id: row.id,
        contact_person: data.contact_person || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
      },
      { onConflict: "brand_id" },
    );
    if (contactError) throw new Error(contactError.message);

    return { brandId: row.id };
  });

export const generateCreatorDNA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    await checkRateLimit(supabase, userId, "generate_creator_dna", {
      windowSeconds: 3600,
      max: 20,
    });

    const { data: profile, error } = await supabase
      .from("creator_profiles")
      .select(
        "id, display_name, headline, bio, location, languages, creator_types, categories, starting_price_inr, open_to_paid, open_to_barter, preferred_categories, portfolio_links, ai_category, ai_category_locked",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Finish your profile first.");

    const { generateJson, creatorDnaSchema, CREATOR_DNA_SYSTEM } = await import("@/lib/ai.server");
    const { data: dna, model } = await generateJson<CreatorDNA>({
      system: CREATOR_DNA_SYSTEM,
      prompt: `Creator facts (JSON):\n${JSON.stringify(profile, null, 2)}`,
      schemaName: "creator_dna",
      schema: creatorDnaSchema,
    });

    const { error: saveError } = await supabase
      .from("creator_dna")
      .upsert(
        { creator_id: profile.id, data: dna, model, reviewed_by_user: false },
        { onConflict: "creator_id" },
      );
    if (saveError) throw new Error(saveError.message);

    // AI contributes one extra category label on top of the creator's own picks (max 3 total),
    // unless the creator has locked their own choice via setAiCategory — then leave it alone.
    const own = ((profile as any).categories ?? []).slice(0, 2) as string[];
    if ((profile as any).ai_category_locked) {
      const locked = (profile as any).ai_category as string | null;
      if (locked && !own.includes(locked)) {
        await supabase
          .from("creator_profiles")
          .update({ categories: [...own, locked] })
          .eq("id", profile.id);
      }
    } else {
      const { CATEGORIES } = await import("@/lib/taxonomy");
      const aiPick =
        (dna.best_fit_categories ?? []).find(
          (c) => c && !own.includes(c) && CATEGORIES.includes(c as never),
        ) ?? null;
      await supabase
        .from("creator_profiles")
        .update({ categories: aiPick ? [...own, aiPick] : own, ai_category: aiPick })
        .eq("id", profile.id);
    }

    await classifyAndSavePrimaryCategory(supabase, userId, profile);

    return dna;
  });

/** Creator overrides (locks) or clears the AI-contributed third category label. */
export const setAiCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { CATEGORIES } = await import("@/lib/taxonomy");
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("id, categories, ai_category")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Finish your profile first.");

    const own = ((profile as any).categories ?? [])
      .filter((c: string) => c !== (profile as any).ai_category)
      .slice(0, 2);
    const category =
      data.category && CATEGORIES.includes(data.category as never) ? data.category : null;

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        ai_category: category,
        ai_category_locked: category !== null,
        categories: category ? [...own, category] : own,
      })
      .eq("id", (profile as any).id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Single, confident primary_category — write-time only, never on a read. See classification.server.ts. */
async function classifyAndSavePrimaryCategory(supabase: any, userId: string, profile: any) {
  const { data: social } = await supabase
    .from("social_accounts")
    .select("connected_via_oauth, followers, profile_data")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .maybeSingle();

  const {
    shouldUsePortfolioPath,
    classifyCreatorCategorySocial,
    classifyCreatorCategoryPortfolio,
  } = await import("@/lib/classification.server");
  const usePortfolio = shouldUsePortfolioPath({
    creatorTypes: profile.creator_types ?? [],
    connectedInstagram: !!social?.connected_via_oauth,
    followersCount: social?.followers ?? null,
  });

  const result = usePortfolio
    ? await classifyCreatorCategoryPortfolio(
        profile.bio,
        profile.creator_types ?? [],
        profile.preferred_categories ?? [],
        profile.portfolio_links ?? [],
      )
    : await classifyCreatorCategorySocial(
        profile.bio,
        ((social?.profile_data as any)?.media ?? [])
          .slice(0, 12)
          .map((m: any) => m.caption)
          .filter(Boolean),
        (social?.profile_data as any)?.engagement_rate ?? null,
      );

  await supabase
    .from("creator_profiles")
    .update({
      primary_category: result.category,
      category_confidence: result.confidence,
      category_source: usePortfolio ? "portfolio" : "social",
    })
    .eq("id", profile.id);
}

export const generateBrandDNA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    await checkRateLimit(supabase, userId, "generate_brand_dna", { windowSeconds: 3600, max: 20 });

    const { data: profile, error } = await supabase
      .from("brand_profiles")
      .select("id, brand_name, website, instagram, industry, about, campaign_categories")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Finish your brand profile first.");

    const { generateJson, brandDnaSchema, BRAND_DNA_SYSTEM } = await import("@/lib/ai.server");
    const { data: dna, model } = await generateJson<BrandDNA>({
      system: BRAND_DNA_SYSTEM,
      prompt: `Brand facts (JSON):\n${JSON.stringify(profile, null, 2)}`,
      schemaName: "brand_dna",
      schema: brandDnaSchema,
    });

    const { error: saveError } = await supabase
      .from("brand_dna")
      .upsert(
        { brand_id: profile.id, data: dna, model, reviewed_by_user: false },
        { onConflict: "brand_id" },
      );
    if (saveError) throw new Error(saveError.message);

    return dna;
  });

export type CategoryMapping = {
  input: string;
  category: string;
  is_new: boolean;
  note: string;
};

/* Free-text "Other" categories are normalised by AI: it either maps the phrase
 * onto an existing marketplace category or proposes a clean new one. */
export const mapCustomCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { raw: string[]; existing: string[] }) => input)
  .handler(async ({ data }) => {
    const raw = data.raw
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (!raw.length) return { mappings: [] as CategoryMapping[] };

    const { generateJson } = await import("@/lib/ai.server");
    const { CATEGORIES } = await import("@/lib/taxonomy");

    const { data: result } = await generateJson<{ mappings: CategoryMapping[] }>({
      system:
        "You normalise creator/brand content categories for a marketplace. For each user phrase, map it to the closest existing category when the meaning clearly matches; otherwise propose a short, title-cased new category (1-3 words). Never invent unrelated categories. Keep the note under 12 words.",
      prompt: `Existing marketplace categories: ${JSON.stringify([...CATEGORIES, ...data.existing])}\nUser phrases: ${JSON.stringify(raw)}`,
      schemaName: "category_mappings",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["mappings"],
        properties: {
          mappings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["input", "category", "is_new", "note"],
              properties: {
                input: { type: "string" },
                category: { type: "string" },
                is_new: { type: "boolean" },
                note: { type: "string" },
              },
            },
          },
        },
      },
    });

    return { mappings: result.mappings ?? [] };
  });
