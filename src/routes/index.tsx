import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import heroImage from "@/assets/hero-neon.jpg";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site";

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
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
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

/* Same six signals scoreCreator() actually weighs in matching.ts — not illustrative. */
const SIGNALS = [
  { label: "Category", angle: -90 },
  { label: "Creator type", angle: -30 },
  { label: "Content", angle: 30 },
  { label: "Budget", angle: 90 },
  { label: "Compensation", angle: 150 },
  { label: "Location", angle: 210 },
];

const VIS_SIZE = 320;
const VIS_CENTER = VIS_SIZE / 2;
const VIS_RADIUS = 118;
const SIGNAL_NODES = SIGNALS.map((s) => {
  const rad = (s.angle * Math.PI) / 180;
  return { label: s.label, x: VIS_CENTER + VIS_RADIUS * Math.cos(rad), y: VIS_CENTER + VIS_RADIUS * Math.sin(rad) };
});

/** An "AI analyzing" visual: a scoring core connected to each signal it reads, tilting
 * in 3D toward the pointer and lighting up whichever signal the pointer is nearest.
 * All position math runs through refs (not React state) so mousemove never re-renders. */
function AiEngineVisual() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = VIS_SIZE / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;
    const nx = px / VIS_SIZE - 0.5;
    const ny = py / VIS_SIZE - 0.5;

    el.style.setProperty("--tiltY", `${(nx * 16).toFixed(2)}deg`);
    el.style.setProperty("--tiltX", `${(-ny * 16).toFixed(2)}deg`);
    if (coreRef.current) coreRef.current.style.transform = `translate(${(nx * 10).toFixed(1)}px, ${(ny * 10).toFixed(1)}px)`;

    SIGNAL_NODES.forEach((p, i) => {
      const near = Math.max(0, 1 - Math.hypot(px - p.x, py - p.y) / 130);
      nodeRefs.current[i]?.style.setProperty("--near", near.toFixed(3));
    });
  }

  function handleLeave() {
    const el = wrapRef.current;
    if (!el) return;
    el.style.setProperty("--tiltX", "0deg");
    el.style.setProperty("--tiltY", "0deg");
    if (coreRef.current) coreRef.current.style.transform = "translate(0,0)";
    nodeRefs.current.forEach((n) => n?.style.setProperty("--near", "0"));
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative mx-auto aspect-square w-full max-w-sm [perspective:900px]"
    >
      <div className="absolute inset-0 animate-spin [animation-duration:16s] rounded-full opacity-30 blur-2xl [background:conic-gradient(from_0deg,var(--primary),transparent_35%,transparent_65%,var(--primary))]" />
      <div
        className="relative size-full transition-transform duration-150 ease-out [transform-style:preserve-3d]"
        style={{ transform: "rotateX(var(--tiltX,0deg)) rotateY(var(--tiltY,0deg))" }}
      >
        <svg viewBox={`0 0 ${VIS_SIZE} ${VIS_SIZE}`} className="absolute inset-0 size-full">
          {SIGNAL_NODES.map((p) => (
            <line
              key={p.label}
              x1={VIS_CENTER}
              y1={VIS_CENTER}
              x2={p.x}
              y2={p.y}
              className="stroke-primary"
              strokeWidth={1}
              opacity={0.3}
            />
          ))}
        </svg>
        {SIGNAL_NODES.map((p, i) => (
          <div
            key={p.label}
            ref={(el) => {
              nodeRefs.current[i] = el;
            }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${(p.x / VIS_SIZE) * 100}%`, top: `${(p.y / VIS_SIZE) * 100}%` }}
          >
            <span
              className="block size-2.5 rounded-full bg-primary transition-transform duration-150"
              style={{
                transform: "scale(calc(1 + var(--near, 0) * 1.1))",
                boxShadow: "0 0 calc(var(--near, 0) * 20px) var(--primary)",
              }}
            />
            <span className="whitespace-nowrap text-[10px] font-medium text-muted-foreground">{p.label}</span>
          </div>
        ))}
        <div
          ref={coreRef}
          className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-brand text-center text-xs font-bold leading-tight text-primary-foreground glow-primary transition-transform duration-150"
        >
          AI
          <br />
          Score
        </div>
      </div>
    </div>
  );
}

const stats = [
  { value: "AI-matched", label: "Every match, with the reason it fits" },
  { value: "0", label: "Follower minimums" },
  { value: "Escrow", label: "Payouts released on approval" },
  { value: "UGC-first", label: "Scored on craft, not reach" },
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
            className="absolute inset-0 size-full object-cover opacity-45 dark:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/85" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
              Find creators by content, not follower count
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-7xl">
              AI-matched collaborations, backed by real content fit
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Bingo reads a creator's actual work and a brand's brief, then explains exactly why they
              match. No cold DMs, no follower thresholds, no guesswork.
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

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">How it works</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                An AI engine reading your profile in real time
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every campaign-creator pair runs through the same scoring core: category, creator
                type, content relevance, budget, compensation and location. No black box — every
                match ships with the reasons that produced it.
              </p>
              <p className="mt-4 text-muted-foreground">
                Bingo also reads a creator's bio, past work and captions to classify their category
                and craft, and adjusts a brand's own ranking weights every time they accept or pass
                on a match — never a global change, always starting from pure content fit.
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="size-4" /> Move your cursor over the core to see it work
              </p>
            </div>
            <AiEngineVisual />
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
