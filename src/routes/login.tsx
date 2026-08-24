import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | Bingo" },
      {
        name: "description",
        content: "Sign in to Bingo to manage brand deals, messages and creator earnings.",
      },
      { property: "og:title", content: "Log in | Bingo" },
      {
        property: "og:description",
        content: "Sign in to Bingo to manage brand deals, messages and creator earnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back to home
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-brand font-display font-bold text-primary-foreground">
              B
            </span>
            <span className="font-display text-xl font-bold">Bingo</span>
          </Link>
          <h1 className="mt-8 text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to Bingo.</p>

          <div className="mt-8">
            <GoogleAuthButton />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
            >
              {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Log in <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <aside className="relative hidden flex-col justify-between bg-gradient-brand p-12 text-primary-foreground lg:flex">
        <p className="text-xs uppercase tracking-[0.3em] opacity-80">Ledger, since 2019</p>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Every deal, written down and kept.
          </h2>
          <p className="mt-4 max-w-sm text-sm opacity-90">
            Sign in and pick up your file: matches, briefs, messages and payouts, all in one place.
          </p>
        </div>
        <p className="text-sm opacity-80">Find creators by content, not follower count.</p>
      </aside>
    </div>
  );
}
