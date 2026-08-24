import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { listDeals } from "@/lib/deals.functions";

export const Route = createFileRoute("/_authenticated/deals/")({
  head: () => ({
    meta: [
      { title: "Collaborations | Bingo" },
      { name: "description", content: "Track every Bingo collaboration from agreed terms through content review and payment." },
      { property: "og:title", content: "Collaborations | Bingo" },
      { property: "og:description", content: "Track every Bingo collaboration from agreed terms through content review and payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DealsPage,
});

const stateCopy: Record<string, string> = {
  DISCOVERED: "Discovered",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Terms agreed",
  CREATING: "In creation",
  REVIEW: "In review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function DealsPage() {
  const fetchDeals = useServerFn(listDeals);
  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: () => fetchDeals({ data: undefined }),
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Workspace"
          title="Collaborations"
          subtitle="Every agreed deal, its current stage, and what needs to happen next."
        />

        <div className="mt-8 space-y-3">
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : !(data ?? []).length ? (
            <Panel>
              <EmptyState
                title="No collaborations yet"
                description="Once an offer is accepted in chat, the collaboration appears here with its full lifecycle."
                action={
                  <Button asChild variant="outline">
                    <Link to="/messages" search={{ c: undefined }}>
                      Go to messages
                    </Link>
                  </Button>
                }
              />
            </Panel>
          ) : (
            (data ?? []).map((d) => (
              <Link
                key={d.id}
                to="/deals/$dealId"
                params={{ dealId: d.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div>
                  <p className="font-semibold">{d.campaign_title ?? "Direct collaboration"}</p>
                  <p className="text-sm text-muted-foreground">
                    {d.counterpart} ·{" "}
                    {d.agreed_amount_inr
                      ? `₹${Number(d.agreed_amount_inr).toLocaleString("en-IN")}`
                      : d.compensation_type === "barter"
                        ? "Barter"
                        : "Amount not set"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {stateCopy[d.state] ?? d.state}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
