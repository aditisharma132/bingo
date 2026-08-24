/** Per-user, per-action sliding-window rate limit for AI-triggered endpoints. Throws when exceeded. */
export async function checkRateLimit(
  supabase: any,
  userId: string,
  action: string,
  opts: { windowSeconds: number; max: number },
) {
  const now = Date.now();
  const { data: row } = await supabase
    .from("rate_limits")
    .select("window_start, count")
    .eq("user_id", userId)
    .eq("action", action)
    .maybeSingle();

  const windowExpired =
    !row || now - new Date(row.window_start).getTime() > opts.windowSeconds * 1000;
  if (windowExpired) {
    await supabase
      .from("rate_limits")
      .upsert(
        { user_id: userId, action, window_start: new Date(now).toISOString(), count: 1 },
        { onConflict: "user_id,action" },
      );
    return;
  }

  if (row.count >= opts.max) {
    const resetIn = Math.ceil(
      (opts.windowSeconds * 1000 - (now - new Date(row.window_start).getTime())) / 1000,
    );
    throw new Error(`Too many requests — try again in ${resetIn}s.`);
  }

  await supabase
    .from("rate_limits")
    .update({ count: row.count + 1 })
    .eq("user_id", userId)
    .eq("action", action);
}
