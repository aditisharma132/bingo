import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTicket, listMySupport, raiseDispute } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support & disputes | Bingo" },
      { name: "description", content: "Raise a support ticket or open a dispute on a collaboration." },
      { property: "og:title", content: "Support & disputes | Bingo" },
      { property: "og:description", content: "Raise a support ticket or open a dispute on a collaboration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const REASONS = ["Content not delivered", "Payment issue", "Brief changed after agreement", "Quality concern", "Other"];

function SupportPage() {
  const qc = useQueryClient();
  const load = useServerFn(listMySupport);
  const ticketFn = useServerFn(createTicket);
  const disputeFn = useServerFn(raiseDispute);

  const { data, isLoading } = useQuery({ queryKey: ["support"], queryFn: () => load() });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dealId, setDealId] = useState("");
  const [reason, setReason] = useState(REASONS[0]!);
  const [details, setDetails] = useState("");

  const submitTicket = useMutation({
    mutationFn: () => ticketFn({ data: { subject, body } }),
    onSuccess: () => {
      toast.success("Ticket raised — we'll email you");
      setSubject("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitDispute = useMutation({
    mutationFn: () => disputeFn({ data: { dealId, reason, details } }),
    onSuccess: () => {
      toast.success("Dispute opened");
      setDetails("");
      void qc.invalidateQueries({ queryKey: ["support"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Help"
          title="Support & disputes"
          subtitle="Anything from a question to a collaboration that went sideways — we'll pick it up."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-lg font-semibold">Raise a support ticket</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Payout hasn't arrived" />
              </div>
              <div>
                <Label htmlFor="body">What's happening?</Label>
                <Textarea id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <Button disabled={submitTicket.isPending} onClick={() => submitTicket.mutate()}>
                {submitTicket.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Send ticket
              </Button>
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Open a dispute</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label htmlFor="deal">Collaboration</Label>
                <select
                  id="deal"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={dealId}
                  onChange={(e) => setDealId(e.target.value)}
                >
                  <option value="">Select a collaboration</option>
                  {(data?.deals ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <select
                  id="reason"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="details">Details</Label>
                <Textarea id="details" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
              </div>
              <Button variant="outline" disabled={submitDispute.isPending} onClick={() => submitDispute.mutate()}>
                {submitDispute.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Open dispute
              </Button>
            </div>
          </Panel>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-lg font-semibold">Your tickets</h2>
            {isLoading ? (
              <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
            ) : data?.tickets.length ? (
              <ul className="mt-4 space-y-3">
                {data.tickets.map((t: any) => (
                  <li key={t.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{t.subject}</span>
                      <Badge variant="secondary">{t.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No tickets yet" description="Anything you send lands here with its status." />
            )}
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Your disputes</h2>
            {isLoading ? (
              <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
            ) : data?.disputes.length ? (
              <ul className="mt-4 space-y-3">
                {data.disputes.map((d: any) => (
                  <li key={d.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{d.reason}</span>
                      <Badge variant="secondary">{d.status}</Badge>
                    </div>
                    {d.details ? <p className="mt-1 text-sm text-muted-foreground">{d.details}</p> : null}
                    {d.resolution ? <p className="mt-2 text-sm">Resolution: {d.resolution}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No disputes" description="Hopefully it stays that way." />
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
