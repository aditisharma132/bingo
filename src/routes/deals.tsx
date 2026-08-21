import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deal Vault | Bingo" },
      { name: "description", content: "Manage every brand deal from negotiation to payout inside the Bingo Deal Vault." },
      { property: "og:title", content: "Deal Vault | Bingo" },
      { property: "og:description", content: "Manage every brand deal from negotiation to payout inside the Bingo Deal Vault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Deals,
});

const pipeline = [
  { stage: "Negotiation", count: 12 },
  { stage: "Contracting", count: 5 },
  { stage: "Creation", count: 8 },
  { stage: "Review", count: 3 },
  { stage: "Paid", count: 24 },
];

const deals = [
  {
    creator: "Jax V.",
    title: "Tech Hardware Promo",
    stage: "Negotiation",
    match: "94%",
    milestone: "Finalize Rate Card",
    note: "48h remaining",
  },
  {
    creator: "Elena M.",
    title: "Apparel Launch Q3",
    stage: "Review",
    match: "88%",
    milestone: "Approve Draft Cut",
    note: "Awaiting brand",
  },
  {
    creator: "Zero_Day",
    title: "NFT Drop Collab",
    stage: "Contracting",
    match: "99%",
    milestone: "Signature Pending",
    note: "Creator action",
  },
];

const timeline = [
  { when: "10:42 AM • System", what: "Payment of $4,500 cleared for Jax V. milestone 1." },
  { when: "Yesterday • Elena M.", what: "Uploaded new draft asset: v2_cut_final.mp4" },
  { when: "Oct 24 • Legal", what: "Contract template updated for Q4 promotional terms." },
];

function Deals() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">Deal Management</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Deal Vault</h1>

        <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pipeline.map((item) => (
            <div key={item.stage} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-display text-2xl font-bold">{item.count}</p>
              <p className="text-sm text-muted-foreground">{item.stage}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="space-y-4">
            {deals.map((deal) => (
              <article key={deal.creator} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-xl bg-gradient-brand font-display font-bold text-primary-foreground">
                    {deal.creator.charAt(0)}
                  </span>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{deal.creator}</h2>
                    <p className="text-sm text-muted-foreground">{deal.title}</p>
                  </div>
                  <Badge variant="outline" className="border-primary text-primary">
                    {deal.stage}
                  </Badge>
                  <span className="font-display text-sm font-bold text-accent-foreground dark:text-accent">
                    Match {deal.match}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Next milestone</p>
                    <p className="text-sm font-medium">{deal.milestone}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{deal.note}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline">
                    Chat
                  </Button>
                  <Button size="sm" className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                    View details
                  </Button>
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Timeline Engine</h2>
            <ol className="mt-4 space-y-5">
              {timeline.map((event) => (
                <li key={event.what} className="border-l-2 border-primary/50 pl-4">
                  <p className="text-xs text-muted-foreground">{event.when}</p>
                  <p className="mt-1 text-sm">{event.what}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
