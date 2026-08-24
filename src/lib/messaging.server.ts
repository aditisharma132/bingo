/* Server-only helpers for messaging, offers and payments. */

export type Party = {
  role: "creator" | "brand" | "admin";
  creatorId: string | null;
  brandId: string | null;
  userId: string;
};

export async function getParty(supabase: any, userId: string): Promise<Party> {
  const [{ data: creator }, { data: brand }, { data: roles }] = await Promise.all([
    supabase.from("creator_profiles").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("brand_profiles").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const list = (roles ?? []).map((r: any) => r.role as string);
  const role = list.includes("admin") ? "admin" : brand ? "brand" : "creator";
  return {
    role: role as Party["role"],
    creatorId: creator?.id ?? null,
    brandId: brand?.id ?? null,
    userId,
  };
}

export async function notifyUsers(
  userIds: string[],
  payload: { kind: string; title: string; body?: string | null; link?: string | null },
) {
  const { notifyUsersDeep } = await import("@/lib/notify.server");
  await notifyUsersDeep(userIds.filter(Boolean), payload);
}

export type Identity = {
  userId: string;
  kind: "creator" | "brand";
  name: string;
  avatar: string | null;
  creatorId: string | null;
  brandId: string | null;
};

/** Display identity (creator or brand card) for a set of user ids. */
export async function identitiesFor(supabase: any, userIds: string[]): Promise<Map<string, Identity>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, Identity>();
  if (!ids.length) return map;

  const [{ data: creators }, { data: brands }] = await Promise.all([
    supabase.from("creator_profiles").select("id, user_id, display_name, avatar_url").in("user_id", ids),
    supabase.from("brand_profiles").select("id, user_id, brand_name, logo_url").in("user_id", ids),
  ]);

  for (const c of (creators ?? []) as any[]) {
    map.set(c.user_id, {
      userId: c.user_id,
      kind: "creator",
      name: c.display_name ?? "Creator",
      avatar: c.avatar_url ?? null,
      creatorId: c.id,
      brandId: null,
    });
  }
  for (const b of (brands ?? []) as any[]) {
    const prev = map.get(b.user_id);
    map.set(b.user_id, {
      userId: b.user_id,
      kind: "brand",
      name: b.brand_name ?? "Brand",
      avatar: b.logo_url ?? null,
      creatorId: prev?.creatorId ?? null,
      brandId: b.id,
    });
  }
  return map;
}

/** Resolve the user id behind a creator or brand profile id. */
export async function ownerOfProfile(
  supabase: any,
  input: { creatorId?: string | null; brandId?: string | null; userId?: string | null },
): Promise<{ userId: string; kind: "creator" | "brand" }> {
  if (input.userId) {
    const map = await identitiesFor(supabase, [input.userId]);
    const found = map.get(input.userId);
    if (!found) throw new Error("That account is not set up yet.");
    return { userId: found.userId, kind: found.kind };
  }
  if (input.creatorId) {
    const { data } = await supabase
      .from("creator_profiles")
      .select("user_id")
      .eq("id", input.creatorId)
      .maybeSingle();
    if (!data?.user_id) throw new Error("Creator not found.");
    return { userId: data.user_id as string, kind: "creator" };
  }
  if (input.brandId) {
    const { data } = await supabase.from("brand_profiles").select("user_id").eq("id", input.brandId).maybeSingle();
    if (!data?.user_id) throw new Error("Brand not found.");
    return { userId: data.user_id as string, kind: "brand" };
  }
  throw new Error("Pick someone to message.");
}

/** Blocking + messaging-preference gate, evaluated with elevated rights. */
export async function messagingAllowed(targetUserId: string, senderUserId: string, senderKind: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("can_message_user", {
    _target: targetUserId,
    _sender: senderUserId,
    _sender_role: senderKind,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function conversationUsers(supabase: any, conversationId: string) {
  const { data } = await supabase
    .from("conversations")
    .select(
      "id, brand_id, creator_id, campaign_id, deal_id, status, requested_by, party_a_user_id, party_b_user_id, creator_profiles(user_id, display_name), brand_profiles(user_id, brand_name)",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) throw new Error("Conversation not found.");
  const creator = Array.isArray(data.creator_profiles) ? data.creator_profiles[0] : data.creator_profiles;
  const brand = Array.isArray(data.brand_profiles) ? data.brand_profiles[0] : data.brand_profiles;

  const aUserId = (data.party_a_user_id as string | null) ?? (brand?.user_id as string | undefined) ?? null;
  const bUserId = (data.party_b_user_id as string | null) ?? (creator?.user_id as string | undefined) ?? null;
  const identities = await identitiesFor(supabase, [aUserId, bUserId].filter(Boolean) as string[]);

  return {
    conversation: data,
    aUserId,
    bUserId,
    identities,
    creatorUserId: (creator?.user_id as string) ?? null,
    brandUserId: (brand?.user_id as string) ?? null,
    creatorName: (creator?.display_name as string) ?? "Creator",
    brandName: (brand?.brand_name as string) ?? "Brand",
    otherUserId(userId: string) {
      return userId === aUserId ? bUserId : aUserId;
    },
    nameOf(userId: string | null) {
      if (!userId) return "Member";
      return identities.get(userId)?.name ?? "Member";
    },
  };
}

/** Deterministic, human-readable digital signature line for the collaboration agreement. */
export function signatureLine(
  name: string,
  role: string,
  userId: string,
  conversationId: string,
  extra?: { place?: string | null; date?: string | null },
) {
  const seed = `${userId}:${conversationId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const sigId = hash.toString(16).toUpperCase().padStart(8, "0");
  const when = extra?.date ? new Date(`${extra.date}T00:00:00`) : new Date();
  const stamp = Number.isNaN(when.getTime()) ? new Date() : when;
  const place = extra?.place ? ` at ${extra.place}` : "";
  return `Contract signed by ${name} (${role})${place} on ${stamp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · Signature ID BNG-${sigId}`;
}

/** Find (or open) the single ongoing brand ↔ creator thread. */
export async function threadBetween(
  supabase: any,
  input: {
    creatorId: string;
    brandId: string;
    creatorUserId: string;
    brandUserId: string;
    requestedBy: string;
    subject: string;
  },
) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("creator_id", input.creatorId)
    .eq("brand_id", input.brandId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if ((existing as any)?.id) return (existing as any).id as string;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      creator_id: input.creatorId,
      brand_id: input.brandId,
      party_a_user_id: input.brandUserId,
      party_b_user_id: input.creatorUserId,
      requested_by: input.requestedBy,
      status: "accepted",
      subject: input.subject,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}
