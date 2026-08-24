import { createServerFn } from "@tanstack/react-start";

/**
 * Bridges a Clerk-verified Google sign-in into a normal Supabase Auth session.
 * Clerk only handles the Google OAuth handshake (no domain/redirect-URI setup needed
 * on our side); the resulting Supabase user, session, RLS, and `handle_new_user`
 * trigger are all completely unchanged from the existing email/password path.
 *
 * No requireSupabaseAuth middleware — this IS the pre-auth entry point, gated by
 * verifying the Clerk token instead.
 */
export const bridgeClerkSession = createServerFn({ method: "POST" })
  .inputValidator((input: { clerkToken: string; role?: ("creator" | "brand") | undefined }) => input)
  .handler(async ({ data }) => {
    const secretKey = process.env["CLERK_SECRET_KEY"];
    if (!secretKey) throw new Error("Google sign-in isn't configured yet.");

    const { verifyToken, createClerkClient } = await import("@clerk/backend");
    let clerkUserId: string;
    try {
      const payload = await verifyToken(data.clerkToken, { secretKey });
      clerkUserId = payload.sub;
    } catch {
      throw new Error("Could not verify your Google sign-in — please try again.");
    }

    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
    if (!primary?.emailAddress) throw new Error("Your Google account has no verified email address.");
    const email = primary.emailAddress;
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          ...(fullName ? { full_name: fullName } : {}),
          ...(data.role ? { role: data.role } : {}),
        },
      },
    });
    if (error || !link) throw new Error(error?.message ?? "Could not sign you in.");

    return { tokenHash: link.properties.hashed_token, email };
  });
