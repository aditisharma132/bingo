export type CampaignBrief = {
  objective: string;
  deliverables: string[];
  categories: string[];
  creator_types: string[];
  platforms: string[];
  locations: string[];
  keywords: string[];
  tone: string[];
  do_not: string[];
  timeline: string;
  budget_note: string;
};

export type FitLabel = "strong" | "good" | "potential" | "weak";

export type CreatorForMatching = {
  id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  languages: string[];
  creator_types: string[];
  categories: string[];
  starting_price_inr: number | null;
  open_to_paid: boolean;
  open_to_barter: boolean;
  dna?: {
    content_style?: string[];
    best_fit_categories?: string[];
    audience_signals?: string[];
    strengths?: string[];
  } | null;
};

export type CampaignForMatching = {
  brief: CampaignBrief;
  compensation_type: "paid" | "barter" | "hybrid";
  budget_min: number | null;
  budget_max: number | null;
};

export type MatchResult = {
  score: number;
  fit: FitLabel;
  reasons: string[];
  gaps: string[];
  signals: Record<string, number>;
  profile?: "ugc" | "influencer" | "balanced";
};

const norm = (value: string) => value.trim().toLowerCase();

function overlap(a: string[], b: string[]) {
  const setB = new Set(b.map(norm));
  return a.filter((item) => setB.has(norm(item)));
}

function keywordHits(keywords: string[], haystack: string) {
  const text = haystack.toLowerCase();
  return keywords.filter((k) => k.trim().length > 2 && text.includes(norm(k)));
}

/* Learned brand preference weights, applied over the creator's OWN tags — never the
 * campaign∩creator intersection, or a later campaign that doesn't itself mention a
 * previously-rejected tag would never trigger the learned dislike. Average only over
 * the sides that have a value, so a real signal never gets halved against a structural
 * zero (no category overlap to average, say). Cold start: no weights row -> 0 -> pure
 * content-fit ranking. */
export type MatchWeights = {
  category_weights: Record<string, number>;
  tone_weights: Record<string, number>;
} | null;

function weightedAdj(tags: string[], weightMap: Record<string, number>): number | null {
  const vals = tags.map((t) => weightMap[norm(t)]).filter((v): v is number => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/* Weight profiles: a UGC brief is judged on craft, content relevance and price
 * discipline, while an influencer/ambassador brief leans on audience reach
 * signals and category authority. Weights always sum to 100. */
export type MatchProfile = "ugc" | "influencer" | "balanced";

type WeightSet = {
  category: number;
  creator_type: number;
  content_relevance: number;
  budget: number;
  compensation: number;
  location: number;
};

const WEIGHTS: Record<MatchProfile, WeightSet> = {
  ugc: {
    category: 22,
    creator_type: 26,
    content_relevance: 26,
    budget: 16,
    compensation: 6,
    location: 4,
  },
  influencer: {
    category: 32,
    creator_type: 22,
    content_relevance: 16,
    budget: 12,
    compensation: 6,
    location: 12,
  },
  balanced: {
    category: 30,
    creator_type: 25,
    content_relevance: 18,
    budget: 15,
    compensation: 7,
    location: 5,
  },
};

const UGC_HINTS = [
  "ugc",
  "user generated",
  "user-generated",
  "product shoot",
  "testimonial",
  "creator content",
];
const INFLUENCER_HINTS = [
  "influencer",
  "ambassador",
  "reach",
  "awareness",
  "collab post",
  "shoutout",
];

export function detectProfile(brief: CampaignBrief): MatchProfile {
  const text = [...brief.creator_types, ...brief.deliverables, brief.objective, ...brief.keywords]
    .join(" ")
    .toLowerCase();
  const ugc = UGC_HINTS.filter((h) => text.includes(h)).length;
  const influencer = INFLUENCER_HINTS.filter((h) => text.includes(h)).length;
  if (ugc > influencer) return "ugc";
  if (influencer > ugc) return "influencer";
  return "balanced";
}

export function scoreCreator(
  campaign: CampaignForMatching,
  creator: CreatorForMatching,
  profileOverride?: MatchProfile,
  weights?: MatchWeights,
): MatchResult {
  const profile = profileOverride ?? detectProfile(campaign.brief);
  const W = WEIGHTS[profile];
  const brief = campaign.brief;
  const reasons: string[] = [];
  const gaps: string[] = [];

  // Category relevance (30)
  const creatorCategories = [...creator.categories, ...(creator.dna?.best_fit_categories ?? [])];
  const sharedCategories = overlap(brief.categories, creatorCategories);
  const categoryScore =
    brief.categories.length === 0
      ? W.category / 2
      : Math.min(W.category, (sharedCategories.length / brief.categories.length) * W.category);
  if (sharedCategories.length) reasons.push(`Works in ${sharedCategories.slice(0, 3).join(", ")}`);
  else gaps.push("No overlapping category yet");

  // Creator type (25)
  const sharedTypes = overlap(brief.creator_types, creator.creator_types);
  const typeScore =
    brief.creator_types.length === 0 ? W.creator_type / 2 : sharedTypes.length ? W.creator_type : 0;
  if (sharedTypes.length)
    reasons.push(`Is a ${sharedTypes.join(" / ")} — exactly what the brief asks for`);
  else if (brief.creator_types.length)
    gaps.push(`Brief asks for ${brief.creator_types.join(", ")}`);

  // Content relevance from their own words (18)
  const haystack = [
    creator.headline ?? "",
    creator.bio ?? "",
    (creator.dna?.content_style ?? []).join(" "),
    (creator.dna?.strengths ?? []).join(" "),
    creator.categories.join(" "),
  ].join(" ");
  const hits = keywordHits(brief.keywords, haystack);
  const contentScore =
    brief.keywords.length === 0
      ? W.content_relevance / 2
      : Math.min(W.content_relevance, (hits.length / brief.keywords.length) * W.content_relevance);
  if (hits.length) reasons.push(`Content already covers ${hits.slice(0, 3).join(", ")}`);
  else if (!creator.dna) gaps.push("Creator DNA not generated yet");

  // Budget compatibility (15)
  let budgetScore = W.budget / 2;
  const price = creator.starting_price_inr;
  const max = campaign.budget_max;
  if (price != null && max != null) {
    if (price <= max) {
      budgetScore = W.budget;
      reasons.push(`Starting price ₹${price.toLocaleString("en-IN")} fits the budget`);
    } else {
      budgetScore = price <= max * 1.25 ? W.budget / 2 : 0;
      gaps.push(`Starting price ₹${price.toLocaleString("en-IN")} is above budget`);
    }
  } else if (price == null) {
    gaps.push("No starting price shared yet");
  }

  // Compensation preference (7)
  let compScore = 0;
  if (campaign.compensation_type === "paid") compScore = creator.open_to_paid ? W.compensation : 0;
  else if (campaign.compensation_type === "barter")
    compScore = creator.open_to_barter ? W.compensation : 0;
  else compScore = creator.open_to_paid || creator.open_to_barter ? W.compensation : 0;
  if (compScore === 0) gaps.push(`Not open to ${campaign.compensation_type} collaborations`);

  // Location (5)
  let locationScore = W.location * 0.6;
  if (brief.locations.length && creator.location) {
    const match = brief.locations.some(
      (loc) =>
        norm(loc).includes(norm(creator.location!)) || norm(creator.location!).includes(norm(loc)),
    );
    locationScore = match ? W.location : 0;
    if (match) reasons.push(`Based in ${creator.location}`);
    else gaps.push(`Brief targets ${brief.locations.join(", ")}`);
  } else if (!creator.location) {
    gaps.push("Location not shared yet");
  }

  // Learned preference adjustment (±15), from this brand's own accept/reject history.
  const catAdj = weights ? weightedAdj(creator.categories, weights.category_weights) : null;
  const toneAdj = weights
    ? weightedAdj(creator.dna?.content_style ?? [], weights.tone_weights)
    : null;
  const presentAdj = [catAdj, toneAdj].filter((v): v is number => v !== null);
  const prefAdjustment = presentAdj.length
    ? (presentAdj.reduce((a, b) => a + b, 0) / presentAdj.length) * 15
    : 0;
  if (prefAdjustment >= 5) reasons.push("This brand's past feedback favors creators like this");
  else if (prefAdjustment <= -5)
    gaps.push("This brand's past feedback has leaned away from similar creators");

  const signals = {
    category: Math.round(categoryScore),
    creator_type: typeScore,
    content_relevance: Math.round(contentScore),
    budget: Math.round(budgetScore),
    compensation: compScore,
    location: Math.round(locationScore),
    profile_weighting: Math.round(prefAdjustment),
  };
  const score = Math.max(
    0,
    Math.min(
      100,
      Object.values(signals).reduce((sum, n) => sum + n, 0),
    ),
  );

  const fit: FitLabel =
    score >= 75 ? "strong" : score >= 55 ? "good" : score >= 35 ? "potential" : "weak";

  if (!reasons.length) reasons.push("Not enough data yet.");
  if (!gaps.length) gaps.push("No gaps found.");

  reasons.unshift(
    profile === "ugc"
      ? "Scored as a UGC brief — craft and content relevance weigh most"
      : profile === "influencer"
        ? "Scored as an influencer brief — category authority and audience fit weigh most"
        : "Scored on a balanced profile",
  );

  return { score, fit, profile, reasons: reasons.slice(0, 4), gaps: gaps.slice(0, 3), signals };
}

export const FIT_ORDER: Record<FitLabel, number> = { strong: 0, good: 1, potential: 2, weak: 3 };
