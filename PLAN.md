# Bingo — Run + Classification + Scoring Engine Plan

Sources: full repo scan (`src/`, `supabase/migrations/`) + `research/patform.pdf` (three overlapping
drafts of the same product — a hackathon PRD, a Node/Mongo backend spec, and the final
"Bingo Scoring Engine: Core Build Doc" for a standalone Python service). Where drafts disagree,
this plan follows **what the repo actually contains today**, not the oldest draft.

Ground truth: this is **not** greenfield. It's a TanStack Start + Supabase app with a working
taxonomy, a working (TypeScript, in-process) matching engine, and a working AI pipeline. The
PDF's Python service doc describes something that doesn't exist yet (`server/` isn't in the repo).
Nothing below re-derives what's already built — it extends it.

---

## 1. Running the app today

**Stack:** TanStack Start (React 19 + Vite + Nitro) on the frontend/server-fn layer, Supabase
(Postgres + Auth) as the database, package manager is **bun** (`bun.lock`, `bunfig.toml`).

```bash
bun install
bun run dev      # vite dev — TanStack Start dev server
```

**Environment (`.env`, already present):**

```
SUPABASE_URL=...
SUPABASE_PROJECT_ID=vgatysibsnqwweyrnolr
SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PROJECT_ID=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

This points at a **live, hosted Lovable-managed Supabase project** — there is no local Postgres
to stand up. `bun run dev` against this `.env` gets you the full app with real auth and real data
immediately.

**Gap to know about before touching AI features:** `src/lib/ai.server.ts` calls
`process.env["LOVABLE_API_KEY"]` (routed through `https://ai.gateway.lovable.dev`, model
`google/gemini-2.5-flash`). That key is **not in `.env`** — it's injected by the Lovable Cloud
runtime in the hosted preview/production environment, not available for a bare local `bun run
dev`. Locally, every AI-backed flow (Creator DNA, Brand DNA, campaign brief generation, the
Instagram-suggestions pipeline) will throw `"AI is not configured yet."` until you either add a
`LOVABLE_API_KEY` yourself or run inside Lovable's environment.

**Database migrations:** `supabase/migrations/*.sql` are incremental deltas Lovable's AI applies
directly to the hosted project when you edit schema through Lovable, or via `supabase db push`
if you use the Supabase CLI locally against the linked project (`supabase link --project-ref
vgatysibsnqwweyrnolr`). You don't need Docker/`supabase start` unless you specifically want an
offline local Postgres instance.

**Seed data:** there's no standalone seed script — seeding is an in-app, admin-gated server
function. `src/lib/seed.functions.ts::seedDemoData` requires an authenticated admin (checked via
`has_role` RPC), then uses `supabaseAdmin` (service-role client) to create real auth users +
`creator_profiles`/`brand_profiles`/campaigns from `src/lib/seed-data.ts`. To seed:
sign up → get promoted to `admin` role (via `user_roles` table) → call `seedDemoData` from the
admin surface.

---

## 2. Creator profile classification & category labeling

### 2.1 What already exists

- `src/lib/taxonomy.ts` — `CATEGORIES` (15 values: Beauty, Skincare, Fashion, Fitness, Food &
  Beverage, Travel, Tech & Gadgets, Gaming, Finance, Home & Living, Parenting, Automotive,
  Education, Wellness, Sustainability) and `CREATOR_TYPES` (10 values, incl. "UGC Creator").
  This is the taxonomy's single source of truth today — reuse it, don't reinvent it.
- `creator_profiles.categories` — a **multi-value** array, editable by the creator, also settable
  by AI suggestions.
- `src/lib/instagram-ai.server.ts::buildInstagramSuggestions` — already does profile
  classification from real Instagram data (bio + up to 12 recent captions + engagement rate),
  constrained to the taxonomy, via the Lovable/Gemini gateway. Output goes into
  `ai_profile_suggestions` as a **proposed diff**; nothing is written until the user clicks apply
  (`applySuggestion`). This is the human-in-the-loop review the PRD asks for, and it already
  works.
- `src/lib/matching.ts` already treats UGC vs. influencer differently: `detectProfile()` picks a
  weight profile per **campaign**, and the UGC weight set already zeroes out anything
  follower-count-shaped. What it does *not* do is change how a **creator's own category label**
  gets produced based on whether they're UGC.

### 2.2 The actual gap

Nothing today produces a **single, confident, brand-facing primary category**. `categories` is a
free multi-select the creator (or an AI suggestion) fills in — good for matching nuance, useless as
a one-glance label ("Beauty" vs. "Beauty, Skincare, Fashion, Wellness"). And nothing branches
on creator type for *which evidence* gets classified: a UGC creator with 400 followers and three
portfolio links gets the same bio/caption-based classification path as a 40K-follower influencer,
even though the doc's own premise is that a UGC profile "won't stand out" and shouldn't be judged
on that axis.

### 2.3 Design

**New columns on `creator_profiles`** (migration, additive — nothing existing breaks):

```sql
alter table public.creator_profiles
  add column primary_category text,
  add column category_confidence numeric(3,2),
  add column category_source text check (category_source in ('social','portfolio','manual'));
```

`primary_category` is constrained to one `CATEGORIES` value (validate in the app layer via a
Postgres `check` against the taxonomy list, or a `CATEGORIES` lookup table if you want it
enforced in SQL). `categories[]` stays as-is — it keeps feeding `matching.ts`'s Dice-style overlap
scoring, which genuinely benefits from multiple tags. `primary_category` is a *new, separate*
field purpose-built for the one-glance label and for brand filtering.

**Source-aware classification — the UGC branch:**

Decide the input, not just the prompt, based on creator type/signal strength:

- **Standard / influencer path** (has a connected, OAuth-verified Instagram account, or
  meaningful bio+caption text): classify from the existing `describeSnapshot()`-style bundle
  (bio, recent captions, engagement) — same evidence `buildInstagramSuggestions` already
  assembles. `category_source = 'social'`.
- **UGC / sparse-profile path** (creator_types includes "UGC Creator", or no connected social
  account, or below a small follower floor): classify from `portfolio_links` +
  `previous_collaboration_links` + bio instead. The prompt explicitly does **not** ask the model to
  judge reach or polish — it summarizes what the linked work *is* (e.g. "product-shoot UGC for
  skincare and food brands") and maps that summary to one category. `category_source =
  'portfolio'`.

Both paths return **one** category (not an array) plus a confidence float, from a JSON-schema-
constrained call so the output can't drift outside the 15/16-value taxonomy. Where this call lives
is a build-order question, answered in §3 — it's naturally the **Classification layer** of the new
scoring engine, run once at profile-write time (onboarding, or "re-analyze" after editing
portfolio/social), not on every read.

**One small taxonomy fix before any classification work starts:** the user's own example
("beauty, health, lifestyle") includes "Lifestyle," which isn't in `CATEGORIES` today (closest is
"Wellness," which is not the same vertical). Decide now whether to add `"Lifestyle"` as a 16th
category — recommended, since it's one of the most common creator verticals and its absence
will visibly misclassify a chunk of real profiles. This is the "highest-leverage half hour" the PDF
calls out for the Python taxonomy (§3.5) — do it once, for both the TS and Python taxonomies
together, or they drift.

### 2.4 Brand-side discovery: filter by up to 3 categories

`discover.tsx` today does client-side free-text filtering over whatever `listPublicCreators`
returns (`src/lib/campaigns.functions.ts:781`) — no server-side category filter, no cap.

Add a category **chip-select capped at 3** above the search box, and push the filter server-side:

```ts
// campaigns.functions.ts — listPublicCreators, extended
.inputValidator((input: { categories?: string[] }) => ({
  categories: (input.categories ?? []).slice(0, 3),
}))
...
let query = context.supabase.from("creator_profiles").select(...)...
if (data.categories.length) query = query.in("primary_category", data.categories);
```

Brands pick ≤3 categories → server returns creators whose single `primary_category` is in that
set. This is the exact "brand looks up creators by category (max 3)" behavior — the cap lives on
the *brand's filter selection*, matched against the creator's *single* label, which is why the
one-label design in §2.3 matters: a multi-label creator would show up under filters that aren't
really their category.

---

## 3. The AI Scoring Engine — standalone Python service

This is new work — `server/` does not exist in the repo. Below adapts the PDF's "Bingo Scoring
Engine: Core Build Doc" verbatim where it's already correct, and corrects it for this repo's reality
(existing Postgres schema, existing taxonomy, existing TS matching engine that shouldn't be
thrown away mid-flight).

### 3.1 Why standalone, and the one filesystem rule that matters

Independent of the frontend on purpose: the Lovable rebuild of the frontend doesn't block this,
and every route is verifiable with `curl` + a seed script on day one. The HTTP boundary means
either side — Lovable frontend or Python engine — can be rewritten without touching the other.

That independence has a filesystem consequence: **`server/` is a top-level directory, sibling to
`src/`**, outside anything Lovable's auto-sync writes to. If it lived under `src/`, the next Lovable
export could overwrite or conflict with it, and the engine would get lost to a frontend deploy.

### 3.2 The three layers — keep them separate

| Layer | Job | Who does it |
|---|---|---|
| Classification | Free text → fixed enums | Claude, once per entity, at write time |
| Scoring | Enums → a number | Pure Python, at read time |
| Learning | Outcomes → weights | Pure Python + one Claude call for text reasons |

The LLM never sees a ranking request. It classifies on the way in and phrases results on the way
out. Everything between is arithmetic you can print and defend — "why is this creator ranked
third" gets answered with six integers, not a vector.

No RAG, no embeddings, no pgvector. Retrieval over a few dozen rows is `SELECT *`; cosine
similarity over a ~16-item closed vocabulary is a worse, unauditable version of set intersection.

### 3.3 Repo layout

```
server/
  main.py            # FastAPI app, routes, startup
  db.py              # engine, session dependency
  models.py          # SQLModel tables — new ones only, see §3.4
  config.py          # env loading
  ai/
    __init__.py
    taxonomy.py       # mirrors src/lib/taxonomy.ts — keep in sync, see §3.5
    claude_client.py  # all Claude calls live here, nowhere else
    schemas.py        # JSON schemas generated from taxonomy
  matching.py         # deterministic scoring — ports src/lib/matching.ts, see §3.7
  learning.py         # weight updates
  seed.py
tests/
  test_matching.py       # pure functions, no DB, no network
  test_dna_consistency.py
requirements.txt
.env.example
```

Rule worth enforcing from day one: **`matching.py` imports nothing from `claude_client.py`**. If
scoring can't run offline with zero network calls, the design is broken and the tests will be slow
and flaky.

### 3.4 Database: reuse the existing Supabase Postgres, don't fork it

The generic hackathon doc assumes a fresh schema built from scratch (`users`, `creator`,
`brand`, `campaign`...). **This repo already has that schema, live, in Supabase**, with real
creators/brands/campaigns/DNA already flowing through the TS app. Re-creating those tables
from `server/models.py` would either collide or fork the data. Instead:

- Point `DATABASE_URL` at the **same Supabase Postgres**, using the **direct connection
  string** (Session/Transaction pooler won't do DDL reliably; `create_all` needs the direct one).
  Get it from Supabase dashboard → Settings → Database → Connection string. `psycopg[binary]`,
  not `asyncpg`, to match `sqlmodel`'s sync engine.
- `server/models.py` defines **only the tables that don't already exist**: `Match` (score +
  persisted breakdown, tier, explanation), `BrandPreferenceWeights`, `WeightHistory`. Everything
  else — `creator_profiles`, `brand_profiles`, `campaigns`, `creator_dna`, `brand_dna` — the
  Python service **reads and writes into the existing tables** via plain SQL/SQLModel
  reflection, it does not own or redefine them.
- `SQLModel.metadata.create_all(engine)` at startup only creates the *new* tables (`Match`,
  `BrandPreferenceWeights`, `WeightHistory`); it's a no-op against tables that already exist, so
  it's safe to run against the live project.

```python
# server/db.py
from sqlmodel import SQLModel, Session, create_engine
from server.config import settings

engine = create_engine(settings.database_url, echo=False)

def init_db() -> None:
    SQLModel.metadata.create_all(engine)   # only creates Match / BrandPreferenceWeights / WeightHistory

def get_session():
    with Session(engine) as session:
        yield session
```

`.env.example`:

```
DATABASE_URL=postgresql+psycopg://postgres:<password>@db.vgatysibsnqwweyrnolr.supabase.co:5432/postgres
ANTHROPIC_API_KEY=sk-ant-...
```

(SQLite-for-offline-dev is a legitimate fallback per the PDF if the Supabase project's availability
becomes a demo-day risk, but since this repo's data already lives in Supabase, staying on
Postgres is the reuse-first move — don't fork the data store for a hackathon convenience you
don't need here.)

### 3.5 Taxonomy — one source, mirrored, not duplicated-and-drifted

`ai/taxonomy.py` must mirror `src/lib/taxonomy.ts` exactly (same category strings, including
whatever the "Lifestyle" decision from §2.3 lands on). TypeScript and Python can't literally share
a module, so:

```python
# ai/taxonomy.py
from enum import Enum

class Category(str, Enum):
    beauty = "Beauty"
    skincare = "Skincare"
    fashion = "Fashion"
    fitness = "Fitness"
    food_beverage = "Food & Beverage"
    travel = "Travel"
    tech_gadgets = "Tech & Gadgets"
    gaming = "Gaming"
    finance = "Finance"
    home_living = "Home & Living"
    parenting = "Parenting"
    automotive = "Automotive"
    education = "Education"
    wellness = "Wellness"
    sustainability = "Sustainability"
    # lifestyle = "Lifestyle"   # add once §2.3 taxonomy decision is made — add to taxonomy.ts too

class CreatorType(str, Enum):
    ugc_creator = "UGC Creator"
    influencer = "Influencer"
    photographer = "Photographer"
    videographer = "Videographer"
    editor = "Editor"
    model = "Model"
    podcaster = "Podcaster"
    writer = "Writer"
    illustrator = "Illustrator"
    meme_creator = "Meme Creator"
```

Leave a comment at the top of both files pointing at each other, since there's no build-time check
across languages: `# keep in sync with src/lib/taxonomy.ts` / `# keep in sync with
server/ai/taxonomy.py`.

Two things that will bite if skipped:

- **Overlapping categories.** Beauty and Skincare both existing means Claude has to pick, and
  will pick inconsistently unless told how. Put a one-line disambiguation in the JSON-schema
  field description (not the system prompt): *"Skincare: only for content primarily about
  routines, ingredients, product efficacy. Beauty: makeup, hair, general aesthetics."* Same for
  Fitness vs. Wellness. This is the highest-leverage half hour in the whole build — every
  downstream score inherits this precision or this noise.
- **Postgres string arrays.** SQLModel stores `list[Category]` in an `ARRAY(String)` column as
  plain strings. `set(creator.categories) & set(campaign.categories)` still works because
  `Category` subclasses `str`, but it works by accident — normalize with `.value` on read, or
  accept it knowingly.

### 3.6 Claude integration — classification layer

Structured outputs (GA), not forced tool-use: `output_config.format` grammar-constrains at the
token level, so an out-of-vocabulary category is unrepresentable, not just unlikely.

```python
# ai/claude_client.py
import json, anthropic
from server.ai.schemas import CREATOR_CATEGORY_SCHEMA

client = anthropic.Anthropic()
DNA_MODEL = "claude-haiku-4-5"
EXPLAIN_MODEL = "claude-sonnet-5"

def classify_creator_category_social(bio: str, captions: list[str], engagement_rate: float | None) -> dict:
    resp = client.messages.create(
        model=DNA_MODEL, max_tokens=512, temperature=0,
        system=(
            "You assign ONE primary content category from a fixed taxonomy, from social profile "
            "evidence. Pick the single best-fitting category, not several. "
            "Do not infer a category from a single passing mention."
        ),
        messages=[{"role": "user", "content": f"Bio:\n{bio}\n\nRecent captions:\n" + "\n".join(captions)}],
        output_config={"format": {"type": "json_schema", "schema": CREATOR_CATEGORY_SCHEMA}},
    )
    return json.loads(resp.content[0].text)   # {"category": "Beauty", "confidence": 0.82}

def classify_creator_category_portfolio(portfolio_links: list[str], link_summaries: list[str], bio: str) -> dict:
    resp = client.messages.create(
        model=DNA_MODEL, max_tokens=512, temperature=0,
        system=(
            "This creator is a UGC/portfolio creator — do not judge or infer anything about their "
            "reach or follower count. Assign ONE primary content category from a fixed taxonomy "
            "based only on what their linked portfolio work actually is."
        ),
        messages=[{"role": "user", "content": f"Bio:\n{bio}\n\nPortfolio summary:\n" + "\n".join(link_summaries)}],
        output_config={"format": {"type": "json_schema", "schema": CREATOR_CATEGORY_SCHEMA}},
    )
    return json.loads(resp.content[0].text)
```

`temperature=0` on every classification call — the same input should produce the same label on
every run; any variance is pure downstream noise. `generate_*_dna` and both
`classify_creator_category_*` calls use Haiku 4.5 (constrained extraction, grammar does the
work). `explain_matches` (§3.9) uses Sonnet 5 — one batched call per ranking, where prose
quality is what a judge/brand actually reads.

**Never call classification from a read path.** Category + DNA are generated once, at
creator/brand/campaign write time, and persisted. If it ever runs on a GET, one page refresh
becomes N Haiku calls and the cost model collapses. This is the single discipline that keeps the
whole build cheap (§3.12).

### 3.7 Scoring — port `matching.ts`, don't redesign it

`src/lib/matching.ts` already implements almost exactly what the PDF's `matching.py` describes:
weighted sub-scores, a UGC vs. influencer weight-profile split, Dice-style category/keyword
overlap, fit-label bucketing (it currently uses `strong/good/potential/weak` — same four tiers the
PDF specifies), grounded reasons + gaps, no follower count anywhere. Port this logic to
`server/matching.py` **as the same six-term formula**, so both engines agree during the
transition period (§3.7 rewritten in Python for the standalone service, `matching.ts` kept running
for the current in-app UI until the frontend cuts over — see §3.14).

Two correctness fixes the PDF calls out that `matching.ts` doesn't need today (no learning loop
yet) but the Python port must get right from the start once `BrandPreferenceWeights` exists:

**Fix 1 — learned weights apply over the creator's tags, not the intersection.** If you intersect
`creator.tags` with `campaign.tags` before applying a learned weight, a brand's "too polished"
rejection (Polished → −0.15) never fires on a later campaign that doesn't itself ask for "Polished"
— which is exactly the case the learned weight exists for. Apply the weight over the creator's own
tags:

```python
def _weighted_adj(tags: list[str], weight_map: dict[str, float]) -> float | None:
    vals = [weight_map.get(t, 0.0) for t in tags]
    return mean(vals) if vals else None

cat_adj = _weighted_adj(creator.categories, weights.category_weights)
tone_adj = _weighted_adj(creator.tone_tags, weights.tone_weights)
present = [v for v in (cat_adj, tone_adj) if v is not None]
pref_adjustment = (mean(present) * 15) if present else 0.0
```

**Fix 2 — don't average a real signal against a structural zero.** If `cat_adj` is 0 only because
the term didn't apply (no category overlap to average), don't let that zero halve a genuine
`tone_adj` signal. Average over the sides that actually have values, as above.

**Cold start:** every learned weight defaults to 0, so `pref_adjustment` is 0 and ranking is pure
content fit until real feedback accumulates. That's correct — don't add a fake prior.

**Tests worth having** (pure functions, no DB, no network, sub-second):

- `dice([], [])` is 0, `dice(["a"], ["a"])` is 1.0
- a specialist with 2 tags and a generalist with 5, both overlapping on 2, score comparably
  (symmetric Dice, the whole reason to use it over raw intersection count)
- **two identical creators differing only in `follower_count` score identically** — this is the UGC
  guarantee; assert it, don't assume it
- base score stays in [0, 100] across randomized DNA
- a creator with a −1.0 weight on all their tags scores measurably below the same creator at
  neutral

### 3.8 Learning loop

- **Rejection weighs more than acceptance, deliberately** — e.g. 0.15/rejection vs. 0.05/
  acceptance. Acceptance is noisy (price, availability); a stated rejection reason is a clean
  signal. Comment the asymmetry so it doesn't get "fixed" later.
- **Clamp on write, not on read** — otherwise weights escape ±1 and the ±15 nudge silently
  becomes ±40.
- **Persist a weight-history row** (`brand_id, timestamp, event_id, weights_snapshot`) — cheap,
  and it's the only way to actually *show* "here's the vector before the rejection, here's after,
  here's the re-rank" instead of asserting it.
- `classify_feedback_reason` returns **direction only, never magnitude**:
  `{"tone_adjustments": {"Polished": -1}, "category_adjustments": {}}`. Python owns the step
  size. Same principle as not letting the LLM emit the ranking — never let it emit the number that
  goes into the formula.

### 3.9 API surface

```
POST /creators/{id}/classify        # runs classification (social or portfolio path), writes
                                     # primary_category + confidence + source back to Supabase
GET  /campaigns/{id}/matches        # full pipeline; ?explain=false skips the Sonnet call
POST /feedback                      # updates weights in the same transaction as the Feedback insert
GET  /brands/{id}/weights           # debug the learning loop without opening a shell
```

- `GET /campaigns/{id}/matches` runs the full pipeline synchronously. Scoring a few dozen
  creators in Python is sub-millisecond; the Sonnet explanation call is the entire latency. Accept
  a couple of seconds, or use `?explain=false` while iterating on scoring (faster and free).
- `POST /feedback` must update weights inside the **same transaction** as the `Feedback` insert
  — a recorded event that doesn't move the weights is worse than no event.
- CORS wide open for now (no auth/cookies on this service yet) — Lovable's preview domain isn't
  known in advance.

**Response shape — return hydrated rows, not bare IDs.** A bare `creator_id` list forces N
follow-up calls for name/avatar and builds an N+1 into the one endpoint that runs on page load.

```json
{
  "campaign_id": "cmp_123",
  "matches": [
    {
      "creator_id": "cr_007", "name": "Ananya R", "handle": "@ananyar",
      "avatar_url": "...", "follower_count": 12400,
      "tier": "Strong Fit", "score": 84.5,
      "explanation": "Strong overlap on skincare with an authentic tone...",
      "primary_category": "Skincare",
      "breakdown": { "category_score": 24.0, "tone_score": 11.25 }
    }
  ]
}
```

Three separations worth holding onto — they're the ones that get collapsed by accident:

- **Display data vs. scoring data.** Name/handle/avatar/follower count live on the creator row
  and are never read by the scoring function. Tags/DNA live separately and are never rendered
  raw. `follower_count` in the response payload: fine. `follower_count` inside `matching.py`: the
  exact bug this whole design exists to prevent.
- **Render `tier`, not `score`.** Ship `score` in the payload for sorting/debugging, don't print it —
  a raw number invites "why 87 and not 89," which has no defensible answer; the tier does.
- **The engine owns ranking order.** The frontend renders `matches` in array order and never
  re-sorts. State this explicitly to whoever touches the frontend — a "sort by followers" dropdown
  quietly undoes the entire scoring design.

### 3.10 Seed data

Generate DNA/category through the real classification pipeline — never hand-write it. Hand-
written labels are always cleaner than what Claude actually produces, so testing against them
tests nothing about production behavior. Write ~15 creator bios (mix of clean-Instagram
influencers and sparse-profile UGC creators with portfolio links) and ~5 brand descriptions as
realistic prose, deliberately including 2–3 ambiguous ones (a fitness creator who also posts
recipes, a beauty creator drifting into fashion) — those expose weak taxonomy disambiguation.
`seed.py` idempotent: truncate-then-insert, since it'll run often during the build.

### 3.11 DNA/classification consistency check — do this before writing `matching.py`

The actual risk, and the step people skip. If the same bio classifies as `Beauty` on one run and
`Fashion` on the next, every downstream score is noise, and no amount of weight-tuning recovers
it — both answers look reasonable in isolation, so eyeballing won't catch it.

```python
# tests/test_dna_consistency.py
def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if (a or b) else 1.0

def test_category_is_stable_across_runs():
    for bio in FIXTURE_BIOS:          # the seed bios
        runs = [classify_creator_category_social(bio, [], None) for _ in range(3)]
        cats = [r["category"] for r in runs]
        assert len(set(cats)) == 1, f"unstable: {cats}"
```

Since this is a **single-label** classification (§2.3), the bar is exact agreement across runs, not
a Jaccard threshold. If it fails: fix the enum disambiguation text and add 2–3 few-shot examples
to the system prompt, then rerun — don't proceed to scoring until it passes. Freeze the fixture
output to a JSON file afterward; matching tests should load that, not call the API.

### 3.12 Running it for free

- **Claude API**: no permanent free tier, but signup credit covers this comfortably if
  classification is write-time-only (§3.6) and `?explain=false` is used while iterating on scoring
  — the Sonnet explanation call is the large majority of spend. Set a spend cap in the console
  regardless.
- **Hosting for a demo**: skip a PaaS deploy — run `uvicorn` locally behind a Cloudflare Tunnel
  (free, no account for a quick tunnel, public HTTPS the frontend can call, no cold start, hot-
  reloadable mid-demo). A named tunnel avoids the "URL changed on restart, everything 404s"
  failure mode (§3.15).
- **Database**: already solved — reusing the existing Supabase project (§3.4) means no
  additional spin-up/pause risk beyond what the app already lives with.

### 3.13 Build order — strictly sequential, each step verifiable before the next

1. `ai/taxonomy.py` with disambiguation descriptions written properly, mirrored from
   `src/lib/taxonomy.ts` (including the Lifestyle decision).
2. `models.py` (new tables only) + `db.py`; confirm `create_all` doesn't touch existing Supabase
   tables and does create `Match`/`BrandPreferenceWeights`/`WeightHistory`.
3. `claude_client.classify_creator_category_social` + `_portfolio` + `schemas.py`.
4. Consistency test (§3.11) — must pass exact-match before continuing.
5. Freeze fixture classifications to JSON.
6. `matching.py` (ported from `matching.ts`, §3.7) + offline unit tests.
7. `POST /creators/{id}/classify`, `GET /campaigns/{id}/matches` without explanations.
8. `learning.py` + `POST /feedback`; verify a score visibly moves.
9. `seed.py` end to end.
10. `explain_matches`, wired last.

Steps 1–8 are the product. Step 10 is presentation. Cutting explanations costs polish; cutting step
4 costs correctness in a way nobody notices until the demo produces a ranking that makes no
sense.

### 3.14 Connecting to the frontend — and the transition question

Four things, in the order they'll break:

- **Hand over the contract, don't describe it.** FastAPI serves `/openapi.json`; generate the
  frontend client/types from that rather than hand-writing both sides (`follower_count` vs.
  `followerCount` drift is exactly this failure). Requires explicit `response_model`s
  (`response_model=list[MatchOut]`) — without them OpenAPI reports `{}` for the body.
- **CORS**: allow the Lovable preview domain and wherever it's published; `allow_credentials`
  + `allow_origins=["*"]` together are rejected by the browser and the error reads like a server
  fault.
- **Base URL as an env var** (`VITE_SCORING_API_URL`), never hardcoded — a Cloudflare quick
  tunnel issues a new hostname per restart, and a hosted HTTPS frontend can't call
  `http://localhost:8000` (Chrome tolerates loopback, Safari doesn't).
- **Never re-sort client-side.** The engine owns ranking order.

**Open transition decision (flagged, not resolved here):** `src/lib/matching.ts` is live and used
by the current UI today. Recommend building `server/` alongside it — verified independently via
curl/tests per §3.13 — and only cutting the frontend's match-fetching over to
`GET /campaigns/{id}/matches` once the Python engine is passing its own test suite and has been
spot-checked against real seed data. Ripping out working in-app matching mid-build to make room
for a service that isn't proven yet is the kind of premature swap worth avoiding; the HTTP
boundary means the cutover can happen in one place (wherever the frontend currently calls into
`matching.ts`) whenever it's ready, not as a prerequisite to starting the Python build.

### 3.15 Failure modes — lookup table, not narrative

The **silent** ones are the dangerous ones: no error, no log, no test that naturally catches them.

| Symptom | Cause | Fix / check |
|---|---|---|
| (silent) Feedback recorded, weights never change | JSON column mutated in place; SQLAlchemy tracks by identity, sees nothing dirty | Wrap in `MutableDict.as_mutable(JSON)`, or reassign the whole dict on every write. Check: `GET /brands/{id}/weights` before/after `POST /feedback` |
| New weight rows come back `None` not `{}` | `default_factory` is Pydantic-level, ignored with a raw `sa_column` | Set `default=dict` on the `Column` itself |
| Schema change missing from DB | `create_all()` only creates missing tables, never `ALTER`s existing ones | Drop/recreate the affected new table during the build; keep `seed.py` cheap to rerun |
| (silent) Learned dislike never fires on a later campaign | Weight applied over `creator.tags & campaign.tags` intersection | §3.7 Fix 1 — apply over the creator's own tags. Check: give feedback on campaign A, verify re-ranking on campaign B, not A |
| (silent) A real preference signal gets halved | Averaging a real adjustment against a structural zero | §3.7 Fix 2 |
| Scores drift outside 0–100 | Weights clamped on read instead of write | Clamp inside the weight-update function, every write |
| (silent) Ranking looks arbitrary for similar creators | Unstable classification — same bio, different category across runs | §3.11 consistency test must pass before `matching.py` is trusted |
| (silent) UGC creators quietly rank low | `follower_count` or any size proxy leaked into the scoring function | §3.7 identical-creators-differ-only-by-followers test |
| `KeyError`/`None` reading Claude's response | Mixed `content[0].text` (structured outputs) with `tool_use.input` (forced tool-use) response shapes | Pick one path; with `output_config.format` it's always `content[0].text` |
| Explanations attached to wrong creator / missing | `explain_matches` returned a key set that doesn't match what was sent | Validate returned keys against input `creator_id`s; fall back to a templated string from `breakdown` — explanations must never fail the request |
| Credit burns fast | `classify_*`/`generate_*_dna` called from a GET | Grep for those calls outside write handlers — should return nothing |
| (silent) Reject flow does nothing visible on stage | Feedback modal has a "skip reason" option; empty `reason_text` skips `classify_feedback_reason`, only the small unconditional nudge fires | Make the text reason mandatory |
| Ranking order doesn't match the engine | Client-side sort somewhere (e.g. a "sort by followers" dropdown) | Render `matches` in array order, always — say this to whoever builds the frontend before they build it |
| "Why is this one 87 and not 89?" | Rendered `score` instead of `tier` | `tier` in the UI, `score` in the payload only; answer with the `breakdown` toggle instead |

---

## 4. Suggested order across both workstreams

1. **Taxonomy decision** (§2.3/§3.5): finalize whether "Lifestyle" is added, write the
   disambiguation text for every ambiguous category pair. Do this once, apply to both
   `src/lib/taxonomy.ts` and `server/ai/taxonomy.py`.
2. **Migration**: add `primary_category` / `category_confidence` / `category_source` to
   `creator_profiles` (§2.3).
3. **`server/` scaffold through step 5 of §3.13** — taxonomy, models (new tables only), Claude
   classification client (both social and portfolio paths), consistency test passing.
4. **`server/matching.py`** — port of `matching.ts`, with the two learning-loop fixes built in from
   the start even though the learning loop itself lands later.
5. **Wire `POST /creators/{id}/classify`** and point the onboarding/portfolio-edit flow at it (or
   at a thin server-fn proxy) so `primary_category` actually gets populated for real creators.
6. **Discover-page category filter** (§2.4) — ships as soon as `primary_category` is populated,
   independent of the rest of the scoring engine.
7. **`GET /campaigns/{id}/matches`, learning loop, seed script, explanations** — §3.13 steps
   7–10.
8. **Frontend cutover decision** (§3.14) — once the engine's own tests + a spot-check against
   seeded data look right, not before.

---

## 5. Decisions flagged for you, not assumed

- **Add "Lifestyle" to the category taxonomy?** (§2.3) — recommended, but it's your product
  call, and it touches both the TS and Python taxonomies plus any existing data already tagged
  under the current 15.
- **UGC-path threshold** (§2.3): what exactly triggers the portfolio-based classification instead
  of the social one — `creator_types` includes "UGC Creator," or no verified OAuth Instagram
  connection, or a follower-count floor, or some combination? The plan above uses "any of
  these," but the precise rule affects real creators at the boundary and is worth deciding
  deliberately rather than defaulting.
- **Cutover timing** (§3.14) — when the frontend actually switches from `matching.ts` to the
  Python service's `/matches` endpoint. Recommended: after the engine's test suite is green and
  spot-checked, not as a blocking prerequisite to starting the build.
