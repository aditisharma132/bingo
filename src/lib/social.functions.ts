import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeHttpUrl } from "@/lib/safe-url";

export type TagRow = { id: string; slug: string; label: string; kind: string; related: string[] };

export type BrandPostRow = {
  id: string;
  brand_id: string;
  kind: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_url: string | null;
  campaign_id: string | null;
  is_published: boolean;
  created_at: string;
  brand_name?: string;
  brand_logo?: string | null;
};

/* ------------------------------- tags ------------------------------- */

export const listTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tags")
      .select("id, slug, label, kind, related")
      .order("label");
    if (error) throw new Error(error.message);
    return (data ?? []) as TagRow[];
  });

export const listEntityTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { entityType: "creator" | "brand" | "campaign"; entityId: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("entity_tags")
      .select("id, tag_id, tags(id, slug, label, kind, related)")
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => {
      const t = Array.isArray(r.tags) ? r.tags[0] : r.tags;
      return { id: r.id, tag: t as TagRow };
    });
  });

export const addTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      label: string;
      kind?: "category" | "label";
      entityType: "creator" | "brand" | "campaign";
      entityId: string;
    }) => {
      const label = input.label.trim();
      if (label.length < 2 || label.length > 40) throw new Error("Tags must be 2–40 characters.");
      return { ...input, label, kind: input.kind ?? "label" };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    let tagId = existing?.id as string | undefined;

    if (!tagId) {
      let related: string[] = [];
      try {
        const { checkRateLimit } = await import("@/lib/rate-limit.server");
        await checkRateLimit(supabase, userId, "map_tag", { windowSeconds: 3600, max: 30 });
        const { generateJson } = await import("@/lib/ai.server");
        const { CATEGORIES, CREATOR_TYPES } = await import("@/lib/taxonomy");
        const { data: mapped } = await generateJson<{ related: string[] }>({
          system:
            "You map a marketing tag to the closest items in a fixed taxonomy. Return only items that exist in the provided lists. Return an empty array if nothing fits.",
          prompt: `Tag: "${data.label}"\nCategories: ${CATEGORIES.join(", ")}\nCreator types: ${CREATOR_TYPES.join(", ")}`,
          schemaName: "tag_mapping",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["related"],
            properties: { related: { type: "array", items: { type: "string" } } },
          },
        });
        related = (mapped.related ?? []).slice(0, 6);
      } catch {
        related = [];
      }

      const { data: created, error } = await supabase
        .from("tags")
        .insert({ slug, label: data.label, kind: data.kind, created_by: userId, related })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      tagId = created.id as string;
    }

    const { error: linkError } = await supabase
      .from("entity_tags")
      .upsert(
        { tag_id: tagId, entity_type: data.entityType, entity_id: data.entityId, owner_id: userId },
        { onConflict: "tag_id,entity_type,entity_id" },
      );
    if (linkError) throw new Error(linkError.message);
    return { tagId };
  });

export const removeTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityTagId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("entity_tags")
      .delete()
      .eq("id", data.entityTagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- profiles ----------------------------- */

export const saveProfileMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { avatarUrl?: string | null; coverUrl?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getParty } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);

    if (me.brandId) {
      const patch: Record<string, string | null> = {};
      if (data.avatarUrl !== undefined) patch["logo_url"] = data.avatarUrl;
      if (data.coverUrl !== undefined) patch["cover_url"] = data.coverUrl;
      const { error } = await supabase
        .from("brand_profiles")
        .update(patch as any)
        .eq("id", me.brandId);
      if (error) throw new Error(error.message);
    } else if (me.creatorId) {
      const patch: Record<string, string | null> = {};
      if (data.avatarUrl !== undefined) patch["avatar_url"] = data.avatarUrl;
      if (data.coverUrl !== undefined) patch["cover_url"] = data.coverUrl;
      const { error } = await supabase
        .from("creator_profiles")
        .update(patch as any)
        .eq("id", me.creatorId);
      if (error) throw new Error(error.message);
    } else {
      throw new Error("Finish onboarding first.");
    }
    return { ok: true };
  });

export const getMyEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getParty } = await import("@/lib/messaging.server");
    const me = await getParty(context.supabase, context.userId);
    return { role: me.role, creatorId: me.creatorId, brandId: me.brandId };
  });

export const getCreatorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { creatorId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: creator, error } = await supabase
      .from("creator_profiles")
      .select(
        "id, user_id, display_name, headline, bio, avatar_url, cover_url, location, languages, creator_types, categories, starting_price_inr, open_to_paid, open_to_barter, portfolio_links, verification, creator_dna(data)",
      )
      .eq("id", data.creatorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!creator) throw new Error("Creator not found.");

    const { data: tagRows } = await supabase
      .from("entity_tags")
      .select("id, tags(id, slug, label, kind, related)")
      .eq("entity_type", "creator")
      .eq("entity_id", data.creatorId);

    const dna = Array.isArray((creator as any).creator_dna)
      ? (creator as any).creator_dna[0]?.data
      : (creator as any).creator_dna?.data;

    return {
      creator: { ...(creator as any), creator_dna: undefined, dna: dna ?? null },
      tags: (tagRows ?? []).map((r: any) => (Array.isArray(r.tags) ? r.tags[0] : r.tags)),
      isSelf: (creator as any).user_id === userId,
    };
  });

export const getBrandProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { brandId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: brand, error } = await supabase
      .from("brand_profiles")
      .select(
        "id, user_id, brand_name, logo_url, cover_url, website, instagram, industry, about, campaign_categories, verification",
      )
      .eq("id", data.brandId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!brand) throw new Error("Brand not found.");

    const [
      { data: tagRows },
      { data: posts },
      { data: subs },
      { data: mySub },
      { data: campaigns },
    ] = await Promise.all([
      supabase
        .from("entity_tags")
        .select("id, tags(id, slug, label, kind, related)")
        .eq("entity_type", "brand")
        .eq("entity_id", data.brandId),
      supabase
        .from("brand_posts")
        .select(
          "id, brand_id, kind, title, body, image_url, cta_url, campaign_id, is_published, created_at",
        )
        .eq("brand_id", data.brandId)
        .order("created_at", { ascending: false }),
      supabase
        .from("brand_subscriptions")
        .select("id", { count: "exact" })
        .eq("brand_id", data.brandId),
      supabase
        .from("brand_subscriptions")
        .select("id")
        .eq("brand_id", data.brandId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("campaigns")
        .select("id, title, status, compensation_type, budget_min, budget_max, created_at")
        .eq("brand_id", data.brandId)
        .eq("status", "published")
        .order("created_at", { ascending: false }),
    ]);

    // Activity indicator: how recently the brand posted, briefed or replied.
    const { data: recentMessages } = await supabase
      .from("conversation_messages")
      .select("created_at")
      .eq("sender_id", (brand as any).user_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const stamps = [
      ...(posts ?? []).map((p: any) => p.created_at as string),
      ...(campaigns ?? []).map((c: any) => c.created_at as string),
      ...(recentMessages ?? []).map((m: any) => m.created_at as string),
    ].filter(Boolean);
    const lastActiveAt = stamps.sort().at(-1) ?? null;
    const days = lastActiveAt ? (Date.now() - new Date(lastActiveAt).getTime()) / 86_400_000 : null;
    const activity =
      days === null
        ? { level: "new" as const, label: "New here" }
        : days <= 3
          ? { level: "high" as const, label: "Very active" }
          : days <= 14
            ? { level: "medium" as const, label: "Active recently" }
            : { level: "low" as const, label: "Quiet lately" };

    // Creators viewing a brand can flag interest per campaign; show current state.
    const { data: myCreator } = await supabase
      .from("creator_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    let interest = new Map<string, string>();
    if (myCreator && (campaigns ?? []).length) {
      const { data: myPitches } = await supabase
        .from("pitches")
        .select("campaign_id, status")
        .eq("creator_id", (myCreator as any).id)
        .in(
          "campaign_id",
          (campaigns ?? []).map((c: any) => c.id),
        );
      interest = new Map(
        (myPitches ?? []).map((p: any) => [p.campaign_id as string, p.status as string]),
      );
    }

    return {
      brand: brand as any,
      activity: { ...activity, lastActiveAt, liveCampaigns: (campaigns ?? []).length },
      tags: (tagRows ?? []).map((r: any) => (Array.isArray(r.tags) ? r.tags[0] : r.tags)),
      posts: (posts ?? []) as BrandPostRow[],
      subscriberCount: (subs ?? []).length,
      isSubscribed: !!mySub,
      isSelf: (brand as any).user_id === userId,
      campaigns: (campaigns ?? []).map((c: any) => ({
        ...c,
        interest_status: interest.get(c.id) ?? null,
      })),
    };
  });

/* ------------------------- posts + subscriptions ------------------------- */

export const createBrandPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      body: string;
      kind: "campaign" | "newsletter" | "update";
      imageUrl?: string | null;
      ctaUrl?: string | null;
      campaignId?: string | null;
    }) => {
      if (!input.title.trim()) throw new Error("Add a title.");
      if (!input.body.trim()) throw new Error("Add some content.");
      return { ...input, ctaUrl: normalizeHttpUrl(input.ctaUrl, "Link") };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getParty, notifyUsers } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);
    if (!me.brandId) throw new Error("Only brands can post.");

    const { data: post, error } = await supabase
      .from("brand_posts")
      .insert({
        brand_id: me.brandId,
        title: data.title.trim(),
        body: data.body.trim(),
        kind: data.kind,
        image_url: data.imageUrl ?? null,
        cta_url: data.ctaUrl ?? null,
        campaign_id: data.campaignId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: brand } = await supabase
      .from("brand_profiles")
      .select("brand_name")
      .eq("id", me.brandId)
      .maybeSingle();
    const { data: subs } = await supabase
      .from("brand_subscriptions")
      .select("user_id")
      .eq("brand_id", me.brandId);
    await notifyUsers(
      (subs ?? []).map((s: any) => s.user_id),
      {
        kind: "post",
        title: `${brand?.brand_name ?? "A brand"} posted: ${data.title.trim()}`,
        body: data.body.slice(0, 140),
        link: `/brands/${me.brandId}`,
      },
    );

    return { postId: post.id as string };
  });

export const deleteBrandPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { postId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brand_posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { brandId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("brand_subscriptions")
      .select("id")
      .eq("brand_id", data.brandId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("brand_subscriptions").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { subscribed: false };
    }
    const { error } = await supabase
      .from("brand_subscriptions")
      .insert({ brand_id: data.brandId, user_id: userId });
    if (error) throw new Error(error.message);
    return { subscribed: true };
  });

export const listSubscribedFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: subs } = await supabase
      .from("brand_subscriptions")
      .select("brand_id")
      .eq("user_id", userId);
    const brandIds = (subs ?? []).map((s: any) => s.brand_id);
    if (!brandIds.length) return [];
    const { data, error } = await supabase
      .from("brand_posts")
      .select(
        "id, brand_id, kind, title, body, image_url, cta_url, campaign_id, is_published, created_at, brand_profiles(brand_name, logo_url)",
      )
      .in("brand_id", brandIds)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => {
      const b = Array.isArray(p.brand_profiles) ? p.brand_profiles[0] : p.brand_profiles;
      return {
        ...p,
        brand_name: b?.brand_name ?? "Brand",
        brand_logo: b?.logo_url ?? null,
      } as BrandPostRow;
    });
  });

/* --------------------------- notifications --------------------------- */

/** Latest 10 unread alerts plus recent read history (badged as read in the UI). */
export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: unread, error }, { data: read, error: readError }] = await Promise.all([
      context.supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .not("read_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (error) throw new Error(error.message);
    if (readError) throw new Error(readError.message);
    return [...(unread ?? []), ...(read ?? [])];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
