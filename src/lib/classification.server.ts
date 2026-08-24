/**
 * Single, confident, brand-facing primary category per creator — separate from the
 * multi-value `categories[]` field that matching.ts's overlap scoring uses.
 * Runs once at profile-write time (onboarding save, or "re-analyze"), never on a read.
 */
import { CATEGORIES } from "@/lib/taxonomy";

type CategoryResult = { category: (typeof CATEGORIES)[number]; confidence: number };

const categorySchema = {
  type: "object",
  additionalProperties: false,
  required: ["category", "confidence"],
  properties: {
    category: {
      type: "string",
      enum: [...CATEGORIES],
      description:
        "Pick exactly ONE. Disambiguation: Skincare = routines, ingredients, product efficacy only. " +
        "Beauty = makeup, hair, general aesthetics. Wellness = mental health, mindfulness, holistic " +
        "self-care. Fitness = workouts, training, athletic performance. Lifestyle = broad day-in-the-life " +
        "or general living content that doesn't fit a narrower category above.",
    },
    confidence: { type: "number", description: "0 to 1." },
  },
};

function coerce(data: { category: string; confidence: number }): CategoryResult {
  const category = CATEGORIES.includes(data.category as never)
    ? (data.category as CategoryResult["category"])
    : "Lifestyle";
  const confidence = Math.max(0, Math.min(1, Number(data.confidence) || 0));
  return { category, confidence };
}

/** Social/influencer path — evidence is bio + recent captions, same bundle the Instagram AI-boost flow uses. */
export async function classifyCreatorCategorySocial(
  bio: string | null,
  captions: string[],
  engagementRate: number | null,
): Promise<CategoryResult> {
  const { generateJson } = await import("@/lib/ai.server");
  const { data } = await generateJson<{ category: string; confidence: number }>({
    system:
      "You assign ONE primary content category from a fixed taxonomy, from social profile evidence. " +
      "Pick the single best-fitting category, not several. Do not infer a category from a single passing mention.",
    prompt: [
      `Bio:\n${bio || "(empty)"}`,
      "",
      `Recent captions:\n${captions.length ? captions.join("\n") : "(none)"}`,
      engagementRate != null ? `Average engagement rate: ${engagementRate}%` : "",
    ].join("\n"),
    schemaName: "creator_category_social",
    schema: categorySchema,
  });
  return coerce(data);
}

/**
 * UGC/sparse-profile path — never judges reach or polish. Evidence is bio + self-declared
 * creator types/categories + portfolio link URLs. Note: links are listed as text only, not
 * fetched or browsed — there's no link-content pipeline in this app today (see README).
 */
export async function classifyCreatorCategoryPortfolio(
  bio: string | null,
  creatorTypes: string[],
  preferredCategories: string[],
  portfolioLinks: string[],
): Promise<CategoryResult> {
  const { generateJson } = await import("@/lib/ai.server");
  const { data } = await generateJson<{ category: string; confidence: number }>({
    system:
      "This creator is a UGC/portfolio creator — do not judge or infer anything about their reach or " +
      "follower count. Assign ONE primary content category from a fixed taxonomy based on their bio, " +
      "declared creator types and self-picked category interests. Portfolio link URLs are supporting " +
      "context only, not content you can browse — don't over-weight domain names.",
    prompt: [
      `Bio:\n${bio || "(empty)"}`,
      `Creator types: ${creatorTypes.join(", ") || "(none)"}`,
      `Self-picked category interests: ${preferredCategories.join(", ") || "(none)"}`,
      `Portfolio links: ${portfolioLinks.join(", ") || "(none)"}`,
    ].join("\n"),
    schemaName: "creator_category_portfolio",
    schema: categorySchema,
  });
  return coerce(data);
}

/** Decision #5: which evidence path a creator is classified from. */
export function shouldUsePortfolioPath(opts: {
  creatorTypes: string[];
  connectedInstagram: boolean;
  followersCount: number | null;
}): boolean {
  return (
    opts.creatorTypes.includes("UGC Creator") ||
    !opts.connectedInstagram ||
    (opts.followersCount != null && opts.followersCount < 2000)
  );
}

/**
 * Feedback -> weight direction only (never magnitude — the caller owns step size).
 * Tags are a creator's own categories/creator_types, matching what scoreCreator's
 * pref_adjustment averages over.
 */
export async function classifyFeedbackReason(
  reasonText: string,
  creatorTags: string[],
): Promise<{ adjustments: Record<string, -1 | 0 | 1> }> {
  const { generateJson } = await import("@/lib/ai.server");
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["adjustments"],
    properties: {
      adjustments: {
        type: "object",
        description:
          "One entry per tag actually discussed in the reason text. -1 dislike, 1 like, omit if not mentioned.",
        additionalProperties: { type: "number", enum: [-1, 0, 1] },
      },
    },
  };
  const { data } = await generateJson<{ adjustments: Record<string, number> }>({
    system:
      "A brand explained why they accepted or rejected a creator match. Map their reason onto which of " +
      "the creator's own tags they liked (+1) or disliked (-1). Only include tags the reason text actually " +
      "discusses. Never invent a magnitude — direction only.",
    prompt: `Creator's tags: ${creatorTags.join(", ") || "(none)"}\n\nBrand's reason: ${reasonText}`,
    schemaName: "match_feedback_reason",
    schema,
  });
  const adjustments: Record<string, -1 | 0 | 1> = {};
  for (const [tag, v] of Object.entries(data.adjustments ?? {})) {
    if (creatorTags.includes(tag) && (v === -1 || v === 0 || v === 1)) adjustments[tag] = v;
  }
  return { adjustments };
}
