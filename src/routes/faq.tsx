import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SITE_URL } from "@/lib/site";

const faqs = [
  {
    q: "How does Bingo match creators to a brief?",
    a: "Brands describe the need in plain language. Bingo reads content style, categories, tags, audience context and past work to rank creators by qualitative fit, then explains each recommendation.",
  },
  {
    q: "Do I need a big following to get work?",
    a: "No. UGC creators, editors and photographers are scored on craft signals and content fit. Follower count is one signal among many, not the ranking.",
  },
  {
    q: "Who can message me?",
    a: "Brands can reach creators directly. Creator-to-creator, brand-to-brand and creator-to-brand messages arrive as a request first — you accept before the conversation opens. You can turn requests off or block someone at any time.",
  },
  {
    q: "How do payments work?",
    a: "Terms are agreed inside the chat as a structured offer. The brand secures the amount before work starts, and it is released to the creator once delivery is approved.",
  },
  {
    q: "Can I create my own categories and tags?",
    a: "Yes. Both creators and brands can add custom labels. Bingo maps them into the taxonomy so matching still works across everyone's wording.",
  },
  {
    q: "Something went wrong with a collaboration — what now?",
    a: "Raise a dispute from the collaboration, or send us a ticket from the support page. Our team reviews both sides before any payout is released.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — How Bingo matching, deals and payouts work" },
      {
        name: "description",
        content:
          "Answers on Creator DNA, how matches are ranked, message requests, secured payments, delivery approval and payouts on Bingo.",
      },
      { property: "og:title", content: "FAQ — How Bingo matching, deals and payouts work" },
      {
        property: "og:description",
        content: "Common questions from creators and brands about matching, chat requests, deals and payments.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/faq` },
      { name: "twitter:card", content: "summary_large_image" },
      { "script:ld+json": faqJsonLd },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/faq` }],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">FAQ</p>
        <h1 className="mt-3 font-display text-4xl font-bold">Questions, answered</h1>
        <p className="mt-3 text-muted-foreground">
          Everything creators and brands ask before their first collaboration.
        </p>

        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-display">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-lg font-semibold">Still stuck?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Raise a ticket and we'll get back to you by email.
          </p>
          <Button asChild className="mt-4">
            <Link to="/help">Contact support</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
