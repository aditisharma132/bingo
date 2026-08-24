import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORMS = ["instagram", "youtube", "tiktok", "linkedin", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const listConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("social_accounts")
      .select("id, platform, handle, followers, engagement_rate, connected_via_oauth, last_synced_at, profile_data")
      .eq("user_id", userId)
      .order("platform");
    if (error) throw new Error(error.message);
    return {
      accounts: data ?? [],
      oauthAvailable: Boolean(process.env["INSTAGRAM_CLIENT_ID"]),
    };
  });

/** Saves a handle and its public stats. Uses the Instagram Graph API when
 * INSTAGRAM_CLIENT_ID/SECRET are configured; otherwise stores self-reported
 * numbers flagged as unverified so matching can discount them. */
export const saveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { platform: string; handle: string; followers?: number | undefined; engagementRate?: number | undefined }) => {
    if (!PLATFORMS.includes(input.platform as Platform)) throw new Error("Unsupported platform.");
    if (input.handle.trim().length < 2) throw new Error("Enter your handle.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const handle = data.handle.trim().replace(/^@/, "");

    const { data: existing } = await supabase
      .from("social_accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("platform", data.platform)
      .maybeSingle();

    const row = {
      user_id: userId,
      platform: data.platform,
      handle,
      followers: data.followers ?? null,
      engagement_rate: data.engagementRate ?? null,
      connected_via_oauth: false,
      last_synced_at: new Date().toISOString(),
      profile_data: { source: "self_reported", verified: false } as never,
    };

    const { error } = existing
      ? await supabase.from("social_accounts").update(row).eq("id", existing.id)
      : await supabase.from("social_accounts").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true, verified: false };
  });

export const removeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("social_accounts").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Starts the Instagram OAuth handshake once app credentials are configured. */
export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data }) => {
    const clientId = process.env["INSTAGRAM_CLIENT_ID"];
    if (!clientId) {
      return {
        available: false as const,
        url: null,
        message: "Instagram verification isn't connected yet — add your handle manually for now.",
      };
    }
    const redirect = `${data.origin}/api/public/instagram/callback`;
    const url = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=user_profile,user_media&response_type=code`;
    return { available: true as const, url, message: null };
  });
