import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bridgeClerkSession } from "@/lib/clerk-auth.functions";

const CLERK_PUBLISHABLE_KEY = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] as string | undefined;

export const Route = createFileRoute("/auth/clerk-callback")({
  component: ClerkCallbackPage,
});

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link to="/login" className="inline-block text-sm text-primary hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}

/** Finishes the Google sign-in Clerk started, then bridges it into a real Supabase
 * session (see clerk-auth.functions.ts) — nothing downstream of that needs to know
 * Clerk was involved at all. */
function ClerkBridge() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const bridge = useServerFn(bridgeClerkSession);
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    if (!isSignedIn) {
      setError("Google sign-in didn't complete — please try again.");
      return;
    }
    ran.current = true;
    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error("Could not read your Google session.");

        let role: "creator" | "brand" | undefined;
        try {
          const stored = window.localStorage.getItem("bingo-intended-role");
          role = stored === "brand" || stored === "creator" ? stored : undefined;
        } catch {
          /* ignore */
        }

        const { tokenHash, email } = await bridge({ data: { clerkToken, role } });
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "email",
          email,
        });
        if (otpError) throw otpError;
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong signing you in.");
      }
    })();
  }, [isLoaded, isSignedIn, getToken, bridge, navigate]);

  if (error) return <ErrorScreen message={error} />;
  return <Spinner />;
}

function ClerkCallbackPage() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return <ErrorScreen message="Google sign-in isn't configured yet." />;
  }
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ClerkBridge />
    </ClerkProvider>
  );
}
