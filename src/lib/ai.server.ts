import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.5-flash";

type JsonSchema = Record<string, unknown>;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured yet.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: JsonSchema;
}): Promise<{ data: T; model: string }> {
  let response;
  try {
    response = await getClient().models.generateContent({
      model: MODEL,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: opts.schema,
        temperature: 0,
      },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    console.error("Gemini API error", err);
    throw new Error("AI could not analyze this right now.");
  }

  const content = response.text;
  if (!content) throw new Error("AI returned an empty response.");

  return { data: JSON.parse(content) as T, model: MODEL };
}

const stringArray = { type: "array", items: { type: "string" } };

export const creatorDnaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "content_style",
    "audience_signals",
    "best_fit_categories",
    "brand_fit_notes",
    "strengths",
    "gaps",
  ],
  properties: {
    summary: { type: "string" },
    content_style: stringArray,
    audience_signals: stringArray,
    best_fit_categories: stringArray,
    brand_fit_notes: { type: "string" },
    strengths: stringArray,
    gaps: stringArray,
  },
};

export const brandDnaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "positioning",
    "tone_of_voice",
    "target_audience",
    "ideal_creator_profile",
    "content_themes",
    "gaps",
  ],
  properties: {
    summary: { type: "string" },
    positioning: { type: "string" },
    tone_of_voice: stringArray,
    target_audience: stringArray,
    ideal_creator_profile: stringArray,
    content_themes: stringArray,
    gaps: stringArray,
  },
};

export const CREATOR_DNA_SYSTEM = [
  "You build 'Creator DNA' profiles for a creator-brand marketplace.",
  "Judge creators by their content, craft and niche relevance — never by follower count.",
  "Use only the facts supplied. Never invent metrics, brands or audience numbers.",
  "When information is missing, add an honest entry to 'gaps' such as 'Not enough data yet.'",
  "Keep every list item under 12 words.",
].join(" ");

export const BRAND_DNA_SYSTEM = [
  "You build 'Brand DNA' profiles for a creator-brand marketplace.",
  "Use only the facts supplied. Never invent campaign results, budgets or audience numbers.",
  "When information is missing, add an honest entry to 'gaps' such as 'Not enough data yet.'",
  "Keep every list item under 12 words.",
].join(" ");

export const campaignBriefSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "objective",
    "deliverables",
    "categories",
    "creator_types",
    "platforms",
    "locations",
    "keywords",
    "tone",
    "do_not",
    "timeline",
    "budget_note",
  ],
  properties: {
    objective: { type: "string" },
    deliverables: stringArray,
    categories: stringArray,
    creator_types: stringArray,
    platforms: stringArray,
    locations: stringArray,
    keywords: stringArray,
    tone: stringArray,
    do_not: stringArray,
    timeline: { type: "string" },
    budget_note: { type: "string" },
  },
};

export const CAMPAIGN_BRIEF_SYSTEM = [
  "You turn a brand's plain-language campaign idea into a structured brief for a creator marketplace.",
  "Use only the facts supplied plus reasonable category/creator-type inference; never invent budgets, dates or results.",
  "categories must come from marketing categories like Beauty, Skincare, Fashion, Fitness, Food & Beverage, Travel, Tech & Gadgets, Gaming, Finance, Home & Living, Parenting, Automotive, Education, Wellness, Sustainability.",
  "creator_types must come from: UGC Creator, Influencer, Photographer, Videographer, Editor, Model, Podcaster, Writer, Illustrator, Meme Creator.",
  "keywords should be 5-10 short content signals used to match creators by what they actually make.",
  "Keep every list item under 12 words. If something is unknown, leave the list short rather than guessing.",
].join(" ");
