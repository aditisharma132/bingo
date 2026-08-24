import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, EmptyState, FitBadge, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptCampaignInvite,
  listCreatorOpportunities,
  sendPitch,
  withdrawPitch,
} from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: "Opportunities | Bingo" },
      {
        name: "description",
        content: "Campaigns ranked for your Creator DNA, with the reasons behind every fit.",
      },
      { property: "og:title", content: "Opportunities | Bingo" },
      {
        property: "og:description",
        content: "Campaigns ranked for your Creator DNA, with the reasons behind every fit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchOpportunities = useServerFn(listCreatorOpportunities);
  const pitch = useServerFn(sendPitch);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [price, setPrice] = useState("");

  const query = useQuery({
    queryKey: ["creator-opportunities"],
    queryFn: () => fetchOpportunities({ data: undefined }),
  });

  const mutation = useMutation({
    mutationFn: (campaignId: string) =>
      pitch({
        data: {
          campaignId,
          message,
          portfolioUrl: portfolio,
          proposedPrice: price ? Number(price) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Pitch sent");
      setOpenId(null);
      setMessage("");
      setPortfolio("");
      setPrice("");
      void queryClient.invalidateQueries({ queryKey: ["creator-opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptInvite = useServerFn(acceptCampaignInvite);
  const acceptMutation = useMutation({
    mutationFn: (campaignId: string) => acceptInvite({ data: { campaignId } }),
    onSuccess: (r) => {
      toast.success("Invite accepted — the brand has been notified");
      void queryClient.invalidateQueries({ queryKey: ["creator-opportunities"] });
      void navigate({ to: "/messages", search: { c: r.conversationId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useServerFn(withdrawPitch);
  const withdrawMutation = useMutation({
    mutationFn: (pitchId: string) => withdraw({ data: { pitchId } }),
    onSuccess: () => {
      toast.success("Pitch withdrawn");
      void queryClient.invalidateQueries({ queryKey: ["creator-opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data ?? [];
  const shortlisted = rows.filter((r) => r.shortlisted);
  const hidden = rows.filter((r) => !r.shortlisted);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Creator"
          title="Opportunities for you"
          subtitle="Ranked on your content and craft — never on follower count. Every fit shows its reasoning."
        />

        {query.isLoading ? (
          <div className="grid py-20 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : query.error ? (
          <div className="mt-8">
            <EmptyState
              title="Couldn't load opportunities"
              description={(query.error as Error).message}
            />
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            <Section
              title="Matched to you"
              description="Brands have already ranked you against these briefs."
              rows={shortlisted}
              openId={openId}
              setOpenId={setOpenId}
              message={message}
              setMessage={setMessage}
              portfolio={portfolio}
              setPortfolio={setPortfolio}
              price={price}
              setPrice={setPrice}
              onPitch={(id) => mutation.mutate(id)}
              pending={mutation.isPending}
              onAcceptInvite={(id) => acceptMutation.mutate(id)}
              acceptPending={acceptMutation.isPending}
              onWithdraw={(id) => withdrawMutation.mutate(id)}
              withdrawPending={withdrawMutation.isPending}
            />
            <Section
              title="Hidden opportunities"
              description="Published campaigns you haven't been ranked for yet — pitch if you see a fit."
              rows={hidden}
              openId={openId}
              setOpenId={setOpenId}
              message={message}
              setMessage={setMessage}
              portfolio={portfolio}
              setPortfolio={setPortfolio}
              price={price}
              setPrice={setPrice}
              onPitch={(id) => mutation.mutate(id)}
              pending={mutation.isPending}
              onAcceptInvite={(id) => acceptMutation.mutate(id)}
              acceptPending={acceptMutation.isPending}
              onWithdraw={(id) => withdrawMutation.mutate(id)}
              withdrawPending={withdrawMutation.isPending}
            />
          </div>
        )}
      </main>
    </div>
  );
}

type Row = Awaited<ReturnType<typeof listCreatorOpportunities>>[number];

function Section(props: {
  title: string;
  description: string;
  rows: Row[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  message: string;
  setMessage: (v: string) => void;
  portfolio: string;
  setPortfolio: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  onPitch: (campaignId: string) => void;
  pending: boolean;
  onAcceptInvite: (campaignId: string) => void;
  acceptPending: boolean;
  onWithdraw: (pitchId: string) => void;
  withdrawPending: boolean;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold">{props.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {props.rows.length ? (
          props.rows.map((row) => (
            <Panel key={row.campaign_id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">{row.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.brand_name} · {row.compensation_type}
                    {row.budget_max ? ` · up to ₹${row.budget_max.toLocaleString("en-IN")}` : ""}
                  </p>
                </div>
                <FitBadge fit={row.fit} />
              </div>
              <p className="mt-3 text-sm">{row.brief.objective}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.brief.categories.slice(0, 4).map((c) => (
                  <Chip key={c} label={c} />
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> Why AI matched this
              </p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {row.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Gaps: {row.gaps.join(" · ")}</p>

              {row.pitch_status ? (
                <div className="mt-4 flex items-center gap-2">
                  <p className="text-sm text-primary">Pitch {row.pitch_status}</p>
                  {row.pitch_status === "sent" && row.pitch_id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={props.withdrawPending}
                      onClick={() => props.onWithdraw(row.pitch_id!)}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              ) : props.openId === row.campaign_id ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    props.onPitch(row.campaign_id);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`msg-${row.campaign_id}`}>Your pitch</Label>
                    <Textarea
                      id={`msg-${row.campaign_id}`}
                      required
                      rows={4}
                      value={props.message}
                      onChange={(e) => props.setMessage(e.target.value)}
                      placeholder="Why you're a fit and what you'd make."
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Portfolio link"
                      value={props.portfolio}
                      onChange={(e) => props.setPortfolio(e.target.value)}
                    />
                    <Input
                      placeholder="Proposed price (₹)"
                      inputMode="numeric"
                      value={props.price}
                      onChange={(e) => props.setPrice(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={props.pending}
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      {props.pending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Send
                      pitch
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => props.setOpenId(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex items-center gap-2">
                  <Button onClick={() => props.setOpenId(row.campaign_id)}>Pitch for this</Button>
                  {row.invited ? (
                    <>
                      <span className="text-sm text-primary">You were invited</span>
                      <Button
                        variant="outline"
                        disabled={props.acceptPending}
                        onClick={() => props.onAcceptInvite(row.campaign_id)}
                      >
                        Accept invite & chat
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </Panel>
          ))
        ) : (
          <EmptyState
            title="Nothing here yet"
            description="When brands publish campaigns that fit your DNA, they'll appear here with the reasons why."
          />
        )}
      </div>
    </section>
  );
}
