import { createServerFn } from "@tanstack/react-start";

export const submitPublicTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; subject: string; body: string }) => {
    const email = input.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (input.subject.trim().length < 4) throw new Error("Add a short subject.");
    if (input.body.trim().length < 10) throw new Error("Tell us a bit more so we can help.");
    return { email, subject: input.subject.trim(), body: input.body.trim() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: null,
      contact_email: data.email,
      subject: data.subject,
      body: data.body,
      status: "open",
    });
    if (error) throw new Error(error.message);

    const { sendEmail, notifyAdmins } = await import("@/lib/notify.server");
    await sendEmail({
      to: data.email,
      subject: "We've got your message",
      html: `<p>Thanks for reaching out to Bingo. Our team will reply about “${data.subject}” shortly.</p>`,
    });
    await notifyAdmins({
      kind: "support_ticket",
      title: `New support ticket: ${data.subject}`,
      body: `${data.email} wrote: ${data.body}`,
      link: "/admin",
    });
    return { ok: true };
  });
