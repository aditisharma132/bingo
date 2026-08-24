/* Server-only notification + transactional email fan-out. */

export type NotifyPayload = {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  email?: boolean;
};

/** Sends a transactional email when RESEND_API_KEY is configured; logs otherwise. */
export async function sendEmail(input: { to: string; subject: string; html: string }) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? "Bingo <onboarding@resend.dev>";
  if (!key) {
    console.info("[email:mock]", input.to, "—", input.subject);
    return { sent: false as const, mocked: true as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!res.ok) {
    console.error("resend error", await res.text());
    return { sent: false as const, mocked: false as const };
  }
  return { sent: true as const, mocked: false as const };
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow internal relative paths as email CTA links. */
function safeLinkPath(link?: string | null) {
  if (!link) return null;
  if (!/^\/[A-Za-z0-9\-._~/?&=%#]*$/.test(link)) return null;
  if (link.startsWith("//")) return null;
  return link;
}

function emailShell(title: string, body: string, link?: string | null) {
  const path = safeLinkPath(link);
  const url = path ? `https://bingo.lovable.app${path}` : null;
  return `<div style="font-family:system-ui,sans-serif;max-width:520px">
    <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
    <p style="color:#444;line-height:1.6;white-space:pre-wrap">${escapeHtml(body)}</p>
    ${url ? `<p><a href="${escapeHtml(url)}" style="background:#ff2d78;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Bingo</a></p>` : ""}
    <p style="color:#888;font-size:12px">Bingo — find creators by content, not follower count.</p>
  </div>`;
}


/** Writes in-app notifications and optionally emails the same users. */
export async function notifyUsersDeep(userIds: string[], payload: NotifyPayload) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin.from("notifications").insert(
    unique.map((user_id) => ({
      user_id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    })),
  );

  if (payload.email === false) return;
  const { data: people } = await supabaseAdmin.from("profiles").select("id, email").in("id", unique);
  for (const person of people ?? []) {
    if (!person.email) continue;
    await sendEmail({
      to: person.email,
      subject: payload.title,
      html: emailShell(payload.title, payload.body ?? "", payload.link),
    });
  }
}

export async function notifyDealParties(dealId: string, payload: NotifyPayload) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("deals")
    .select("id, creator_profiles(user_id), brand_profiles(user_id)")
    .eq("id", dealId)
    .maybeSingle();
  if (!data) return;
  const creator: any = Array.isArray(data.creator_profiles) ? data.creator_profiles[0] : data.creator_profiles;
  const brand: any = Array.isArray(data.brand_profiles) ? data.brand_profiles[0] : data.brand_profiles;
  await notifyUsersDeep([creator?.user_id, brand?.user_id].filter(Boolean), payload);
}

export async function sendWelcomeEmail(userId: string, name: string, role: "creator" | "brand") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle();
  if (!data?.email) return;
  await sendEmail({
    to: data.email,
    subject: "Welcome to Bingo",
    html: emailShell(
      `Welcome, ${name}`,
      role === "creator"
        ? "Your creator profile is live. We're matching you to campaigns by your content and craft — never by follower count."
        : "Your brand profile is live. Describe a campaign in plain language and we'll surface creators who genuinely fit.",
      role === "creator" ? "/matches" : "/campaigns",
    ),
  });
}
