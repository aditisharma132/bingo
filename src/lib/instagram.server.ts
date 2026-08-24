/**
 * Instagram Business Login + Graph API helpers.
 * Server-only: reads app credentials from the environment and never returns
 * access tokens to the browser.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

const AUTH_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export const CALLBACK_PATH = "/api/public/instagram/callback";

export type IgProfile = {
  user_id?: string;
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  follows_count?: number;
  profile_picture_url?: string;
};

export type IgMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

export type IgSnapshot = {
  profile: IgProfile;
  media: IgMedia[];
  insights: Array<{ name: string; value: number | null }>;
  engagement_rate: number | null;
  synced_at: string;
};

export class InstagramError extends Error {}

function appId() {
  const value = process.env["INSTAGRAM_APP_ID"];
  if (!value) throw new InstagramError("Instagram isn't configured on the server yet.");
  return value;
}

function appSecret() {
  const value = process.env["INSTAGRAM_APP_SECRET"];
  if (!value) throw new InstagramError("Instagram isn't configured on the server yet.");
  return value;
}

export function instagramConfigured() {
  return Boolean(process.env["INSTAGRAM_APP_ID"] && process.env["INSTAGRAM_APP_SECRET"]);
}

function scopes() {
  return (process.env["INSTAGRAM_SCOPES"] || "instagram_business_basic,instagram_business_manage_insights").replace(
    / /g,
    "",
  );
}

/* --------------------------- token encryption --------------------------- */

function tokenKey() {
  const raw = process.env["SOCIAL_TOKEN_KEY"] || process.env["INSTAGRAM_APP_SECRET"] || "";
  if (!raw) throw new InstagramError("Token encryption key is missing.");
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptToken(stored: string) {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/* -------------------------------- state -------------------------------- */

function stateSecret() {
  return process.env["INSTAGRAM_STATE_SECRET"] || appSecret();
}

export type OAuthState = { uid: string; redirect: string; exp: number };

export function signState(payload: OAuthState) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): OAuthState {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new InstagramError("Invalid OAuth state.");
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new InstagramError("OAuth state failed verification.");
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  if (parsed.exp < Date.now()) throw new InstagramError("This connection link expired — please try again.");
  return parsed;
}

/* --------------------------------- oauth -------------------------------- */

export function redirectUriFor(origin: string) {
  return `${origin.replace(/\/$/, "")}${CALLBACK_PATH}`;
}

export function buildAuthorizeUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes(),
    state,
    force_reauth: "true",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Accepts a bare code or the full redirect URL pasted from the browser. */
export function extractCode(raw: string) {
  const text = raw.trim();
  if (!text) throw new InstagramError("Paste the authorization code or the full redirect URL.");
  if (text.includes("code=")) {
    const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text;
    const code = new URLSearchParams(query).get("code");
    if (code) return code.split("#")[0]!;
  }
  if (/^[A-Za-z0-9._-]+$/.test(text)) return text;
  throw new InstagramError("Couldn't find an authorization code in that text.");
}

export async function exchangeCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new InstagramError(`Instagram rejected the sign-in: ${text}`);
  const json = JSON.parse(text) as { access_token?: string; user_id?: string | number };
  if (!json.access_token) throw new InstagramError("Instagram did not return an access token.");
  return { accessToken: json.access_token, userId: String(json.user_id ?? "") };
}

export async function exchangeLongLived(shortToken: string) {
  const url = `${LONG_LIVED_URL}?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
    appSecret(),
  )}&access_token=${encodeURIComponent(shortToken)}`;
  const res = await fetch(url);
  if (!res.ok) return { accessToken: shortToken, expiresIn: 3600 };
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  return { accessToken: json.access_token ?? shortToken, expiresIn: json.expires_in ?? 5184000 };
}

/* ------------------------------- graph api ------------------------------ */

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH_BASE}${path}?${query.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new InstagramError(`Instagram API error: ${text}`);
  return JSON.parse(text) as any;
}

export async function fetchProfile(token: string): Promise<IgProfile> {
  return graphGet("/me", token, {
    fields: "user_id,username,name,account_type,media_count,profile_picture_url,followers_count,follows_count",
  });
}

export async function fetchMedia(token: string, userId: string, limit = 12): Promise<IgMedia[]> {
  const data = await graphGet(`/${userId}/media`, token, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return (data.data ?? []) as IgMedia[];
}

function metricValue(metric: any): number | null {
  const total = metric?.total_value;
  if (total && typeof total.value === "number") return total.value;
  const values = metric?.values;
  if (Array.isArray(values) && values.length) {
    const last = values[values.length - 1];
    if (last && typeof last.value === "number") return last.value;
  }
  return null;
}

export async function fetchInsights(token: string, userId: string) {
  const read = async (metric: string, extra: Record<string, string>) => {
    const data = await graphGet(`/${userId}/insights`, token, { metric, period: "day", ...extra });
    return (data.data ?? []) as any[];
  };
  let rows: any[] = [];
  try {
    rows = await read("reach,profile_views,accounts_engaged,total_interactions", { metric_type: "total_value" });
  } catch {
    try {
      rows = await read("reach,profile_views", {});
    } catch {
      rows = [];
    }
  }
  return rows.map((r) => ({ name: String(r.name), value: metricValue(r) }));
}

export function computeEngagementRate(profile: IgProfile, media: IgMedia[]) {
  const followers = Number(profile.followers_count ?? 0);
  if (!followers || media.length === 0) return null;
  const total = media.reduce((sum, m) => sum + Number(m.like_count ?? 0) + Number(m.comments_count ?? 0), 0);
  const rate = (total / media.length / followers) * 100;
  return Number.isFinite(rate) ? Number(rate.toFixed(2)) : null;
}

export async function fetchSnapshot(token: string): Promise<IgSnapshot> {
  const profile = await fetchProfile(token);
  const igId = String(profile.user_id ?? profile.id ?? "me");
  let media: IgMedia[] = [];
  let insights: Array<{ name: string; value: number | null }> = [];
  try {
    media = await fetchMedia(token, igId, 12);
  } catch (error) {
    console.error("instagram media fetch failed", error);
  }
  try {
    insights = await fetchInsights(token, igId);
  } catch (error) {
    console.error("instagram insights fetch failed", error);
  }
  return {
    profile,
    media,
    insights,
    engagement_rate: computeEngagementRate(profile, media),
    synced_at: new Date().toISOString(),
  };
}
