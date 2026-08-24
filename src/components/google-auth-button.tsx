import { ClerkProvider, useSignIn } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const CLERK_PUBLISHABLE_KEY = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] as string | undefined;

/**
 * Google sign-in via Clerk — chosen specifically because Clerk's dev instance ships
 * with Google OAuth already configured (no domain verification or redirect-URI setup
 * needed on our side). The result is bridged into a normal Supabase session on
 * /auth/clerk-callback; nothing else in the app knows Clerk is involved.
 */
function GoogleButtonInner({
  label,
  onBeforeRedirect,
}: {
  label: string;
  onBeforeRedirect?: (() => void) | undefined;
}) {
  const { signIn, isLoaded } = useSignIn();

  async function handleClick() {
    if (!isLoaded || !signIn) return;
    onBeforeRedirect?.();
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/auth/clerk-callback`,
        redirectUrlComplete: `${window.location.origin}/auth/clerk-callback`,
      });
    } catch {
      toast.error("Google sign-in failed. Try email instead.");
    }
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleClick} type="button">
      {label}
    </Button>
  );
}

export function GoogleAuthButton({
  label = "Continue with Google",
  onBeforeRedirect,
}: {
  label?: string;
  onBeforeRedirect?: (() => void) | undefined;
}) {
  if (!CLERK_PUBLISHABLE_KEY) return null;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <GoogleButtonInner label={label} onBeforeRedirect={onBeforeRedirect} />
    </ClerkProvider>
  );
}
