# Bingo

A creator–brand marketplace that matches on content and craft, not follower count.

**Stack:** TanStack Start (React 19, Vite, Nitro) · Supabase (Postgres + Auth, RLS) · Google Gemini
for classification, matching, and moderation · Stripe for payments · Resend for email.

## Getting started

```bash
npm install
cp .env.example .env   # fill in the values below
npm run dev
```

| Variable                                                                              | Purpose                                                            |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` (+ `VITE_` mirrors) | Supabase connection                                                |
| `SUPABASE_SERVICE_ROLE_KEY`                                                           | Admin operations (seeding, roles)                                  |
| `GEMINI_API_KEY`                                                                      | AI classification, matching explanations, moderation               |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                        | Transactional email (optional — logs to console if unset)          |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_SCOPES`                        | Instagram connect (optional — feature no-ops if unset)             |
| `SOCIAL_TOKEN_KEY`, `INSTAGRAM_STATE_SECRET`                                          | App-generated secrets for token encryption and OAuth state signing |
| `STRIPE_SECRET_KEY`                                                                   | Payments (optional — runs in mock mode if unset)                   |

## Database

Migrations live in `supabase/migrations/` and must run **in filename order** — apply via the
Supabase CLI (`supabase db push`), the SQL editor, or any direct Postgres connection.

Seeding: sign up, promote your account to `admin` (`user_roles` table), then run `seedDemoData`
from the admin panel.

## AI engine

- **Classification** — assigns each creator a single primary category from bio/portfolio evidence, grammar-constrained to a fixed taxonomy.
- **Matching** — a deterministic scoring function (`src/lib/matching.ts`) across category, creator type, content relevance, budget, compensation, and location. Follower count is never a signal.
- **Learning loop** — brand accept/reject feedback nudges a per-brand preference weight that carries across future campaigns.
- **Moderation** — direct messages are screened before sending.
- **Rate limiting** — every AI-triggered action is capped per user.

## Testing

```bash
npm run test    # vitest — matching engine + classification logic
npm run build   # type-check + production build
```

## Deployment

Deploy the whole app to **Vercel** — TanStack Start's Nitro server handles SSR and server
functions as one unit, so no separate backend host is needed. Set the environment variables above
in your Vercel project, plus:

- **Supabase**: same project as local dev, no separate provisioning.
- **Instagram**: register each deployment's redirect URI (`https://<domain>/api/public/instagram/callback`) in the Meta app dashboard.
- **Google Sign-In**: enable the Google provider in Supabase Auth settings with your own OAuth client, and add your production domain under Auth → URL Configuration.
- **Supabase free tier** pauses after 7 days of inactivity — upgrade if uptime matters.

## License

Proprietary — all rights reserved.
