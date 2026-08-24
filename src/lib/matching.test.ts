import { describe, expect, it } from "vitest";
import {
  detectProfile,
  scoreCreator,
  type CampaignForMatching,
  type CreatorForMatching,
} from "./matching";

const baseCreator: CreatorForMatching = {
  id: "c1",
  display_name: "Test Creator",
  headline: null,
  bio: null,
  location: null,
  languages: [],
  creator_types: ["Influencer"],
  categories: ["Beauty"],
  starting_price_inr: 10000,
  open_to_paid: true,
  open_to_barter: false,
  dna: null,
};

const baseCampaign: CampaignForMatching = {
  brief: {
    objective: "",
    deliverables: [],
    categories: ["Beauty"],
    creator_types: ["Influencer"],
    platforms: [],
    locations: [],
    keywords: [],
    tone: [],
    do_not: [],
    timeline: "",
    budget_note: "",
  },
  compensation_type: "paid",
  budget_min: null,
  budget_max: 20000,
};

describe("scoreCreator", () => {
  it("never uses follower count — two creators identical except id score identically", () => {
    const a = scoreCreator(baseCampaign, baseCreator);
    const b = scoreCreator(baseCampaign, { ...baseCreator, id: "c2" });
    expect(a.score).toBe(b.score);
  });

  it("stays within [0, 100] across varied fixtures", () => {
    const fixtures: CreatorForMatching[] = [
      baseCreator,
      { ...baseCreator, categories: [], creator_types: [], starting_price_inr: null },
      { ...baseCreator, categories: ["Fitness", "Wellness"], starting_price_inr: 999999 },
      { ...baseCreator, open_to_paid: false, open_to_barter: false },
    ];
    for (const creator of fixtures) {
      const { score } = scoreCreator(baseCampaign, creator);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("scores higher when category and creator type overlap the brief", () => {
    const matching = scoreCreator(baseCampaign, baseCreator);
    const nonMatching = scoreCreator(baseCampaign, {
      ...baseCreator,
      categories: ["Automotive"],
      creator_types: ["Podcaster"],
    });
    expect(matching.score).toBeGreaterThan(nonMatching.score);
  });

  it("scores higher when price fits the budget than when it doesn't", () => {
    const withinBudget = scoreCreator(baseCampaign, { ...baseCreator, starting_price_inr: 15000 });
    const overBudget = scoreCreator(baseCampaign, { ...baseCreator, starting_price_inr: 100000 });
    expect(withinBudget.score).toBeGreaterThan(overBudget.score);
  });

  it("a negative learned category weight measurably lowers the score", () => {
    const cold = scoreCreator(baseCampaign, baseCreator);
    const disliked = scoreCreator(baseCampaign, baseCreator, undefined, {
      category_weights: { beauty: -1 },
      tone_weights: {},
    });
    expect(disliked.score).toBeLessThan(cold.score);
  });

  it("cold start (no weights row) applies zero preference adjustment", () => {
    const withUndefined = scoreCreator(baseCampaign, baseCreator, undefined, undefined);
    const withNull = scoreCreator(baseCampaign, baseCreator, undefined, null);
    expect(withUndefined.score).toBe(withNull.score);
    expect(withUndefined.signals["profile_weighting"]).toBe(0);
  });

  it("fit label follows the documented score thresholds", () => {
    expect(scoreCreator(baseCampaign, baseCreator).fit).toBeDefined();
    const weak = scoreCreator(baseCampaign, {
      ...baseCreator,
      categories: [],
      creator_types: [],
      open_to_paid: false,
      open_to_barter: false,
      starting_price_inr: null,
    });
    expect(["potential", "weak"]).toContain(weak.fit);
  });
});

describe("detectProfile", () => {
  it("detects a UGC-leaning brief", () => {
    const profile = detectProfile({
      objective: "",
      deliverables: ["3 UGC videos"],
      categories: [],
      creator_types: ["UGC Creator"],
      platforms: [],
      locations: [],
      keywords: ["user generated"],
      tone: [],
      do_not: [],
      timeline: "",
      budget_note: "",
    });
    expect(profile).toBe("ugc");
  });

  it("detects an influencer-leaning brief", () => {
    const profile = detectProfile({
      objective: "Build awareness with an influencer ambassador",
      deliverables: ["shoutout"],
      categories: [],
      creator_types: [],
      platforms: [],
      locations: [],
      keywords: [],
      tone: [],
      do_not: [],
      timeline: "",
      budget_note: "",
    });
    expect(profile).toBe("influencer");
  });

  it("falls back to balanced with no strong hints either way", () => {
    expect(
      detectProfile({
        objective: "",
        deliverables: [],
        categories: [],
        creator_types: [],
        platforms: [],
        locations: [],
        keywords: [],
        tone: [],
        do_not: [],
        timeline: "",
        budget_note: "",
      }),
    ).toBe("balanced");
  });
});
