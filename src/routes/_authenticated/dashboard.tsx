import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { EmptyState, PageHeader, Panel, Stat } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { TrendsPanel } from "@/components/trends-panel";
import { cn } from "@/lib/utils";
import { getDashboard } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Bingo" },
      { name: "description", content: "Your Bingo home: matches, campaigns and collaborations in one place." },
      { property: "og:title", content: "Dashboard | Bingo" },
      { property: "og:description", content: "Your Bingo home: matches, campaigns and collaborations in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { tab?: "overview" | "analytics" } =>
    search["tab"] === "analytics" ? { tab: "analytics" } : {},
  component: Dashboard,
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

function Dashboard() {
  const { loading, role, displayName, needsOnboarding } = useAuth();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate();
  const fetchDashboard = useServerFn(getDashboard);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && needsOnboarding) navigate({ to: "/onboarding", replace: true });
  }, [loading, needsOnboarding, navigate]);

  // Instagram callback lands here on success — confirm and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("instagram");
    if (!flag) return;
    if (flag === "connected") {
      toast.success(`Instagram connected${params.get("handle") ? ` — @${params.get("handle")}` : ""}`);
    } else {
      toast.error(params.get("message") ?? "Instagram connection failed.");
    }
    void qc.invalidateQueries();
    window.history.replaceState({}, "", `${window.location.pathname}?tab=analytics`);
  }, [qc]);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard({ data: undefined }),
    enabled: !loading && !needsOnboarding,
  });

  if (loading || needsOnboarding) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const isBrand = role === "brand";
  const stats = data?.stats ?? [
    { label: isBrand ? "Live campaigns" : "Open opportunities", value: "—" },
    { label: "Active collaborations", value: "—" },
    { label: isBrand ? "Shortlisted creators" : "Pitches sent", value: "—" },
    { label: "Completed", value: "—" },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow={isBrand ? "Brand Dashboard" : "Creator Dashboard"}
          title={`Welcome back, ${displayName || "there"}`}
          subtitle={
            isBrand
              ? "Describe a campaign in plain language and Bingo builds the brief and the shortlist."
              : "Opportunities are ranked by your content and craft — never by follower count."
          }
          action={
            <Button asChild variant="outline">
              <Link to={isBrand ? "/campaigns" : "/matches"}>
                {isBrand ? "Your campaigns" : "Your matches"} <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-6 inline-flex rounded-full border border-border p-1 text-sm">
          {(["overview", "analytics"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => navigate({ to: "/dashboard", search: { tab: t } })}
              className={cn(
                "rounded-full px-4 py-1.5 capitalize",
                tab === t ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "analytics" ? (
          <div className="mt-6">
            <TrendsPanel />
          </div>
        ) : (
        <>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} {...(s.hint ? { hint: s.hint } : {})} />
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <h2 className="text-lg font-semibold">{isBrand ? "Your best matches" : "Opportunities for you"}</h2>
            <div className="mt-4 space-y-3">
              {(data?.opportunities ?? []).length ? (
                data!.opportunities.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">{o.title}</p>
                      <p className="text-sm capitalize text-muted-foreground">{o.subtitle}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      {isBrand && o.creatorId ? (
                        <Link
                          to="/creators/$creatorId"
                          params={{ creatorId: o.creatorId }}
                          search={{
                            ...(o.campaignId ? { campaign: o.campaignId } : {}),
                            ...(o.matchId ? { match: o.matchId } : {}),
                          }}
                        >
                          View profile
                        </Link>
                      ) : (
                        <Link to={isBrand ? "/campaigns" : "/matches"}>View</Link>
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={isBrand ? "No matches yet" : "No opportunities yet"}
                  description={
                    isBrand
                      ? "Create your first campaign and Bingo will rank creators who actually fit the brief."
                      : "Once brands publish campaigns that fit your DNA, they'll appear here with the reasons why."
                  }
                  action={
                    isBrand ? (
                      <Button asChild className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90">
                        <Link to="/campaigns">Create a campaign</Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline">
                        <Link to="/profile">Review your Creator DNA</Link>
                      </Button>
                    )
                  }
                />
              )}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold">Active collaborations</h2>
            <div className="mt-4 space-y-3">
              {(data?.deals ?? []).length ? (
                data!.deals.map((d) => (
                  <Link
                    key={d.id}
                    to="/deals/$dealId"
                    params={{ dealId: d.id }}
                    className="block rounded-xl border border-border p-4 transition-colors hover:border-primary/50"
                  >
                    <p className="font-medium">{d.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.subtitle} · {stateCopy[d.state] ?? d.state}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Nothing in progress"
                  description="Accepted deals show their stage here — from negotiating through to completed."
                />
              )}
            </div>
          </Panel>
        </div>
        </>
        )}
      </main>
    </div>
  );
}
