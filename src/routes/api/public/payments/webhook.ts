import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/** Stripe webhook. Inactive until STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are configured. */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!webhookSecret) return new Response("Payments provider not configured", { status: 503 });

        const raw = await request.text();
        const header = request.headers.get("stripe-signature") ?? "";
        const parts = Object.fromEntries(
          header.split(",").map((piece) => piece.split("=").map((s) => s.trim()) as [string, string]),
        );
        const timestamp = parts["t"];
        const provided = parts["v1"];
        if (!timestamp || !provided) return new Response("Invalid signature", { status: 401 });

        const expected = createHmac("sha256", webhookSecret).update(`${timestamp}.${raw}`).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { logPaymentEvent, markPaymentSecured } = await import("@/lib/payments.server");
        const object = event?.data?.object ?? {};
        const paymentId: string | null = object?.metadata?.payment_id ?? null;

        await logPaymentEvent({
          paymentId,
          provider: "stripe",
          eventType: String(event?.type ?? "unknown"),
          providerEventId: event?.id ?? null,
          payload: event,
        });

        try {
          if (event?.type === "checkout.session.completed" && paymentId) {
            await markPaymentSecured(paymentId, null);
          }
          if (event?.type === "checkout.session.expired" && paymentId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", paymentId);
          }
        } catch (error) {
          console.error("webhook handling failed", error);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
