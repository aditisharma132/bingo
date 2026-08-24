# Bingo — AI Creator × Brand Marketplace (real MVP)

Rebuild the current demo (localStorage store, placeholder routes) into a real product: real accounts, real database, real AI, real campaign/deal lifecycle — while keeping the existing Stitch-derived neon visual language (Sora / Space Grotesk, gradient brand, glow accents, light + dark themes).

Answers locked in: Stripe (Lovable-managed) for payments, Instagram OAuth architecture now with manual handle/portfolio entry until Meta keys exist, and the core loop shipped first.

## Phase 1 — Foundation (backend + auth)
- Enable Lovable Cloud (database, auth, storage, secrets).
- Schema with RLS, grants, timestamps and indexes: `profiles`, `user_roles` (creator/brand/admin, separate table), `creator_profiles`, `brand_profiles`, `social_accounts`, `creator_dna`, `brand_dna`, `campaigns`, `campaign_briefs`, `matches`, `pitches`, `shortlists`, `deals`, `messages`, `content_submissions`, `payments`, `payment_events`, `feedback`, `brand_updates`, `verification_records`, `support_tickets`, `disputes`, `ai_reviews`, `notifications`.
- Email/password signup + login with role selection, protected route layout, role-aware navigation, sign-out hygiene.
- Design-system pass: shared Card/Section/Stat/Chip/EmptyState/StepHeader components so every new page matches the Stitch look.

## Phase 2 — Onboarding + DNA
- Creator onboarding wizard (6 steps): basic profile + photo upload, creator types, categories, social presence, commercial preferences (starting price, paid/barter), portfolio links.
- Brand onboarding wizard: brand identity, logo, website/socials, industry, contact, campaign categories.
- AI service layer (server-side, Lovable AI, `google/gemini-3.7-flash`) with schema-validated JSON: `generateCreatorDNA`, `generateBrandDNA`.
- Review-and-edit screens for both DNAs; staged loading copy ("Analyzing your profile…"), retry on failure with data preserved.
- Creator public profile page where content and fit lead, follower count is secondary.

## Phase 3 — Campaigns + the matching engine (the core)
- Brand "Create campaign" with one natural-language box → `generateCampaignBrief` → editable structured brief → publish.
- Deterministic ranking pipeline in the backend (content relevance, category, audience, engagement, creator type, budget compatibility, platform, location, preferences, historical feedback). UGC creators never ranked by followers; follower count is contextual for influencers only.
- `explainMatch` turns the actual scoring inputs into reasons — no invented metrics, gaps shown as "Not enough data yet."
- Fit labels only: Strong / Good / Potential / Weak Fit. No percentages.
- Brand "Your best matches" — top 15 cards with photo, type, category, metrics, price, fit label, reasons, verification, portfolio, Invite.
- Creator "Opportunities for you" + "Hidden opportunities" with the same explainability.

## Phase 4 — Collaboration loop
- Invite / express interest / decline, creator pitches (message, portfolio, proposed price) and the brand pitch inbox.
- Deal state machine `DISCOVERED → NEGOTIATING → ACCEPTED → CREATING → REVIEW → COMPLETED`, validated server-side, shown as a progress rail.
- Campaign-scoped realtime chat (database-backed, live subscription — no simulated delays).
- Content submission (Instagram URL or Drive/portfolio URL), brand approve / request changes / mark complete.
- Structured two-way feedback stored for future ranking signals.

## Phase 5 — Payments, admin, extras
- Enable Lovable-managed Stripe; payment service abstraction, checkout for a deal, webhook-verified `payments`/`payment_events`, "financially secured" state never set from the frontend.
- Admin dashboard: users, verification queue, tickets, disputes, AI review, platform metrics.
- Brand updates feed, trends with real backend abstraction + honest empty states, notifications.
- Landing page rewrite to the specified hero, CTAs and creator/brand sections; About / How it works / For Creators / For Brands routes with their own metadata.
- Seed script (10 creators, 5 brands, campaigns, matches, messages, completed deals) kept clearly separate from production data, plus a development-only account switcher.

## Technical notes
- TanStack Start: `createServerFn` for app logic, `src/routes/api/public/*` only for the Stripe webhook. All AI and secrets stay server-side in an `AIService` module; no LLM calls from components.
- Instagram: `social_accounts` + OAuth callback route and encrypted token storage built now; the connect button falls back to manual handle entry until Meta credentials are added.
- Every list gets the specified empty state; every mutation gets a real error state.
- Existing `src/lib/bingo-store.tsx` demo store and its seed arrays are removed once Phase 1–3 replace them.

Phases 1–4 land the demo-critical loop; Phase 5 follows. Each phase ends with the flow tested end to end in the preview before moving on.
