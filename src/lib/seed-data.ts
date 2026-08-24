export type SeedCreator = {
  email: string;
  display_name: string;
  bio: string;
  location: string;
  languages: string[];
  creator_types: string[];
  categories: string[];
  starting_price_inr: number;
  open_to_barter: boolean;
};

export type SeedBrand = {
  email: string;
  brand_name: string;
  industry: string;
  about: string;
  website: string;
  campaign_categories: string[];
  campaigns: {
    title: string;
    raw_prompt: string;
    objective: string;
    compensation_type: "paid" | "barter" | "hybrid";
    budget_min: number;
    budget_max: number;
    brief: Record<string, unknown>;
  }[];
};

export const SEED_CREATORS: SeedCreator[] = [
  {
    email: "seed.aarohi@bingo.test",
    display_name: "Aarohi Menon",
    bio: "Skincare-obsessed UGC creator shooting clean, high-conversion product videos out of a tiny Bandra studio.",
    location: "Mumbai, India",
    languages: ["English", "Hindi"],
    creator_types: ["UGC Creator"],
    categories: ["Beauty", "Skincare", "Lifestyle"],
    starting_price_inr: 18000,
    open_to_barter: true,
  },
  {
    email: "seed.kabir@bingo.test",
    display_name: "Kabir Sethi",
    bio: "Tech reviewer with a nerdy, no-hype tone. Long-form YouTube plus punchy Shorts on gadgets and productivity.",
    location: "Bengaluru, India",
    languages: ["English"],
    creator_types: ["Influencer"],
    categories: ["Tech & Gadgets"],
    starting_price_inr: 65000,
    open_to_barter: false,
  },
  {
    email: "seed.riya@bingo.test",
    display_name: "Riya Dsouza",
    bio: "Food stylist turned creator. Recipe reels, restaurant features and cosy kitchen storytelling.",
    location: "Goa, India",
    languages: ["English", "Konkani"],
    creator_types: ["Influencer", "UGC Creator"],
    categories: ["Food & Beverage", "Travel", "Lifestyle"],
    starting_price_inr: 32000,
    open_to_barter: true,
  },
  {
    email: "seed.dev@bingo.test",
    display_name: "Dev Raghunath",
    bio: "Fitness coach making honest supplement breakdowns and 30-day transformation series.",
    location: "Chennai, India",
    languages: ["English", "Tamil"],
    creator_types: ["Influencer"],
    categories: ["Fitness", "Wellness"],
    starting_price_inr: 45000,
    open_to_barter: false,
  },
  {
    email: "seed.naina@bingo.test",
    display_name: "Naina Kapoor",
    bio: "Fashion UGC specialist — try-on hauls, styling carousels and fast-turnaround ad creative.",
    location: "Delhi, India",
    languages: ["English", "Hindi"],
    creator_types: ["UGC Creator"],
    categories: ["Fashion", "Beauty", "Lifestyle"],
    starting_price_inr: 22000,
    open_to_barter: true,
  },
  {
    email: "seed.arjun@bingo.test",
    display_name: "Arjun Bhatt",
    bio: "Finance explainer creator translating markets and personal finance for first-time investors.",
    location: "Pune, India",
    languages: ["English", "Hindi"],
    creator_types: ["Influencer"],
    categories: ["Finance", "Education"],
    starting_price_inr: 55000,
    open_to_barter: false,
  },
];

export const SEED_BRANDS: SeedBrand[] = [
  {
    email: "seed.glowform@bingo.test",
    brand_name: "Glowform",
    industry: "Beauty & Personal Care",
    about: "Barrier-first skincare made for Indian weather. Clinically tested, unfussy routines.",
    website: "https://glowform.example.com",
    campaign_categories: ["Beauty", "Skincare"],
    campaigns: [
      {
        title: "Barrier Serum launch — UGC pack",
        raw_prompt: "We need 12 UGC videos for our new barrier serum, focused on before/after and texture shots.",
        objective: "Drive first-purchase conversions on the new barrier serum",
        compensation_type: "paid",
        budget_min: 15000,
        budget_max: 40000,
        brief: {
          objective: "Drive first-purchase conversions on the new barrier serum",
          categories: ["Beauty", "Skincare"],
          creator_types: ["UGC Creator"],
          deliverables: ["3 UGC videos", "2 photo sets"],
          keywords: ["barrier repair", "texture", "before after", "sensitive skin"],
          tone: "Warm, honest, dermatologist-adjacent",
          locations: ["India"],
        },
      },
    ],
  },
  {
    email: "seed.northloop@bingo.test",
    brand_name: "Northloop",
    industry: "Technology",
    about: "Desk gear and audio for people who work with their headphones on.",
    website: "https://northloop.example.com",
    campaign_categories: ["Tech & Gadgets"],
    campaigns: [
      {
        title: "ANC headphone launch — creator reviews",
        raw_prompt: "Looking for honest tech reviewers to cover our new ANC headphones with long-form plus Shorts.",
        objective: "Build credibility and awareness for the new ANC headphones",
        compensation_type: "hybrid",
        budget_min: 40000,
        budget_max: 120000,
        brief: {
          objective: "Build credibility and awareness for the new ANC headphones",
          categories: ["Tech & Gadgets"],
          creator_types: ["Influencer"],
          deliverables: ["1 long-form review", "2 Shorts"],
          keywords: ["ANC", "review", "sound quality", "work from home"],
          tone: "Analytical, no hype",
          locations: ["India"],
        },
      },
    ],
  },
  {
    email: "seed.tavaa@bingo.test",
    brand_name: "Tavaa Foods",
    industry: "Food & Beverage",
    about: "Small-batch masalas and ready bases for people who cook on weeknights.",
    website: "https://tavaa.example.com",
    campaign_categories: ["Food & Beverage", "Lifestyle"],
    campaigns: [
      {
        title: "Weeknight recipe reels",
        raw_prompt: "Want recipe creators to build 15-minute weeknight meals using our masala bases.",
        objective: "Show how fast weeknight cooking gets with our bases",
        compensation_type: "barter",
        budget_min: 0,
        budget_max: 0,
        brief: {
          objective: "Show how fast weeknight cooking gets with our bases",
          categories: ["Food & Beverage", "Lifestyle"],
          creator_types: ["UGC Creator", "Influencer"],
          deliverables: ["2 recipe reels"],
          keywords: ["weeknight", "15 minute", "masala", "home cooking"],
          tone: "Cosy and practical",
          locations: ["India"],
        },
      },
    ],
  },
  {
    email: "seed.forma@bingo.test",
    brand_name: "Forma Athletics",
    industry: "Health & Wellness",
    about: "Training gear and plant-based recovery supplements for everyday athletes.",
    website: "https://forma.example.com",
    campaign_categories: ["Fitness", "Wellness"],
    campaigns: [
      {
        title: "30-day recovery challenge",
        raw_prompt: "Fitness creators to run a 30-day recovery challenge with our protein and mobility gear.",
        objective: "Prove product results through a documented 30-day series",
        compensation_type: "paid",
        budget_min: 30000,
        budget_max: 90000,
        brief: {
          objective: "Prove product results through a documented 30-day series",
          categories: ["Fitness", "Wellness"],
          creator_types: ["Influencer"],
          deliverables: ["4 progress posts", "1 wrap-up video"],
          keywords: ["recovery", "protein", "mobility", "30 day"],
          tone: "Motivating, evidence-led",
          locations: ["India"],
        },
      },
    ],
  },
];
