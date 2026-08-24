import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { adminOverview, setVerification } from "@/lib/admin.functions";
import { seedDemoData } from "@/lib/seed.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin | Bingo" },
      { name: "description", content: "Platform operations: users, verification, campaigns, tickets and disputes." },
      { property: "og:title", content: "Admin | Bingo" },
      { property: "og:description", content: "Platform operations: users, verification, campaigns, tickets and disputes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(adminOverview);
  const verify = useServerFn(setVerification);

  const seed = useServerFn(seedDemoData);
  const seedMutation = useMutation({
    mutationFn: () => seed(),
    onSuccess: (res: any) => {
      toast.success(
        `Seeded ${res.createdCreators} creators, ${res.createdBrands} brands, ${res.createdCampaigns} campaigns`,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const query = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({ data: undefined }),
    enabled: isAdmin,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: { subject: "creator" | "brand"; id: string; status: "approved" | "rejected" }) =>
      verify({ data: input }),
    onSuccess: () => {
      toast.success("Verification updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading || (isAdmin && query.isLoading)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin || query.error || !query.data) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState
            title="Admins only"
            description="This account doesn't have the admin role. Sign in with an admin account to open the console."
          />
        </main>
      </div>
    );
  }

  const data = query.data!;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader eyebrow="Platform" title="Admin console" subtitle="Users, verification queue, campaigns, tickets and disputes." />
          <Button variant="outline" disabled={seedMutation.isPending} onClick={() => seedMutation.mutate()}>
            {seedMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Load demo data
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Creators" value={String(data.metrics.creators)} />
          <Stat label="Brands" value={String(data.metrics.brands)} />
          <Stat label="Campaigns" value={String(data.metrics.campaigns)} hint={`${data.metrics.published} published`} />
          <Stat label="Deals" value={String(data.metrics.deals)} />
        </div>

        <Panel className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Payments & GMV</h2>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Provider: {data.metrics.finance.provider}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Completed GMV" value={`₹${data.metrics.finance.gmv.toLocaleString("en-IN")}`} />
            <Stat label="Held in escrow" value={`₹${data.metrics.finance.escrowHeld.toLocaleString("en-IN")}`} />
            <Stat label="Released" value={`₹${data.metrics.finance.released.toLocaleString("en-IN")}`} />
            <Stat
              label="Awaiting payment"
              value={`₹${data.metrics.finance.pending.toLocaleString("en-IN")}`}
              hint={`${data.metrics.finance.paymentsCount} payment records`}
            />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {data.metrics.finance.dealFunnel.map((step: any) => (
              <div key={step.state} className="rounded-xl border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{step.state.replace(/_/g, " ")}</p>
                <p className="mt-1 text-xl font-semibold">{step.count}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="text-lg font-semibold">Creators</h2>
            <div className="mt-4 space-y-3">
              {data.creators.map((c: any) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium">{c.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(c.creator_types ?? []).join(", ") || "No type"} · {c.verification}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => mutation.mutate({ subject: "creator", id: c.id, status: "approved" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mutation.mutate({ subject: "creator", id: c.id, status: "rejected" })}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {!data.creators.length ? <EmptyState title="No creators" description="Creator accounts will appear here." /> : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Brands</h2>
            <div className="mt-4 space-y-3">
              {data.brands.map((b: any) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div>
                    <p className="font-medium">{b.brand_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.industry ?? "No industry"} · {b.verification}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => mutation.mutate({ subject: "brand", id: b.id, status: "approved" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mutation.mutate({ subject: "brand", id: b.id, status: "rejected" })}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {!data.brands.length ? <EmptyState title="No brands" description="Brand accounts will appear here." /> : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <div className="mt-4 space-y-2 text-sm">
              {data.campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>{c.title}</span>
                  <span className="text-xs uppercase text-muted-foreground">{c.status}</span>
                </div>
              ))}
              {!data.campaigns.length ? <EmptyState title="No campaigns" description="Published briefs will appear here." /> : null}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Tickets & disputes</h2>
            <div className="mt-4 space-y-2 text-sm">
              {data.tickets.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>{t.subject}</span>
                  <span className="text-xs uppercase text-muted-foreground">{t.status}</span>
                </div>
              ))}
              {data.disputes.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>{d.reason}</span>
                  <span className="text-xs uppercase text-muted-foreground">{d.status}</span>
                </div>
              ))}
              {!data.tickets.length && !data.disputes.length ? (
                <EmptyState title="All clear" description="No open tickets or disputes right now." />
              ) : null}
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}
