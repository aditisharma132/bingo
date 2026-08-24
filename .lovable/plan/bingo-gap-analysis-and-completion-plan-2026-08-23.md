# Bingo — gap analysis and completion plan

An audit of the current app against your spec: what is already live, what is missing, and the order to build the rest.

Note on stack: your spec names MongoDB + custom JWT + Resend. This app runs on Lovable Cloud (Postgres + managed auth + row-level security), which already covers auth, roles, isolation and webhooks. I would keep that rather than migrate — every functional requirement in the spec maps onto it. Say the word if you want the migration discussion instead.

## Already built and working

- Roles (creator / brand / admin) in a separate roles table, server-enforced isolation via row-level policies.
- Email/password signup with role selection, Google sign-in, protected route layout, sign-out, onboarding gate.
- Creator and brand multi-step onboarding, AI Creator DNA / Brand DNA with review-and-edit, staged AI loading copy.
- Campaign creation from a plain-language prompt, AI-structured brief, edit, publish.
- Deterministic matching engine with grounded reasons, gaps, and the four fit labels — no percentages anywhere.
- Brand matches list, creator "Opportunities for you" plus a "Hidden opportunities" section, pitches, invites, shortlists.
- Per-conversation messaging with structured offer cards (price, deliverables, timeline), accept / counter, deal creation on accept.
- Manual escrow-style funding and release actions, deals table with state and `payment_secured`.
- Public creator and brand profiles with cover, avatar, about, tags; brand posts (campaign / newsletter / update), subscribe, subscriber feed, notification bell.
- Custom labels for creators and brands, AI-mapped onto the shared taxonomy for matching.
- Admin console: platform counts, user lists, verification approve/reject, campaigns, tickets and disputes read-out.
- Light + dark Stitch-styled design system, per-route metadata, empty states across lists.

## Missing versus the spec

**Payments (biggest gap).** Stripe is not connected. "Fund" flips the flag directly with no provider, no webhook, no checkout, no failure states, and no payment event history.

**Deal lifecycle.** There is no deal workspace page. `DISCOVERED → NEGOTIATING → ACCEPTED → CREATING → REVIEW → COMPLETED` is not enforced as a transition table with per-role permissions, there is no visual progress rail, and the payment gate on `ACCEPTED → CREATING` is implicit.

**Content submission.** The table exists but nothing writes to it: no submit form (Instagram URL for influencer work, Drive URL for UGC), no brand approve / request changes / mark complete.

**Feedback loop.** No structured two-way feedback form at completion (content fit, audience fit, communication, price/value, overall + free text), so nothing is stored as a future ranking signal.

**Email.** No transactional email at all — no welcome, invite, pitch, deal-change or payment emails.

**Forgot password.** No reset request or reset screen.

**Dashboard.** The stat tiles are hardcoded zeros and the activity lists are empty placeholders rather than real queries.

**Matching depth.** One weighting profile for everyone. The spec wants two: influencers include audience + engagement; UGC creators exclude follower/engagement entirely and weight creative relevance, portfolio strength and category fit. Portfolio strength, historical feedback and platform fit are not scored yet.

**Instagram connect.** Manual handle only; no OAuth flow, no follower/engagement sync, so audience signals are always absent.

**Trends.** Not built. Spec wants real trending categories/keywords derived from published campaigns, with an honest empty state.

**Brand activity indicator.** Very Active / Active / Less Active / "New on Bingo" is not computed or shown.

**Notifications.** Bell and list exist; unread marking, per-event coverage (invite, pitch, message, deal change, payment, feedback) and deep links are incomplete.

**Admin depth.** Tickets, disputes and AI review are read-only lists; no resolve/assign actions, no transaction volume or completed-deal analytics.

**Support surface.** No way for a user to raise a ticket or a dispute, though the tables exist.

**Seed data.** No 10 creators / 5 brands / campaigns / precomputed matches / completed deal with feedback. Demos currently start empty.

## Build order

**Phase A — close the core loop (highest value)**
1. Deal workspace page per deal: progress rail, terms summary, role-aware actions, linked chat.
2. Server-side state machine: allowed transitions, per-role permission, payment gate before `CREATING`, every move written to deal events.
3. Content submission (Instagram or Drive URL by campaign type) + brand approve / request changes / complete, auto-moving `CREATING → REVIEW → COMPLETED`.
4. Two-way structured feedback at completion, stored for ranking.
5. Real dashboard numbers and activity lists for creator, brand and admin.

**Phase B — money and mail**
6. Stripe checkout for securing a deal, webhook-verified confirmation, released state on approval, full payment event history, honest success/cancel/failure messages.
7. Transactional email: welcome, invite, pitch received, deal state change, payment secured/released, password reset — non-blocking, failures logged.
8. Forgot-password request and reset screens.

**Phase C — intelligence and trust**
9. Two matching weighting profiles (influencer vs UGC), plus portfolio-strength and past-feedback signals; keep labels, never percentages.
10. Instagram OAuth connect with follower/engagement sync feeding audience signals; manual entry stays as fallback.
11. Trends from real published-campaign activity, with an empty state when there is not enough data.
12. Brand activity indicator computed from real posting/campaign/response activity.

**Phase D — operations and polish**
13. Notification coverage for every event type, unread badge accuracy, mark-as-read, deep links.
14. Support tickets and disputes: user-facing raise flow, admin resolve/assign, AI-review queue actions.
15. Admin analytics: transaction volume, completed deals, verification throughput.
16. Seed pack (10 creators with mixed and tiny followings, 5 brands with DNA, published campaigns, precomputed matches, sample chat, one completed deal with feedback) kept clearly flagged and separate from real data.
17. Responsive pass and empty/error-state sweep across every list and mutation.

## Feature ideas beyond the spec

- Saved searches and creator collections for brands.
- Campaign templates and duplicate-campaign.
- Creator availability calendar and response-time badge.
- Rate cards per deliverable type instead of a single starting price.
- Bulk invite from a match list with per-creator personalised notes.
- Exportable campaign performance recap for the brand at completion.
- Referral loop: creators invite brands they already work with.

## Technical notes

- Deal transitions, payment state and content approvals all live in server functions with role checks; the client never sets `payment_secured` or a deal state directly.
- Stripe runs through Lovable-managed payments with the webhook on a public API route, signature-verified, writing `payments` and `payment_events`.
- Email goes through a single non-blocking service module with an env-configured from-address.
- Matching stays deterministic and explainable; the AI only phrases reasons from signals that actually matched, and prints "Not enough data yet" when a signal is absent.
