import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getDeal,
  reviewSubmission,
  submitContent,
  submitDealFeedback,
  transitionDeal,
} from "@/lib/deals.functions";
import { releaseDealPayment, startDealCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/deals/$dealId")({
  head: () => ({
    meta: [
      { title: "Collaboration workspace | Bingo" },
      { name: "description", content: "Terms, stage, content review, payment and feedback for a Bingo collaboration." },
      { property: "og:title", content: "Collaboration workspace | Bingo" },
      { property: "og:description", content: "Terms, stage, content review, payment and feedback for a Bingo collaboration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DealWorkspace,
});

const RAIL = ["DISCOVERED", "NEGOTIATING", "ACCEPTED", "CREATING", "REVIEW", "COMPLETED"] as const;
const RAIL_LABEL: Record<string, string> = {
  DISCOVERED: "Discovered",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Terms agreed",
  CREATING: "Creating",
  REVIEW: "Review",
  COMPLETED: "Completed",
};

const RATING_FIELDS = [
  { key: "content_fit", label: "Content fit" },
  { key: "audience_fit", label: "Audience fit" },
  { key: "communication", label: "Communication" },
  { key: "value", label: "Price / value" },
] as const;

function Rail({ state }: { state: string }) {
  if (state === "CANCELLED") {
    return (
      <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        This collaboration was cancelled.
      </p>
    );
  }
  const index = RAIL.indexOf(state as (typeof RAIL)[number]);
  return (
    <ol className="flex flex-wrap gap-2">
      {RAIL.map((s, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <li
            key={s}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
              current
                ? "border-transparent bg-gradient-brand text-primary-foreground"
                : done
                  ? "border-primary/40 text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {done ? <Check className="size-3" /> : null}
            {RAIL_LABEL[s]}
          </li>
        );
      })}
    </ol>
  );
}

function DealWorkspace() {
  const { dealId } = useParams({ from: "/_authenticated/deals/$dealId" });
  const qc = useQueryClient();
  const fetchDeal = useServerFn(getDeal);
  const move = useServerFn(transitionDeal);
  const submit = useServerFn(submitContent);
  const review = useServerFn(reviewSubmission);
  const sendFeedback = useServerFn(submitDealFeedback);
  const startCheckout = useServerFn(startDealCheckout);
  const releaseFn = useServerFn(releaseDealPayment);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => fetchDeal({ data: { dealId } }),
  });

  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("instagram");
  const [note, setNote] = useState("");
  const [changes, setChanges] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState(0);
  const [fbNote, setFbNote] = useState("");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["deal", dealId] });
    void qc.invalidateQueries({ queryKey: ["deals"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const checkout = useMutation({
    mutationFn: () => startCheckout({ data: { dealId, origin: window.location.origin } }),
    onSuccess: (res: any) => {
      if (res.alreadyPaid) {
        toast.info("This collaboration is already funded");
        invalidate();
        return;
      }
      if (res.provider === "stripe" && res.url) {
        window.location.href = res.url as string;
        return;
      }
      navigate({ to: "/checkout/$paymentId", params: { paymentId: res.paymentId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: () => releaseFn({ data: { dealId } }),
    onSuccess: () => {
      toast.success("Payment released");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: (to: string) => move({ data: { dealId, to } }),
    onSuccess: () => {
      toast.success("Collaboration updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => submit({ data: { dealId, url, kind, note } }),
    onSuccess: () => {
      toast.success("Content submitted for review");
      setUrl("");
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { submissionId: string; action: "approve" | "changes" }) =>
      review({ data: { ...input, feedback: changes } }),
    onSuccess: () => {
      toast.success("Review sent");
      setChanges("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feedbackMutation = useMutation({
    mutationFn: () =>
      sendFeedback({ data: { dealId, ratings, overall, decision: overall >= 4 ? "would_repeat" : "unsure", note: fbNote } }),
    onSuccess: () => {
      toast.success("Thanks — that sharpens future matches");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Panel>
            <EmptyState
              title="Collaboration unavailable"
              description={(error as Error | null)?.message ?? "We couldn't load this collaboration."}
              action={
                <Button asChild variant="outline">
                  <Link to="/deals">Back to collaborations</Link>
                </Button>
              }
            />
          </Panel>
        </main>
      </div>
    );
  }

  const { deal, submissions, events, payment, actions, conversationId, me, myFeedbackGiven } = data;
  const isCreator = me.actor === "creator";
  const isBrand = me.actor === "brand";
  const latest = (submissions as any[])[0] ?? null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Collaboration"
          title={deal.campaign_title ?? "Direct collaboration"}
          subtitle={`${deal.brandName} × ${deal.creatorName}`}
          action={
            conversationId ? (
              <Button asChild variant="outline">
                <Link to="/messages" search={{ c: conversationId }}>
                  <MessageSquare className="mr-1 size-4" /> Open chat
                </Link>
              </Button>
            ) : undefined
          }
        />

        <div className="mt-8 space-y-6">
          <Panel>
            <Rail state={deal.state} />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Compensation</p>
                <p className="mt-1 font-semibold">
                  {deal.agreed_amount_inr
                    ? `₹${Number(deal.agreed_amount_inr).toLocaleString("en-IN")}`
                    : deal.compensation_type === "barter"
                      ? "Barter"
                      : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment</p>
                <p className="mt-1 font-semibold">
                  {payment ? (payment as any).status : deal.compensation_type === "barter" ? "Not required" : "Not secured"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                <p className="mt-1 font-semibold capitalize">{deal.compensation_type}</p>
              </div>
            </div>

            {actions.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {actions.map((a) => (
                  <Button
                    key={a.to}
                    variant={a.to === "CANCELLED" ? "outline" : "default"}
                    className={a.to === "CANCELLED" ? "" : "bg-gradient-brand text-primary-foreground hover:opacity-90"}
                    disabled={moveMutation.isPending}
                    onClick={() => moveMutation.mutate(a.to)}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {!deal.payment_secured && deal.compensation_type !== "barter" && deal.state !== "CANCELLED" ? (
              isBrand ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={checkout.isPending}
                    onClick={() => checkout.mutate()}
                  >
                    {checkout.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                    Secure payment in escrow
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Creation unlocks for the creator as soon as funds are held.
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Creation unlocks once the brand secures the payment.
                </p>
              )
            ) : null}

            {isBrand && deal.payment_secured && (payment as any)?.status === "secured" ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="outline" disabled={release.isPending} onClick={() => release.mutate()}>
                  {release.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Release payment to creator
                </Button>
                <span className="text-sm text-muted-foreground">Release after you're happy with the content.</span>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Content</h2>
            {!submissions.length ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {isCreator
                  ? "Submit your Instagram post link or a Drive link for UGC once creation starts."
                  : "The creator hasn't submitted anything yet."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {(submissions as any[]).map((s) => (
                  <li key={s.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="break-all text-sm text-primary underline"
                      >
                        {s.url}
                      </a>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {s.status.replace("_", " ")}
                      </span>
                    </div>
                    {s.note ? <p className="mt-2 text-sm text-muted-foreground">{s.note}</p> : null}
                    {s.brand_feedback ? (
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Brand feedback: </span>
                        {s.brand_feedback}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {isCreator && ["CREATING", "REVIEW"].includes(deal.state) ? (
              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div>
                    <Label htmlFor="kind">Type</Label>
                    <select
                      id="kind"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="instagram">Instagram post</option>
                      <option value="drive">Drive / UGC files</option>
                      <option value="other">Other link</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="url">Link</Label>
                    <Input
                      id="url"
                      className="mt-1"
                      placeholder="https://..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
                <Textarea
                  placeholder="Anything the brand should know (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Submit for review
                </Button>
              </div>
            ) : null}

            {isBrand && deal.state === "REVIEW" && latest ? (
              <div className="mt-5 space-y-3">
                <Textarea
                  placeholder="Feedback (required when requesting changes)"
                  value={changes}
                  onChange={(e) => setChanges(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ submissionId: latest.id, action: "approve" })}
                  >
                    Approve & complete
                  </Button>
                  <Button
                    variant="outline"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ submissionId: latest.id, action: "changes" })}
                  >
                    Request changes
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approving marks the collaboration complete and releases any secured payment.
                </p>
              </div>
            ) : null}
          </Panel>

          {deal.state === "COMPLETED" ? (
            <Panel>
              <h2 className="text-lg font-semibold">Feedback</h2>
              {myFeedbackGiven ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Thanks — your feedback is recorded and feeds future match quality.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {RATING_FIELDS.map((f) => (
                    <div key={f.key} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">{f.label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRatings((r) => ({ ...r, [f.key]: n }))}
                            className={`size-8 rounded-full border text-sm ${
                              ratings[f.key] === n
                                ? "border-transparent bg-gradient-brand text-primary-foreground"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Overall</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setOverall(n)}
                          className={`size-8 rounded-full border text-sm ${
                            overall === n
                              ? "border-transparent bg-gradient-brand text-primary-foreground"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    placeholder="What worked, what didn't (optional)"
                    value={fbNote}
                    onChange={(e) => setFbNote(e.target.value)}
                  />
                  <Button
                    className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                    disabled={feedbackMutation.isPending}
                    onClick={() => feedbackMutation.mutate()}
                  >
                    Share feedback
                  </Button>
                </div>
              )}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="text-lg font-semibold">History</h2>
            {!events.length ? (
              <p className="mt-2 text-sm text-muted-foreground">Stage changes will be logged here.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {(events as any[]).map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
                    <span>
                      {e.from_state ? `${RAIL_LABEL[e.from_state] ?? e.from_state} → ` : ""}
                      {RAIL_LABEL[e.to_state] ?? e.to_state}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
