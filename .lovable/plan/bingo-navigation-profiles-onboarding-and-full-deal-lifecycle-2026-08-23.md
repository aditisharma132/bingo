# Bingo: navigation, profiles, onboarding and full deal lifecycle

A large upgrade split into five phases. Each phase is shippable on its own.

## Phase 1 — Shell, navigation and account menu

- One shared app shell for every signed-in page: sticky header, page content, and a footer pinned to the bottom on every route (no more per-page footer drift, short pages keep the footer at the bottom).
- Header right side becomes compact: notification bell icon, messages icon with unread badge, avatar button, and an icon-only sign-out.
- Clicking the avatar/name opens a menu: View public profile, Edit profile, Settings, Notification preferences, Connections, Support, Light/Dark/System toggle, Sign out.
- "Messages" and "Trends" leave the main nav (messages becomes the icon, trends moves into the dashboard).
- Creator nav: Dashboard, Matches, Feed, Collaborations. Brand nav: Dashboard, Discover, Campaigns, Collaborations.

## Phase 2 — Merged profile and merged analytics

- One profile page with tabs instead of separate pages: Overview / Edit, Media (cover, avatar, portfolio), Tags & categories, and Preview — where Preview shows exactly how the profile looks to a brand and to another creator, using the real public-profile rendering.
- Same treatment for the brand profile (Brand DNA, media, tags, public preview).
- The standalone Trends page is folded into the dashboard as an "Analytics" section with sub-tabs (Overview, Trends). Creator trends are filtered to that creator's own labels/categories first, with a toggle to see the whole market.
- Notification preferences page (email on/off per category: messages, offers, deal state changes, brand posts).

## Phase 3 — Onboarding quality (both sides)

Creator:
- Every choice list (creator type, categories, content style, languages) gets an "Other — describe it" field. What's typed goes to the AI, which either maps it onto an existing category or creates a new tag, and explains which it picked.
- Profile media and about section are set up during onboarding, so the profile is complete on day one.

Brand:
- Multi-step wizard with working Next / Previous and a progress bar, answers preserved between steps.
- Validation: contact name letters only; phone with country code and a 10-digit national number; password strength meter and minimum strength at signup.
- Extra questions to close information gaps: target demographics (age, gender split, geographies), brand mission and tone, competitors, past collaboration experience, budget bands, and content do's/don'ts. These feed Brand DNA and matching.

## Phase 4 — Discovery, matching and messaging search

- Message/inbox search: find a creator or brand by name, tag, location, content style, creator type or category, and start a thread from the result.
- Brand dashboard "View" opens a creator detail view (not the campaign page): who Aarav is, why he fits, which campaign he fits, score breakdown, signals, gaps, sample work, and actions — Invite, Message, Shortlist.
- Every campaign shows a ranked top 10 with "Load more" for the next pages, plus rank position, fit label and per-category scoring so the ranking is explainable.

## Phase 5 — Full deal lifecycle and email

- Complete the loop end to end: plain-language brief → AI understanding → qualitative matches with reasons → invite or pitch → chat and negotiation → payment (mock provider until real keys) → deliverables submitted → review/approval → completion → two-way feedback that feeds back into matching.
- Any missing states get built: pitch inbox for brands, invite inbox for creators, revision requests, completion + payout release, review reminders.
- Email via Resend for: account created / verify email, invite received, pitch received, new message digest, offer received or accepted, payment funded and released, deliverable submitted or approved, dispute raised. Respects the notification preferences from Phase 2.

## Technical notes

- New shared `AppShell` layout component wrapping authenticated pages (flex column, `min-h-screen`, footer last) rather than editing the managed `_authenticated/route.tsx`.
- Profile/dashboard tabs use search params (`?tab=media`) so links and refresh work.
- New tables/columns: `notification_prefs`, brand onboarding answer columns on `brand_dna`, `pitches`/`invites` reuse existing tables where possible; every new table gets grants + RLS scoped to the owner.
- Validation with zod on both client and server functions.
- Email verification requires turning on confirm-email in auth settings; transactional email needs a `RESEND_API_KEY` and a verified sending domain — until that key exists, emails log to the server and the in-app notifications still fire.
- AI category mapping reuses the existing Lovable AI gateway helper; new tags are normalized and deduped against the shared taxonomy.
