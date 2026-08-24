import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { SITE_URL } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | Bingo" },
      { name: "description", content: "What Bingo collects, why, and how you can control it." },
      { property: "og:title", content: "Privacy Policy | Bingo" },
      {
        property: "og:description",
        content: "What Bingo collects, why, and how you can control it.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Legal</p>
        <h1 className="mt-4 font-display text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: August 24, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <Section title="1. What we collect">
            <ul>
              <li>
                <strong>Account information</strong> — name, email, password (stored hashed, we
                never see it in plain text), and account type (Creator or Brand).
              </li>
              <li>
                <strong>Profile information</strong> — bio, headline, categories, portfolio links,
                location, languages, pricing preferences, and (for Brands) company details.
              </li>
              <li>
                <strong>Instagram data</strong> — if you connect your Instagram account, we access
                your public profile info, recent posts, and engagement metrics through Instagram's
                own API, solely to power profile suggestions and matching. We never post on your
                behalf or see your Instagram password.
              </li>
              <li>
                <strong>Messages and deal activity</strong> — conversations, offers, deal state, and
                content submissions exchanged through the Service.
              </li>
              <li>
                <strong>Payment information</strong> — for paid deals, our payment processor handles
                your card details directly; we store only the resulting transaction status, not your
                card number.
              </li>
              <li>
                <strong>Usage data</strong> — standard technical data like IP address, browser type,
                and pages visited, collected automatically.
              </li>
            </ul>
          </Section>

          <Section title="2. How we use it">
            <ul>
              <li>
                To run the matching engine — scoring campaign fit based on your profile and
                preferences.
              </li>
              <li>
                To generate AI-assisted profile summaries ("Creator DNA" / "Brand DNA") and category
                classification, using Google's Gemini API. We send the relevant text (bio, captions,
                campaign descriptions) to Gemini for this purpose; we don't send your payment
                information or private messages to it.
              </li>
              <li>To facilitate deals, messaging, and payments between Creators and Brands.</li>
              <li>To send account, deal, and campaign-related notifications by email.</li>
              <li>
                To screen direct messages for harassment, threats, and similarly harmful content
                before sending.
              </li>
              <li>To detect fraud and enforce our Terms of Service.</li>
            </ul>
          </Section>

          <Section title="3. Who we share it with">
            <ul>
              <li>
                <strong>The other party in a match or deal</strong> — your public profile, and
                whatever you choose to share in messages, pitches, and deal negotiations.
              </li>
              <li>
                <strong>Service providers</strong> we rely on to run Bingo: Supabase (database and
                authentication), Google (Gemini API for AI features, and Google Sign-In if you use
                it), Instagram/Meta (if you connect your account), our payment processor, and our
                email provider. Each only receives what it needs to do its job.
              </li>
              <li>We don't sell your personal information to anyone.</li>
            </ul>
          </Section>

          <Section title="4. Data retention and deletion">
            <p>
              We keep your data for as long as your account is active. If you want your account and
              associated data deleted, contact us at{" "}
              <a href="mailto:privacy@bingo.app">privacy@bingo.app</a> or through the{" "}
              <a href="/help">support form</a> — we'll process deletion requests within 30 days,
              except where we're required to retain certain records (e.g. transaction history) for
              legal or accounting purposes.
            </p>
          </Section>

          <Section title="5. Your rights">
            <p>
              Depending on where you live, you may have the right to access, correct, export, or
              delete your personal information, and to object to certain processing. Contact us at{" "}
              <a href="mailto:privacy@bingo.app">privacy@bingo.app</a> to exercise any of these.
            </p>
          </Section>

          <Section title="6. Cookies">
            <p>
              We use essential cookies/local storage to keep you signed in and remember your
              preferences (like theme). We don't use third-party advertising trackers.
            </p>
          </Section>

          <Section title="7. Children's privacy">
            <p>
              Bingo isn't intended for anyone under 18. We don't knowingly collect information from
              minors.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use industry-standard measures to protect your data — encrypted connections, access
              controls on our database (row-level security scoped to your own account), and
              encrypted storage for sensitive tokens like your Instagram access token. No system is
              perfectly secure, and we can't guarantee absolute security.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes will be announced
              through the Service or by email before they take effect.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a href="mailto:privacy@bingo.app">privacy@bingo.app</a> or through the{" "}
              <a href="/help">support form</a>.
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
