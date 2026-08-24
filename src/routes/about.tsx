import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Bingo — Matches on content, not follower count" },
      {
        name: "description",
        content:
          "Bingo matches creators to brands based on what they actually create, not how many followers they have. Taste Profile, Brand DNA, explainable recommendations.",
      },
      { property: "og:title", content: "About Bingo — Matches on content, not follower count" },
      {
        property: "og:description",
        content:
          "Bingo matches creators to brands based on what they actually create, not how many followers they have.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        {/* Mission */}
        <section>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">About us</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Bingo matches creators to brands based on what they actually create — not how many followers they have.
          </h1>
        </section>

        {/* The problem */}
        <section className="mt-10">
          <p className="text-lg text-muted-foreground">
            Follower-count-driven discovery fails both sides. Talented nano, micro, and UGC creators with small audiences stay invisible to brands no matter how good their content is. Meanwhile, brands waste hours manually vetting people whose follower count says nothing about whether their content actually fits the campaign.
          </p>
        </section>

        {/* What makes Bingo different */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">What makes Bingo different</h2>
          <div className="mt-4 space-y-4 text-muted-foreground">
            <p>
              Bingo reads a creator's actual content and a brand's actual identity, then matches on aesthetic, tone, audience, and values — with every recommendation explained, never a black-box score.
            </p>
            <p>
              Whether a brand needs an Influencer for reach or a UGC Creator for content production, Bingo finds the fit. Audience size never disqualifies a UGC creator.
            </p>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Who it's for</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Creators</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nano, micro, and mid-tier influencers. UGC creators, photographers, video editors, meme creators — anyone whose content doesn't get discovered through traditional follower-based search.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-display text-lg font-semibold">Brands</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Startups, small and growing Indian brands that need real content fit, not a rate card sorted by the biggest number.
              </p>
            </div>
          </div>
        </section>

        {/* North star */}
        <section className="mt-12">
          <blockquote className="border-l-4 border-primary pl-6 font-display text-2xl font-semibold italic leading-snug">
            A creator with 2,000 followers who makes exactly the content a brand needs shouldn't lose to someone with 200,000 followers just because of the number beside their profile.
          </blockquote>
        </section>

        <section className="mt-12 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/signup" search={{ role: "creator" }}>
              Join as a Creator
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/signup" search={{ role: "brand" }}>
              Join as a Brand
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
