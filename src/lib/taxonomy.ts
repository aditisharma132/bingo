export const CREATOR_TYPES = [
  "UGC Creator",
  "Influencer",
  "Photographer",
  "Videographer",
  "Editor",
  "Model",
  "Podcaster",
  "Writer",
  "Illustrator",
  "Meme Creator",
] as const;

export const CATEGORIES = [
  "Beauty",
  "Skincare",
  "Fashion",
  "Fitness",
  "Food & Beverage",
  "Travel",
  "Tech & Gadgets",
  "Gaming",
  "Finance",
  "Home & Living",
  "Parenting",
  "Automotive",
  "Education",
  "Wellness",
  "Sustainability",
  "Lifestyle",
] as const;

export const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Marathi",
  "Bengali",
  "Gujarati",
  "Punjabi",
] as const;

export const INDUSTRIES = [
  "D2C Brand",
  "Beauty & Personal Care",
  "Fashion & Apparel",
  "Food & Beverage",
  "Technology",
  "Gaming",
  "Fintech",
  "Health & Wellness",
  "Travel & Hospitality",
  "Education",
  "Agency",
] as const;

export const PLATFORMS = ["instagram", "youtube", "tiktok", "linkedin", "x"] as const;

export type CreatorDNA = {
  summary: string;
  content_style: string[];
  audience_signals: string[];
  best_fit_categories: string[];
  brand_fit_notes: string;
  strengths: string[];
  gaps: string[];
};

export type BrandDNA = {
  summary: string;
  positioning: string;
  tone_of_voice: string[];
  target_audience: string[];
  ideal_creator_profile: string[];
  content_themes: string[];
  gaps: string[];
};

/** Cities offered in the location dropdown across signup and onboarding. */
export const LOCATIONS = [
  "Mumbai, IN",
  "Delhi NCR, IN",
  "Bengaluru, IN",
  "Hyderabad, IN",
  "Chennai, IN",
  "Kolkata, IN",
  "Pune, IN",
  "Ahmedabad, IN",
  "Jaipur, IN",
  "Chandigarh, IN",
  "Kochi, IN",
  "Goa, IN",
  "Lucknow, IN",
  "Indore, IN",
  "Dubai, AE",
  "Singapore, SG",
  "London, UK",
  "New York, US",
  "Los Angeles, US",
  "Toronto, CA",
  "Sydney, AU",
  "Berlin, DE",
  "Remote / Anywhere",
] as const;
