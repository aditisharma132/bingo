import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import heroImage from "@/assets/hero-neon.jpg";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bingo — Creator Marketplace" },
      {
        name: "description",
        content:
          "Bingo matches brands with creators by content, not follower count. AI matching, contract vault and instant payouts.",
      },
      { property: "og:title", content: "Bingo — Creator Marketplace" },
      {
        property: "og:description",
        content:
          "Bingo matches brands with creators by content, not follower count. AI matching, contract vault and instant payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Sparkles,
    title: "AI Match Profiles",
    body: "Creators are ranked on content signal, audience fit and conversion — never vanity metrics.",
  },
  {
    icon: ShieldCheck,
    title: "Deal Vault",
    body: "Negotiation, contracting, creation, review and payout stages tracked in a single pipeline.",
  },
  {
    icon: Wallet,
    title: "Instant Payouts",
    body: "Milestone-based escrow releases funds the moment a brand approves the cut.",
  },
  {
    icon: BarChart3,
    title: "Performance Reporting",
    body: "Campaign performance, sales and clicks, and top creator rankings in one dashboard.",
  },
];

const stats = [
  { value: "1.2M", label: "Monthly creator reach" },
  { value: "$12,450", label: "Avg. creator earnings" },
  { value: "98%", label: "Top match accuracy" },
  { value: "24h", label: "Median deal turnaround" },
];

function Index() {
  const { loading, user, needsOnboarding } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    navigate({ to: needsOnboarding ? "/onboarding" : "/dashboard", replace: true });
  }, [loading, user, needsOnboarding, navigate]);

  return (
    <div className="min-h-screen">
      <SiteNav />

      <main>
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt="A neon-lit digital marketplace hero image showing creators and brands connecting on Bingo"
            width={1536}
            height={1024}
            className="absolute inset-0 size-full object-cover opacity-30 dark:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/80 to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
              Find creators by content, not follower count
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-7xl">
              Discover the creator-brand matches your campaign is missing
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Join the next generation platform where true talent meets opportunity in a neon-drenched digital
              ecosystem.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                <Link to="/signup">
                  Join Bingo <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/dashboard">See the dashboard</Link>
              </Button>
            </div>

            <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="font-display text-3xl font-bold text-gradient-brand">{stat.value}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">The full partnership lifecycle</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            From discovery and onboarding to collaboration and final performance analysis.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 text-primary-foreground sm:p-16">
            <div className="absolute inset-0 grid-backdrop opacity-40" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-bold sm:text-4xl">Engineered for Creators. Built for Brands.</h2>
              <p className="mt-4 text-sm opacity-90 sm:text-base">
                Create your Bingo profile and get matched with brands that actually fit your content.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-8">
                <Link to="/signup">
                  Create account <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
