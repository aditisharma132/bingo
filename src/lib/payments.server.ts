/* Server-only payment helpers.
 *
 * Provider strategy:
 *  - When STRIPE_SECRET_KEY is configured we create a real Stripe Checkout
 *    session and rely on the webhook at /api/public/payments/webhook.
 *  - Otherwise we fall back to a "mock" provider: a payment row is created in
 *    `pending` and the brand confirms it on an in-app test checkout page.
 * Both paths converge on markPaymentSecured / markPaymentReleased, so swapping
 * in real keys later needs no changes anywhere else in the app.
 */

export type ProviderName = "stripe" | "mock";

export function activeProvider(): ProviderName {
  return process.env["STRIPE_SECRET_KEY"] ? "stripe" : "mock";
}

export type CheckoutInput = {
  dealId: string;
  amountInr: number;
  label: string;
  origin: string;
};

export async function createCheckout(input: CheckoutInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const provider = activeProvider();

  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, status")
    .eq("deal_id", input.dealId)
    .maybeSingle();

  if (existing && (existing.status === "secured" || existing.status === "released")) {
    return { alreadyPaid: true as const, paymentId: existing.id, url: null, provider };
  }

  let paymentId = existing?.id as string | undefined;
  if (!paymentId) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        deal_id: input.dealId,
        provider,
        method: provider === "stripe" ? "card" : "test",
        amount_inr: input.amountInr,
        currency: "INR",
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    paymentId = data.id;
  } else {
    await supabaseAdmin
      .from("payments")
      .update({ provider, amount_inr: input.amountInr, status: "pending" })
      .eq("id", paymentId);
  }

  if (provider === "mock") {
    return {
      alreadyPaid: false as const,
      paymentId: paymentId!,
      url: `/checkout/${paymentId}`,
      provider,
    };
  }

  const secret = process.env["STRIPE_SECRET_KEY"]!;
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "inr",
    "line_items[0][price_data][unit_amount]": String(Math.round(input.amountInr * 100)),
    "line_items[0][price_data][product_data][name]": input.label.slice(0, 120),
    success_url: `${input.origin}/deals/${input.dealId}?paid=1`,
    cancel_url: `${input.origin}/deals/${input.dealId}?cancelled=1`,
    "metadata[payment_id]": paymentId!,
    "metadata[deal_id]": input.dealId,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("stripe checkout failed", detail);
    throw new Error("Could not start checkout. Please try again.");
  }
  const session = (await res.json()) as { id: string; url: string; payment_intent?: string };
  await supabaseAdmin
    .from("payments")
    .update({ provider_session_id: session.id, provider_payment_intent: session.payment_intent ?? null })
    .eq("id", paymentId!);

  return { alreadyPaid: false as const, paymentId: paymentId!, url: session.url, provider };
}

export async function markPaymentSecured(paymentId: string, actorId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, deal_id, status, amount_inr")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.status === "secured" || payment.status === "released") return { ok: true, dealId: payment.deal_id };

  const now = new Date().toISOString();
  await supabaseAdmin.from("payments").update({ status: "secured", funded_at: now }).eq("id", payment.id);
  await supabaseAdmin
    .from("deals")
    .update({ payment_secured: true, state: "CREATING" })
    .eq("id", payment.deal_id);

  const { recordDealEvent } = await import("@/lib/deals.server");
  await recordDealEvent({
    dealId: payment.deal_id,
    from: "ACCEPTED",
    to: "CREATING",
    actorId,
    note: "Payment secured in escrow",
  });

  const { notifyDealParties } = await import("@/lib/notify.server");
  await notifyDealParties(payment.deal_id, {
    kind: "payment",
    title: "Payment secured",
    body: "Funds are held safely. The creator can start producing.",
    link: `/deals/${payment.deal_id}`,
  });

  return { ok: true, dealId: payment.deal_id as string };
}

export async function markPaymentReleased(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, deal_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) throw new Error("Payment not found.");
  if (payment.status !== "secured") throw new Error("Only secured payments can be released.");

  await supabaseAdmin
    .from("payments")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", payment.id);

  const { notifyDealParties } = await import("@/lib/notify.server");
  await notifyDealParties(payment.deal_id, {
    kind: "payment",
    title: "Payment released",
    body: "The escrowed amount has been released to the creator.",
    link: `/deals/${payment.deal_id}`,
  });

  return { ok: true, dealId: payment.deal_id as string };
}

export async function logPaymentEvent(input: {
  paymentId: string | null;
  provider: string;
  eventType: string;
  providerEventId?: string | null;
  payload: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("payment_events").insert({
    payment_id: input.paymentId,
    provider: input.provider,
    event_type: input.eventType,
    provider_event_id: input.providerEventId ?? null,
    payload: input.payload as never,
  });
}
