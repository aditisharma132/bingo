import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password | Bingo" },
      { name: "description", content: "Send yourself a secure link to set a new Bingo password." },
      { property: "og:title", content: "Reset your password | Bingo" },
      { property: "og:description", content: "Send yourself a secure link to set a new Bingo password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Forgot your password?</h1>
        {sent ? (
          <p className="mt-3 text-muted-foreground">
            If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
          </p>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground">
              Enter your email and we'll send a secure link to set a new password.
            </p>
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  className="mt-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
              >
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="text-primary underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
