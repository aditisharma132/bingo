import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Creator Dashboard | Bingo" },
      { name: "description", content: "Track reach, active deals and earnings across your Bingo brand partnerships." },
      { property: "og:title", content: "Creator Dashboard | Bingo" },
      { property: "og:description", content: "Track reach, active deals and earnings across your Bingo brand partnerships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const stats = [
  { label: "Total Reach", value: "1.2M", delta: "+14% this week" },
  { label: "Active Deals", value: "4", delta: "2 pending review" },
  { label: "Earnings", value: "$12,450", delta: "+5% this month" },
  { label: "Profile Views", value: "3,892", delta: "Highly ranked!" },
];

const matches = [
  { name: "Nexus Gear", category: "Tech & Gaming Hardware", match: "98%", budget: "$2k – $5k" },
  { name: "Volt Energy", category: "Lifestyle & Fitness", match: "92%", budget: "$1k – $3k" },
  { name: "Lumina Skincare", category: "Beauty & Wellness", match: "87%", budget: "$800 – $2k" },
];

const campaigns = [
  { name: "Lumina Skincare", stage: "Content Review", progress: 75 },
  { name: "Urban Threads", stage: "Drafting", progress: 30 },
  { name: "Summer Cyber Campaign", stage: "Contract Signed", progress: 55 },
];

function Dashboard() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">Creator Dashboard</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Welcome back, Nova</h1>
          </div>
          <Button asChild variant="outline">
            <Link to="/deals">
              Open Deal Vault <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 font-display text-3xl font-bold text-gradient-brand">{stat.value}</p>
              <p className="mt-1 text-xs text-accent-foreground/80 dark:text-accent">{stat.delta}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Top Brand Matches</h2>
              <Link to="/deals" className="text-sm text-primary hover:underline">
                View all matches
              </Link>
            </div>
            <ul className="mt-4 space-y-3">
              {matches.map((match) => (
                <li
                  key={match.name}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/50 p-4"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-brand font-display font-bold text-primary-foreground">
                    {match.name.charAt(0)}
                  </span>
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{match.name}</p>
                    <p className="text-sm text-muted-foreground">{match.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-sm font-bold text-primary">{match.match} Match</p>
                    <p className="text-xs text-muted-foreground">{match.budget}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Active Campaigns</h2>
            <ul className="mt-4 space-y-5">
              {campaigns.map((campaign) => (
                <li key={campaign.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{campaign.name}</span>
                    <span className="text-muted-foreground">{campaign.progress}%</span>
                  </div>
                  <Progress value={campaign.progress} className="mt-2 h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">{campaign.stage}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
