# Messaging, negotiation, payments, social profiles and custom tags

Builds on the existing Bingo backend (campaigns, matches, deals, messages, payments tables already exist).

## 1. Quick fix — back arrows
Add a "Back to home" arrow link at the top of the login and signup pages.

## 2. Messaging (creator ↔ brand)
- Conversation list + thread UI at `/messages`, reachable from the nav with an unread badge.
- Threads can start from a match, a campaign, or directly from a creator/brand profile ("Message" button) — no need for an existing deal.
- Live updates (realtime), read receipts, unread counts, empty states.

## 3. Negotiation inside the thread
- Structured offer cards posted into the conversation: price, deliverables, timeline, notes.
- Counter-offer / accept / decline, each recorded as an event; accepting an offer locks the agreed terms onto the deal and moves it to ACCEPTED.
- The thread shows the full negotiation history alongside normal chat.

## 4. Payments
- Once terms are accepted, the brand funds the deal; on completion the creator is paid out.
- Payment status shown on the deal and in the thread (Awaiting funding → Secured → Released).
- Provider: Lovable-managed Stripe checkout for funding a deal, with the webhook confirming payment server-side (status is never set from the browser). If you'd rather ship the UI first, we can start with a manual "mark as funded" step and turn on Stripe next.

## 5. Custom labels and categories
- Brands and creators can add their own tags on top of the preset lists (free text, normalized, reused across accounts once created).
- Matchmaking scores on the tag set plus AI relevance: the AI maps custom tags to the shared taxonomy so "clean-girl skincare" still matches "Skincare".
- Tags are shown as chips on profiles, campaigns and match reasons.

## 6. Social-style profiles
- Both creators and brands get a public profile page: cover image, display picture, about, tags, links, stats.
- Image uploads to storage with owner-only write, public read.
- Creator profile = portfolio (no posting).
- Brand profile = feed: brands post active campaigns and newsletter posts, with images and links.

## 7. Subscribe + alerts (YouTube style)
- Creators can subscribe to a brand from its profile; subscriber count shown.
- Every new brand post notifies subscribers — bell menu in the nav with unread count, plus a notifications page.

## Technical notes
- New tables: `conversations`, `conversation_participants`, `offers`, `tags`, `entity_tags`, `brand_posts`, `brand_subscriptions`; existing `messages`, `deals`, `payments`, `notifications` extended rather than replaced. Every table gets grants + RLS scoped to the participants/owner.
- Storage bucket for avatars and cover images.
- All writes through `createServerFn`; Stripe only via the webhook route.
- Delivered in the order above so messaging is usable before payments land.
