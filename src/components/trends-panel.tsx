import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Panel, Stat } from "@/components/bingo-ui";
import { getTrends } from "@/lib/trends.functions";
import { cn } from "@/lib/utils";

function Bars({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Panel>
      <h3 className="text-lg font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize">{row.label}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-gradient-brand"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </Panel>
  );
}

/** Market signals, optionally narrowed to the signed-in creator's own labels. */
export function TrendsPanel() {
  const fetchTrends = useServerFn(getTrends);
  const { data, isLoading } = useQuery({ queryKey: ["trends"], queryFn: () => fetchTrends({ data: undefined }) });
  const [scope, setScope] = useState<"mine" | "market">("mine");

  if (isLoading || !data) {
    return (
      <div className="mt-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Crunching the numbers…
      </div>
    );
  }

  const hasLabels = data.myLabels.length > 0;
  const useMine = scope === "mine" && hasLabels;
  const demandCategories = useMine ? data.forMe.demandCategories : data.demandCategories;
  const demandTypes = useMine ? data.forMe.demandTypes : data.demandTypes;
  const supplyCategories = useMine ? data.forMe.supplyCategories : data.supplyCategories;
  const gaps = useMine ? data.forMe.gaps : data.gaps;

  return (
    <div className="space-y-6">
      {hasLabels ? (
        <div className="inline-flex rounded-full border border-border p-1 text-sm">
          {(["mine", "market"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full px-3 py-1.5",
                scope === s ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {s === "mine" ? "My categories" : "Whole market"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live campaigns" value={String(data.headline.liveCampaigns)} hint="Open to pitches" />
        <Stat label="Campaigns (30d)" value={String(data.headline.campaigns30d)} hint="Newly briefed" />
        <Stat
          label="Median starting price"
          value={
            data.headline.medianStartingPrice
              ? `₹${data.headline.medianStartingPrice.toLocaleString("en-IN")}`
              : "—"
          }
          hint="Across creator profiles"
        />
        <Stat label="Strong-fit rate" value={`${data.headline.strongMatchRate}%`} hint="Of all matches scored" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bars
          title="What brands are briefing for"
          rows={demandCategories}
          empty={useMine ? "No briefs in your categories yet." : "No briefs yet."}
        />
        <Bars title="Creator types in demand" rows={demandTypes} empty="No briefs yet." />
        <Bars title="Creator supply by category" rows={supplyCategories} empty="No creator profiles yet." />
        <Bars title="Most requested deliverables" rows={data.demandDeliverables} empty="No briefs yet." />
      </div>

      <Panel>
        <h3 className="text-lg font-semibold">Opportunity gaps</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Categories where brands are briefing faster than creators are joining.
        </p>
        {gaps.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {gaps.map((gap) => (
              <li key={gap.label} className="rounded-xl border p-3 text-sm">
                <span className="font-medium capitalize">{gap.label}</span>
                <span className="ml-2 text-muted-foreground">
                  {gap.count} briefs · {gap.supply} creators
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Supply is keeping up with demand right now.</p>
        )}
      </Panel>

      <Bars title="Compensation mix" rows={data.compensationMix} empty="No campaigns yet." />
    </div>
  );
}
