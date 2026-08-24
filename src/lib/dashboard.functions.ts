import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardData = {
  role: "creator" | "brand" | "admin";
  stats: { label: string; value: string; hint?: string }[];
  opportunities: {
    id: string;
    title: string;
    subtitle: string;
    to: string;
    creatorId?: string;
    campaignId?: string;
    matchId?: string;
  }[];
  deals: { id: string; title: string; state: string; subtitle: string }[];
};

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const { supabase, userId } = context;
    const { getParty } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);

    const { data: dealRows } = await supabase
      .from("deals")
      .select(
        "id, state, agreed_amount_inr, updated_at, creator_profiles(display_name), brand_profiles(brand_name), campaigns(title)",
      )
      .order("updated_at", { ascending: false })
      .limit(50);
    const deals = dealRows ?? [];
    const active = deals.filter((d: any) => ["ACCEPTED", "CREATING", "REVIEW"].includes(d.state));
    const completed = deals.filter((d: any) => d.state === "COMPLETED");

    const dealCards = deals.slice(0, 5).map((d: any) => {
      const creator = Array.isArray(d.creator_profiles) ? d.creator_profiles[0] : d.creator_profiles;
      const brand = Array.isArray(d.brand_profiles) ? d.brand_profiles[0] : d.brand_profiles;
      const campaign = Array.isArray(d.campaigns) ? d.campaigns[0] : d.campaigns;
      return {
        id: d.id as string,
        title: (campaign?.title as string | undefined) ?? "Direct collaboration",
        state: d.state as string,
        subtitle:
          me.role === "brand" ? (creator?.display_name ?? "Creator") : (brand?.brand_name ?? "Brand"),
      };
    });

    if (me.role === "brand" && me.brandId) {
      const [{ data: campaigns }, { data: shortlists }, { data: matches }] = await Promise.all([
        supabase.from("campaigns").select("id, title, status").eq("brand_id", me.brandId),
        supabase.from("shortlists").select("id"),
        supabase
          .from("matches")
          .select("id, fit, score, creator_id, campaign_id, creator_profiles(display_name), campaigns(title, brand_id)")
          .order("score", { ascending: false })
          .limit(20),
      ]);
      const mine = (matches ?? []).filter((m: any) => {
        const c = Array.isArray(m.campaigns) ? m.campaigns[0] : m.campaigns;
        return c?.brand_id === me.brandId;
      });
      const live = (campaigns ?? []).filter((c: any) => c.status === "published");
      return {
        role: "brand",
        stats: [
          { label: "Live campaigns", value: String(live.length), hint: `${(campaigns ?? []).length} total` },
          { label: "Active collaborations", value: String(active.length), hint: "Deals in progress" },
          { label: "Shortlisted creators", value: String((shortlists ?? []).length) },
          { label: "Completed", value: String(completed.length), hint: "Builds your track record" },
        ],
        opportunities: mine.slice(0, 5).map((m: any) => {
          const creator = Array.isArray(m.creator_profiles) ? m.creator_profiles[0] : m.creator_profiles;
          const campaign = Array.isArray(m.campaigns) ? m.campaigns[0] : m.campaigns;
          return {
            id: m.id as string,
            title: (creator?.display_name as string) ?? "Creator",
            subtitle: `${m.fit} fit · ${campaign?.title ?? "Campaign"}`,
            to: `/creators/${m.creator_id}`,
            creatorId: m.creator_id as string,
            campaignId: m.campaign_id as string,
            matchId: m.id as string,
          };
        }),
        deals: dealCards,
      };
    }

    if (me.role === "creator" && me.creatorId) {
      const [{ data: pitches }, { data: matches }] = await Promise.all([
        supabase.from("pitches").select("id, status").eq("creator_id", me.creatorId),
        supabase
          .from("matches")
          .select("id, fit, campaign_id, campaigns(title, status)")
          .eq("creator_id", me.creatorId)
          .limit(20),
      ]);
      const open = (matches ?? []).filter((m: any) => {
        const c = Array.isArray(m.campaigns) ? m.campaigns[0] : m.campaigns;
        return c?.status === "published";
      });
      return {
        role: "creator",
        stats: [
          { label: "Open opportunities", value: String(open.length), hint: "Live campaigns matched to you" },
          { label: "Active collaborations", value: String(active.length), hint: "Deals in progress" },
          { label: "Pitches sent", value: String((pitches ?? []).length) },
          { label: "Completed", value: String(completed.length), hint: "Builds your track record" },
        ],
        opportunities: open.slice(0, 5).map((m: any) => {
          const campaign = Array.isArray(m.campaigns) ? m.campaigns[0] : m.campaigns;
          return {
            id: m.id as string,
            title: (campaign?.title as string) ?? "Campaign",
            subtitle: `${m.fit} fit`,
            to: "/matches",
          };
        }),
        deals: dealCards,
      };
    }

    const [{ count: creators }, { count: brands }, { count: campaignCount }] = await Promise.all([
      supabase.from("creator_profiles").select("id", { count: "exact", head: true }),
      supabase.from("brand_profiles").select("id", { count: "exact", head: true }),
      supabase.from("campaigns").select("id", { count: "exact", head: true }),
    ]);
    return {
      role: "admin",
      stats: [
        { label: "Creators", value: String(creators ?? 0) },
        { label: "Brands", value: String(brands ?? 0) },
        { label: "Campaigns", value: String(campaignCount ?? 0) },
        { label: "Deals", value: String(deals.length) },
      ],
      opportunities: [],
      deals: dealCards,
    };
  });
