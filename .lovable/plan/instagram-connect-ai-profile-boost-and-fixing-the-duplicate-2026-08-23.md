# Instagram connect + AI profile boost, and fixing the duplicate Settings page

## 1. Why "Edit profile" and "Settings" look identical

The account menu sends both items to `/profile` (with `?tab=overview` and `?tab=settings`), but the profile page ignores that query entirely — it keeps its own internal tab state that always starts on "Edit". So both menu items land on the same screen.

Fix:
- Profile page reads the tab from the URL and keeps it in sync, so deep links work.
- Add a real **Settings** section to the profile page: account email, password change, theme, notification-preference shortcut, connected accounts shortcut, and danger-zone sign-out. "Edit profile" keeps the profile-content tabs (Edit, Media, Tags, Preview).
- Menu items point at the matching tab (`edit` vs `settings`).

## 2. Instagram connect (creators and brands)

A new "Connect Instagram" flow modelled on the helper files you uploaded, rebuilt for this stack (server functions instead of FastAPI).

Flow:
1. User clicks **Connect Instagram** on the Connections page (and on the profile Settings tab).
2. Server builds the Instagram Business Login authorize URL with a signed, single-use `state` and a redirect URI derived from the current origin — so it works on both the preview domain and the published domain. You whitelist both callback URLs in the Meta app's Business login settings.
3. Callback endpoint at `/api/public/instagram/callback` exchanges the code for a short-lived token, upgrades it to a long-lived token, fetches the account, stores it, and redirects back into the app with a success/failure flag.
4. Fallback: if the callback domain isn't whitelisted yet, a "paste the redirect URL or code" box completes the same exchange manually.

Data fetched and stored (per your choice): profile (username, account type, followers, follows, media count, profile picture), last 12 posts (caption, type, permalink, likes, comments, timestamp, per-post insights where available) and account insights (reach, profile views, accounts engaged, total interactions).

Storage: the existing `social_accounts` row is reused — handle, followers, engagement rate (computed from recent posts), `connected_via_oauth = true`, `last_synced_at`, and the raw profile/media/insights snapshot in `profile_data`. The access token is stored encrypted and never returned to the browser. A **Refresh** button re-syncs on demand.

Brands get the same treatment against their brand profile.

## 3. AI analysis — suggestions you approve

After a sync, an "AI profile boost" panel appears on the profile page:
- Suggested headline and bio rewritten from actual content themes.
- Suggested categories, content style and creator type (mapped into the existing taxonomy, plus new custom tags where nothing fits).
- Detected audience signals: posting cadence, best-performing format (reel/carousel/image), average engagement rate vs follower band, top-performing themes.
- For brands: brand tone, visual themes, audience read-out feeding Brand DNA.

Each suggestion has **Apply** / **Dismiss**; nothing is written to the profile without your click. Applying updates the profile fields and the Creator/Brand DNA record, which immediately improves matching.

## 4. Connections page upgrade

- Instagram card shows connected state: avatar, handle, account type, followers, reach, engagement, last synced, plus a post grid of the latest 12 with their metrics.
- Disconnect removes the token and reverts the account to self-reported.
- Manual handle entry stays for platforms without OAuth.

## Technical notes

- New server modules: `src/lib/instagram.server.ts` (Graph API calls, token exchange, AES-GCM token encryption), `src/lib/instagram.functions.ts` (start OAuth, complete manual code, sync, disconnect, AI analyse/apply), and the callback route `src/routes/api/public/instagram/callback.ts` with state verification.
- Migration: add encrypted-token and snapshot columns to `social_accounts` if missing, plus an `ai_profile_suggestions` table (owner-scoped RLS + grants) so suggestions persist until applied or dismissed.
- AI analysis runs through the existing Lovable AI layer in `src/lib/ai.server.ts` — no extra key needed.
- **Credentials**: you pasted `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` in a text file. I'll store them as backend secrets (never in code), and I'd recommend rotating that secret in the Meta dashboard afterwards since it was shared in plain text.
- Instagram Business Login requires a Business/Creator IG account linked to a Facebook page; personal accounts will get a clear error message instead of a silent failure.
