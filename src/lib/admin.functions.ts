import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [creators, brands, campaigns, deals, tickets, disputes, verifications, roles] = await Promise.all([
      supabaseAdmin
        .from("creator_profiles")
        .select("id, display_name, location, creator_types, categories, verification, onboarding_completed, is_seed, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("brand_profiles")
        .select("id, brand_name, industry, verification, onboarding_completed, is_seed, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("campaigns")
        .select("id, title, status, compensation_type, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("deals").select("id, state, created_at").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin
        .from("support_tickets")
        .select("id, subject, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("disputes")
        .select("id, reason, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin
        .from("verification_records")
        .select("id, subject_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabaseAdmin.from("user_roles").select("role"),
    ]);

    const [payments, allDeals] = await Promise.all([
      supabaseAdmin.from("payments").select("id, amount_inr, status, provider, created_at"),
      supabaseAdmin.from("deals").select("id, state, agreed_amount_inr"),
    ]);
    const paymentRows = (payments.data ?? []) as any[];
    const dealRows = (allDeals.data ?? []) as any[];
    const sum = (rows: any[]) => rows.reduce((acc, r) => acc + (r.amount_inr ?? 0), 0);
    const finance = {
      escrowHeld: sum(paymentRows.filter((p) => p.status === "secured")),
      released: sum(paymentRows.filter((p) => p.status === "released")),
      pending: sum(paymentRows.filter((p) => p.status === "pending")),
      gmv: dealRows.filter((d) => d.state === "COMPLETED").reduce((a, d) => a + (d.agreed_amount_inr ?? 0), 0),
      paymentsCount: paymentRows.length,
      provider: paymentRows[0]?.provider ?? (process.env["STRIPE_SECRET_KEY"] ? "stripe" : "mock"),
      dealFunnel: ["DISCOVERED", "IN_CONVERSATION", "NEGOTIATING", "AGREED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "CANCELLED"].map(
        (state) => ({ state, count: dealRows.filter((d) => d.state === state).length }),
      ),
    };

    const roleCounts = (roles.data ?? []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.role] = (acc[row.role] ?? 0) + 1;
      return acc;
    }, {});

    return {
      metrics: {
        creators: creators.data?.length ?? 0,
        brands: brands.data?.length ?? 0,
        campaigns: campaigns.data?.length ?? 0,
        published: (campaigns.data ?? []).filter((c: any) => c.status === "published").length,
        deals: deals.data?.length ?? 0,
        finance,
        roleCounts,
      },
      creators: creators.data ?? [],
      brands: brands.data ?? [],
      campaigns: campaigns.data ?? [],
      tickets: tickets.data ?? [],
      disputes: disputes.data ?? [],
      verifications: verifications.data ?? [],
    };
  });

export const setVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: "creator" | "brand"; id: string; status: "approved" | "rejected" | "pending" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.subject === "creator" ? "creator_profiles" : "brand_profiles";
    const { error } = await supabaseAdmin.from(table).update({ verification: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveSupportItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "ticket" | "dispute"; id: string; status: string; resolution?: string | undefined }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.kind === "ticket") {
      const { error } = await supabaseAdmin
        .from("support_tickets")
        .update({ status: data.status })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("disputes")
        .update({ status: data.status, resolution: data.resolution ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
