import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Camera, Sparkles, Wallet } from "lucide-react";
import creatorsImage from "@/assets/creators-neon.jpg";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/for-creators")({
  head: () => ({
    meta: [
      { title: "For Creators & UGC — Get matched by your content | Bingo" },
      {
        name: "description",
        content:
          "Bingo ranks UGC creators, editors and influencers by craft and content fit — not follower count. Build a Creator DNA, get briefs, get paid.",
      },
      { property: "og:title", content: "For Creators & UGC — Get matched by your content | Bingo" },
      {
        property: "og:description",
        content:
          "Build a Creator DNA, receive briefs that actually fit your content and get paid the moment work is approved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForCreatorsPage,
});

const perks = [
  {
    icon: Sparkles,
    title: "Creator DNA, not a follower number",
    body: "Bingo reads your content style, categories and craft to build a match profile brands can trust.",
  },
  {
    icon: Camera,
    title: "Built for UGC first",
    body: "Ad-ready UGC, editing, photography and long-form all get scored on their own signals.",
  },
  {
    icon: Wallet,
    title: "Paid on approval",
    body: "Milestone escrow releases your payout the moment the brand approves the cut.",
  },
  {
    icon: BadgeCheck,
    title: "Verified opportunities",
    body: "Every brief is from a verified brand with a real budget range attached.",
  },
];

const steps = [
  { n: "01", t: "Create your profile", b: "Content style, categories, languages, rates and portfolio links." },
  { n: "02", t: "Review your DNA", b: "Bingo drafts your fit signals — you confirm or edit before it goes live." },
  { n: "03", t: "Get matched", b: "Ranked opportunities land with the reasons why you fit the brief." },
  { n: "04", t: "Deliver and get paid", b: "Chat, deliver, get approved and receive the payout." },
];

function ForCreatorsPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main>
        <section className="relative overflow-hidden">
          <img
            src={creatorsImage}
            alt="Creator filming a UGC video in a neon-lit studio"
            width={1536}
            height={1024}
            className="absolute inset-0 size-full object-cover opacity-25 dark:opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/85 to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">For creators & UGC</p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
              Your content is the <span className="text-gradient-brand">portfolio</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Bingo matches you to brands on craft, category and audience fit. No follower minimums, no cold DMs, no
              chasing invoices.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                <Link to="/signup">
                  Join as a creator <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/for-brands">I'm a brand</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Why creators pick Bingo</h2>
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
              <h2 className="text-3xl font-bold sm:text-4xl">Get discovered for the work you actually make</h2>
              <p className="mt-4 text-sm opacity-90 sm:text-base">
                Set up your Creator DNA in a few minutes and start receiving briefs that fit.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-8">
                <Link to="/signup">
                  Create creator account <ArrowRight className="ml-1 size-4" />
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
