import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Rocket, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account | Bingo" },
      { name: "description", content: "Join Bingo as a creator or brand and start matching on content, not follower count." },
      { property: "og:title", content: "Create your account | Bingo" },
      { property: "og:description", content: "Join Bingo as a creator or brand and start matching on content, not follower count." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Signup,
});

function Signup() {
  const [accountType, setAccountType] = useState<"creator" | "brand">("creator");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-end overflow-hidden bg-gradient-brand p-12 lg:flex">
        <div className="absolute inset-0 grid-backdrop opacity-40" />
        <div className="relative max-w-md text-primary-foreground">
          <h2 className="text-4xl font-bold leading-tight">Engineered for Creators. Built for Brands.</h2>
          <p className="mt-4 text-sm opacity-90">
            AI match profiles, contract vaults and instant payouts — all in one neon-drenched workspace.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-brand font-display font-bold text-primary-foreground">
              B
            </span>
            <span className="font-display text-xl font-bold">Bingo</span>
          </Link>
          <h1 className="mt-8 text-3xl font-bold">Join Bingo</h1>
          <p className="mt-2 text-sm text-muted-foreground">Engineered for Creators. Built for Brands.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              toast.success(`Demo signup as ${accountType} — connect a backend to make this real.`);
            }}
          >
            <div className="space-y-2">
              <Label>Account type</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "creator", label: "Creator", icon: Rocket },
                  { key: "brand", label: "Brand", icon: Store },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAccountType(option.key)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors ${
                      accountType === option.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <option.icon className="size-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" required placeholder="Nova Reyes" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email address</Label>
              <Input id="signup-email" type="email" required placeholder="you@studio.com" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" required placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm</Label>
                <Input id="confirm-password" type="password" required placeholder="••••••••" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox className="mt-0.5" /> I agree to the Terms of Service and Privacy Policy.
            </label>
            <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
              Create account <ArrowRight className="ml-1 size-4" />
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
