import { describe, expect, it } from "vitest";
import { shouldUsePortfolioPath } from "./classification.server";

describe("shouldUsePortfolioPath", () => {
  it("uses the portfolio path for declared UGC creators", () => {
    expect(
      shouldUsePortfolioPath({
        creatorTypes: ["UGC Creator"],
        connectedInstagram: true,
        followersCount: 50000,
      }),
    ).toBe(true);
  });

  it("uses the portfolio path when there's no connected Instagram", () => {
    expect(
      shouldUsePortfolioPath({
        creatorTypes: ["Influencer"],
        connectedInstagram: false,
        followersCount: null,
      }),
    ).toBe(true);
  });

  it("uses the portfolio path below the follower floor", () => {
    expect(
      shouldUsePortfolioPath({
        creatorTypes: ["Influencer"],
        connectedInstagram: true,
        followersCount: 1999,
      }),
    ).toBe(true);
  });

  it("uses the social path for a connected influencer above the floor", () => {
    expect(
      shouldUsePortfolioPath({
        creatorTypes: ["Influencer"],
        connectedInstagram: true,
        followersCount: 40000,
      }),
    ).toBe(false);
  });
});
