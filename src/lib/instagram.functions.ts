import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type SuggestionRow = {
  id: string;
  field: string;
  label: string;
  current_value: Json;
  suggested_value: Json;
  rationale: string | null;
  status: string;
};

/** Instagram connection status + the latest stored snapshot (never the token). */
export const getInstagramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { instagramConfigured } = await import("@/lib/instagram.server");
    const { data } = await context.supabase
      .from("social_accounts")
      .select(
        "id, handle, followers, engagement_rate, connected_via_oauth, last_synced_at, profile_data, external_id",
      )
      .eq("user_id", context.userId)
      .eq("platform", "instagram")
      .maybeSingle();

    return {
      configured: instagramConfigured(),
      connected: Boolean(data?.connected_via_oauth),
      account: data ?? null,
    };
  });

export const startInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data, context }) => {
    const ig = await import("@/lib/instagram.server");
    if (!ig.instagramConfigured()) {
      return { available: false as const, url: null, redirectUri: null };
    }
    const redirectUri = ig.redirectUriFor(data.origin);
    const state = ig.signState({
      uid: context.userId,
      redirect: data.origin,
      exp: Date.now() + 15 * 60 * 1000,
    });
    return { available: true as const, url: ig.buildAuthorizeUrl(state, redirectUri), redirectUri };
  });

/** Fallback when the callback domain isn't whitelisted: paste the code/redirect URL. */
export const completeInstagramManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { raw: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const ig = await import("@/lib/instagram.server");
    const { saveInstagramConnection } = await import("@/lib/instagram-store.server");
    const code = ig.extractCode(data.raw);
    const short = await ig.exchangeCode(code, ig.redirectUriFor(data.origin));
    const long = await ig.exchangeLongLived(short.accessToken);
    const snapshot = await ig.fetchSnapshot(long.accessToken);
    await saveInstagramConnection(context.userId, long.accessToken, long.expiresIn, snapshot);
    return { ok: true, username: snapshot.profile.username ?? null };
  });

export const syncInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ig = await import("@/lib/instagram.server");
    const { saveInstagramConnection } = await import("@/lib/instagram-store.server");
    const { data: row } = await context.supabase
      .from("social_accounts")
      .select("access_token_encrypted")
      .eq("user_id", context.userId)
      .eq("platform", "instagram")
      .maybeSingle();
    // access_token_encrypted is not readable through RLS for safety; fall back to admin read.
    let encrypted =
      (row as { access_token_encrypted?: string | null } | null)?.access_token_encrypted ?? null;
    if (!encrypted) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: adminRow } = await supabaseAdmin
        .from("social_accounts")
        .select("access_token_encrypted")
        .eq("user_id", context.userId)
        .eq("platform", "instagram")
        .maybeSingle();
      encrypted = adminRow?.access_token_encrypted ?? null;
    }
    if (!encrypted) throw new Error("Instagram isn't connected yet.");
    const token = ig.decryptToken(encrypted);
    const snapshot = await ig.fetchSnapshot(token);
    await saveInstagramConnection(context.userId, token, null, snapshot);
    return { ok: true, syncedAt: snapshot.synced_at };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("social_accounts")
      .delete()
      .eq("user_id", context.userId)
      .eq("platform", "instagram");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- AI suggestions ---------------------------- */

export const analyzeInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    await checkRateLimit(context.supabase, context.userId, "analyze_instagram", {
      windowSeconds: 3600,
      max: 20,
    });
    const { buildInstagramSuggestions } = await import("@/lib/instagram-ai.server");
    return buildInstagramSuggestions(context.supabase, context.userId);
  });

export const listProfileSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_profile_suggestions")
      .select("id, field, label, current_value, suggested_value, rationale, status")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SuggestionRow[];
  });

export const resolveSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "apply" | "dismiss" }) => input)
  .handler(async ({ data, context }) => {
    const { applySuggestion } = await import("@/lib/instagram-ai.server");
    return applySuggestion(context.supabase, context.userId, data.id, data.action);
  });
