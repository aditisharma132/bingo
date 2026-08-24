import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { listNotifications, markNotificationsRead } from "@/lib/social.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Bingo" },
      { name: "description", content: "Offers, messages, payments and new posts from the brands you follow." },
      { property: "og:title", content: "Notifications | Bingo" },
      { property: "og:description", content: "Offers, messages, payments and new posts from the brands you follow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications({ data: undefined }),
    refetchInterval: 20000,
  });

  const mutation = useMutation({
    mutationFn: () => markRead({ data: undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All caught up");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data ?? [];
  const hasUnread = rows.some((n: { read_at: string | null }) => !n.read_at);

  // Opening the page clears the bell badge — the alerts stay listed, badged as read.
  const autoMarked = useRef(false);
  useEffect(() => {
    if (!hasUnread || autoMarked.current) return;
    autoMarked.current = true;
    void markRead({ data: undefined }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [hasUnread, markRead, queryClient]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Alerts"
          title="Notifications"
          subtitle="Everything that needs your attention — offers, messages, payments and brand posts."
          action={
            <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              Mark all read
            </Button>
          }
        />

        <div className="mt-8 space-y-3">
          {query.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Nothing yet" description="Subscribe to brands and start conversations to see alerts here." />
          ) : (
            rows.map((n: any) => (
              <Panel key={n.id} className={n.read_at ? "opacity-70" : "border-primary/40"}>
                <div className="flex items-start gap-3">
                  <Bell className="mt-1 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {n.title}
                      <span
                        className={
                          n.read_at
                            ? "rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                            : "rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground"
                        }
                      >
                        {n.read_at ? "Read" : "New"}
                      </span>
                    </p>
                    {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                    {n.link ? (
                      <Link to={n.link} className="mt-2 inline-block text-sm text-primary hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </div>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Panel>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
