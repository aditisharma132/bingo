import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startDealCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase
      .from("deals")
      .select("id, state, agreed_amount_inr, compensation_type, brand_profiles(user_id, brand_name), campaigns(title)")
      .eq("id", data.dealId)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found.");
    const brand: any = Array.isArray(deal.brand_profiles) ? deal.brand_profiles[0] : deal.brand_profiles;
    if (brand?.user_id !== userId) throw new Error("Only the brand can fund this collaboration.");
    if (deal.compensation_type === "barter") throw new Error("Barter collaborations don't need funding.");
    const amount = deal.agreed_amount_inr ?? 0;
    if (amount <= 0) throw new Error("Agree on an amount before funding.");

    const campaign: any = Array.isArray(deal.campaigns) ? deal.campaigns[0] : deal.campaigns;
    const { createCheckout } = await import("@/lib/payments.server");
    return createCheckout({
      dealId: deal.id,
      amountInr: amount,
      label: `Bingo collaboration — ${campaign?.title ?? brand?.brand_name ?? "campaign"}`,
      origin: data.origin,
    });
  });

/** Test-mode confirmation used while no live payment keys are configured. */
export const confirmMockPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, provider, deal_id, amount_inr, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Payment not found.");
    if (payment.provider !== "mock" && payment.provider !== "manual") {
      throw new Error("This payment must be completed with the payment provider.");
    }

    const { data: deal } = await supabase
      .from("deals")
      .select("id, brand_profiles(user_id)")
      .eq("id", payment.deal_id)
      .maybeSingle();
    const brand: any = Array.isArray(deal?.brand_profiles) ? deal?.brand_profiles[0] : deal?.brand_profiles;
    if (!deal || brand?.user_id !== userId) throw new Error("Only the brand can complete this payment.");

    const { markPaymentSecured, logPaymentEvent } = await import("@/lib/payments.server");
    await logPaymentEvent({
      paymentId: payment.id,
      provider: "mock",
      eventType: "checkout.completed",
      payload: { amount_inr: payment.amount_inr, confirmed_by: userId },
    });
    return markPaymentSecured(payment.id, userId);
  });

export const getPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, deal_id, amount_inr, currency, status, provider")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new Error("Payment not found.");

    // RLS check: only deal parties can read the deal, so this fails for others.
    const { data: deal } = await supabase
      .from("deals")
      .select("id, creator_profiles(display_name), campaigns(title)")
      .eq("id", payment.deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Not allowed.");
    const creator: any = Array.isArray(deal.creator_profiles) ? deal.creator_profiles[0] : deal.creator_profiles;
    const campaign: any = Array.isArray(deal.campaigns) ? deal.campaigns[0] : deal.campaigns;

    return {
      ...payment,
      creatorName: (creator?.display_name as string) ?? "Creator",
      campaignTitle: (campaign?.title as string) ?? "Direct collaboration",
    };
  });

export const releaseDealPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase
      .from("deals")
      .select("id, brand_profiles(user_id)")
      .eq("id", data.dealId)
      .maybeSingle();
    const brand: any = Array.isArray(deal?.brand_profiles) ? deal?.brand_profiles[0] : deal?.brand_profiles;
    if (!deal || brand?.user_id !== userId) throw new Error("Only the brand can release the payment.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("deal_id", data.dealId)
      .eq("status", "secured")
      .maybeSingle();
    if (!payment) throw new Error("No secured payment for this collaboration.");
    const { markPaymentReleased } = await import("@/lib/payments.server");
    return markPaymentReleased(payment.id);
  });
