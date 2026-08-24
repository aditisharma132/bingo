import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationPrefs = {
  email_messages: boolean;
  email_offers: boolean;
  email_deals: boolean;
  email_brand_posts: boolean;
  email_payments: boolean;
};

const DEFAULTS: NotificationPrefs = {
  email_messages: true,
  email_offers: true,
  email_deals: true,
  email_brand_posts: true,
  email_payments: true,
};

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_prefs")
      .select("email_messages, email_offers, email_deals, email_brand_posts, email_payments")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data ?? DEFAULTS) as NotificationPrefs;
  });

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<NotificationPrefs>) => input)
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      email_messages: data.email_messages ?? true,
      email_offers: data.email_offers ?? true,
      email_deals: data.email_deals ?? true,
      email_brand_posts: data.email_brand_posts ?? true,
      email_payments: data.email_payments ?? true,
    };
    const { error } = await context.supabase
      .from("notification_prefs")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
