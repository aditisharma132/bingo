import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only demo pack: realistic creators, brands and live campaigns so the
 * marketplace, matching and trends views have something to chew on. */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SEED_BRANDS, SEED_CREATORS } = await import("@/lib/seed-data");

    let createdCreators = 0;
    let createdBrands = 0;
    let createdCampaigns = 0;

    const ensureUser = async (email: string, fullName: string) => {
      const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing?.id) return existing.id as string;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `Bingo#${Math.random().toString(36).slice(2, 10)}A1`,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) throw new Error(error?.message ?? "Could not create the demo account.");
      return data.user.id;
    };

    for (const creator of SEED_CREATORS) {
      const userId = await ensureUser(creator.email, creator.display_name);
      const { data: existing } = await supabaseAdmin
        .from("creator_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) continue;
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "creator" }).select();
      const { error } = await supabaseAdmin.from("creator_profiles").insert({
        user_id: userId,
        display_name: creator.display_name,
        bio: creator.bio,
        location: creator.location,
        languages: creator.languages,
        creator_types: creator.creator_types,
        categories: creator.categories,
        preferred_categories: creator.categories,
        starting_price_inr: creator.starting_price_inr,
        open_to_paid: true,
        open_to_barter: creator.open_to_barter,
        portfolio_links: [],
        verification: "approved",
        onboarding_completed: true,
        is_public: true,
        is_seed: true,
      });
      if (!error) createdCreators += 1;
    }

    for (const brand of SEED_BRANDS) {
      const userId = await ensureUser(brand.email, brand.brand_name);
      let { data: brandRow } = await supabaseAdmin
        .from("brand_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!brandRow) {
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "brand" }).select();
        const { data: inserted, error } = await supabaseAdmin
          .from("brand_profiles")
          .insert({
            user_id: userId,
            brand_name: brand.brand_name,
            industry: brand.industry,
            about: brand.about,
            website: brand.website,
            campaign_categories: brand.campaign_categories,
            verification: "approved",
            onboarding_completed: true,
            is_public: true,
            is_seed: true,
          })
          .select("id")
          .maybeSingle();
        if (error) continue;
        brandRow = inserted;
        createdBrands += 1;
      }
      if (!brandRow) continue;

      for (const campaign of brand.campaigns) {
        const { data: existingCampaign } = await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("brand_id", brandRow.id)
          .eq("title", campaign.title)
          .maybeSingle();
        if (existingCampaign) continue;
        const { data: created } = await supabaseAdmin
          .from("campaigns")
          .insert({
            brand_id: brandRow.id,
            title: campaign.title,
            raw_prompt: campaign.raw_prompt,
            status: "published",
            compensation_type: campaign.compensation_type,
            budget_min: campaign.budget_min,
            budget_max: campaign.budget_max,
            is_seed: true,
            published_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        if (!created) continue;
        createdCampaigns += 1;
        await supabaseAdmin.from("campaign_briefs").insert({
          campaign_id: created.id,
          data: campaign.brief as never,
          model: "seed",
        });
      }
    }

    return { createdCreators, createdBrands, createdCampaigns };
  });
