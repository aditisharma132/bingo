import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Platform-wide trends: what brands are briefing for and what creators supply. */
export const getTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: myCreator } = await context.supabase
      .from("creator_profiles")
      .select("categories, creator_types")
      .eq("user_id", context.userId)
      .maybeSingle();
    const myLabels = [
      ...((myCreator?.categories ?? []) as string[]),
      ...((myCreator?.creator_types ?? []) as string[]),
    ].map((l) => l.toLowerCase());
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

    const [campaigns, briefs, creators, deals, matches] = await Promise.all([
      supabaseAdmin.from("campaigns").select("id, compensation_type, budget_min, budget_max, status, created_at"),
      supabaseAdmin.from("campaign_briefs").select("data, created_at"),
      supabaseAdmin.from("creator_profiles").select("categories, creator_types, starting_price_inr, is_public"),
      supabaseAdmin.from("deals").select("state, agreed_amount_inr, created_at"),
      supabaseAdmin.from("matches").select("fit"),
    ]);

    const tally = (rows: string[]) => {
      const counts = new Map<string, number>();
      for (const raw of rows) {
        const key = raw?.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    const briefRows = (briefs.data ?? []) as any[];
    const demandCategories = tally(briefRows.flatMap((b) => (b.data?.categories ?? []) as string[]));
    const demandTypes = tally(briefRows.flatMap((b) => (b.data?.creator_types ?? []) as string[]));
    const demandDeliverables = tally(briefRows.flatMap((b) => (b.data?.deliverables ?? []) as string[]));

    const creatorRows = (creators.data ?? []) as any[];
    const supplyCategories = tally(creatorRows.flatMap((c) => (c.categories ?? []) as string[]));
    const supplyTypes = tally(creatorRows.flatMap((c) => (c.creator_types ?? []) as string[]));

    const supplyMap = new Map(supplyCategories.map((row) => [row.label.toLowerCase(), row.count]));
    const gaps = demandCategories
      .map((row) => ({ ...row, supply: supplyMap.get(row.label.toLowerCase()) ?? 0 }))
      .filter((row) => row.supply < row.count)
      .slice(0, 6);

    const prices = creatorRows
      .map((c) => c.starting_price_inr as number | null)
      .filter((n): n is number => typeof n === "number" && n > 0)
      .sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)]! : null;

    const budgets = (campaigns.data ?? [])
      .map((c: any) => c.budget_max as number | null)
      .filter((n): n is number => typeof n === "number" && n > 0);
    const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : null;

    const dealRows = (deals.data ?? []) as any[];
    const completed = dealRows.filter((d) => d.state === "COMPLETED");
    const gmv = completed.reduce((sum, d) => sum + (d.agreed_amount_inr ?? 0), 0);
    const matchRows = (matches.data ?? []) as any[];

    const mine = (rows: { label: string; count: number }[]) =>
      myLabels.length ? rows.filter((r) => myLabels.includes(r.label.toLowerCase())) : [];

    return {
      myLabels,
      forMe: {
        demandCategories: mine(demandCategories),
        demandTypes: mine(demandTypes),
        supplyCategories: mine(supplyCategories),
        gaps: gaps.filter((g) => myLabels.includes(g.label.toLowerCase())),
      },
      headline: {
        campaigns30d: (campaigns.data ?? []).filter((c: any) => c.created_at >= since).length,
        liveCampaigns: (campaigns.data ?? []).filter((c: any) => c.status === "published").length,
        creators: creatorRows.length,
        completedDeals: completed.length,
        gmv,
        medianStartingPrice: median,
        avgCampaignBudget: avgBudget,
        strongMatchRate: matchRows.length
          ? Math.round((matchRows.filter((m) => m.fit === "strong").length / matchRows.length) * 100)
          : 0,
      },
      demandCategories,
      demandTypes,
      demandDeliverables,
      supplyCategories,
      supplyTypes,
      gaps,
      compensationMix: ["paid", "barter", "hybrid"].map((type) => ({
        label: type,
        count: (campaigns.data ?? []).filter((c: any) => c.compensation_type === type).length,
      })),
    };
  });
