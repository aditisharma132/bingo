import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AiProfileBoost } from "@/components/ai-profile-boost";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { InstagramPanel } from "@/components/instagram-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listConnections, removeConnection, saveConnection } from "@/lib/connections.functions";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Social connections | Bingo" },
      { name: "description", content: "Link your Instagram, YouTube and other handles so brands see real reach." },
      { property: "og:title", content: "Social connections | Bingo" },
      { property: "og:description", content: "Link your Instagram, YouTube and other handles so brands see real reach." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectionsPage,
});

const PLATFORMS = ["instagram", "youtube", "tiktok", "linkedin", "x"];

function ConnectionsPage() {
  const qc = useQueryClient();
  const load = useServerFn(listConnections);
  const save = useServerFn(saveConnection);
  const remove = useServerFn(removeConnection);

  const { data, isLoading } = useQuery({ queryKey: ["connections"], queryFn: () => load() });

  const [platform, setPlatform] = useState("instagram");
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [engagement, setEngagement] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["connections"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          platform,
          handle,
          followers: followers ? Number(followers) : undefined,
          engagementRate: engagement ? Number(engagement) : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Handle saved");
      setHandle("");
      setFollowers("");
      setEngagement("");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Profile"
          title="Social connections"
          subtitle="Verified reach makes your matches stronger. Connect Instagram, or add handles manually for now."
        />

        <div className="mt-8 space-y-6">
          <InstagramPanel />
          <AiProfileBoost />
        </div>

        <Panel className="mt-6">
          <h2 className="text-lg font-semibold">Add a handle</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="platform">Platform</Label>
              <select
                id="platform"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm capitalize"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" />
            </div>
            <div>
              <Label htmlFor="followers">Followers</Label>
              <Input id="followers" inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="engagement">Engagement rate (%)</Label>
              <Input id="engagement" inputMode="decimal" value={engagement} onChange={(e) => setEngagement(e.target.value)} />
            </div>
          </div>
          <Button className="mt-4" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Save handle
          </Button>
        </Panel>

        <Panel className="mt-6">
          <h2 className="text-lg font-semibold">Connected accounts</h2>
          {isLoading ? (
            <Loader2 className="mt-4 size-4 animate-spin text-muted-foreground" />
          ) : data?.accounts.length ? (
            <ul className="mt-4 space-y-3">
              {data.accounts.map((a: any) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-medium capitalize">
                      {a.platform} · @{a.handle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.followers ? `${Number(a.followers).toLocaleString("en-IN")} followers` : "Followers not set"}
                      {a.engagement_rate ? ` · ${a.engagement_rate}% engagement` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.connected_via_oauth ? "default" : "secondary"}>
                      {a.connected_via_oauth ? "Verified" : "Self-reported"}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(a.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No handles yet" description="Add at least one so brands can see your reach." />
          )}
        </Panel>
      </main>
    </div>
  );
}
