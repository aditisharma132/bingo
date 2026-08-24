import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, Loader2, Pencil, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, EmptyState, FitBadge, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCampaign,
  inviteCreator,
  publishCampaign,
  respondToPitch,
  runMatching,
  setCampaignStatus,
  submitMatchFeedback,
  updateCampaign,
  withdrawInvite,
} from "@/lib/campaigns.functions";
import { CATEGORIES } from "@/lib/taxonomy";

export const Route = createFileRoute("/_authenticated/campaigns/$campaignId")({
  head: () => ({
    meta: [
      { title: "Campaign workspace | Bingo" },
      {
        name: "description",
        content: "Review the AI brief, the ranked shortlist and creator pitches for this campaign.",
      },
      { property: "og:title", content: "Campaign workspace | Bingo" },
      {
        property: "og:description",
        content: "Review the AI brief, the ranked shortlist and creator pitches for this campaign.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampaignDetail,
});

function CampaignDetail() {
  const { campaignId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchCampaign = useServerFn(getCampaign);
  const publish = useServerFn(publishCampaign);
  const match = useServerFn(runMatching);
  const setStatus = useServerFn(setCampaignStatus);
  const invite = useServerFn(inviteCreator);
  const withdraw = useServerFn(withdrawInvite);
  const feedback = useServerFn(submitMatchFeedback);
  const respond = useServerFn(respondToPitch);
  const [visible, setVisible] = useState(10);
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => fetchCampaign({ data: { campaignId } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });

  const matchMutation = useMutation({
    mutationFn: () => match({ data: { campaignId } }),
    onSuccess: (r) => {
      toast.success(`${r.matched} creators ranked`);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await publish({ data: { campaignId } });
      return match({ data: { campaignId } });
    },
    onSuccess: () => {
      toast.success("Campaign published and matched");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "closed" | "published") => setStatus({ data: { campaignId, status } }),
    onSuccess: (_r, status) => {
      toast.success(status === "closed" ? "Campaign closed" : "Campaign reopened");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="Campaign unavailable"
            description={(query.error as Error)?.message ?? "Not found."}
          />
        </main>
      </div>
    );
  }

  const { campaign, matches, pitches } = query.data;
  const brief = campaign.brief;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Link
          to="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All campaigns
        </Link>

        <div className="mt-4">
          <PageHeader
            eyebrow={`${campaign.status} · ${campaign.compensation_type}`}
            title={campaign.title}
            subtitle={brief?.objective ?? "No brief generated yet."}
            action={
              <div className="flex flex-wrap gap-2">
                {campaign.status === "published" ? (
                  <Button
                    variant="outline"
                    onClick={() => matchMutation.mutate()}
                    disabled={matchMutation.isPending}
                  >
                    {matchMutation.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 size-4" />
                    )}
                    Re-run matching
                  </Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">
                    Matchmaking starts when you publish this draft.
                  </span>
                )}
                {campaign.status !== "closed" ? (
                  <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                    <Pencil className="mr-1 size-4" />
                    {editing
                      ? "Close editor"
                      : campaign.status === "draft"
                        ? "Edit draft"
                        : "Edit campaign"}
                  </Button>
                ) : null}
                {campaign.status === "published" ? (
                  <Button
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("closed")}
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : null}
                    Close campaign
                  </Button>
                ) : null}
                {campaign.status === "closed" ? (
                  <Button
                    className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate("published")}
                  >
                    {statusMutation.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : null}
                    Reopen campaign
                  </Button>
                ) : null}
                {campaign.status === "draft" ? (
                  <Button
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                    className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : null}
                    Publish campaign
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>

        {editing ? (
          <div className="mt-6">
            <CampaignEditor
              campaign={campaign}
              onDone={() => {
                setEditing(false);
                void refresh();
              }}
            />
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <Panel>
              <h2 className="text-lg font-semibold">The brief</h2>
              {brief ? (
                <div className="mt-4 space-y-4 text-sm">
                  <BriefList label="Deliverables" items={brief.deliverables} />
                  <BriefChips label="Categories" items={brief.categories} />
                  <BriefChips label="Creator types" items={brief.creator_types} />
                  <BriefChips label="Platforms" items={brief.platforms} />
                  <BriefChips label="Locations" items={brief.locations} />
                  <BriefChips label="Content signals" items={brief.keywords} />
                  <BriefChips label="Tone" items={brief.tone} />
                  <BriefList label="Avoid" items={brief.do_not} />
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Timeline
                    </p>
                    <p className="mt-1">{brief.timeline || "Not specified yet."}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Budget
                    </p>
                    <p className="mt-1">
                      {campaign.budget_min || campaign.budget_max
                        ? `₹${(campaign.budget_min ?? 0).toLocaleString("en-IN")} – ₹${(campaign.budget_max ?? 0).toLocaleString("en-IN")}`
                        : brief.budget_note || "Not specified yet."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No brief yet.</p>
              )}
            </Panel>

            <Panel>
              <h2 className="text-lg font-semibold">Interested creators &amp; pitches</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Creators who raised their hand for this campaign — including ones the category match
                never ranked.
              </p>
              <div className="mt-4 space-y-3">
                {pitches.length ? (
                  pitches.map((p: any) => (
                    <div key={p.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Link
                            to="/creators/$creatorId"
                            params={{ creatorId: p.creator_id }}
                            className="font-semibold hover:text-primary"
                          >
                            {p.creator?.display_name}
                          </Link>
                          {p.creator?.headline ? (
                            <p className="text-xs text-muted-foreground">{p.creator.headline}</p>
                          ) : null}
                        </div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {p.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.outside_match ? (
                          <span className="rounded-full border border-accent/50 px-2 py-0.5 text-[11px] text-accent-foreground">
                            Self-nominated · outside category match
                          </span>
                        ) : (
                          <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] text-primary">
                            Also in ranked shortlist
                          </span>
                        )}
                        {(p.creator?.categories ?? []).slice(0, 3).map((c: string) => (
                          <span
                            key={c}
                            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {c}
                          </span>
                        ))}
                        {p.creator?.location ? (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {p.creator.location}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{p.message}</p>
                      {p.portfolio_url ? (
                        <a
                          href={p.portfolio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm text-primary hover:underline"
                        >
                          View portfolio →
                        </a>
                      ) : null}
                      {p.proposed_price_inr ? (
                        <p className="mt-2 text-sm">
                          Proposed: ₹{p.proposed_price_inr.toLocaleString("en-IN")}
                        </p>
                      ) : null}

                      {p.status === "sent" ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              await respond({ data: { pitchId: p.id, status: "accepted" } });
                              toast.success("Pitch accepted — a chat with the creator is now open");
                              void refresh();
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await respond({ data: { pitchId: p.id, status: "declined" } });
                              void refresh();
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No interest yet"
                    description="Creators can pitch or show interest from your brand profile once this campaign is published."
                  />
                )}
              </div>
            </Panel>
          </div>

          <Panel>
            <h2 className="text-lg font-semibold">Your best matches</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked on content, category and craft — never on follower count. Top{" "}
              {Math.min(visible, matches.length)} of {matches.length} shown.
            </p>
            <div className="mt-4 space-y-3">
              {matches.length ? (
                matches.slice(0, visible).map((m, index) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    rank={index + 1}
                    campaignTitle={campaign.title}
                    onInvite={async () => {
                      await invite({ data: { matchId: m.id } });
                      toast.success("Invite sent");
                      void feedback({ data: { matchId: m.id, action: "accepted" } }).catch(
                        () => {},
                      );
                      void refresh();
                    }}
                    onReject={async (reasonText) => {
                      await feedback({ data: { matchId: m.id, action: "rejected", reasonText } });
                      toast.success("Noted — this shapes your future matches");
                      void refresh();
                    }}
                    onWithdrawInvite={async () => {
                      await withdraw({ data: { matchId: m.id } });
                      toast.success("Invite withdrawn");
                      void refresh();
                    }}
                  />
                ))
              ) : (
                <EmptyState
                  title="No matches yet"
                  description="Run matching to rank creators against this brief."
                  action={
                    <Button
                      onClick={() => matchMutation.mutate()}
                      disabled={matchMutation.isPending}
                    >
                      Run matching
                    </Button>
                  }
                />
              )}
              {matches.length > visible ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setVisible((v) => v + 10)}
                >
                  Load 10 more
                </Button>
              ) : null}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}

/* Inline editor for a campaign draft — title, prompt, categories, compensation
 * and budget, with an optional AI re-write of the brief. */
function CampaignEditor({
  campaign,
  onDone,
}: {
  campaign: Awaited<ReturnType<typeof getCampaign>>["campaign"];
  onDone: () => void;
}) {
  const save = useServerFn(updateCampaign);
  const [title, setTitle] = useState(campaign.title ?? "");
  const [prompt, setPrompt] = useState(campaign.raw_prompt ?? "");
  const [comp, setComp] = useState<"paid" | "barter" | "hybrid">(campaign.compensation_type);
  const [budgetMin, setBudgetMin] = useState(
    campaign.budget_min ? String(campaign.budget_min) : "",
  );
  const [budgetMax, setBudgetMax] = useState(
    campaign.budget_max ? String(campaign.budget_max) : "",
  );
  const [cats, setCats] = useState<string[]>(campaign.brief?.categories ?? []);
  const [regenerate, setRegenerate] = useState(false);

  const toggleCat = (c: string) =>
    setCats((v) => {
      if (v.includes(c)) return v.filter((x) => x !== c);
      if (v.length >= 3) {
        toast.error("You can target a maximum of 3 categories per campaign.");
        return v;
      }
      return [...v, c];
    });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          campaignId: campaign.id,
          title,
          prompt,
          compensation_type: comp,
          budget_min: budgetMin ? Number(budgetMin) : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
          categories: cats,
          regenerateBrief: regenerate,
        },
      }),
    onSuccess: () => {
      toast.success(regenerate ? "Draft updated and brief rewritten" : "Draft updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel>
      <h2 className="text-lg font-semibold">
        Edit {campaign.status === "draft" ? "draft" : "campaign"}
      </h2>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="edit-title">Campaign title</Label>
          <Input
            id="edit-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-prompt">What are you trying to do?</Label>
          <Textarea
            id="edit-prompt"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>
            Target categories *{" "}
            <span className="text-xs text-muted-foreground">(pick up to 3)</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={cats.includes(c)} onClick={() => toggleCat(c)} />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="edit-comp">Compensation</Label>
            <select
              id="edit-comp"
              value={comp}
              onChange={(e) => setComp(e.target.value as typeof comp)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="paid">Paid</option>
              <option value="barter">Barter</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bmin">Budget min (₹)</Label>
            <Input
              id="edit-bmin"
              inputMode="numeric"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-bmax">Budget max (₹)</Label>
            <Input
              id="edit-bmax"
              inputMode="numeric"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={regenerate}
            onChange={(e) => setRegenerate(e.target.checked)}
          />
          Rewrite the AI brief from these edits
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Save changes
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function BriefChips({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Chip key={item} label={item} />
        ))}
      </div>
    </div>
  );
}

function BriefList({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

type MatchRow = Awaited<ReturnType<typeof getCampaign>>["matches"][number];

const SIGNAL_LABELS: Record<string, string> = {
  category: "Category relevance",
  creator_type: "Craft / creator type",
  content_relevance: "Content relevance",
  budget: "Budget fit",
  compensation: "Compensation fit",
  location: "Location fit",
  profile_weighting: "Your past feedback",
};

/* Brand-side explanation card: who they are, why they fit this brief, and the
 * score breakdown — without navigating away from the campaign. */
function MatchCard({
  match,
  rank,
  campaignTitle,
  onInvite,
  onReject,
  onWithdrawInvite,
}: {
  match: MatchRow;
  rank: number;
  campaignTitle: string;
  onInvite: () => Promise<void>;
  onReject: (reasonText: string) => Promise<void>;
  onWithdrawInvite: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [withdrawingInvite, setWithdrawingInvite] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const creator = match.creator;
  const signals = (match.signals ?? {}) as Record<string, number>;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-sm font-semibold">
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{creator?.display_name}</p>
              <FitBadge fit={match.fit} />
            </div>
            <p className="text-sm text-muted-foreground">
              {creator?.headline ?? "No headline yet"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(creator?.creator_types ?? []).map((t) => (
          <Chip key={t} label={t} />
        ))}
        {(creator?.categories ?? []).slice(0, 3).map((c) => (
          <Chip key={c} label={c} />
        ))}
      </div>

      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">
          Why {creator?.display_name ?? "this creator"} fits{" "}
        </span>
        <span className="font-medium">{campaignTitle}</span>
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {match.reasons.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide details" : "Why this fit — full breakdown"}
      </button>

      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Score breakdown
            </p>
            <div className="mt-2 space-y-1">
              {Object.entries(SIGNAL_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{Math.round(signals[key] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
          {creator?.bio ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">About</p>
              <p className="mt-1">{creator.bio}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Gaps to check</p>
            <p className="mt-1 text-muted-foreground">{match.gaps.join(" · ")}</p>
          </div>
          {creator?.id ? (
            <Link
              to="/creators/$creatorId"
              params={{ creatorId: creator.id }}
              className="inline-block text-primary hover:underline"
            >
              Open full creator profile →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm">
          {creator?.starting_price_inr
            ? `From ₹${creator.starting_price_inr.toLocaleString("en-IN")}`
            : "Price on request"}
        </span>
        <div className="flex items-center gap-2">
          {!match.invited ? (
            <Button size="sm" variant="ghost" onClick={() => setReasonOpen((v) => !v)}>
              Not a fit
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={match.invited ? "outline" : "default"}
            disabled={inviting}
            onClick={async () => {
              setInviting(true);
              try {
                await onInvite();
              } finally {
                setInviting(false);
              }
            }}
          >
            <Send className="mr-1 size-4" /> {match.invited ? "Re-invite" : "Invite"}
          </Button>
          {match.invited && match.creator_interested !== true ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={withdrawingInvite}
              onClick={async () => {
                setWithdrawingInvite(true);
                try {
                  await onWithdrawInvite();
                } finally {
                  setWithdrawingInvite(false);
                }
              }}
            >
              {withdrawingInvite ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Withdraw
            </Button>
          ) : null}
        </div>
      </div>

      {reasonOpen ? (
        <div className="mt-3 space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
          <Label htmlFor={`reject-reason-${match.id}`} className="text-xs text-muted-foreground">
            Why isn't this a fit? This trains your future matches.
          </Label>
          <Textarea
            id={`reject-reason-${match.id}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Too polished for our raw, testimonial-style briefs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setReasonOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={rejecting || !reason.trim()}
              onClick={async () => {
                setRejecting(true);
                try {
                  await onReject(reason.trim());
                  setReasonOpen(false);
                  setReason("");
                } finally {
                  setRejecting(false);
                }
              }}
            >
              {rejecting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Submit
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
