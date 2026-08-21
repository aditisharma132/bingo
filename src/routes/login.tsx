import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | Bingo" },
      { name: "description", content: "Sign in to Bingo to manage brand deals, messages and creator earnings." },
      { property: "og:title", content: "Log in | Bingo" },
      { property: "og:description", content: "Sign in to Bingo to manage brand deals, messages and creator earnings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
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
          <h1 className="mt-8 text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to Bingo.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              toast.success("Demo sign in — connect a backend to make this real.");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" required placeholder="you@studio.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-primary">Forgot password?</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" required placeholder="••••••••" className="pl-9" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox /> Remember me for 30 days
            </label>
            <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
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

      <div className="relative hidden items-center overflow-hidden bg-gradient-brand p-12 lg:flex">
        <div className="absolute inset-0 grid-backdrop opacity-40" />
        <div className="relative max-w-md text-primary-foreground">
          <p className="font-display text-sm uppercase tracking-[0.25em]">
            Find creators by content, not follower count.
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">Discover the Unseen</h2>
          <p className="mt-4 text-sm opacity-90">
            Join the next generation platform where true talent meets opportunity in a neon-drenched digital
            ecosystem.
          </p>
        </div>
      </div>
    </div>
  );
}
