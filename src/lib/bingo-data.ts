export type Role = "creator" | "brand";

export type CollabState =
  | "invited"
  | "interested"
  | "declined"
  | "selected"
  | "accepted"
  | "in_production"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "completed";

export const stateLabel: Record<CollabState, string> = {
  invited: "Invited",
  interested: "Interest expressed",
  declined: "Declined",
  selected: "Selected",
  accepted: "Accepted",
  in_production: "In production",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  completed: "Completed",
};

export const linearStates: CollabState[] = [
  "invited",
  "accepted",
  "in_production",
  "in_review",
  "approved",
  "completed",
];

export type TasteProfile = {
  interests: string[];
  aesthetic: string[];
  contentStyle: string[];
  values: string[];
  audience: { label: string; value: string }[];
};

export type CreatorProfile = {
  id: string;
  name: string;
  handle: string;
  avatarInitials: string;
  headline: string;
  location: string;
  categories: string[];
  reach: string;
  engagement: string;
  rateCard: string;
  socials: { platform: string; handle: string; followers: string; verified: boolean }[];
  taste: TasteProfile;
  verification: { identity: boolean; social: boolean; ownership: boolean };
  privacy: {
    showRates: boolean;
    showAudienceData: boolean;
    showEmail: boolean;
    discoverable: boolean;
  };
};

export type BrandProfile = {
  id: string;
  name: string;
  initials: string;
  website: string;
  industry: string;
  headline: string;
  dna: {
    aesthetic: string[];
    values: string[];
    audience: string[];
    tone: string[];
  };
  budgetBand: string;
  verified: boolean;
};

export type CampaignBrief = {
  id: string;
  brandId: string;
  title: string;
  rawPrompt: string;
  objective: string;
  deliverables: string[];
  timeline: { label: string; date: string }[];
  compensation: string;
  requirements: string[];
  audience: string;
  status: "draft" | "open" | "closed";
};

export type MatchReason = { label: string; weight: number; detail: string };

export const demoCreators: CreatorProfile[] = [
  {
    id: "c-nova",
    name: "Nova Reyes",
    handle: "@novabuilds",
    avatarInitials: "NR",
    headline: "Hardware teardowns and desk-setup films with a neon-noir edge.",
    location: "Lisbon, PT",
    categories: ["Tech", "Gaming", "Design"],
    reach: "1.2M",
    engagement: "6.4%",
    rateCard: "$2,500 – $6,000 / deliverable",
    socials: [
      { platform: "YouTube", handle: "@novabuilds", followers: "820K", verified: true },
      { platform: "Instagram", handle: "@nova.builds", followers: "310K", verified: true },
      { platform: "TikTok", handle: "@novabuilds", followers: "94K", verified: false },
    ],
    taste: {
      interests: ["Modular hardware", "Synthwave", "Industrial design", "Retro computing"],
      aesthetic: ["High contrast", "Neon on black", "Macro detail", "Slow push-ins"],
      contentStyle: ["Long-form essay", "Voice-over teardown", "Hands-only b-roll"],
      values: ["Repairability", "Honest reviews", "No paid-positive claims"],
      audience: [
        { label: "Core age", value: "24–34" },
        { label: "Top markets", value: "US, DE, UK" },
        { label: "Split", value: "68% male / 30% female" },
        { label: "Watch intent", value: "Purchase research" },
      ],
    },
    verification: { identity: true, social: true, ownership: true },
    privacy: { showRates: true, showAudienceData: true, showEmail: false, discoverable: true },
  },
  {
    id: "c-elena",
    name: "Elena Marques",
    handle: "@elenaeveryday",
    avatarInitials: "EM",
    headline: "Slow-fashion styling and city walk films for the quiet-luxury crowd.",
    location: "Milan, IT",
    categories: ["Fashion", "Lifestyle"],
    reach: "480K",
    engagement: "8.1%",
    rateCard: "$1,200 – $3,500 / deliverable",
    socials: [
      { platform: "Instagram", handle: "@elenaeveryday", followers: "390K", verified: true },
      { platform: "TikTok", handle: "@elenaeveryday", followers: "90K", verified: true },
    ],
    taste: {
      interests: ["Slow fashion", "Textiles", "Analog photography"],
      aesthetic: ["Warm film grain", "Natural light", "Muted earth palette"],
      contentStyle: ["Get-ready-with-me", "Cinematic vlog", "Carousel styling"],
      values: ["Sustainable sourcing", "Body neutrality", "Transparent gifting"],
      audience: [
        { label: "Core age", value: "25–39" },
        { label: "Top markets", value: "IT, FR, US" },
        { label: "Split", value: "81% female" },
        { label: "Watch intent", value: "Style inspiration" },
      ],
    },
    verification: { identity: true, social: true, ownership: false },
    privacy: { showRates: false, showAudienceData: true, showEmail: false, discoverable: true },
  },
  {
    id: "c-jax",
    name: "Jax Verlan",
    handle: "@zero_day",
    avatarInitials: "JV",
    headline: "Competitive FPS breakdowns and peripheral science.",
    location: "Austin, US",
    categories: ["Gaming", "Esports", "Tech"],
    reach: "2.4M",
    engagement: "4.9%",
    rateCard: "$4,000 – $9,000 / deliverable",
    socials: [
      { platform: "Twitch", handle: "zero_day", followers: "1.1M", verified: true },
      { platform: "YouTube", handle: "@zeroday", followers: "1.3M", verified: true },
    ],
    taste: {
      interests: ["Aim training", "Latency", "Hardware tuning"],
      aesthetic: ["Dark UI", "Data overlays", "Fast cuts"],
      contentStyle: ["Live stream", "Analysis short", "Coaching clip"],
      values: ["Anti-hype", "Numbers first", "Community moderation"],
      audience: [
        { label: "Core age", value: "18–28" },
        { label: "Top markets", value: "US, CA, BR" },
        { label: "Split", value: "74% male" },
        { label: "Watch intent", value: "Skill improvement" },
      ],
    },
    verification: { identity: true, social: true, ownership: true },
    privacy: { showRates: true, showAudienceData: false, showEmail: false, discoverable: true },
  },
  {
    id: "c-mira",
    name: "Mira Osei",
    handle: "@mirawellness",
    avatarInitials: "MO",
    headline: "Skin-barrier science explained without the fear-mongering.",
    location: "London, UK",
    categories: ["Beauty", "Wellness", "Science"],
    reach: "610K",
    engagement: "9.3%",
    rateCard: "$1,800 – $4,200 / deliverable",
    socials: [
      { platform: "TikTok", handle: "@mirawellness", followers: "420K", verified: true },
      { platform: "Instagram", handle: "@mira.osei", followers: "190K", verified: true },
    ],
    taste: {
      interests: ["Dermatology", "Formulation", "Morning routines"],
      aesthetic: ["Soft daylight", "Pastel props", "Clean typography"],
      contentStyle: ["Explainer", "Myth-busting duet", "Routine diary"],
      values: ["Evidence-based", "No fear marketing", "Accessible pricing"],
      audience: [
        { label: "Core age", value: "22–35" },
        { label: "Top markets", value: "UK, US, AU" },
        { label: "Split", value: "88% female" },
        { label: "Watch intent", value: "Product validation" },
      ],
    },
    verification: { identity: true, social: false, ownership: true },
    privacy: { showRates: true, showAudienceData: true, showEmail: true, discoverable: true },
  },
  {
    id: "c-kai",
    name: "Kai Tanaka",
    handle: "@kaimakes",
    avatarInitials: "KT",
    headline: "Workshop builds, tool reviews and shop-safety deep dives.",
    location: "Osaka, JP",
    categories: ["DIY", "Design", "Tech"],
    reach: "330K",
    engagement: "7.6%",
    rateCard: "$900 – $2,600 / deliverable",
    socials: [
      { platform: "YouTube", handle: "@kaimakes", followers: "260K", verified: true },
      { platform: "Instagram", handle: "@kai.makes", followers: "70K", verified: false },
    ],
    taste: {
      interests: ["Joinery", "Small-shop tooling", "Material sourcing"],
      aesthetic: ["Warm wood", "Top-down process", "Ambient sound"],
      contentStyle: ["Silent build", "Tool teardown", "Time-lapse"],
      values: ["Craft over speed", "Safety first", "Buy-it-once"],
      audience: [
        { label: "Core age", value: "28–45" },
        { label: "Top markets", value: "JP, US, DE" },
        { label: "Split", value: "61% male" },
        { label: "Watch intent", value: "Project planning" },
      ],
    },
    verification: { identity: false, social: true, ownership: true },
    privacy: { showRates: true, showAudienceData: false, showEmail: false, discoverable: true },
  },
];

export const demoBrands: BrandProfile[] = [
  {
    id: "b-nexus",
    name: "Nexus Gear",
    initials: "NG",
    website: "nexusgear.io",
    industry: "Gaming peripherals",
    headline: "Precision peripherals engineered with competitive players.",
    dna: {
      aesthetic: ["Neon on black", "Macro product detail", "Motion-heavy"],
      values: ["Performance honesty", "Repairable hardware", "Player-first"],
      audience: ["18–34 competitive gamers", "Hardware researchers", "US/DE/BR"],
      tone: ["Technical", "Confident", "No hype language"],
    },
    budgetBand: "$2k – $12k per creator",
    verified: true,
  },
  {
    id: "b-lumina",
    name: "Lumina Skincare",
    initials: "LS",
    website: "luminaskin.co",
    industry: "Beauty & wellness",
    headline: "Barrier-first skincare formulated with dermatologists.",
    dna: {
      aesthetic: ["Soft daylight", "Pastel minimal", "Clean typography"],
      values: ["Evidence over claims", "Accessible pricing", "Cruelty-free"],
      audience: ["22–38 skincare researchers", "UK/US/AU"],
      tone: ["Warm", "Educational", "Calm"],
    },
    budgetBand: "$800 – $5k per creator",
    verified: true,
  },
  {
    id: "b-volt",
    name: "Volt Energy",
    initials: "VE",
    website: "drinkvolt.com",
    industry: "Functional beverage",
    headline: "Low-sugar energy built for long focus sessions.",
    dna: {
      aesthetic: ["High saturation", "Fast cuts", "Street and desk settings"],
      values: ["Transparent labels", "No crash claims", "Community events"],
      audience: ["18–30 students, gamers, athletes"],
      tone: ["Playful", "Direct", "Meme-fluent"],
    },
    budgetBand: "$1k – $4k per creator",
    verified: false,
  },
  {
    id: "b-urban",
    name: "Urban Threads",
    initials: "UT",
    website: "urbanthreads.studio",
    industry: "Apparel",
    headline: "Small-batch city wear cut from deadstock fabric.",
    dna: {
      aesthetic: ["Film grain", "Muted earth palette", "Street photography"],
      values: ["Deadstock sourcing", "Fair factories", "Slow drops"],
      audience: ["24–40 design-literate shoppers", "IT/FR/US"],
      tone: ["Understated", "Editorial", "Human"],
    },
    budgetBand: "$1.5k – $6k per creator",
    verified: true,
  },
];

export function matchReasons(creator: CreatorProfile, brand: BrandProfile): MatchReason[] {
  const overlap = (a: string[], b: string[]) =>
    a.filter((x) => b.some((y) => y.toLowerCase().includes((x.toLowerCase().split(" ")[0] ?? x.toLowerCase())))).length;

  const aesthetic = overlap(creator.taste.aesthetic, brand.dna.aesthetic);
  const values = overlap(creator.taste.values, brand.dna.values);
  const audience = brand.dna.audience.some((a) =>
    creator.taste.audience.some((x) => a.split(" ").some((w) => w.length > 2 && x.value.includes(w))),
  );

  return [
    {
      label: "Aesthetic overlap",
      weight: 30 + aesthetic * 18,
      detail: `${creator.taste.aesthetic.slice(0, 2).join(", ")} sits close to ${(brand.dna.aesthetic[0] ?? "their look").toLowerCase()}.`,
    },
    {
      label: "Value alignment",
      weight: 40 + values * 20,
      detail: `Both lead with ${(brand.dna.values[0] ?? "honesty").toLowerCase()}; creator states "${creator.taste.values[0] ?? "honest work"}".`,
    },
    {
      label: "Audience fit",
      weight: audience ? 88 : 62,
      detail: `Creator core ${(creator.taste.audience[0]?.value ?? "n/a")} against brand target ${brand.dna.audience[0] ?? "their core audience"}.`,
    },
    {
      label: "Tone of voice",
      weight: 55 + creator.taste.contentStyle.length * 8,
      detail: `${creator.taste.contentStyle[0] ?? "Their core"} format carries a ${(brand.dna.tone[0] ?? "clear").toLowerCase()} read well.`,
    },
  ];
}

export function matchScore(creator: CreatorProfile, brand: BrandProfile): number {
  const reasons = matchReasons(creator, brand);
  const raw = reasons.reduce((sum, r) => sum + Math.min(r.weight, 100), 0) / reasons.length;
  const seed = (creator.id.length * 7 + brand.id.length * 13) % 9;
  return Math.max(58, Math.min(99, Math.round(raw) + seed));
}

export const trendingSignals = [
  { category: "Repair & longevity content", momentum: "+34%", note: "Brand demand rising in hardware and appliances." },
  { category: "Barrier-first skincare explainers", momentum: "+28%", note: "Science-led beauty briefs doubled this quarter." },
  { category: "Deadstock & small-batch fashion", momentum: "+19%", note: "Apparel brands shifting away from mega-hauls." },
  { category: "Focus & study routines", momentum: "+15%", note: "Beverage and software brands chasing the same slot." },
];

export const hiddenOpportunities = [
  {
    brand: "Urban Threads",
    why: "Outside your usual tech lane, but your macro-detail style maps onto their fabric close-ups.",
    band: "$1.5k – $6k",
  },
  {
    brand: "Volt Energy",
    why: "Your late-night build streams overlap their focus-session audience with almost no creator competition.",
    band: "$1k – $4k",
  },
];

export function briefFromPrompt(prompt: string, brand: BrandProfile): Omit<CampaignBrief, "id" | "brandId"> {
  const p = prompt.toLowerCase();
  const isVideo = p.includes("video") || p.includes("youtube") || p.includes("film");
  const isShort = p.includes("tiktok") || p.includes("reel") || p.includes("short");
  const budget = /\$\s?[\d,.]+k?/.exec(prompt)?.[0] ?? brand.budgetBand;

  return {
    title: prompt.trim().slice(0, 60) || `${brand.name} campaign`,
    rawPrompt: prompt,
    objective: `Drive considered purchase intent for ${brand.name} among ${brand.dna.audience[0] ?? "their core audience"}.`,
    deliverables: [
      isVideo ? "1× long-form integration (60–90s dedicated segment)" : "1× hero piece agreed at kickoff",
      isShort ? "2× short-form cutdowns (TikTok / Reels)" : "2× supporting posts",
      "1× usage licence for paid amplification (90 days)",
    ],
    timeline: [
      { label: "Kickoff call", date: "Week 1" },
      { label: "Concept + script approval", date: "Week 2" },
      { label: "First cut delivered", date: "Week 4" },
      { label: "Publish window", date: "Week 5–6" },
    ],
    compensation: `${budget} · 50% on signature, 50% on approval`,
    requirements: [
      `Tone must stay ${brand.dna.tone.join(", ").toLowerCase()}`,
      "Disclose the partnership in caption and on-screen",
      "No competitor integrations 30 days either side",
      "Raw files shared for brand archive",
    ],
    audience: brand.dna.audience.join(" · "),
    status: "open",
  };
}
