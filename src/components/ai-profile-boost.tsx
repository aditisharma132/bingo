import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Chip, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { analyzeInstagram, listProfileSuggestions, resolveSuggestion } from "@/lib/instagram.functions";

function renderValue(value: unknown) {
  if (value == null || value === "") return <span className="text-muted-foreground">(empty)</span>;
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((v) => (
          <Chip key={String(v)} label={String(v)} />
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key}>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{key.replace(/_/g, " ")}</p>
            <div className="mt-1">{renderValue(val)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm">{String(value)}</p>;
}

export function AiProfileBoost() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeInstagram);
  const list = useServerFn(listProfileSuggestions);
  const resolve = useServerFn(resolveSuggestion);

  const query = useQuery({ queryKey: ["profile-suggestions"], queryFn: () => list() });

  const run = useMutation({
    mutationFn: () => analyze(),
    onSuccess: (res: any) => {
      toast.success(res.count ? `${res.count} suggestion${res.count === 1 ? "" : "s"} ready` : "Your profile already looks aligned with your Instagram.");
      void qc.invalidateQueries({ queryKey: ["profile-suggestions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const act = useMutation({
    mutationFn: (input: { id: string; action: "apply" | "dismiss" }) => resolve({ data: input }),
    onSuccess: (_res, input) => {
      toast.success(input.action === "apply" ? "Applied to your profile" : "Dismissed");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suggestions = query.data ?? [];

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">AI profile boost</h2>
          <p className="text-sm text-muted-foreground">
            Analyses your connected Instagram content and metrics, then suggests improvements. Nothing changes until you
            apply it.
          </p>
        </div>
        <Button
          className="bg-gradient-brand text-primary-foreground hover:opacity-90"
          disabled={run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Sparkles className="mr-1 size-4" />}
          Analyse my Instagram
        </Button>
      </div>

      {query.isLoading ? (
        <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
      ) : suggestions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No pending suggestions.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold">{s.label}</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: s.id, action: "apply" })}>
                    <Check className="mr-1 size-4" /> Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: s.id, action: "dismiss" })}
                  >
                    <X className="mr-1 size-4" /> Dismiss
                  </Button>
                </div>
              </div>
              {s.rationale ? <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p> : null}
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Current</p>
                  <div className="mt-2">{renderValue(s.current_value)}</div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Suggested</p>
                  <div className="mt-2">{renderValue(s.suggested_value)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
