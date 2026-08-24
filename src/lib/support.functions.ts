import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMySupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [tickets, disputes, deals] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("id, subject, body, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("disputes")
        .select("id, reason, details, status, resolution, created_at, deal_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("deals")
        .select("id, state, campaigns(title), brand_profiles(brand_name), creator_profiles(display_name)")
        .order("updated_at", { ascending: false }),
    ]);

    return {
      tickets: tickets.data ?? [],
      disputes: disputes.data ?? [],
      deals: (deals.data ?? []).map((d: any) => {
        const campaign = Array.isArray(d.campaigns) ? d.campaigns[0] : d.campaigns;
        const brand = Array.isArray(d.brand_profiles) ? d.brand_profiles[0] : d.brand_profiles;
        const creator = Array.isArray(d.creator_profiles) ? d.creator_profiles[0] : d.creator_profiles;
        return {
          id: d.id as string,
          label: `${campaign?.title ?? "Direct collaboration"} — ${brand?.brand_name ?? "Brand"} × ${creator?.display_name ?? "Creator"}`,
        };
      }),
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subject: string; body: string }) => {
    if (input.subject.trim().length < 4) throw new Error("Add a short subject.");
    if (input.body.trim().length < 10) throw new Error("Tell us a bit more so we can help.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      subject: data.subject.trim(),
      body: data.body.trim(),
      status: "open",
    });
    if (error) throw new Error(error.message);

    const { sendEmail, notifyAdmins } = await import("@/lib/notify.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (me?.email) {
      await sendEmail({
        to: me.email,
        subject: "We've got your support request",
        html: `<p>Thanks for reaching out. Our team will reply about “${data.subject.trim()}” shortly.</p>`,
      });
    }
    await notifyAdmins({
      kind: "support_ticket",
      title: `New support ticket: ${data.subject.trim()}`,
      body: `${me?.email ?? "A user"} wrote: ${data.body.trim()}`,
      link: "/admin",
    });
    return { ok: true };
  });

export const raiseDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string; reason: string; details: string }) => {
    if (!input.dealId) throw new Error("Pick the collaboration this is about.");
    if (input.reason.trim().length < 3) throw new Error("Choose a reason.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: deal } = await supabase.from("deals").select("id").eq("id", data.dealId).maybeSingle();
    if (!deal) throw new Error("You're not part of that collaboration.");

    const { error } = await supabase.from("disputes").insert({
      deal_id: data.dealId,
      raised_by: userId,
      reason: data.reason.trim(),
      details: data.details.trim() || null,
      status: "open",
    });
    if (error) throw new Error(error.message);

    const { notifyDealParties, notifyAdmins } = await import("@/lib/notify.server");
    await notifyDealParties(data.dealId, {
      kind: "dispute",
      title: "A dispute was raised",
      body: `Reason: ${data.reason.trim()}. Our team will review and get in touch.`,
      link: `/deals/${data.dealId}`,
    });
    await notifyAdmins({
      kind: "dispute",
      title: `New dispute: ${data.reason.trim()}`,
      body: data.details.trim() || "No further details provided.",
      link: `/admin`,
    });
    return { ok: true };
  });
