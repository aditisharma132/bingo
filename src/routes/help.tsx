import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicTicket } from "@/lib/public-support.functions";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Support — Raise a ticket with the Bingo team" },
      {
        name: "description",
        content:
          "Have a question or an issue with a collaboration? Send the Bingo team a support ticket and we'll reply by email.",
      },
      { property: "og:title", content: "Support — Raise a ticket with the Bingo team" },
      { property: "og:description", content: "Send the Bingo team a question or report an issue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const submit = useServerFn(submitPublicTicket);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () => submit({ data: { email, subject, body } }),
    onSuccess: () => {
      toast.success("Ticket sent — check your inbox for a confirmation.");
      setSubject("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <LifeBuoy className="size-7 text-primary" />
        <h1 className="mt-4 font-display text-4xl font-bold">Support</h1>
        <p className="mt-3 text-muted-foreground">
          Tell us what's going on and we'll get back to you by email. Already signed in? You can also raise a
          ticket or a dispute from your{" "}
          <Link to="/support" className="text-primary hover:underline">
            support dashboard
          </Link>
          .
        </p>

        <form
          className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Your email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Payment not released"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">How can we help?</Label>
            <Textarea
              id="body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share as much detail as you can — links, names and dates help us resolve faster."
              required
            />
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Sending…" : "Send ticket"}
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
