import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Instagram, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/bingo-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeInstagramManual,
  disconnectInstagram,
  getInstagramStatus,
  startInstagramConnect,
  syncInstagram,
} from "@/lib/instagram.functions";
import { safeHref } from "@/lib/safe-url";

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-IN") : "—";
}

export function InstagramPanel() {
  const qc = useQueryClient();
  const status = useServerFn(getInstagramStatus);
  const start = useServerFn(startInstagramConnect);
  const manual = useServerFn(completeInstagramManual);
  const sync = useServerFn(syncInstagram);
  const disconnect = useServerFn(disconnectInstagram);

  const [showManual, setShowManual] = useState(false);
  const [raw, setRaw] = useState("");

  const query = useQuery({ queryKey: ["instagram-status"], queryFn: () => status() });
  const invalidate = () => qc.invalidateQueries();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("instagram");
    if (!flag) return;
    if (flag === "connected") toast.success(`Instagram connected${params.get("handle") ? ` — @${params.get("handle")}` : ""}`);
    if (flag === "error") toast.error(params.get("message") ?? "Instagram connection failed.");
    window.history.replaceState({}, "", window.location.pathname);
    void qc.invalidateQueries();
  }, [qc]);

  const connect = useMutation({
    mutationFn: () => start({ data: { origin: window.location.origin } }),
    onSuccess: (res: any) => {
      if (res.available && res.url) window.location.href = res.url;
      else toast.info("Instagram isn't configured on the server yet.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const manualMutation = useMutation({
    mutationFn: () => manual({ data: { raw, origin: window.location.origin } }),
    onSuccess: (res: any) => {
      toast.success(`Connected${res.username ? ` — @${res.username}` : ""}`);
      setRaw("");
      setShowManual(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: () => sync(),
    onSuccess: () => {
      toast.success("Instagram data refreshed");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Instagram disconnected");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const account = query.data?.account as any;
  const snapshot = account?.profile_data as any;
  const profile = snapshot?.profile ?? {};
  const insights: Array<{ name: string; value: number | null }> = snapshot?.insights ?? [];
  const media: any[] = snapshot?.media ?? [];
  const connected = Boolean(query.data?.connected);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
            <Instagram className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Instagram</h2>
            <p className="text-sm text-muted-foreground">
              {connected
                ? `Connected as @${profile.username ?? account?.handle} · last synced ${
                    account?.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : "—"
                  }`
                : "Connect your Instagram business/creator account to pull real reach, posts and insights."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {connected ? (
            <>
              <Badge>Verified</Badge>
              <Button variant="outline" size="sm" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
                {syncMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate()}
              >
                <Unlink className="mr-1 size-4" /> Disconnect
              </Button>
            </>
          ) : (
            <Button
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
              disabled={connect.isPending}
              onClick={() => connect.mutate()}
            >
              {connect.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Instagram className="mr-1 size-4" />}
              Connect Instagram
            </Button>
          )}
        </div>
      </div>

      {connected ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Followers", value: num(profile.followers_count ?? account?.followers) },
              { label: "Posts", value: num(profile.media_count) },
              { label: "Engagement", value: account?.engagement_rate ? `${account.engagement_rate}%` : "—" },
              ...insights.slice(0, 4).map((i) => ({ label: i.name.replace(/_/g, " "), value: num(i.value) })),
            ]
              .slice(0, 4)
              .map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-xl font-semibold">{stat.value}</p>
                </div>
              ))}
          </div>

          {media.length ? (
            <div className="mt-6">
              <p className="text-sm font-semibold">Recent posts</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {media.slice(0, 12).map((m) => (
                  <a
                    key={m.id}
                    href={safeHref(m.permalink)}
                    target="_blank"
                    rel="noreferrer"
                    className="group overflow-hidden rounded-xl border border-border"
                  >
                    <div className="aspect-square overflow-hidden bg-muted">
                      {m.thumbnail_url || m.media_url ? (
                        <img
                          src={m.thumbnail_url ?? m.media_url}
                          alt={(m.caption ?? "Instagram post").slice(0, 60)}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      ♥ {num(m.like_count)} · 💬 {num(m.comments_count)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5">
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowManual((v) => !v)}
          >
            Redirect blocked? Paste the code manually
          </button>
          {showManual ? (
            <div className="mt-3 space-y-2">
              <Label htmlFor="ig-code">Authorization code or full redirect URL</Label>
              <Input id="ig-code" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="https://…?code=AQ…" />
              <Button size="sm" disabled={!raw || manualMutation.isPending} onClick={() => manualMutation.mutate()}>
                {manualMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Complete connection
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
