/* Shared (client + server safe) helpers for collaboration agreements. */

export type AgreementDoc = {
  source: "default" | "ai" | "upload";
  title: string;
  text?: string | null;
  path?: string | null;
  fileName?: string | null;
  compensationType?: "paid" | "barter" | "hybrid" | null;
  amountInr?: number | null;
};

export const AGREEMENT_KIND = "agreement";
export const ATTACHMENT_KIND = "attachment";

export type Attachment = {
  path: string;
  name: string;
  mime: string;
  size: number;
};

export function safeParse<T>(body: string | null | undefined): T | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export function defaultAgreementText(input: {
  brandName: string;
  creatorName: string;
  compensationType: string;
  amountInr?: number | null;
  deliverables?: string[];
  timeline?: string | null;
}) {
  const terms =
    input.compensationType === "paid" || input.compensationType === "hybrid"
      ? `₹${Number(input.amountInr ?? 0).toLocaleString("en-IN")}`
      : "Barter / product exchange";
  const deliverables = (input.deliverables ?? []).filter(Boolean);
  return [
    "COLLABORATION AGREEMENT",
    "",
    `This agreement is made between ${input.brandName} ("the Brand") and ${input.creatorName} ("the Creator") for the collaboration agreed in this Bingo thread.`,
    "",
    `1. Compensation. ${terms}. Paid engagements are held securely by Bingo and released once the Brand approves the delivered content.`,
    "",
    `2. Deliverables. ${deliverables.length ? deliverables.map((d) => `• ${d}`).join("\n") : "As set out in the accepted offer in this thread."}`,
    "",
    `3. Timeline. ${input.timeline ? `Agreed response / delivery date: ${input.timeline}.` : "As set out in the accepted offer."} Any change must be agreed in writing in this thread.`,
    "",
    "4. Usage rights. The Brand may use the delivered content on its owned channels for 12 months from delivery. Paid media or extended usage requires a further written agreement.",
    "",
    "5. Disclosure. The Creator will disclose the partnership as required by applicable advertising rules.",
    "",
    "6. Cancellation. Either party may cancel before work begins. Once payment is secured or content is in production, the agreed compensation is payable in full for work completed.",
    "",
    "7. Signatures. This agreement is executed digitally in Bingo. Each signature records the signer's full name, place and date.",
  ].join("\n");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Maximum counter offers allowed per collaboration. */
export const MAX_COUNTER_OFFERS = 4;
