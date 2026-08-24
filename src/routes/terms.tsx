import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | Bingo" },
      {
        name: "description",
        content: "The terms that govern using Bingo as a creator or a brand.",
      },
      { property: "og:title", content: "Terms of Service | Bingo" },
      {
        property: "og:description",
        content: "The terms that govern using Bingo as a creator or a brand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Legal</p>
        <h1 className="mt-4 font-display text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 24, 2026</p>

        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <Section title="1. Who these terms cover">
            <p>
              These Terms of Service ("Terms") govern your use of Bingo (the "Service"), a
              marketplace that matches content creators ("Creators") with brands ("Brands") for paid
              and barter collaborations. By creating an account, you agree to these Terms. If you
              don't agree, don't use the Service.
            </p>
          </Section>

          <Section title="2. Accounts and eligibility">
            <p>
              You must be at least 18 years old to create an account. There are two account types:
            </p>
            <ul>
              <li>
                <strong>Creator accounts</strong> — individuals or teams offering content creation,
                influence, or related creative services.
              </li>
              <li>
                <strong>Brand accounts</strong> — organizations sourcing creators for campaigns.
                Brand accounts must sign up with a company email address; we don't accept free
                consumer webmail (Gmail, Yahoo, Outlook, and similar) for Brand accounts.
              </li>
            </ul>
            <p>
              You're responsible for the accuracy of the information on your profile and for keeping
              your login credentials secure.
            </p>
          </Section>

          <Section title="3. How matching works">
            <p>
              Bingo classifies profiles and campaign briefs using a combination of information you
              provide (your bio, portfolio, categories, and — if you connect it — your Instagram
              account) and AI-assisted analysis. Matching and ranking are based on content fit,
              category overlap, and a brand's own past feedback — never on follower count. Every
              match includes the reasons behind it. Where AI suggests changes to your own profile
              (e.g. a headline or category), nothing is applied until you review and approve it.
            </p>
          </Section>

          <Section title="4. Your content">
            <p>
              You keep ownership of everything you post — your bio, portfolio links, messages, and
              any content submitted as part of a deal. By posting it on Bingo, you grant us a
              license to display, store, and process it as needed to operate the Service (for
              example, showing your public profile to Brands, or running it through our matching and
              classification systems).
            </p>
            <p>
              You're responsible for what you post. Don't post anything that's false, infringes
              someone else's rights, or violates the law. Direct messages are automatically screened
              for harassment, threats, and similarly harmful content before being sent — we don't
              otherwise read your private messages.
            </p>
          </Section>

          <Section title="5. Deals, payments, and disputes">
            <p>
              When a Creator and Brand agree to work together, that agreement is tracked through the
              Service as a "deal." For paid collaborations, funds are collected and released through
              our payment provider as the deal progresses — we call this a{" "}
              <strong>secured campaign payment</strong>, not escrow, and it's subject to our payment
              provider's own terms in addition to these ones. Barter collaborations are agreed
              directly between the parties; Bingo doesn't guarantee the value or delivery of barter
              goods.
            </p>
            <p>
              If a deal goes wrong, either party can raise a dispute through the Service. We'll
              review disputes in good faith but Bingo isn't a party to the underlying agreement
              between Creator and Brand, and we don't guarantee a particular outcome.
            </p>
          </Section>

          <Section title="6. Third-party services">
            <p>
              Bingo integrates with third-party services to operate: Instagram (for account
              connection and content analysis, if you choose to connect it), Google (for sign-in and
              for AI-assisted classification via the Gemini API), and a payment processor for paid
              deals. Your use of those integrations is also subject to that provider's own terms.
            </p>
          </Section>

          <Section title="7. Prohibited conduct">
            <ul>
              <li>Creating fake accounts, fake engagement, or misrepresenting who you are.</li>
              <li>
                Circumventing the Service to avoid fees by taking a matched deal off-platform.
              </li>
              <li>Harassing, threatening, or abusing other users.</li>
              <li>
                Scraping, reverse-engineering, or attempting to bypass rate limits or security
                controls.
              </li>
            </ul>
          </Section>

          <Section title="8. Termination">
            <p>
              You can delete your account at any time by contacting us. We may suspend or terminate
              accounts that violate these Terms, engage in fraud, or pose a risk to other users.
            </p>
          </Section>

          <Section title="9. Disclaimers and limitation of liability">
            <p>
              The Service is provided "as is." Bingo doesn't guarantee that any match, deal, or
              campaign outcome will meet your expectations. To the maximum extent permitted by law,
              Bingo isn't liable for indirect, incidental, or consequential damages arising from
              your use of the Service or from a deal between a Creator and a Brand.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              We may update these Terms from time to time. If we make material changes, we'll notify
              you through the Service or by email before they take effect.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these Terms? Reach us through the <a href="/help">support form</a> or
              at <a href="mailto:legal@bingo.app">legal@bingo.app</a>.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
