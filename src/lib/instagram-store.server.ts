import type { IgSnapshot } from "@/lib/instagram.server";

/** Upserts the Instagram connection for a user, storing the token encrypted. */
export async function saveInstagramConnection(
  userId: string,
  accessToken: string,
  expiresIn: number | null,
  snapshot: IgSnapshot,
) {
  const { encryptToken } = await import("@/lib/instagram.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const profile = snapshot.profile;
  const row = {
    user_id: userId,
    platform: "instagram",
    handle: profile.username ?? null,
    external_id: String(profile.user_id ?? profile.id ?? ""),
    followers: profile.followers_count ?? null,
    engagement_rate: snapshot.engagement_rate,
    connected_via_oauth: true,
    access_token_encrypted: encryptToken(accessToken),
    token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    last_synced_at: snapshot.synced_at,
    profile_data: snapshot as unknown as never,
  };

  const { data: existing } = await supabaseAdmin
    .from("social_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "instagram")
    .maybeSingle();

  const { error } = existing
    ? await supabaseAdmin.from("social_accounts").update(row).eq("id", existing.id)
    : await supabaseAdmin.from("social_accounts").insert(row);
  if (error) throw new Error(error.message);

  // Keep the creator/brand profile handle in sync so the public page shows it.
  const handle = profile.username ?? null;
  if (handle) {
    await supabaseAdmin.from("brand_profiles").update({ instagram: handle }).eq("user_id", userId);
  }
  return { ok: true };
}
