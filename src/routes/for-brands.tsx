import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Filter, ShieldCheck, Wand2 } from "lucide-react";
import brandsImage from "@/assets/brands-neon.jpg";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/for-brands")({
  head: () => ({
    meta: [
      { title: "Bingo — For Brands" },
      {
        name: "description",
        content:
          "Describe a campaign in plain language. Bingo writes the brief and ranks creators by content fit, with the reasons behind every match.",
      },
      { property: "og:title", content: "Bingo — For Brands" },
      {
        property: "og:description",
        content:
          "AI briefs, explainable creator shortlists, contract vault and milestone payouts in one marketplace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/for-brands` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/for-brands` }],
  }),
  component: ForBrandsPage,
});

const perks = [
  {
    icon: Wand2,
    title: "Plain-language briefs",
    body: "Describe the campaign in a sentence — Bingo turns it into a structured brief with deliverables and budget.",
  },
  {
    icon: Filter,
    title: "Explainable shortlists",
    body: "Every ranked creator comes with the signals behind the score: category, style, audience and budget fit.",
  },
  {
    icon: ShieldCheck,
    title: "Deal vault",
    body: "Negotiation, contracting, creation, review and payout tracked in one pipeline.",
  },
  {
    icon: BarChart3,
    title: "Performance reporting",
    body: "Sales, clicks and top creator rankings roll up per campaign.",
  },
];

const steps = [
  { n: "01", t: "Set your Brand DNA", b: "Positioning, industry, audience and campaign categories." },
  { n: "02", t: "Describe a campaign", b: "One paragraph is enough — Bingo drafts the full brief." },
  { n: "03", t: "Review the shortlist", b: "Ranked creators with reasons, rates and past work." },
  { n: "04", t: "Collaborate and pay", b: "Approve deliverables, release milestone payouts, measure results." },
];

function ForBrandsPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main>
        <section className="relative overflow-hidden">
          <img
            src={brandsImage}
            alt="Product lineup lit with neon in a data-grid studio"
            width={1536}
            height={1024}
            className="absolute inset-0 size-full object-cover opacity-45 dark:opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/85" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">For brands</p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
              Shortlists built on <span className="text-gradient-brand">content fit</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Skip the spreadsheet hunt. Describe the campaign, get a structured brief and a ranked creator shortlist
              with the reasoning attached.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                <Link to="/signup">
                  Start a campaign <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/for-creators">I'm a creator</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Everything the campaign needs</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map((p) => (
              <article key={p.title} className="rounded-2xl border border-border bg-card p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="rounded-2xl border border-border bg-card p-6">
                <span className="font-display text-3xl font-bold text-gradient-brand">{s.n}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-brand p-10 text-primary-foreground sm:p-16">
            <div className="absolute inset-0 grid-backdrop opacity-40" />
            <div className="relative max-w-xl">
              <h2 className="text-3xl font-bold sm:text-4xl">Meet creators who actually fit</h2>
              <p className="mt-4 text-sm opacity-90 sm:text-base">
                Set up your Brand DNA and publish your first campaign today.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-8">
                <Link to="/signup">
                  Create brand account <ArrowRight className="ml-1 size-4" />
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
