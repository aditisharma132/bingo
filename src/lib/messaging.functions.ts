import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_COUNTER_OFFERS } from "@/lib/agreement";

export type OfferRow = {
  id: string;
  created_by: string;
  author_role: "creator" | "brand" | "admin";
  compensation_type: "paid" | "barter" | "hybrid";
  amount_inr: number | null;
  deliverables: string[];
  timeline: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export type ThreadMessage = {
  id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  offer_id: string | null;
  created_at: string;
};

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      creatorId?: string | null;
      brandId?: string | null;
      targetUserId?: string | null;
      campaignId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getParty, notifyUsers, identitiesFor, ownerOfProfile, messagingAllowed } =
      await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);
    const myIdentity = (await identitiesFor(supabase, [userId])).get(userId);
    if (!myIdentity) throw new Error("Finish setting up your profile before starting a chat.");

    const target = await ownerOfProfile(supabase, {
      creatorId: data.creatorId ?? null,
      brandId: data.brandId ?? null,
      userId: data.targetUserId ?? null,
    });
    if (target.userId === userId) throw new Error("You can't message yourself.");

    const allowed = await messagingAllowed(target.userId, userId, myIdentity.kind);
    if (!allowed) throw new Error("This person isn't accepting messages from you right now.");

    const targetIdentity = (await identitiesFor(supabase, [target.userId])).get(target.userId);
    const pairIsBrandCreator = myIdentity.kind !== targetIdentity?.kind;

    const pairFilter = `and(party_a_user_id.eq.${userId},party_b_user_id.eq.${target.userId}),and(party_a_user_id.eq.${target.userId},party_b_user_id.eq.${userId})`;

    // Existing thread between the same two people (same campaign scope)? Always
    // reuse it so the chat history stays in one place.
    let query = supabase.from("conversations").select("id, status").or(pairFilter);
    query = data.campaignId
      ? query.eq("campaign_id", data.campaignId)
      : query.is("campaign_id", null);
    const { data: existingRows } = await query.order("created_at", { ascending: true }).limit(1);
    let existing = existingRows?.[0] ?? null;

    // Older threads may predate the party columns — match them on the profile pair
    // and backfill the parties so future lookups find them.
    if (!existing && pairIsBrandCreator) {
      const creatorProfileId =
        myIdentity.kind === "creator" ? myIdentity.creatorId : targetIdentity?.creatorId;
      const brandProfileId =
        myIdentity.kind === "brand" ? myIdentity.brandId : targetIdentity?.brandId;
      if (creatorProfileId && brandProfileId) {
        let legacy = supabase
          .from("conversations")
          .select("id, status")
          .eq("creator_id", creatorProfileId)
          .eq("brand_id", brandProfileId);
        legacy = data.campaignId
          ? legacy.eq("campaign_id", data.campaignId)
          : legacy.is("campaign_id", null);
        const { data: legacyRows } = await legacy.order("created_at", { ascending: true }).limit(1);
        existing = legacyRows?.[0] ?? null;
        if (existing) {
          await supabase
            .from("conversations")
            .update({ party_a_user_id: userId, party_b_user_id: target.userId })
            .eq("id", existing.id)
            .is("party_a_user_id", null);
        }
      }
    }

    if (existing)
      return { conversationId: existing.id as string, status: existing.status as string };

    // Brands can reach creators directly; everyone else sends a request first,
    // unless the two already have an accepted thread.
    const { data: priorAccepted } = await supabase
      .from("conversations")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(party_a_user_id.eq.${userId},party_b_user_id.eq.${target.userId}),and(party_a_user_id.eq.${target.userId},party_b_user_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();

    const autoAccept =
      Boolean(priorAccepted) || (myIdentity.kind === "brand" && targetIdentity?.kind === "creator");

    const creatorId = pairIsBrandCreator
      ? myIdentity.kind === "creator"
        ? myIdentity.creatorId
        : (targetIdentity?.creatorId ?? null)
      : null;
    const brandId = pairIsBrandCreator
      ? myIdentity.kind === "brand"
        ? myIdentity.brandId
        : (targetIdentity?.brandId ?? null)
      : null;

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        creator_id: creatorId,
        brand_id: brandId,
        party_a_user_id: userId,
        party_b_user_id: target.userId,
        requested_by: userId,
        status: autoAccept ? "accepted" : "pending",
        campaign_id: data.campaignId ?? null,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    await notifyUsers([target.userId], {
      kind: "message",
      title: autoAccept
        ? `${myIdentity.name} started a conversation`
        : `${myIdentity.name} wants to connect`,
      link: `/messages?c=${created.id}`,
    });

    return { conversationId: created.id as string, status: created.status as string };
  });

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getParty, identitiesFor } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);

    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, campaign_id, deal_id, last_message_at, status, requested_by, party_a_user_id, party_b_user_id, creator_id, brand_id, creator_profiles(user_id, display_name, avatar_url), brand_profiles(user_id, brand_name, logo_url), campaigns(title)",
      )
      .order("last_message_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const ids = rows.map((c: any) => c.id);
    const counterpartIds = rows.map((c: any) => {
      const creator = Array.isArray(c.creator_profiles)
        ? c.creator_profiles[0]
        : c.creator_profiles;
      const brand = Array.isArray(c.brand_profiles) ? c.brand_profiles[0] : c.brand_profiles;
      const a = c.party_a_user_id ?? brand?.user_id ?? null;
      const b = c.party_b_user_id ?? creator?.user_id ?? null;
      return userId === a ? b : a;
    });
    const identities = await identitiesFor(supabase, counterpartIds.filter(Boolean) as string[]);

    const [{ data: reads }, { data: msgs }] = await Promise.all([
      supabase
        .from("conversation_reads")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId),
      ids.length
        ? supabase
            .from("conversation_messages")
            .select("conversation_id, body, kind, created_at, sender_id")
            .in("conversation_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const readMap = new Map((reads ?? []).map((r: any) => [r.conversation_id, r.last_read_at]));

    return rows.map((c: any, index: number) => {
      const campaign = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
      const mine = (msgs ?? []).filter((m: any) => m.conversation_id === c.id);
      const last = mine[0] ?? null;
      const readAt = readMap.get(c.id) as string | undefined;
      const unread = mine.filter(
        (m: any) =>
          m.sender_id !== userId && (!readAt || new Date(m.created_at) > new Date(readAt)),
      ).length;
      const counterpartId = counterpartIds[index] ?? null;
      const identity = counterpartId ? identities.get(counterpartId) : undefined;
      const status = (c.status as string) ?? "accepted";
      return {
        id: c.id as string,
        campaign_id: c.campaign_id as string | null,
        campaign_title: (campaign?.title as string | undefined) ?? null,
        deal_id: c.deal_id as string | null,
        last_message_at: c.last_message_at as string,
        last_message: last
          ? last.kind === "offer"
            ? "Sent an offer"
            : last.kind === "campaign"
              ? "New campaign request"
              : last.kind === "attachment"
                ? "Shared a file"
                : last.kind === "agreement"
                  ? "Sent an agreement"
                  : (last.body as string)
          : null,
        unread,
        status,
        isRequest: status === "pending",
        iRequested: c.requested_by === userId,
        counterpart: {
          userId: counterpartId,
          kind: identity?.kind ?? null,
          name: identity?.name ?? "Member",
          image: identity?.avatar ?? null,
        },
        myRole: me.role,
      };
    });
  });

export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getParty, conversationUsers } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);
    const info = await conversationUsers(supabase, data.conversationId);
    const { conversation, creatorName, brandName } = info;

    const [{ data: messages }, { data: offers }] = await Promise.all([
      supabase
        .from("conversation_messages")
        .select("id, sender_id, kind, body, offer_id, created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("offers")
        .select(
          "id, created_by, author_role, compensation_type, amount_inr, deliverables, timeline, notes, status, created_at",
        )
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: true }),
    ]);

    let deal: any = null;
    let payment: any = null;
    if (conversation.deal_id) {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("id, state, compensation_type, agreed_amount_inr, payment_secured")
        .eq("id", conversation.deal_id)
        .maybeSingle();
      deal = dealRow ?? null;
      if (deal) {
        const { data: paymentRow } = await supabase
          .from("payments")
          .select("id, status, amount_inr, currency, released_at, funded_at, method")
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        payment = paymentRow ?? null;
      }
    }

    const counterpartId = info.otherUserId(userId);
    const status = (conversation.status as string) ?? "accepted";
    const dealCapable = Boolean(conversation.creator_id && conversation.brand_id);

    return {
      me: { userId, role: me.role },
      conversation: {
        id: conversation.id as string,
        campaign_id: conversation.campaign_id as string | null,
        creatorName,
        brandName,
        counterpartName: info.nameOf(counterpartId),
        counterpartUserId: counterpartId,
        counterpartKind: counterpartId ? (info.identities.get(counterpartId)?.kind ?? null) : null,
        status,
        isRequest: status === "pending",
        iRequested: conversation.requested_by === userId,
        dealCapable,
      },
      messages: (messages ?? []) as ThreadMessage[],
      offers: (offers ?? []) as OfferRow[],
      deal,
      payment,
    };
  });

export const respondToRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; action: "accept" | "decline" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { conversationUsers, notifyUsers } = await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const conversation = info.conversation;
    if (conversation.status !== "pending")
      throw new Error("This request has already been handled.");
    if (conversation.requested_by === userId)
      throw new Error("Only the person who received the request can respond.");

    const { error } = await supabase
      .from("conversations")
      .update({ status: data.action === "accept" ? "accepted" : "declined" })
      .eq("id", data.conversationId);
    if (error) throw new Error(error.message);

    if (data.action === "accept") {
      await notifyUsers([conversation.requested_by as string], {
        kind: "message",
        title: `${info.nameOf(userId)} accepted your message request`,
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; body: string }) => {
    const body = input.body.trim();
    if (!body) throw new Error("Write a message first.");
    if (body.length > 4000) throw new Error("Message is too long.");
    return { conversationId: input.conversationId, body };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const status = (info.conversation.status as string) ?? "accepted";
    if (status === "declined") throw new Error("This conversation was declined.");
    if (status === "pending" && info.conversation.requested_by !== userId) {
      throw new Error("Accept the request before replying.");
    }
    if (status === "pending" && info.conversation.requested_by === userId) {
      const { count } = await supabase
        .from("conversation_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", data.conversationId)
        .eq("sender_id", userId);
      if ((count ?? 0) >= 1)
        throw new Error("Wait for your request to be accepted before sending more.");
    }

    const { moderateText } = await import("@/lib/moderation.server");
    const moderation = await moderateText(data.body);
    if (moderation.flagged) {
      throw new Error(
        `Message blocked — ${moderation.reason || "it looks like it violates our guidelines"}.`,
      );
    }

    const { error } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        body: data.body,
        kind: "text",
      });
    if (error) throw new Error(error.message);
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    const recipient = info.otherUserId(userId);
    await notifyUsers(recipient ? [recipient] : [], {
      kind: "message",
      title: `New message from ${info.nameOf(userId)}`,
      body: data.body.slice(0, 120),
      link: `/messages?c=${data.conversationId}`,
    });

    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversation_reads")
      .upsert(
        {
          conversation_id: data.conversationId,
          user_id: context.userId,
          last_read_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      conversationId: string;
      compensationType: "paid" | "barter" | "hybrid";
      amount: number | null;
      deliverables: string[];
      timeline: string;
      notes: string;
      parentOfferId?: string | null;
    }) => {
      if (input.compensationType !== "barter" && (!input.amount || input.amount <= 0)) {
        throw new Error("Add an amount for a paid offer.");
      }
      const timeline = (input.timeline ?? "").trim();
      if (!timeline) throw new Error("Pick the date by which they should respond.");
      const due = new Date(`${timeline}T23:59:59`);
      if (Number.isNaN(due.getTime())) throw new Error("Pick a valid response date.");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) throw new Error("The response date can't be in the past.");
      return { ...input, timeline };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getParty, notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const me = await getParty(supabase, userId);
    const pre = await conversationUsers(supabase, data.conversationId);
    if (!pre.conversation.creator_id || !pre.conversation.brand_id) {
      throw new Error("Offers are only available in brand ↔ creator conversations.");
    }
    if ((pre.conversation.status as string) === "pending") {
      throw new Error("Accept the request before sending an offer.");
    }

    const { data: history, error: historyError } = await supabase
      .from("offers")
      .select("id, created_by, author_role, parent_offer_id, status, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (historyError) throw new Error(historyError.message);
    const offersSoFar = (history ?? []) as any[];

    if (me.role === "creator" && !offersSoFar.some((o) => o.author_role === "brand")) {
      throw new Error("Wait for the brand to send an offer — you can counter it after that.");
    }

    const counterCount = offersSoFar.filter((o) => o.parent_offer_id).length;
    if (data.parentOfferId && counterCount >= MAX_COUNTER_OFFERS) {
      throw new Error(
        `The counter-offer limit of ${MAX_COUNTER_OFFERS} has been reached for this collaboration.`,
      );
    }

    const latest = offersSoFar.at(-1);
    if (latest && latest.created_by === userId && latest.status === "pending") {
      throw new Error("Your offer is still open — wait for a response before sending another.");
    }

    // any previous pending offers are superseded
    await supabase
      .from("offers")
      .update({ status: "countered" })
      .eq("conversation_id", data.conversationId)
      .eq("status", "pending");

    const { data: offer, error } = await supabase
      .from("offers")
      .insert({
        conversation_id: data.conversationId,
        created_by: userId,
        author_role: me.role === "admin" ? "brand" : me.role,
        compensation_type: data.compensationType,
        amount_inr: data.amount,
        deliverables: data.deliverables.filter(Boolean),
        timeline: data.timeline || null,
        notes: data.notes || null,
        parent_offer_id: data.parentOfferId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "offer",
      offer_id: offer.id,
      body: null,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    const { creatorUserId, brandUserId, creatorName, brandName } = await conversationUsers(
      supabase,
      data.conversationId,
    );
    const recipient = userId === brandUserId ? creatorUserId : brandUserId;
    await notifyUsers([recipient], {
      kind: "offer",
      title: `New offer from ${userId === brandUserId ? brandName : creatorName}`,
      body: data.amount ? `₹${data.amount.toLocaleString("en-IN")}` : "Barter collaboration",
      link: `/messages?c=${data.conversationId}`,
    });

    return { offerId: offer.id as string };
  });

export const respondToOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { offerId: string; action: "accept" | "decline" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");

    const { data: offer, error } = await supabase
      .from("offers")
      .select("id, conversation_id, created_by, compensation_type, amount_inr, status, timeline")
      .eq("id", data.offerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offer) throw new Error("Offer not found.");
    if (offer.status === "countered") {
      throw new Error("A counter offer replaced this one — respond to the latest offer instead.");
    }
    if (offer.status !== "pending") throw new Error("This offer is no longer open.");
    if (offer.created_by === userId) throw new Error("You can't respond to your own offer.");

    // The offer can only be accepted inside the response window set by the sender.
    const deadline = (offer as any).timeline as string | null;
    if (deadline) {
      const due = new Date(`${deadline}T23:59:59`);
      if (!Number.isNaN(due.getTime()) && Date.now() > due.getTime()) {
        await supabase.from("offers").update({ status: "expired" }).eq("id", offer.id);
        throw new Error(`The response window closed on ${deadline} — ask for a fresh offer.`);
      }
    }

    const { conversation, creatorUserId, brandUserId } = await conversationUsers(
      supabase,
      offer.conversation_id,
    );

    if (data.action === "decline") {
      await supabase.from("offers").update({ status: "declined" }).eq("id", offer.id);
      await supabase.from("conversation_messages").insert({
        conversation_id: offer.conversation_id,
        sender_id: userId,
        kind: "system",
        body: "Offer declined.",
      });
      await notifyUsers([offer.created_by], {
        kind: "offer",
        title: "Your offer was declined",
        link: `/messages?c=${offer.conversation_id}`,
      });
      return { ok: true, dealId: null };
    }

    await supabase.from("offers").update({ status: "accepted" }).eq("id", offer.id);

    let dealId = conversation.deal_id as string | null;
    if (dealId) {
      await supabase
        .from("deals")
        .update({
          state: "ACCEPTED",
          compensation_type: offer.compensation_type,
          agreed_amount_inr: offer.amount_inr,
        })
        .eq("id", dealId);
    } else {
      const { data: deal, error: dealError } = await supabase
        .from("deals")
        .insert({
          campaign_id: conversation.campaign_id,
          creator_id: conversation.creator_id,
          brand_id: conversation.brand_id,
          state: "ACCEPTED",
          compensation_type: offer.compensation_type,
          agreed_amount_inr: offer.amount_inr,
        })
        .select("id")
        .single();
      if (dealError) throw new Error(dealError.message);
      dealId = deal.id as string;
      await supabase
        .from("conversations")
        .update({ deal_id: dealId })
        .eq("id", offer.conversation_id);
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: offer.conversation_id,
      sender_id: userId,
      kind: "system",
      body: "Offer accepted — terms are locked in.",
    });
    await notifyUsers([creatorUserId, brandUserId], {
      kind: "deal",
      title: "Terms accepted",
      body: offer.amount_inr
        ? `Agreed at ₹${Number(offer.amount_inr).toLocaleString("en-IN")}`
        : "Barter agreed",
      link: `/messages?c=${offer.conversation_id}`,
    });

    return { ok: true, dealId };
  });

export const fundDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const { conversation, brandUserId, creatorUserId } = await conversationUsers(
      supabase,
      data.conversationId,
    );
    if (userId !== brandUserId) throw new Error("Only the brand can fund this deal.");
    if (!conversation.deal_id) throw new Error("Agree on terms before funding.");

    const { data: deal } = await supabase
      .from("deals")
      .select("id, agreed_amount_inr, compensation_type")
      .eq("id", conversation.deal_id)
      .maybeSingle();
    if (!deal) throw new Error("Deal not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("deal_id", deal.id)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "secured", funded_at: now, amount_inr: deal.agreed_amount_inr ?? 0 })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("payments").insert({
        deal_id: deal.id,
        provider: "manual",
        method: "manual",
        amount_inr: deal.agreed_amount_inr ?? 0,
        currency: "INR",
        status: "secured",
        funded_at: now,
      });
    }
    await supabaseAdmin
      .from("deals")
      .update({ payment_secured: true, state: "CREATING" })
      .eq("id", deal.id);
    const { recordDealEvent } = await import("@/lib/deals.server");
    await recordDealEvent({
      dealId: deal.id,
      from: "ACCEPTED",
      to: "CREATING",
      actorId: userId,
      note: "Payment secured",
    });

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: "Payment secured — the creator can start.",
    });
    await notifyUsers([creatorUserId], {
      kind: "payment",
      title: "Payment secured",
      body: "The brand has funded this collaboration.",
      link: `/messages?c=${data.conversationId}`,
    });

    return { ok: true };
  });

export const releasePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const { conversation, brandUserId, creatorUserId } = await conversationUsers(
      supabase,
      data.conversationId,
    );
    if (userId !== brandUserId) throw new Error("Only the brand can release the payment.");
    if (!conversation.deal_id) throw new Error("No deal to release.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("deal_id", conversation.deal_id)
      .maybeSingle();
    if (!payment || payment.status !== "secured")
      throw new Error("Fund the deal before releasing payment.");

    // Release only after the agreement is fully executed by both parties.
    const { data: latestAgreement } = await supabase
      .from("conversation_messages")
      .select("created_at")
      .eq("conversation_id", data.conversationId)
      .eq("kind", "agreement")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestAgreement)
      throw new Error("Send and sign the agreement before releasing the payment.");
    const { data: afterAgreement } = await supabase
      .from("conversation_messages")
      .select("sender_id, body")
      .eq("conversation_id", data.conversationId)
      .eq("kind", "system")
      .gte("created_at", (latestAgreement as any).created_at);
    const signers = new Set(
      (afterAgreement ?? [])
        .filter((m: any) => (m.body ?? "").includes(CONTRACT_SIGNED_MARKER))
        .map((m: any) => m.sender_id as string),
    );
    if (signers.size < 2) {
      throw new Error("Both parties must sign the agreement before the payment can be released.");
    }

    await supabaseAdmin
      .from("payments")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", payment.id);
    await supabaseAdmin.from("deals").update({ state: "COMPLETED" }).eq("id", conversation.deal_id);

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: "Collaboration marked complete by the brand — the held payment has been released to the creator.",
    });
    await notifyUsers([creatorUserId], {
      kind: "payment",
      title: "You've been paid",
      body: "The brand released the payment for this collaboration.",
      link: `/messages?c=${data.conversationId}`,
    });

    return { ok: true };
  });

export type PeopleSearchResult = {
  id: string;
  kind: "creator" | "brand";
  name: string;
  headline: string | null;
  location: string | null;
  avatar: string | null;
  labels: string[];
  tags: string[];
};

export const SHORTLIST_MARKER = "Shortlisted by the brand";
export const CONTRACT_SENT_MARKER = "Contract sent for signature";
export const CONTRACT_SIGNED_MARKER = "Contract signed by";
export const CONTRACT_EXECUTED_MARKER = "Agreement fully executed";
export const BARTER_LOCK_MARKER = "Deal locked";

/* Brand-only: flag the creator as shortlisted inside the thread. */
export const shortlistInConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const { brandUserId, creatorUserId, brandName } = await conversationUsers(
      supabase,
      data.conversationId,
    );
    if (userId !== brandUserId) throw new Error("Only the brand can shortlist a creator.");

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: `${SHORTLIST_MARKER}${brandName ? ` (${brandName})` : ""} — negotiation is open.`,
    });
    if (creatorUserId) {
      await notifyUsers([creatorUserId], {
        kind: "deal",
        title: "You've been shortlisted",
        body: brandName
          ? `${brandName} shortlisted you for a collaboration.`
          : "A brand shortlisted you.",
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true };
  });

/* Barter / UGC deals have nothing to pay, so either party can lock them in. */
export const lockBarterDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const { conversation, brandUserId, creatorUserId } = info;
    if (userId !== brandUserId && userId !== creatorUserId) {
      throw new Error("Only the brand or the creator can lock this deal.");
    }
    if (!conversation.deal_id) throw new Error("Agree on terms before locking the deal.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("deals").update({ state: "CREATING" }).eq("id", conversation.deal_id);
    const { recordDealEvent } = await import("@/lib/deals.server");
    await recordDealEvent({
      dealId: conversation.deal_id as string,
      from: "ACCEPTED",
      to: "CREATING",
      actorId: userId,
      note: "Barter deal locked",
    });

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: `${BARTER_LOCK_MARKER} — terms confirmed by ${info.nameOf(userId)}, the creator can start.`,
    });
    const other = info.otherUserId(userId);
    if (other) {
      await notifyUsers([other], {
        kind: "deal",
        title: "Deal locked",
        body: "The barter terms are confirmed — creation can start.",
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true };
  });

/* Draft the agreement text: default template, or AI-written when guidelines are given. */
export const generateAgreementDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; guidelines?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { conversationUsers } = await import("@/lib/messaging.server");
    const { defaultAgreementText } = await import("@/lib/agreement");
    const info = await conversationUsers(supabase, data.conversationId);
    if (userId !== info.brandUserId && userId !== info.creatorUserId) {
      throw new Error("Only the parties in this thread can draft the agreement.");
    }

    let deal: any = null;
    if (info.conversation.deal_id) {
      const { data: dealRow } = await supabase
        .from("deals")
        .select("compensation_type, agreed_amount_inr")
        .eq("id", info.conversation.deal_id)
        .maybeSingle();
      deal = dealRow ?? null;
    }
    const { data: acceptedOffer } = await supabase
      .from("offers")
      .select("deliverables, timeline, notes, amount_inr, compensation_type")
      .eq("conversation_id", data.conversationId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const base = {
      brandName: info.brandName,
      creatorName: info.creatorName,
      compensationType: (deal?.compensation_type ??
        acceptedOffer?.compensation_type ??
        "paid") as string,
      amountInr: (deal?.agreed_amount_inr ?? acceptedOffer?.amount_inr ?? null) as number | null,
      deliverables: (acceptedOffer?.deliverables ?? []) as string[],
      timeline: (acceptedOffer?.timeline ?? null) as string | null,
    };
    const fallback = defaultAgreementText(base);

    const guidelines = (data.guidelines ?? "").trim();
    // No custom instructions → always the default template.
    if (!guidelines) return { text: fallback, source: "default" as const };

    try {
      const { generateJson } = await import("@/lib/ai.server");
      const { data: out } = await generateJson<{ text: string }>({
        system:
          "You draft short, plain-English influencer collaboration agreements for an Indian creator marketplace. Keep numbered clauses, no markdown, no legal boilerplate padding. Always cover compensation, deliverables, timeline, usage rights, disclosure, cancellation and digital signatures.",
        prompt: [
          `Brand: ${base.brandName}`,
          `Creator: ${base.creatorName}`,
          `Compensation: ${base.compensationType}${base.amountInr ? ` ₹${base.amountInr}` : ""}`,
          `Deliverables: ${base.deliverables.join("; ") || "as agreed in thread"}`,
          `Timeline: ${base.timeline ?? "as agreed in thread"}`,
          `Brand's custom guidelines: ${guidelines}`,
          "",
          "Base structure to follow:",
          fallback,
        ].join("\n"),
        schemaName: "agreement",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: { text: { type: "string" } },
        },
      });
      return { text: (out.text ?? "").trim() || fallback, source: "ai" as const };
    } catch {
      return { text: fallback, source: "default" as const };
    }
  });

/* Either party can send the formal agreement into the thread; the other signs it back.
 * The sender may also adjust the compensation terms before the agreement is sent. */
export const sendContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      conversationId: string;
      text?: string | null;
      filePath?: string | null;
      fileName?: string | null;
      source?: "default" | "ai" | "upload";
      compensationType?: "paid" | "barter" | "hybrid";
      amountInr?: number | null;
      fullName: string;
      place: string;
      date?: string | null;
    }) => {
      const fullName = (input.fullName ?? "").trim();
      const place = (input.place ?? "").trim();
      if (fullName.length < 3) throw new Error("Enter your full legal name to sign.");
      if (!place) throw new Error("Enter the place where you're signing.");
      if (!input.filePath && !(input.text ?? "").trim()) {
        throw new Error("Upload a PDF or generate the agreement text first.");
      }
      if (
        input.compensationType &&
        !["paid", "barter", "hybrid"].includes(input.compensationType)
      ) {
        throw new Error("Invalid compensation type.");
      }
      return { ...input, fullName, place };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUsers, conversationUsers, signatureLine } =
      await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const { conversation } = info;
    if (userId !== info.brandUserId && userId !== info.creatorUserId) {
      throw new Error("Only the brand or the creator can send the agreement.");
    }
    if (!conversation.deal_id) throw new Error("Agree on terms before sending the agreement.");

    const role = userId === info.brandUserId ? "Brand" : "Creator";

    // Update the deal's compensation terms if the sender edited them before sending.
    const updateDeal: {
      compensation_type?: "paid" | "barter" | "hybrid";
      agreed_amount_inr?: number | null;
    } = {};
    if (data.compensationType) {
      updateDeal.compensation_type = data.compensationType;
      updateDeal.agreed_amount_inr =
        data.compensationType === "barter" ? null : (data.amountInr ?? null);
    } else if (typeof data.amountInr === "number" && data.amountInr >= 0) {
      updateDeal.agreed_amount_inr = data.amountInr;
    }
    if (Object.keys(updateDeal).length) {
      await supabaseAdmin.from("deals").update(updateDeal).eq("id", conversation.deal_id);
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: `${CONTRACT_SENT_MARKER} — review the agreement below, then sign it.`,
    });
    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "agreement",
      body: JSON.stringify({
        source: data.source ?? (data.filePath ? "upload" : "default"),
        title: "Collaboration agreement",
        text: data.filePath ? null : (data.text ?? "").trim(),
        path: data.filePath ?? null,
        fileName: data.fileName ?? null,
        compensationType: data.compensationType ?? null,
        amountInr: data.amountInr ?? null,
      }),
    });
    // The sender digitally signs on dispatch, so the other side receives a pre-signed copy.
    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: signatureLine(data.fullName, role, userId, data.conversationId, {
        place: data.place,
        date: data.date ?? null,
      }),
    });

    const other = info.otherUserId(userId);
    if (other) {
      await notifyUsers([other], {
        kind: "deal",
        title: "Agreement ready to sign",
        body: "A digitally signed agreement arrived — countersign to execute it.",
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true };
  });

export const signContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; fullName: string; place: string; date?: string | null }) => {
      const fullName = (input.fullName ?? "").trim();
      const place = (input.place ?? "").trim();
      if (fullName.length < 3) throw new Error("Enter your full legal name to sign.");
      if (!place) throw new Error("Enter the place where you're signing.");
      return { ...input, fullName, place };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const { signatureLine } = await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const other = info.otherUserId(userId);
    const role = userId === info.brandUserId ? "Brand" : "Creator";

    // Only signatures posted after the most recent agreement count — a new contract resets signing.
    const { data: latestAgreement } = await supabase
      .from("conversation_messages")
      .select("created_at")
      .eq("conversation_id", data.conversationId)
      .eq("kind", "agreement")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latestAgreement) throw new Error("There's no agreement to sign yet.");

    const { data: existing } = await supabase
      .from("conversation_messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", data.conversationId)
      .eq("kind", "system")
      .gte("created_at", (latestAgreement as any).created_at);
    const signatureRows = (existing ?? []).filter((m: any) =>
      (m.body ?? "").includes(CONTRACT_SIGNED_MARKER),
    );
    if (signatureRows.some((m: any) => m.sender_id === userId)) {
      throw new Error("You have already signed this agreement.");
    }

    await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "system",
      body: signatureLine(data.fullName, role, userId, data.conversationId, {
        place: data.place,
        date: data.date ?? null,
      }),
    });

    const bothSigned = signatureRows.length >= 1;
    if (bothSigned) {
      await supabase.from("conversation_messages").insert({
        conversation_id: data.conversationId,
        sender_id: userId,
        kind: "system",
        body: `${CONTRACT_EXECUTED_MARKER} — both parties have digitally signed. Each side holds an identical copy.`,
      });
    }

    const recipients = bothSigned
      ? ([info.creatorUserId, info.brandUserId].filter(Boolean) as string[])
      : ((other ? [other] : []) as string[]);
    if (recipients.length) {
      await notifyUsers(recipients, {
        kind: "deal",
        title: bothSigned ? "Agreement fully executed" : "Agreement signed",
        body: bothSigned
          ? "Both parties signed — the countersigned copy is in your thread."
          : `${data.fullName} signed the agreement.`,
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true, executed: bothSigned };
  });

/* Images, files and short media (max 5 MB) shared inside a thread. */
export const sendAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { conversationId: string; path: string; name: string; mime: string; size: number }) => {
      if (!input.path) throw new Error("Upload failed — try again.");
      if (input.size > 5 * 1024 * 1024) throw new Error("Attachments must be under 5 MB.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { notifyUsers, conversationUsers } = await import("@/lib/messaging.server");
    const info = await conversationUsers(supabase, data.conversationId);
    const status = (info.conversation.status as string) ?? "accepted";
    if (status === "declined") throw new Error("This conversation was declined.");
    if (status === "pending" && info.conversation.requested_by !== userId) {
      throw new Error("Accept the request before replying.");
    }

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: data.conversationId,
      sender_id: userId,
      kind: "attachment",
      body: JSON.stringify({ path: data.path, name: data.name, mime: data.mime, size: data.size }),
    });
    if (error) throw new Error(error.message);
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    const other = info.otherUserId(userId);
    if (other) {
      await notifyUsers([other], {
        kind: "message",
        title: `${info.nameOf(userId)} shared a file`,
        body: data.name,
        link: `/messages?c=${data.conversationId}`,
      });
    }
    return { ok: true };
  });

/** Search creators and brands by name, tags, location, craft or category — used to start new chats. */
export const searchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      q?: string;
      kind?: "all" | "creator" | "brand";
      location?: string;
      creatorTypes?: string[];
      categories?: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const kind = data.kind ?? "all";
    const q = (data.q ?? "").trim().toLowerCase();
    const wantTypes = (data.creatorTypes ?? []).map((t) => t.toLowerCase());
    const wantCats = (data.categories ?? []).map((c) => c.toLowerCase());
    const loc = (data.location ?? "").trim().toLowerCase();

    const [creatorsRes, brandsRes, tagsRes] = await Promise.all([
      kind === "brand"
        ? Promise.resolve({ data: [] as any[] })
        : context.supabase
            .from("creator_profiles")
            .select("id, display_name, headline, location, avatar_url, creator_types, categories")
            .eq("is_public", true)
            .limit(200),
      kind === "creator"
        ? Promise.resolve({ data: [] as any[] })
        : context.supabase
            .from("brand_profiles")
            .select("id, brand_name, industry, logo_url, campaign_categories")
            .eq("is_public", true)
            .limit(200),
      context.supabase
        .from("entity_tags")
        .select("entity_id, entity_type, tags(label)")
        .limit(1000),
    ]);

    const tagMap = new Map<string, string[]>();
    for (const row of (tagsRes.data ?? []) as any[]) {
      const label = row.tags?.label;
      if (!label) continue;
      const key = `${row.entity_type}:${row.entity_id}`;
      tagMap.set(key, [...(tagMap.get(key) ?? []), label]);
    }

    const rows: PeopleSearchResult[] = [
      ...((creatorsRes.data ?? []) as any[]).map((c) => ({
        id: c.id as string,
        kind: "creator" as const,
        name: c.display_name as string,
        headline: (c.headline ?? null) as string | null,
        location: (c.location ?? null) as string | null,
        avatar: (c.avatar_url ?? null) as string | null,
        labels: [...((c.creator_types ?? []) as string[]), ...((c.categories ?? []) as string[])],
        tags: tagMap.get(`creator:${c.id}`) ?? [],
      })),
      ...((brandsRes.data ?? []) as any[]).map((b) => ({
        id: b.id as string,
        kind: "brand" as const,
        name: b.brand_name as string,
        headline: (b.industry ?? null) as string | null,
        location: null,
        avatar: (b.logo_url ?? null) as string | null,
        labels: (b.campaign_categories ?? []) as string[],
        tags: tagMap.get(`brand:${b.id}`) ?? [],
      })),
    ];

    return rows
      .filter((row) => {
        const haystack = [
          row.name,
          row.headline ?? "",
          row.location ?? "",
          ...row.labels,
          ...row.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (q && !haystack.includes(q)) return false;
        if (loc && !(row.location ?? "").toLowerCase().includes(loc)) return false;
        const lowered = [...row.labels, ...row.tags].map((l) => l.toLowerCase());
        if (wantTypes.length && !wantTypes.some((t) => lowered.includes(t))) return false;
        if (wantCats.length && !wantCats.some((c) => lowered.includes(c))) return false;
        return true;
      })
      .slice(0, 40);
  });

export const getMessagingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { identitiesFor } = await import("@/lib/messaging.server");
    const [{ data: prefs }, { data: blocks }] = await Promise.all([
      supabase
        .from("messaging_preferences")
        .select("allow_creator_requests, allow_brand_requests")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_blocks")
        .select("id, blocked_user_id, created_at")
        .eq("blocker_user_id", userId),
    ]);

    const identities = await identitiesFor(
      supabase,
      (blocks ?? []).map((b: any) => b.blocked_user_id as string),
    );

    return {
      preferences: {
        allowCreatorRequests: prefs?.allow_creator_requests ?? true,
        allowBrandRequests: prefs?.allow_brand_requests ?? true,
      },
      blocked: (blocks ?? []).map((b: any) => ({
        id: b.id as string,
        userId: b.blocked_user_id as string,
        name: identities.get(b.blocked_user_id)?.name ?? "Member",
        kind: identities.get(b.blocked_user_id)?.kind ?? null,
      })),
    };
  });

export const updateMessagingPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { allowCreatorRequests: boolean; allowBrandRequests: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messaging_preferences").upsert(
      {
        user_id: context.userId,
        allow_creator_requests: data.allowCreatorRequests,
        allow_brand_requests: data.allowBrandRequests,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string }) => input)
  .handler(async ({ data, context }) => {
    if (data.targetUserId === context.userId) throw new Error("You can't block yourself.");
    const { error } = await context.supabase
      .from("user_blocks")
      .upsert(
        { blocker_user_id: context.userId, blocked_user_id: data.targetUserId },
        { onConflict: "blocker_user_id,blocked_user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUserId: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", context.userId)
      .eq("blocked_user_id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
