# Bingo

A creator–brand marketplace that matches on content and craft, not follower count. TanStack Start
(React 19 + Vite + Nitro) on the frontend/server-fn layer, Supabase (Postgres + Auth) as the
database, Google Gemini for every AI-backed flow.

Originally built with [Lovable](https://lovable.dev); this fork runs standalone, outside the
Lovable Cloud runtime, on your own Supabase project and your own Gemini API key.

## Setup

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

**`.env` values:**

| Var | Where to get it | Required for |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` (+ `VITE_` mirrors) | Supabase dashboard → Settings → API | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` | seeding, admin operations |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Creator/Brand DNA, campaign briefs, Instagram AI suggestions, category classification, feedback learning |
| `RESEND_API_KEY`, `EMAIL_FROM` | [resend.com](https://resend.com) | transactional email — optional locally, logs to console when blank |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_SCOPES` | [Meta for Developers](https://developers.facebook.com) → your app → Settings → Basic | Instagram connect + AI profile-boost suggestions — optional, the feature no-ops if unset |
| `SOCIAL_TOKEN_KEY`, `INSTAGRAM_STATE_SECRET` | generate your own (`openssl rand -hex 32`) — these are Bingo's own secrets, not from Meta | encrypting the stored Instagram access token, signing the OAuth `state` param |

**Instagram redirect URI — a real gotcha:** `startInstagramConnect` builds the redirect URI as
`{origin}/api/public/instagram/callback` (see `redirectUriFor()` in `instagram.server.ts`), and
Meta rejects any redirect URI that isn't on the app's **Valid OAuth Redirect URIs** allowlist —
add it yourself in the Meta app dashboard (Instagram Business Login → Settings). This means:
- Every distinct origin you run the app from (a given `localhost:PORT`, your Vercel preview URL,
  your production domain) needs to be added separately.
- Keep the local dev port stable (`npm run dev` defaults to 8080; kill stray background dev
  servers rather than letting Vite creep to 8081/8082/... on every restart) so you're not
  re-registering a new URI every time.
- If a redirect URI isn't registered, the connect flow fails at Instagram's own authorize screen,
  before the user ever reaches Bingo — `completeInstagramManual` (paste the code/URL manually)
  exists as a fallback for other edge cases, but it still requires the *same* redirect URI to
  already be registered, since Instagram validates it before issuing a code at all.

**Database — read this before running migrations:** `supabase/migrations/*.sql` are **not**
self-sufficient on a brand-new Supabase project. Files dated `20260823105837` onward are
incremental deltas Lovable's AI applied directly to an already-existing hosted project; the base
schema (all core tables — `creator_profiles`, `campaigns`, `matches`, `deals`, etc.) was never
exported to this repo. The file dated `20260823100000` (`init base schema`) is this project's
reconstruction of that missing base state — built from `src/integrations/supabase/types.ts`'s
exact column shapes, cross-referenced against every later delta's `ALTER`/`DROP POLICY`/`REVOKE`
statement to infer the correct pre-delta shape wherever a delta's behavior depends on it (e.g.
`brand_profiles` needed `contact_person`/`contact_email`/`contact_phone` columns for a later
`DROP COLUMN` to succeed). It's a faithful, secure reconstruction, not a byte-perfect copy of
whatever Lovable originally generated — treat its RLS policies as a reasonable default, not
gospel, if you're auditing security.

Run all migrations **in filename order** against a fresh project (Supabase CLI `db push`, or the
SQL editor, or a direct Postgres connection — `psql`/any client works since it's plain SQL, no
CLI-specific syntax). Order matters: the base-schema file must run before every delta.

**Seeding:** sign up through the running app, promote your account to `admin` (insert a row into
`user_roles` with `role = 'admin'` — this requires direct DB access; regular signup is deliberately
blocked from self-granting the admin role), then trigger `seedDemoData` from the admin surface. It
creates real auth users + profiles from `src/lib/seed-data.ts`.

## The AI engine

Every AI call goes through one function — `generateJson()` in
[`src/lib/ai.server.ts`](src/lib/ai.server.ts) — using the
[`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK, model `gemini-3.5-flash`,
with `responseJsonSchema` + `responseMimeType: "application/json"` for grammar-constrained
structured output (an out-of-taxonomy category is unrepresentable, not just unlikely) and
`temperature: 0` so repeated calls on the same input agree. Every caller shares the identical
`{system, prompt, schemaName, schema} → {data, model}` contract, so the provider lives in exactly
one place.

**What it's used for:**
- Creator DNA / Brand DNA generation (onboarding)
- Campaign brief generation from a brand's plain-language prompt
- Instagram profile-boost suggestions (human-in-the-loop — nothing writes until the user applies a
  suggested diff)
- **Primary category classification** (`src/lib/classification.server.ts`) — one confident
  category per creator, from either social evidence (bio + recent captions) or portfolio evidence
  (bio + declared creator types + self-picked category interests), depending on which evidence is
  actually strong. Runs once at profile-write time, never on a read.
- **Feedback-direction classification** — turns a brand's free-text rejection reason into which of
  the creator's own tags they liked/disliked (direction only, never magnitude — the app owns step
  size, the model never touches the number that goes into a score).

**Bias, honestly:** the design avoids the most obvious bias vector — every AI input is text only
(no photos, no follower count anywhere in scoring, verified), classification is grammar-constrained
to a fixed taxonomy at `temperature: 0`. What it does **not** do: no explicit fairness instruction
in any prompt guarding against name/writing-style inference, and no bias screening on the learned
`match_weights` loop — if a brand's real rejection pattern correlates with something like regional
content or a specific aesthetic, the system will faithfully learn and reinforce it with no pushback
beyond the existing ±1 clamp. Worth active monitoring, not solved.

**Every AI-triggered endpoint is rate-limited** (`src/lib/rate-limit.server.ts`, a per-user
per-action sliding window backed by the `rate_limits` table) — DNA/brief generation, Instagram
analysis, and tag/feedback classification are all capped (20–60 calls/hour depending on the
action) since each one is a billed Gemini request with no cap otherwise. The optional AI-enrichment
paths (tag mapping, feedback-reason classification) degrade gracefully to their non-AI fallback
when rate-limited rather than failing the whole request.

**Direct messages are moderated before sending** (`src/lib/moderation.server.ts`) — a single Gemini
call flags genuine harassment/threats/hate speech/sexual content while explicitly *not* flagging
blunt business language or criticism (verified against both cases). Fails open: if the moderation
call itself errors, the message still sends rather than blocking chat on a moderation outage. This
adds real per-message latency (a Gemini round-trip) — fine at MVP scale; if it becomes a bottleneck,
the standard fix is async post-send moderation (deliver immediately, retract/flag after) instead of
this synchronous pre-send check.

### The scoring engine

The matching engine (`src/lib/matching.ts`) is a **pure, offline function** — no DB, no network —
that takes a campaign brief and a creator and returns a weighted score across six signals
(category overlap, creator type, content relevance, budget fit, compensation fit, location), plus
a **seventh, learned signal**: `profile_weighting`, a ±15 adjustment computed from the brand's own
accept/reject history (`match_weights` table), averaged over the *creator's own tags* — never the
campaign's — so a lesson learned on one campaign actually carries to the next. Cold start (no
feedback yet) means this term is 0 and ranking is pure content fit.

Deliberately never touches follower count anywhere in the formula — a UGC creator with 400
followers and an influencer with 40k are scored identically on craft and fit.

Brands give feedback (accept via Invite, or reject with a mandatory reason) from the campaign
workspace; `submitMatchFeedback` nudges the weights (rejection moves them further than
acceptance — a stated reason is a clean signal, acceptance is noisy) and writes the update
atomically via the `apply_match_feedback` Postgres function, alongside a `weight_history` row so
the before/after of a rejection is actually visible, not just asserted.

## Decisions worth knowing about

This repo includes `PLAN.md`, the build plan this implementation followed and deliberately
deviated from in a few places. Deviations, and why:

1. **AI scoring engine is TypeScript, in this app — not a standalone Python/FastAPI service.**
   PLAN.md's §3 specifies a separate `server/` Python service (SQLModel, Claude, its own Postgres
   connection). This repo is already 100% TypeScript with a working matching engine and AI-call
   pattern; a second language/runtime/deploy target would fork the very data store the plan itself
   warns against forking, for no benefit at this scale.
2. **One deploy target (Vercel), not Vercel + Railway.** TanStack Start's Nitro server *is* the
   backend — SSR, server functions and static assets are one deployable unit, not a real
   frontend/backend split. See Deployment below.
3. **npm, not bun.** The checked-in `bun.lock` resolved every package against a private registry
   only reachable from Lovable's build sandbox — it wouldn't install anywhere else. Regenerating a
   working `bun.lock` would mean installing Bun for no benefit over the already-present npm.
4. **"Lifestyle" added as a 16th category** (`src/lib/taxonomy.ts`) — a common creator vertical
   that was missing from the original 15 and would otherwise visibly misclassify real profiles.
5. **UGC classification threshold:** a creator is classified from portfolio evidence (not social)
   when `creator_types` includes `"UGC Creator"`, **or** they have no OAuth-connected Instagram
   account, **or** their follower count is under 2,000. See `shouldUsePortfolioPath()` in
   `classification.server.ts` — easy to retune.
6. **Portfolio links are not fetched or browsed.** PLAN.md's portfolio-path description assumes a
   summary of what linked work "actually is." There's no link-content pipeline in this app, and
   building one (fetch + summarize arbitrary URLs) was out of scope here — the portfolio
   classification path uses bio + declared creator types + self-picked category interests, with
   raw link URLs passed only as weak supporting context. Documented rather than silently
   overclaimed.
7. **Google OAuth rewired to native Supabase** (`supabase.auth.signInWithOAuth`), replacing
   `@lovable.dev/cloud-auth-js`. It needs the Google provider enabled in your own Supabase
   project's Auth settings (your own OAuth client ID/secret) to actually work — a dashboard step,
   not something this codebase can configure for you.
8. **`primary_category` is a new, separate field from `categories[]`.** The multi-value array
   keeps feeding the Dice-style overlap scoring in `matching.ts`; `primary_category` is a
   single, confident label purpose-built for brand-facing filtering (Discover page, capped at 3
   selected categories) and can't be derived from the array without picking a winner somewhere.
9. **New Supabase project, not the Lovable-managed one.** The original project's service-role key
   and database password are never exposed outside Lovable's own runtime — Lovable's in-app
   "backend panel" (tables/auth/logs viewers, a Secrets tab) doesn't include them, so there was no
   way to run migrations, seed data, or get the credentials a real Vercel deployment would need
   regardless. A base-schema migration (see Database above) reconstructs the full schema on a
   project you actually control end-to-end.
10. **`seed-data.ts` taxonomy fixed.** The original seed data used free-text values (`"ugc"`,
    `"beauty"`, `"tech"`, `"gadgets"`, `"health"`) that don't match `taxonomy.ts`'s actual
    `CATEGORIES`/`CREATOR_TYPES` constants (`"UGC Creator"`, `"Beauty"`, `"Tech & Gadgets"`).
    Seed-to-seed matching still "worked" by coincidence (both sides were consistently wrong in the
    same way), but a real campaign built through the app's own taxonomy-constrained UI would never
    have matched any seeded creator. Fixed to use real taxonomy values throughout — verified by
    re-running the matching engine against the corrected seed data (see Testing notes below).

## Deployment

**Recommended — everything on Vercel, $0/month to start:**

- **Vercel** (Hobby, free): the whole app — SSR pages and server functions — deploys as one
  project. Nitro auto-detects the Vercel target at build time (`defaultPreset` zero-config
  detection in `@lovable.dev/vite-tanstack-config`), so no config changes are needed — just
  connect the repo and set the env vars from the table above (plus `VITE_*` mirrors for
  client-exposed ones).
- **Supabase** (Free tier): the same project used for local dev — no separate provisioning step.
  The free tier pauses after 7 days of inactivity — a real gotcha for a demo-facing app; Pro
  ($10/mo) removes it if uptime matters.
- **Resend** (Free tier, 3,000 emails/mo): powers the transactional email `notify.server.ts`
  already knows how to send. Note: **account verification emails are Supabase Auth's own
  built-in confirmation flow** (`supabase.auth.signUp`'s `emailRedirectTo`), not something
  `notify.server.ts` sends — for production, configure Resend as Supabase's **custom SMTP**
  provider (Auth → Settings → SMTP) so verification email doesn't hit Supabase's low default
  sending limits.
- **Gemini API**: free tier covers this comfortably since classification only runs at write time,
  never on a read. Set a spend cap in Google AI Studio regardless.

**Why not Railway too:** TanStack Start doesn't have a real frontend/backend split to put on two
platforms — splitting it would mean two deploys, two env-var sets, and CORS between your own
frontend and your own backend, for no benefit. If you'd still rather run on Railway (more familiar
tooling, or plans for a genuinely separate long-running service later), deploy the *whole* app
there instead via Nitro's `node-server` preset (`NITRO_PRESET=node-server`), not split with Vercel.
Railway's free trial credit runs out; after that a small always-on Node service typically runs
$3–7/mo — a strictly worse cost/complexity trade than all-Vercel for this app's current
architecture.

## Testing notes

No browser-automation tool was available while building this, so verification split into what
could be checked directly and what genuinely needs a browser:

**Automated tests:** `npm run test` (vitest) — 14 tests, sub-second, no network/DB — covering
`matching.ts` (score bounds, category/type/budget sensitivity, follower-count independence, the
learned-weight adjustment, `detectProfile`) and the pure decision logic in
`classification.server.ts`. The AI-calling functions themselves aren't covered by the automated
suite (would mean either mocking Gemini, which tests nothing real, or spending real API calls on
every CI run) — those are verified manually per PLAN.md's consistency-check bar instead (below).

**Verified directly:**
- `npm run build` / `tsc --noEmit` / `npm run test` / targeted lint — clean.
- All 20 migrations (base schema + 18 original deltas + the scoring-engine migration) applied to
  a fresh project without error; final schema spot-checked against `types.ts` (41 tables, correct
  columns, all 10 functions present).
- Dev server boots; public routes smoke-tested with `curl`.
- `handle_new_user` trigger verified end-to-end (real signup via the Auth Admin API → `profiles`
  row auto-created).
- Demo data seeded using the exact logic `seedDemoData` runs (same Supabase calls, same
  `seed-data.ts`), after fixing its taxonomy mismatch.
- **Matching engine run against the real seeded data** — correctly ranked the right creators for
  each campaign (e.g. the two skincare/beauty UGC creators topped the Barrier Serum campaign, the
  tech reviewer scored 88/"strong" on the headphone launch and near the bottom everywhere else).
- Determinism check: two creators identical except for `id` score identically (no hidden
  follower-count-shaped signal).
- Learned-weight adjustment: a synthetic `-1` category weight measurably lowered a score
  (87 → 72), confirming the new `profile_weighting` term actually moves rankings.
- Classification consistency (PLAN.md §3.11's bar): every seeded creator bio classified into the
  *exact same* category across 3 separate Gemini calls each — required before trusting the
  pipeline, and it passed cleanly at `temperature: 0`.
- `apply_match_feedback` RPC tested directly: one call correctly wrote a `match_feedback` row, an
  upserted `match_weights` row, and a `weight_history` row, all atomically.

**Needs a real browser (not done here):** the full interactive click-through — sign up as creator
and brand, onboarding, Instagram connect + AI profile-boost suggestions, campaign creation UI,
discover/category filters, messaging + offers, deals lifecycle, payments mock flow, admin panel,
notifications. Do that pass yourself before trusting this in front of anyone.
