/* Server-only helpers for the deal lifecycle. */

export type DealState =
  | "DISCOVERED"
  | "NEGOTIATING"
  | "ACCEPTED"
  | "CREATING"
  | "REVIEW"
  | "COMPLETED"
  | "CANCELLED";

export const DEAL_RAIL: DealState[] = [
  "DISCOVERED",
  "NEGOTIATING",
  "ACCEPTED",
  "CREATING",
  "REVIEW",
  "COMPLETED",
];

type Actor = "creator" | "brand";

export const DEAL_TRANSITIONS: Record<
  DealState,
  { to: DealState; by: Actor[]; label: string; requiresPayment?: boolean }[]
> = {
  DISCOVERED: [{ to: "NEGOTIATING", by: ["creator", "brand"], label: "Start negotiating" }],
  NEGOTIATING: [{ to: "CANCELLED", by: ["creator", "brand"], label: "Cancel collaboration" }],
  ACCEPTED: [
    { to: "CREATING", by: ["brand"], label: "Kick off creation", requiresPayment: true },
    { to: "CANCELLED", by: ["creator", "brand"], label: "Cancel collaboration" },
  ],
  CREATING: [
    { to: "COMPLETED", by: ["brand"], label: "Close deal" },
    { to: "CANCELLED", by: ["creator", "brand"], label: "Cancel collaboration" },
  ],
  REVIEW: [{ to: "COMPLETED", by: ["brand"], label: "Close deal" }],
  COMPLETED: [],
  CANCELLED: [],
};

export type DealParty = {
  deal: any;
  creatorUserId: string;
  brandUserId: string;
  creatorName: string;
  brandName: string;
  actor: Actor | null;
  isAdmin: boolean;
};

export async function getDealParty(
  supabase: any,
  dealId: string,
  userId: string,
  isAdmin = false,
): Promise<DealParty> {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, state, campaign_id, creator_id, brand_id, compensation_type, agreed_amount_inr, barter_details, payment_secured, created_at, updated_at, creator_profiles(user_id, display_name, avatar_url), brand_profiles(user_id, brand_name, logo_url), campaigns(title)",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Deal not found.");

  const creator = Array.isArray(data.creator_profiles) ? data.creator_profiles[0] : data.creator_profiles;
  const brand = Array.isArray(data.brand_profiles) ? data.brand_profiles[0] : data.brand_profiles;
  const creatorUserId = creator?.user_id as string;
  const brandUserId = brand?.user_id as string;
  const actor: Actor | null =
    userId === creatorUserId ? "creator" : userId === brandUserId ? "brand" : null;
  if (!actor && !isAdmin) throw new Error("You don't have access to this collaboration.");

  return {
    deal: data,
    creatorUserId,
    brandUserId,
    creatorName: (creator?.display_name as string) ?? "Creator",
    brandName: (brand?.brand_name as string) ?? "Brand",
    actor,
    isAdmin,
  };
}

export async function recordDealEvent(input: {
  dealId: string;
  from: DealState | null;
  to: DealState;
  actorId: string | null;
  note?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("deal_events").insert({
    deal_id: input.dealId,
    from_state: input.from,
    to_state: input.to,
    actor_id: input.actorId,
    note: input.note ?? null,
  });
}

export function allowedTransitions(state: DealState, actor: Actor, paymentSecured: boolean, isBarter: boolean) {
  return (DEAL_TRANSITIONS[state] ?? []).filter((t) => {
    if (!t.by.includes(actor)) return false;
    if (t.requiresPayment && !paymentSecured && !isBarter) return false;
    // Once the brand has funded (and signed) the deal, it can no longer cancel it.
    if (t.to === "CANCELLED" && actor === "brand" && paymentSecured) return false;
    return true;
  });
}
