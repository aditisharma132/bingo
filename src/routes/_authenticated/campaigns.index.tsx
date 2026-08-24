import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { createCampaign, listBrandCampaigns } from "@/lib/campaigns.functions";
import { CATEGORIES } from "@/lib/taxonomy";


export const Route = createFileRoute("/_authenticated/campaigns/")({
  head: () => ({
    meta: [
      { title: "Campaigns | Bingo" },
      { name: "description", content: "Describe a campaign in plain language and Bingo builds the brief and shortlist." },
      { property: "og:title", content: "Campaigns | Bingo" },
      { property: "og:description", content: "Describe a campaign in plain language and Bingo builds the brief and shortlist." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const fetchCampaigns = useServerFn(listBrandCampaigns);
  const create = useServerFn(createCampaign);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [comp, setComp] = useState<"paid" | "barter" | "hybrid">("paid");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [cats, setCats] = useState<string[]>([]);

  const isBrand = role === "brand";

  const toggleCat = (c: string) =>
    setCats((v) => {
      if (v.includes(c)) return v.filter((x) => x !== c);
      if (v.length >= 3) {
        toast.error("You can target a maximum of 3 categories per campaign.");
        return v;
      }
      return [...v, c];
    });

  const campaigns = useQuery({
    queryKey: ["brand-campaigns"],
    queryFn: () => fetchCampaigns({ data: undefined }),
    enabled: isBrand,
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          title,
          prompt,
          compensation_type: comp,
          budget_min: budgetMin ? Number(budgetMin) : null,
          budget_max: budgetMax ? Number(budgetMax) : null,
          categories: cats,
        },
      }),
    onSuccess: () => {
      toast.success("Draft brief generated — publish it to start matchmaking");
      setTitle("");
      setPrompt("");
      setCats([]);
      void queryClient.invalidateQueries({ queryKey: ["brand-campaigns"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });


  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow={isBrand ? "Brand" : "Creator"}
          title="Campaigns"
          subtitle={
            isBrand
              ? "One plain-language box. Bingo writes the structured brief and ranks creators who actually fit."
              : "Campaigns you have pitched to, plus every open opportunity ranked for your DNA."
          }
          action={
            !isBrand ? (
              <Button asChild variant="outline">
                <Link to="/matches">
                  Opportunities for you <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            ) : undefined
          }
        />

        {!isBrand ? (
          <div className="mt-8">
            <EmptyState
              title="Creator view"
              description="Head to Opportunities to see published campaigns ranked for your Creator DNA, with the reasons behind each fit."
              action={
                <Button asChild className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                  <Link to="/matches">See opportunities</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Panel>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="size-4 text-primary" /> New campaign
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe it the way you would to a colleague. No form filling.
              </p>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Campaign title</Label>
                  <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Monsoon skincare launch" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt">What are you trying to do?</Label>
                  <Textarea
                    id="prompt"
                    required
                    rows={6}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="We're launching a niacinamide serum for oily skin in Bengaluru and Mumbai. We want honest UGC routines and before/after demos for Instagram reels..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Target categories * <span className="text-xs text-muted-foreground">(pick up to 3)</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <Chip key={c} label={c} selected={cats.includes(c)} onClick={() => toggleCat(c)} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Matchmaking only runs once you publish the draft — these categories drive the shortlist.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="comp">Compensation</Label>
                    <select
                      id="comp"
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
                    <Label htmlFor="bmin">Budget min (₹)</Label>
                    <Input id="bmin" inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bmax">Budget max (₹)</Label>
                    <Input id="bmax" inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={mutation.isPending || cats.length === 0}
                  className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
                >
                  {mutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Generate brief
                </Button>

              </form>
            </Panel>

            <Panel>
              <h2 className="text-lg font-semibold">Your campaigns</h2>
              <div className="mt-4 space-y-3">
                {campaigns.isLoading ? (
                  <div className="grid place-items-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : campaigns.data?.length ? (
                  campaigns.data.map((c) => (
                    <Link
                      key={c.id}
                      to="/campaigns/$campaignId"
                      params={{ campaignId: c.id }}
                      className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{c.title}</p>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                          {c.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {c.brief?.objective ?? "Brief pending"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {c.match_count ?? 0} ranked creators · {c.compensation_type}
                      </p>
                    </Link>
                  ))
                ) : (
                  <EmptyState
                    title="No campaigns yet"
                    description="Describe your first campaign on the left and Bingo will build the brief for you."
                  />
                )}
              </div>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}
