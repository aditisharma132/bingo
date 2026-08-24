import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";

import {
  BadgeIndianRupee,
  CalendarIcon,
  Download,
  FileSignature,
  HandCoins,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { PeopleSearch } from "@/components/people-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { transitionDeal } from "@/lib/deals.functions";
import { type AgreementDoc, type Attachment, defaultAgreementText, MAX_COUNTER_OFFERS, safeParse } from "@/lib/agreement";
import { uploadMedia, useMediaUrl } from "@/lib/media";
import { downloadTextPdf } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import {
  blockUser,
  fundDeal,
  generateAgreementDraft,
  getThread,
  listConversations,
  markConversationRead,
  type OfferRow,
  releasePayment,
  respondToOffer,
  respondToRequest,
  sendAttachment,
  sendContract,
  sendMessage,
  sendOffer,
  shortlistInConversation,
  signContract,
  lockBarterDeal,
} from "@/lib/messaging.functions";
import { respondToCampaignInvite } from "@/lib/campaigns.functions";

type CampaignInviteCard = {
  inviteId?: string;
  campaignId: string;
  title: string;
  objective?: string | null;
  deliverables?: string[];
  categories?: string[];
  compensationType?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
};


/** Response deadline presets for offers. */
const DEADLINE_PRESETS: { label: string; days: number }[] = [
  { label: "EOD", days: 0 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** An offer can only be accepted on or before the response date set by the sender. */
function isPastDeadline(timeline: string | null | undefined) {
  if (!timeline) return false;
  const due = new Date(`${timeline}T23:59:59`);
  if (Number.isNaN(due.getTime())) return false;
  return Date.now() > due.getTime();
}






export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (search: Record<string, unknown>) => ({ c: (search["c"] as string) || undefined }),
  head: () => ({
    meta: [
      { title: "Messages | Bingo" },
      { name: "description", content: "Chat with brands and creators, negotiate terms and secure payments in one thread." },
      { property: "og:title", content: "Messages | Bingo" },
      { property: "og:description", content: "Chat with brands and creators, negotiate terms and secure payments in one thread." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

const money = (value: number | null | undefined) =>
  typeof value === "number" ? `₹${value.toLocaleString("en-IN")}` : "—";

function MessagesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const authed = !!session?.access_token;

  const fetchConversations = useServerFn(listConversations);
  const fetchThread = useServerFn(getThread);
  const send = useServerFn(sendMessage);
  const markRead = useServerFn(markConversationRead);

  const activeId = search.c ?? null;

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations({ data: undefined }),
    enabled: authed,
    retry: false,
    refetchInterval: authed ? 8000 : false,
  });

  const thread = useQuery({
    queryKey: ["thread", activeId],
    queryFn: () => fetchThread({ data: { conversationId: activeId as string } }),
    enabled: authed && !!activeId,
    retry: false,
    refetchInterval: authed ? 5000 : false,
  });

  useEffect(() => {
    if (authLoading || authed) return;
    void navigate({ to: "/login" });
  }, [authLoading, authed, navigate]);

  useEffect(() => {
    if (!activeId || !authed) return;
    void markRead({ data: { conversationId: activeId } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => {});
  }, [activeId, authed, markRead, queryClient]);


  const [draft, setDraft] = useState("");
  const sendMutation = useMutation({
    mutationFn: () => send({ data: { conversationId: activeId as string, body: draft } }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["thread", activeId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = conversations.data ?? [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Collaborate"
          title="Messages"
          subtitle="Talk it through, send a structured offer, agree on terms and secure the payment — all in one thread."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <Panel className="p-0">
            <PeopleSearch />
            {conversations.isLoading ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No conversations yet"
                  description="Open a creator or brand profile and hit Message to start talking."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/messages", search: { c: c.id } })}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/60",
                        activeId === c.id && "bg-muted",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-brand font-display text-sm font-bold text-primary-foreground">
                        {c.counterpart.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold">{c.counterpart.name}</span>
                          {c.isRequest ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              {c.iRequested ? "Sent" : "Request"}
                            </span>
                          ) : null}
                          {c.unread > 0 ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                              {c.unread}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {c.campaign_title ? `${c.campaign_title} · ` : ""}
                          {c.last_message ?? "No messages yet"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {!activeId ? (
            <Panel className="grid min-h-[420px] place-items-center text-center">
              <div>
                <MessageSquare className="mx-auto size-8 text-primary" />
                <p className="mt-3 font-display text-lg font-semibold">Pick a conversation</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your negotiations, agreed terms and payment status live inside each thread.
                </p>
              </div>
            </Panel>
          ) : thread.isLoading ? (
            <Panel className="grid min-h-[420px] place-items-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </Panel>
          ) : thread.error ? (
            <Panel>
              <EmptyState title="Couldn't load this thread" description={(thread.error as Error).message} />
            </Panel>
          ) : (
            <div className="space-y-6">
              <ThreadPanel
                data={thread.data!}
                conversationId={activeId}
                draft={draft}
                setDraft={setDraft}
                onSend={() => sendMutation.mutate()}
                sending={sendMutation.isPending}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ThreadPanel({
  data,
  conversationId,
  draft,
  setDraft,
  onSend,
  sending,
}: {
  data: Awaited<ReturnType<typeof getThread>>;
  conversationId: string;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const queryClient = useQueryClient();
  const offerFn = useServerFn(sendOffer);
  const respondFn = useServerFn(respondToOffer);
  const fundFn = useServerFn(fundDeal);
  const releaseFn = useServerFn(releasePayment);
  const respondRequestFn = useServerFn(respondToRequest);
  const blockFn = useServerFn(blockUser);

  const respondRequest = useMutation({
    mutationFn: (action: "accept" | "decline") => respondRequestFn({ data: { conversationId, action } }),
    onSuccess: (_r, action) => {
      toast.success(action === "accept" ? "Request accepted" : "Request declined");
      queryClient.invalidateQueries({ queryKey: ["thread", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: () => blockFn({ data: { targetUserId: data.conversation.counterpartUserId! } }),
    onSuccess: () => {
      toast.success("Blocked");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const [showOffer, setShowOffer] = useState(false);
  const [amount, setAmount] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [timeline, setTimeline] = useState(() => addDaysISO(7));
  const [notes, setNotes] = useState("");
  const [compensationType, setCompensationType] = useState<"paid" | "barter" | "hybrid">("paid");
  const [parentOfferId, setParentOfferId] = useState<string | null>(null);
  const [showAgreement, setShowAgreement] = useState(false);
  const [counterTarget, setCounterTarget] = useState<OfferRow | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const todayISO = addDaysISO(0);


  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["thread", conversationId] });
    void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const offerMutation = useMutation({
    mutationFn: () =>
      offerFn({
        data: {
          conversationId,
          compensationType,
          amount: amount ? Number(amount) : null,
          deliverables: deliverables.split("\n").map((d) => d.trim()).filter(Boolean),
          timeline,
          notes,
          parentOfferId,
        },
      }),
    onSuccess: () => {
      toast.success(parentOfferId ? "Counter offer sent" : "Offer sent");
      setShowOffer(false);
      setParentOfferId(null);
      setAmount("");
      setDeliverables("");
      setTimeline("");
      setNotes("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respondMutation = useMutation({
    mutationFn: (input: { offerId: string; action: "accept" | "decline" }) => respondFn({ data: input }),
    onSuccess: (_r, input) => {
      toast.success(input.action === "accept" ? "Terms accepted" : "Offer declined");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fundMutation = useMutation({
    mutationFn: () => fundFn({ data: { conversationId } }),
    onSuccess: () => {
      toast.success("Payment secured");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseFn({ data: { conversationId } }),
    onSuccess: () => {
      toast.success("Payment released");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shortlistFn = useServerFn(shortlistInConversation);
  const lockFn = useServerFn(lockBarterDeal);
  const signFn = useServerFn(signContract);
  const attachFn = useServerFn(sendAttachment);
  const transitionFn = useServerFn(transitionDeal);

  const closeMutation = useMutation({
    mutationFn: (dealId: string) => transitionFn({ data: { dealId, to: "COMPLETED" } }),
    onSuccess: () => {
      toast.success("Deal closed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const shortlistMutation = useMutation({
    mutationFn: () => shortlistFn({ data: { conversationId } }),
    onSuccess: () => {
      toast.success("Creator shortlisted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockFn({ data: { conversationId } }),
    onSuccess: () => {
      toast.success("Deal locked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signMutation = useMutation({
    mutationFn: (values: { fullName: string; place: string; date: string }) =>
      signFn({ data: { conversationId, ...values } }),
    onSuccess: () => {
      toast.success("Agreement signed and returned");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaignInviteFn = useServerFn(respondToCampaignInvite);
  const campaignInviteMutation = useMutation({
    mutationFn: (v: { campaignId: string; inviteId: string | null; action: "accept" | "decline" }) =>
      campaignInviteFn({ data: { conversationId, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "accept" ? "Campaign request accepted" : "Campaign request declined");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offerById = new Map(data.offers.map((o) => [o.id, o]));
  const isBrand = data.me.role === "brand";
  const systemBodies = data.messages.filter((m) => m.kind === "system").map((m) => m.body ?? "");
  const respondedCampaigns = new Set(
    systemBodies.flatMap((b) => {
      const m = /\(ref:([0-9a-f-]+)\)/i.exec(b);
      return m ? [m[1]] : [];
    }),
  );

  const isShortlisted = systemBodies.some((b) => b.includes("Shortlisted by the brand"));
  // Only the newest agreement stays pinned; earlier ones remain visible in the chat history.
  const latestAgreementIdx = data.messages.reduce(
    (acc, m, i) => (m.kind === "agreement" ? i : acc),
    -1,
  );
  const contractSent = latestAgreementIdx >= 0;
  const agreementDoc = safeParse<AgreementDoc>(
    latestAgreementIdx >= 0 ? (data.messages[latestAgreementIdx]?.body ?? null) : null,
  );
  const signatureMsgs = data.messages
    .slice(latestAgreementIdx + 1)
    .filter((m) => m.kind === "system" && (m.body ?? "").includes("Contract signed by"));
  const signatures = signatureMsgs.map((m) => m.body ?? "");
  const iSigned = signatureMsgs.some((m) => m.sender_id === data.me.userId);
  const fullyExecuted = signatureMsgs.length >= 2;
  const isBarter = data.deal?.compensation_type === "barter";
  const brandHasOffered = data.offers.some((o) => o.author_role === "brand");
  const counterCount = data.offers.filter((o: any) => o.parent_offer_id).length;
  const countersLeft = Math.max(0, MAX_COUNTER_OFFERS - counterCount);
  const latestOffer = data.offers.at(-1);
  const myOfferPending = Boolean(latestOffer && latestOffer.created_by === data.me.userId && latestOffer.status === "pending");
  const canOffer = (isBrand || brandHasOffered) && !myOfferPending && (!latestOffer || countersLeft > 0 || isBrand);
  const offerLabel = isBrand && !latestOffer ? "Send offer" : parentOfferId ? "Counter offer" : isBrand ? "Send offer" : "Counter offer";
  const paymentStatus = data.payment?.status ?? (data.deal ? "awaiting" : null);
  const dealState = data.deal?.state ?? null;
  const dealClosed = dealState === "COMPLETED" || dealState === "CANCELLED";
  const dealLocked =
    paymentStatus === "secured" || paymentStatus === "released" || dealState === "CREATING";
  const canCloseDeal = isBrand && !dealClosed && Boolean(data.deal) && (dealLocked || fullyExecuted);


  return (
    <>
      <Panel className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="font-display text-lg font-semibold">{data.conversation.counterpartName}</p>
            <p className="text-xs text-muted-foreground">
              {data.deal ? `Deal · ${data.deal.state}` : "No agreed terms yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isShortlisted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Star className="size-3" /> Shortlisted
              </span>
            ) : null}
            {isBrand && data.conversation.dealCapable && !data.conversation.isRequest && !isShortlisted ? (
              <Button size="sm" variant="outline" disabled={shortlistMutation.isPending} onClick={() => shortlistMutation.mutate()}>
                <Star className="mr-1 size-4" /> Shortlist creator
              </Button>
            ) : null}
            {data.conversation.dealCapable && !data.conversation.isRequest && canOffer ? (
              <Button size="sm" variant="outline" onClick={() => setShowOffer((v) => !v)}>
                <HandCoins className="mr-1 size-4" /> {showOffer ? "Cancel" : offerLabel}
              </Button>
            ) : null}
          </div>
        </div>

        {data.conversation.isRequest ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/50 px-5 py-3">
            <p className="text-sm text-muted-foreground">
              {data.conversation.iRequested
                ? "Message request sent — you can keep chatting once it's accepted."
                : `${data.conversation.counterpartName} wants to connect with you.`}
            </p>
            {!data.conversation.iRequested ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={respondRequest.isPending} onClick={() => respondRequest.mutate("accept")}>
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={respondRequest.isPending}
                  onClick={() => respondRequest.mutate("decline")}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={block.isPending || !data.conversation.counterpartUserId}
                  onClick={() => block.mutate()}
                >
                  Block
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}


        <div className="max-h-[460px] space-y-4 overflow-y-auto px-5 py-5">
          {data.messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Say hello and share what you have in mind.
            </p>
          ) : null}
          {data.messages.map((m) => {
            const mine = m.sender_id === data.me.userId;
            if (m.kind === "system") {
              return (
                <p key={m.id} className="text-center text-xs uppercase tracking-widest text-muted-foreground">
                  {(m.body ?? "").replace(/\s*\(ref:[0-9a-f-]+\)/i, "")}
                </p>
              );
            }
            if (m.kind === "campaign") {
              const c = safeParse<CampaignInviteCard>(m.body);
              if (!c) return null;
              const answered = respondedCampaigns.has(c.inviteId ?? c.campaignId);
              const canAnswer = !isBrand && !answered;
              return (
                <div key={m.id} className={cn("max-w-md rounded-2xl border border-primary/40 bg-primary/5 p-4", mine ? "ml-auto" : "")}>
                  <p className="font-display text-sm font-bold text-primary">New campaign request</p>
                  <p className="mt-1 text-lg font-bold">{c.title}</p>
                  {c.objective ? <p className="mt-1 text-sm text-muted-foreground">{c.objective}</p> : null}
                  {c.deliverables?.length ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      {c.deliverables.slice(0, 5).map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-sm">
                    {c.compensationType === "barter"
                      ? "Barter"
                      : c.budgetMax
                        ? `Budget up to ${money(c.budgetMax)}`
                        : (c.compensationType ?? "")}
                  </p>
                  {c.categories?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">{c.categories.slice(0, 4).join(" · ")}</p>
                  ) : null}
                  {canAnswer ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                        disabled={campaignInviteMutation.isPending}
                        onClick={() => campaignInviteMutation.mutate({ campaignId: c.campaignId, inviteId: c.inviteId ?? null, action: "accept" })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={campaignInviteMutation.isPending}
                        onClick={() => campaignInviteMutation.mutate({ campaignId: c.campaignId, inviteId: c.inviteId ?? null, action: "decline" })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {answered ? "Response recorded — see the update below." : "Awaiting the creator's response."}
                    </p>
                  )}
                </div>
              );
            }

            if (m.kind === "offer" && m.offer_id) {
              const offer = offerById.get(m.offer_id);
              if (!offer) return null;
              const expired = isPastDeadline(offer.timeline);
              const canRespond =
                offer.status === "pending" && offer.created_by !== data.me.userId && !expired;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-md rounded-2xl border border-primary/40 bg-primary/5 p-4",
                    mine ? "ml-auto" : "",
                  )}
                >
                  <p className="font-display text-sm font-bold text-primary">
                    {offer.status === "countered"
                      ? "Offer · replaced by a counter offer"
                      : offer.status === "pending"
                        ? expired
                          ? "Offer · response window closed"
                          : "Offer"
                        : `Offer · ${offer.status}`}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {offer.compensation_type === "barter" ? "Barter" : money(offer.amount_inr)}
                  </p>
                  {offer.deliverables.length ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      {offer.deliverables.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                  {offer.timeline ? <p className="mt-2 text-sm">Respond by: {offer.timeline}</p> : null}
                  {offer.notes ? <p className="mt-1 text-sm text-muted-foreground">{offer.notes}</p> : null}
                  {offer.status === "pending" && expired ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      This offer could only be signed on or before {offer.timeline}. Ask for a fresh offer.
                    </p>
                  ) : null}
                  {canRespond ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                        disabled={respondMutation.isPending}
                        onClick={() => respondMutation.mutate({ offerId: offer.id, action: "accept" })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={respondMutation.isPending}
                        onClick={() => respondMutation.mutate({ offerId: offer.id, action: "decline" })}
                      >
                        Decline
                      </Button>
                      {countersLeft > 0 ? (
                        <Button size="sm" variant="ghost" onClick={() => setCounterTarget(offer)}>
                          Counter
                        </Button>
                      ) : null}

                    </div>
                  ) : null}
                </div>
              );
            }
            if (m.kind === "attachment") {
              const att = safeParse<Attachment>(m.body);
              if (!att) return null;
              return <AttachmentBubble key={m.id} attachment={att} mine={mine} />;
            }
            if (m.kind === "agreement") {
              return (
                <p key={m.id} className="text-center text-xs uppercase tracking-widest text-muted-foreground">
                  Agreement shared — see the collaboration agreement below
                </p>
              );
            }
            return (
              <div
                key={m.id}
                className={cn(
                  "max-w-md rounded-2xl px-4 py-2.5 text-sm",
                  mine ? "ml-auto bg-gradient-brand text-primary-foreground" : "bg-muted",
                )}
              >
                {m.body}
              </div>
            );
          })}

        </div>

        {showOffer ? (
          <div className="space-y-4 border-t border-border bg-muted/30 px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Compensation</Label>
                <div className="flex gap-2">
                  {(["paid", "barter", "hybrid"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCompensationType(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm capitalize",
                        compensationType === t
                          ? "border-transparent bg-gradient-brand text-primary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-amount">Amount (INR)</Label>
                <Input
                  id="offer-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="25000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-deliverables">Deliverables (one per line)</Label>
              <Textarea
                id="offer-deliverables"
                rows={3}
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                placeholder={"2 Instagram reels\n4 photos for paid usage"}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="offer-timeline">Respond by *</Label>
                <Input
                  id="offer-timeline"
                  type="date"
                  min={todayISO}
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {DEADLINE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setTimeline(addDaysISO(p.days))}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        timeline === addDaysISO(p.days)
                          ? "border-transparent bg-gradient-brand text-primary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer-notes">Notes</Label>
                <Input
                  id="offer-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Usage rights, revisions…"
                />
              </div>
            </div>
            {parentOfferId ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Sending this counter voids the previous offer — it can no longer be accepted by either side.
              </p>
            ) : null}
            <Button
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
              disabled={offerMutation.isPending}
              onClick={() => offerMutation.mutate()}
            >
              {offerMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              {offerLabel}
            </Button>
          </div>
        ) : null}

        <form
          className="flex items-center gap-2 border-t border-border px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) onSend();
          }}
        >
          <input
            id="chat-attachment"
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("Attachments must be under 5 MB.");
                return;
              }
              setUploadingFile(true);
              try {
                const path = await uploadMedia(file, "chat");
                await attachFn({
                  data: { conversationId, path, name: file.name, mime: file.type || "application/octet-stream", size: file.size },
                });
                refresh();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setUploadingFile(false);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={uploadingFile}
            title="Attach an image, file or short media (max 5 MB)"
            onClick={() => document.getElementById("chat-attachment")?.click()}
          >
            {uploadingFile ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          </Button>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" />
          <Button type="submit" disabled={sending || !draft.trim()} size="icon" className="bg-gradient-brand text-primary-foreground">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>

      </Panel>

      {data.deal ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.2em] text-primary">
                {data.deal.compensation_type === "barter" ? "Lock deal" : "Payment"}
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.deal.compensation_type === "barter"
                  ? "Barter / UGC"
                  : data.deal.compensation_type === "hybrid"
                    ? `${money(data.deal.agreed_amount_inr)} + Barter`
                    : money(data.deal.agreed_amount_inr)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.deal.compensation_type === "barter"
                  ? data.deal.state === "ACCEPTED"
                    ? "Terms agreed — the brand confirms to lock this deal."
                    : "Deal locked — the creator can start."
                  : paymentStatus === "released"
                    ? "Released to the creator"
                    : paymentStatus === "secured"
                      ? "On hold — released when the brand marks the collaboration completed"
                      : "Awaiting funding from the brand"}
              </p>
            </div>
            {isBrand ? (
              <div className="flex flex-wrap gap-2">
                {isBarter ? (
                  data.deal.state === "ACCEPTED" ? (
                    <Button
                      className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                      disabled={lockMutation.isPending}
                      onClick={() => lockMutation.mutate()}
                    >
                      <ShieldCheck className="mr-1 size-4" /> Confirm & lock deal
                    </Button>
                  ) : null
                ) : (
                  <>
                    {paymentStatus !== "secured" && paymentStatus !== "released" ? (
                      <Button
                        className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                        disabled={fundMutation.isPending}
                        onClick={() => fundMutation.mutate()}
                      >
                        <BadgeIndianRupee className="mr-1 size-4" /> Pay & lock deal
                      </Button>
                    ) : null}
                    {paymentStatus === "secured" ? (
                      fullyExecuted ? (
                        <Button
                          className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                          disabled={releaseMutation.isPending}
                          onClick={() => releaseMutation.mutate()}
                        >
                          <ShieldCheck className="mr-1 size-4" /> Collaboration completed — release payment
                        </Button>
                      ) : (
                        <span className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                          Held in escrow — both sides must sign the agreement first
                        </span>
                      )
                    ) : null}
                  </>
                )}
                {dealClosed ? null : (
                  <Button variant="outline" onClick={() => setShowAgreement((v) => !v)}>
                    <FileSignature className="mr-1 size-4" />{" "}
                    {showAgreement ? "Cancel agreement" : contractSent ? "Send new agreement" : "Send agreement"}
                  </Button>
                )}
                {canCloseDeal ? (
                  <Button
                    variant="outline"
                    disabled={closeMutation.isPending}
                    onClick={() => data.deal && closeMutation.mutate(data.deal.id)}
                  >
                    <ShieldCheck className="mr-1 size-4" /> Close deal
                  </Button>
                ) : null}
              </div>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                {isBarter
                  ? data.deal.state === "ACCEPTED"
                    ? "Waiting for the brand to lock it"
                    : "Deal locked"
                  : paymentStatus === "released"
                    ? "Paid"
                    : paymentStatus === "secured"
                      ? "Financially secured"
                      : "Not funded yet"}
              </span>
            )}
          </div>

          {showAgreement ? (
            <AgreementComposer
              conversationId={conversationId}
              deal={data.deal}
              brandName={data.conversation.brandName}
              creatorName={data.conversation.creatorName}
              onSent={() => {
                setShowAgreement(false);
                void refresh();
              }}
            />
          ) : null}

          {contractSent && !showAgreement ? (
            <ContractCard
              deal={data.deal}
              doc={agreementDoc}
              brandName={data.conversation.brandName}
              creatorName={data.conversation.creatorName}
              signatures={signatures}
              iSigned={iSigned}
              fullyExecuted={fullyExecuted}
              onSign={(values) => signMutation.mutate(values)}
              signing={signMutation.isPending}
            />
          ) : null}

        </Panel>
      ) : null}

      <AlertDialog open={Boolean(counterTarget)} onOpenChange={(o) => !o && setCounterTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Counter offer voids the current one</AlertDialogTitle>
            <AlertDialogDescription>
              Once you send a counter, the offer of{" "}
              {counterTarget?.compensation_type === "barter"
                ? "barter terms"
                : money(counterTarget?.amount_inr ?? null)}{" "}
              can no longer be accepted by either side. Only the newest offer stays open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the current offer</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const offer = counterTarget;
                if (!offer) return;
                setParentOfferId(offer.id);
                setCompensationType(offer.compensation_type as "paid" | "barter" | "hybrid");
                setAmount(offer.amount_inr ? String(offer.amount_inr) : "");
                setDeliverables(offer.deliverables.join("\n"));
                setTimeline(addDaysISO(3));
                setNotes("");
                setShowOffer(true);
                setCounterTarget(null);
              }}
            >
              Continue with counter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* Formal agreement both sides can read, sign in-app and download as PDF. */
function ContractCard({
  deal,
  doc,
  brandName,
  creatorName,
  signatures,
  iSigned,
  fullyExecuted,
  onSign,
  signing,
}: {
  deal: any;
  doc: AgreementDoc | null;
  brandName: string;
  creatorName: string;
  signatures: string[];
  iSigned: boolean;
  fullyExecuted: boolean;
  onSign: (values: { fullName: string; place: string; date: string }) => void;
  signing: boolean;
}) {
  const [showSign, setShowSign] = useState(false);
  const fileUrl = useMediaUrl(doc?.path ?? null);

  const text =
    doc?.text ??
    defaultAgreementText({
      brandName,
      creatorName,
      compensationType: deal?.compensation_type ?? "paid",
      amountInr: deal?.agreed_amount_inr ?? null,
    });

  const download = () => {
    if (doc?.path) {
      if (!fileUrl) {
        toast.error("Preparing the file — try again in a moment.");
        return;
      }
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
    downloadTextPdf(`bingo-agreement-${brandName}-${creatorName}`, "Collaboration agreement", text, signatures);
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">
          Collaboration agreement
          {doc?.source === "ai" ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              AI drafted
            </span>
          ) : null}
          {doc?.source === "upload" ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Uploaded PDF
            </span>
          ) : null}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={download}>
            <Download className="mr-1 size-4" /> Download PDF
          </Button>
          {iSigned ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <FileSignature className="size-3" /> {fullyExecuted ? "Fully executed" : "You signed · awaiting countersign"}
            </span>
          ) : (
            <Button size="sm" onClick={() => setShowSign((v) => !v)}>
              <FileSignature className="mr-1 size-4" /> {showSign ? "Cancel" : "Sign & return agreement"}
            </Button>
          )}
        </div>
      </div>

      {showSign && !iSigned ? (
        <SignatureForm onSubmit={onSign} pending={signing} />
      ) : null}

      {doc?.path ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Uploaded document: <strong>{doc.fileName ?? "agreement.pdf"}</strong> — download it above to read the full terms.
        </p>
      ) : (
        <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
      )}

      <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Signatures</p>
        {signatures.length ? (
          <ul className="mt-2 space-y-1">
            {signatures.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">Not signed yet.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {fullyExecuted
            ? "Digitally signed by both parties. This countersigned copy is stored in both accounts and can be downloaded as a PDF."
            : "Signatures record the signer's full legal name, place and date with a unique signature ID."}
        </p>
      </div>
    </div>
  );
}

function SignatureForm({
  onSubmit,
  pending,
  label = "Sign agreement",
}: {
  onSubmit: (values: { fullName: string; place: string; date: string }) => void;
  pending: boolean;
  label?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fullName, setFullName] = useState("");
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(today);

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="sig-name">Full legal name *</Label>
        <Input id="sig-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aditya Sharma" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sig-place">Place *</Label>
        <Input id="sig-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Bengaluru" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sig-date">Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="sig-date"
              variant="outline"
              className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 size-4" />
              {date ? format(new Date(date), "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ? new Date(date) : undefined}
              onSelect={(d) => d && setDate(d.toISOString().slice(0, 10))}
              disabled={(d) => d > new Date(today)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="sm:col-span-3">
        <Button
          className="bg-gradient-brand text-primary-foreground hover:opacity-90"
          disabled={pending}
          onClick={() => onSubmit({ fullName, place, date })}
        >
          {pending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <FileSignature className="mr-1 size-4" />}
          {label}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Typing your name here is your digital signature and is recorded with the place and date.
        </p>
      </div>
    </div>
  );
}

/* Brand/creator composes the agreement: default template, AI draft, or an uploaded PDF.
 * The sender may also change the compensation terms before the agreement is sent. */
function AgreementComposer({
  conversationId,
  onSent,
  brandName,
  creatorName,
  deal,
}: {
  conversationId: string;
  onSent: () => void;
  brandName: string;
  creatorName: string;
  deal: any;
}) {
  const generateFn = useServerFn(generateAgreementDraft);
  const contractFn = useServerFn(sendContract);
  const [mode, setMode] = useState<"template" | "ai" | "upload">("template");
  const [guidelines, setGuidelines] = useState("");
  const initialCompensation = (deal?.compensation_type ?? "paid") as "paid" | "barter" | "hybrid";
  const [compensationType, setCompensationType] = useState<"paid" | "barter" | "hybrid">(initialCompensation);
  const [amount, setAmount] = useState(() =>
    typeof deal?.agreed_amount_inr === "number" ? String(deal.agreed_amount_inr) : "",
  );
  const buildText = () =>
    defaultAgreementText({
      brandName,
      creatorName,
      compensationType,
      amountInr: compensationType === "barter" ? null : (amount ? Number(amount) : null),
      deliverables: [],
      timeline: null,
    });
  const [text, setText] = useState(buildText);
  const [upload, setUpload] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Recompute the preview whenever compensation terms change.
  useEffect(() => {
    if (mode !== "upload") setText(buildText());
  }, [compensationType, amount, mode, brandName, creatorName]);

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { conversationId, guidelines } }),
    onSuccess: (r) => {
      setText(r.text);
      toast.success(r.source === "ai" ? "AI draft ready" : "Default template applied");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: (values: { fullName: string; place: string; date: string }) =>
      contractFn({
        data: {
          conversationId,
          text: mode === "upload" ? null : text,
          filePath: mode === "upload" ? (upload?.path ?? null) : null,
          fileName: mode === "upload" ? (upload?.name ?? null) : null,
          source: mode === "upload" ? "upload" : mode === "ai" ? "ai" : "default",
          compensationType,
          amountInr: compensationType === "barter" ? null : (amount ? Number(amount) : null),
          ...values,
        },
      }),
    onSuccess: () => {
      toast.success("Agreement sent and signed by you");
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5">
      <h3 className="font-display text-lg font-semibold">Send the collaboration agreement</h3>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Compensation type</Label>
          <div className="flex flex-wrap gap-2">
            {(["paid", "barter", "hybrid"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCompensationType(t)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm capitalize",
                  compensationType === t
                    ? "border-transparent bg-gradient-brand text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {compensationType !== "barter" ? (
          <div className="space-y-2">
            <Label htmlFor="agreement-amount">Amount (INR)</Label>
            <Input
              id="agreement-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              placeholder="25000"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["template", "Default template"],
            ["ai", "AI written"],
            ["upload", "Upload PDF"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm",
              mode === value ? "border-transparent bg-gradient-brand text-primary-foreground" : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "ai" ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor="agreement-guidelines">Custom guidelines (optional)</Label>
          <Textarea
            id="agreement-guidelines"
            rows={3}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder="e.g. 30-day exclusivity in skincare, 2 rounds of revisions, payment 7 days after approval"
          />
          <Button variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
            Generate agreement
          </Button>
          <p className="text-xs text-muted-foreground">
            With no custom points we always fall back to the default Bingo template.
          </p>
        </div>
      ) : null}

      {mode === "upload" ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor="agreement-file">Agreement PDF (max 5 MB)</Label>
          <Input
            id="agreement-file"
            type="file"
            accept="application/pdf"
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const path = await uploadMedia(file, "agreement");
                setUpload({ path, name: file.name });
                toast.success("PDF uploaded");
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setUploading(false);
              }
            }}
          />
          {upload ? <p className="text-sm text-muted-foreground">Attached: {upload.name}</p> : null}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <Label htmlFor="agreement-text">Agreement text</Label>
          <Textarea id="agreement-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}

      <SignatureForm onSubmit={(v) => send.mutate(v)} pending={send.isPending} label="Sign & send agreement" />
    </div>
  );
}

/* Image / file / short media bubble. */
function AttachmentBubble({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const url = useMediaUrl(attachment.path);
  const isImage = attachment.mime.startsWith("image/");
  const isVideo = attachment.mime.startsWith("video/");

  return (
    <div className={cn("max-w-xs rounded-2xl border border-border bg-muted p-3", mine ? "ml-auto" : "")}>
      {url && isImage ? (
        <img src={url} alt={attachment.name} className="max-h-56 w-full rounded-lg object-cover" loading="lazy" />
      ) : url && isVideo ? (
        <video src={url} controls className="max-h-56 w-full rounded-lg" />
      ) : null}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <Paperclip className="size-3 shrink-0" />
        <span className="truncate">{attachment.name}</span>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 text-primary hover:underline">
            Open
          </a>
        ) : null}
      </div>
    </div>
  );
}



