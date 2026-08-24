import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";

import { ArrowLeft, ArrowRight, Loader2, MailCheck, Rocket, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCATIONS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const signupSearchSchema = z.object({
  role: z.enum(["creator", "brand"]).optional(),
});

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account | Bingo" },
      {
        name: "description",
        content:
          "Join Bingo as a creator or brand and start matching on content, not follower count.",
      },
      { property: "og:title", content: "Create your account | Bingo" },
      {
        property: "og:description",
        content:
          "Join Bingo as a creator or brand and start matching on content, not follower count.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: signupSearchSchema,
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/signup" });
  const [accountType, setAccountType] = useState<"creator" | "brand">(
    search.role === "brand" ? "brand" : "creator",
  );
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const nameLabel = accountType === "creator" ? "Full name" : "Brand name";
  const nameValid =
    accountType === "creator"
      ? /^[\p{L}][\p{L}'.-]*(\s+[\p{L}][\p{L}'.-]*)+$/u.test(fullName.trim())
      : fullName.trim().length >= 2;
  const locationValid = LOCATIONS.includes(location as (typeof LOCATIONS)[number]);
  const formValid = nameValid && locationValid && email.trim().length > 3 && password.length >= 8;

  function rememberRole() {
    try {
      localStorage.setItem("bingo-intended-role", accountType);
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!nameValid) {
      toast.error(
        accountType === "creator"
          ? "Enter your full name — first and last."
          : "Enter your brand name.",
      );
      return;
    }
    if (!locationValid) {
      toast.error("Pick your location from the list.");
      return;
    }
    rememberRole();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding?connect=1`,
        data: { full_name: fullName.trim(), role: accountType, location },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setPendingEmail(email);
      toast.success("Confirm your email to activate the account.");
      return;
    }
    toast.success("Account created — let's connect your social account.");
    navigate({ to: "/onboarding" });
  }

  /** After the user clicks the link in their inbox, pick the session up here. */
  async function handleConfirmed() {
    setChecking(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setChecking(false);
    if (error || !data.session) {
      toast.error("Not confirmed yet — click the link in your email, then try again.");
      return;
    }
    toast.success("Email confirmed — let's connect your social account.");
    navigate({ to: "/onboarding" });
  }

  async function handleResend() {
    if (!pendingEmail) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/onboarding?connect=1` },
    });
    if (error) toast.error(error.message);
    else toast.success("Confirmation email sent again.");
  }

  async function handleGoogle() {
    rememberRole();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) toast.error("Google sign-up failed. Try email instead.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between bg-gradient-brand p-12 text-primary-foreground lg:flex">
        <p className="text-xs uppercase tracking-[0.3em] opacity-80">New entry</p>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Matched on your work, not your follower count.
          </h2>
          <p className="mt-4 max-w-sm text-sm opacity-90">
            Create an account and Bingo builds your AI match profile, campaign briefs and
            collaboration tracking in one workspace.
          </p>
        </div>
        <p className="text-sm opacity-80">Engineered for creators. Built for brands.</p>
      </aside>

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
          <h1 className="mt-8 text-3xl font-bold">Join Bingo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Engineered for Creators. Built for Brands.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {(
              [
                { key: "creator", label: "Creator", icon: Rocket },
                { key: "brand", label: "Brand", icon: Store },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccountType(key)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  accountType === key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted",
                )}
              >
                <Icon className="size-5 text-primary" />
                <p className="mt-2 text-sm font-semibold">{label}</p>
              </button>
            ))}
          </div>

          <Button variant="outline" className="mt-6 w-full" type="button" onClick={handleGoogle}>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          {pendingEmail ? (
            <div className="mt-6 space-y-4 rounded-xl border border-border bg-muted/40 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MailCheck className="size-4 text-primary" /> Check your inbox
              </div>
              <p className="text-sm text-muted-foreground">
                We sent a confirmation link to{" "}
                <span className="font-medium text-foreground">{pendingEmail}</span>. Confirm it,
                then come back here to finish setup and connect your social account.
              </p>
              <Button className="w-full" onClick={handleConfirmed} disabled={checking}>
                {checking ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                I&apos;ve confirmed — continue
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-primary hover:underline"
                >
                  Resend email
                </button>
                <button
                  type="button"
                  onClick={() => setPendingEmail(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">{nameLabel}</Label>
                <Input
                  id="name"
                  placeholder={accountType === "creator" ? "Aarav Mehta" : "Studio Nine"}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                {fullName.trim() && !nameValid ? (
                  <p className="text-xs text-destructive">
                    {accountType === "creator"
                      ? "Enter your first and last name."
                      : "Brand name needs at least 2 characters."}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select your city" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <Button
                type="submit"
                disabled={busy || !formValid}
                className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
              >
                {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Create account <ArrowRight className="ml-1 size-4" />
              </Button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
