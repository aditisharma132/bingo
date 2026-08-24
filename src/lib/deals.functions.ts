import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDeals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getParty } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);

    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, state, compensation_type, agreed_amount_inr, payment_secured, updated_at, creator_profiles(display_name, avatar_url), brand_profiles(brand_name, logo_url), campaigns(title)",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((d: any) => {
      const creator = Array.isArray(d.creator_profiles) ? d.creator_profiles[0] : d.creator_profiles;
      const brand = Array.isArray(d.brand_profiles) ? d.brand_profiles[0] : d.brand_profiles;
      const campaign = Array.isArray(d.campaigns) ? d.campaigns[0] : d.campaigns;
      return {
        id: d.id as string,
        state: d.state as string,
        compensation_type: d.compensation_type as string,
        agreed_amount_inr: d.agreed_amount_inr as number | null,
        payment_secured: Boolean(d.payment_secured),
        updated_at: d.updated_at as string,
        campaign_title: (campaign?.title as string | undefined) ?? null,
        counterpart:
          me.role === "brand" ? (creator?.display_name ?? "Creator") : (brand?.brand_name ?? "Brand"),
        myRole: me.role,
      };
    });
  });

export const getDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getDealParty, allowedTransitions } = await import("@/lib/deals.server");
    const party = await getDealParty(supabase, data.dealId, userId);
    const deal = party.deal;

    const [{ data: submissions }, { data: events }, { data: feedback }, { data: payment }, { data: convo }] =
      await Promise.all([
        supabase
          .from("content_submissions")
          .select("id, url, kind, note, status, brand_feedback, created_at")
          .eq("deal_id", data.dealId)
          .order("created_at", { ascending: false }),
        supabase
          .from("deal_events")
          .select("id, from_state, to_state, note, created_at")
          .eq("deal_id", data.dealId)
          .order("created_at", { ascending: true }),
        supabase
          .from("feedback")
          .select("id, author_id, author_role, ratings, overall, decision, note, created_at")
          .eq("deal_id", data.dealId),
        supabase
          .from("payments")
          .select("id, status, amount_inr, currency, funded_at, released_at, method")
          .eq("deal_id", data.dealId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("conversations").select("id").eq("deal_id", data.dealId).maybeSingle(),
      ]);

    const isBarter = deal.compensation_type === "barter";
    const actions = party.actor
      ? allowedTransitions(deal.state, party.actor, Boolean(deal.payment_secured), isBarter)
      : [];

    const creator = Array.isArray(deal.creator_profiles) ? deal.creator_profiles[0] : deal.creator_profiles;
    const brand = Array.isArray(deal.brand_profiles) ? deal.brand_profiles[0] : deal.brand_profiles;
    const campaign = Array.isArray(deal.campaigns) ? deal.campaigns[0] : deal.campaigns;

    return {
      me: { userId, actor: party.actor },
      deal: {
        id: deal.id as string,
        state: deal.state as string,
        compensation_type: deal.compensation_type as string,
        agreed_amount_inr: deal.agreed_amount_inr as number | null,
        barter_details: deal.barter_details as string | null,
        payment_secured: Boolean(deal.payment_secured),
        campaign_title: (campaign?.title as string | undefined) ?? null,
        creatorName: party.creatorName,
        brandName: party.brandName,
        creatorAvatar: (creator?.avatar_url as string | null) ?? null,
        brandLogo: (brand?.logo_url as string | null) ?? null,
      },
      submissions: submissions ?? [],
      events: events ?? [],
      feedback: feedback ?? [],
      payment: payment ?? null,
      conversationId: (convo?.id as string | undefined) ?? null,
      actions: actions.map((a) => ({ to: a.to, label: a.label })),
      myFeedbackGiven: (feedback ?? []).some((f: any) => f.author_id === userId),
    };
  });

export const transitionDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string; to: string; note?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getDealParty, allowedTransitions, recordDealEvent } = await import("@/lib/deals.server");
    const { notifyUsers } = await import("@/lib/messaging.server");
    const party = await getDealParty(supabase, data.dealId, userId);
    if (!party.actor) throw new Error("Only the creator or brand can move this collaboration.");

    const deal = party.deal;
    const isBarter = deal.compensation_type === "barter";
    const allowed = allowedTransitions(deal.state, party.actor, Boolean(deal.payment_secured), isBarter);
    const move = allowed.find((a) => a.to === data.to);
    if (!move) {
      throw new Error(
        deal.state === "ACCEPTED" && data.to === "CREATING"
          ? "Secure the payment before creation can start."
          : "That step isn't available at this stage.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("deals").update({ state: move.to }).eq("id", deal.id);
    if (error) throw new Error(error.message);

    await recordDealEvent({
      dealId: deal.id,
      from: deal.state,
      to: move.to,
      actorId: userId,
      note: data.note ?? null,
    });
    await notifyUsers([party.creatorUserId, party.brandUserId].filter((u) => u !== userId), {
      kind: "deal",
      title: `Collaboration moved to ${move.to.toLowerCase()}`,
      body: data.note ?? null,
      link: `/deals/${deal.id}`,
    });

    return { ok: true, state: move.to };
  });

export const submitContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dealId: string; url: string; kind: string; note?: string }) => {
    const url = input.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) throw new Error("Add a valid link starting with http.");
    return { dealId: input.dealId, url, kind: input.kind, note: (input.note ?? "").trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getDealParty, recordDealEvent } = await import("@/lib/deals.server");
    const { notifyUsers } = await import("@/lib/messaging.server");
    const party = await getDealParty(supabase, data.dealId, userId);
    if (party.actor !== "creator") throw new Error("Only the creator can submit content.");
    if (!["CREATING", "REVIEW"].includes(party.deal.state)) {
      throw new Error("Content can be submitted once creation has started.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("content_submissions").insert({
      deal_id: data.dealId,
      creator_id: party.deal.creator_id,
      url: data.url,
      kind: data.kind,
      note: data.note || null,
      status: "submitted",
    });
    if (error) throw new Error(error.message);

    if (party.deal.state !== "REVIEW") {
      await supabaseAdmin.from("deals").update({ state: "REVIEW" }).eq("id", data.dealId);
      await recordDealEvent({
        dealId: data.dealId,
        from: party.deal.state,
        to: "REVIEW",
        actorId: userId,
        note: "Content submitted for review",
      });
    }

    await notifyUsers([party.brandUserId], {
      kind: "deal",
      title: `${party.creatorName} submitted content`,
      body: "Review it and approve or request changes.",
      link: `/deals/${data.dealId}`,
    });

    return { ok: true };
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { submissionId: string; action: "approve" | "changes"; feedback?: string }) => {
    if (input.action === "changes" && !(input.feedback ?? "").trim()) {
      throw new Error("Tell the creator what to change.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getDealParty, recordDealEvent } = await import("@/lib/deals.server");
    const { notifyUsers } = await import("@/lib/messaging.server");

    const { data: submission, error: subError } = await supabase
      .from("content_submissions")
      .select("id, deal_id, status")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (subError) throw new Error(subError.message);
    if (!submission) throw new Error("Submission not found.");

    const party = await getDealParty(supabase, submission.deal_id, userId);
    if (party.actor !== "brand") throw new Error("Only the brand can review submitted content.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "changes") {
      await supabaseAdmin
        .from("content_submissions")
        .update({ status: "changes_requested", brand_feedback: (data.feedback ?? "").trim() })
        .eq("id", submission.id);
      await supabaseAdmin.from("deals").update({ state: "CREATING" }).eq("id", submission.deal_id);
      await recordDealEvent({
        dealId: submission.deal_id,
        from: party.deal.state,
        to: "CREATING",
        actorId: userId,
        note: "Changes requested",
      });
      await notifyUsers([party.creatorUserId], {
        kind: "deal",
        title: `${party.brandName} requested changes`,
        body: (data.feedback ?? "").slice(0, 120),
        link: `/deals/${submission.deal_id}`,
      });
      return { ok: true, state: "CREATING" };
    }

    await supabaseAdmin
      .from("content_submissions")
      .update({ status: "approved", brand_feedback: (data.feedback ?? "").trim() || null })
      .eq("id", submission.id);

    // Release any secured payment on approval.
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("deal_id", submission.deal_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (payment && payment.status === "secured") {
      await supabaseAdmin
        .from("payments")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("id", payment.id);
    }

    await supabaseAdmin.from("deals").update({ state: "COMPLETED" }).eq("id", submission.deal_id);
    await recordDealEvent({
      dealId: submission.deal_id,
      from: party.deal.state,
      to: "COMPLETED",
      actorId: userId,
      note: "Content approved",
    });
    await notifyUsers([party.creatorUserId, party.brandUserId], {
      kind: "deal",
      title: "Collaboration completed",
      body: "Share feedback to strengthen future matches.",
      link: `/deals/${submission.deal_id}`,
    });

    return { ok: true, state: "COMPLETED" };
  });

export const submitDealFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      dealId: string;
      ratings: Record<string, number>;
      overall: number;
      decision: string;
      note?: string;
    }) => {
      if (!input.overall || input.overall < 1 || input.overall > 5) throw new Error("Give an overall rating.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getDealParty } = await import("@/lib/deals.server");
    const party = await getDealParty(supabase, data.dealId, userId);
    if (!party.actor) throw new Error("Only the creator or brand can leave feedback.");
    if (party.deal.state !== "COMPLETED") throw new Error("Feedback opens once the collaboration is complete.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("feedback")
      .select("id")
      .eq("deal_id", data.dealId)
      .eq("author_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You've already shared feedback for this collaboration.");

    const { error } = await supabaseAdmin.from("feedback").insert({
      deal_id: data.dealId,
      author_id: userId,
      author_role: party.actor,
      ratings: data.ratings,
      overall: data.overall,
      decision: data.decision,
      reasons: [],
      note: (data.note ?? "").trim() || null,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
