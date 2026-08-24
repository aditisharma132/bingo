import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getMessagingSettings, unblockUser, updateMessagingPreferences } from "@/lib/messaging.functions";
import { getNotificationPrefs, saveNotificationPrefs, type NotificationPrefs } from "@/lib/prefs.functions";


export const Route = createFileRoute("/_authenticated/notification-preferences")({
  head: () => ({
    meta: [
      { title: "Notification preferences | Bingo" },
      { name: "description", content: "Choose which Bingo emails you receive about messages, offers, collaborations and payments." },
      { property: "og:title", content: "Notification preferences | Bingo" },
      { property: "og:description", content: "Choose which Bingo emails you receive about messages, offers, collaborations and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationPreferencesPage,
});

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "email_messages", label: "Messages", hint: "Someone sends you a chat message." },
  { key: "email_offers", label: "Offers & negotiation", hint: "New offers, counters, accepts and declines." },
  { key: "email_deals", label: "Collaboration updates", hint: "Deal stage changes, deliverables and reviews." },
  { key: "email_payments", label: "Payments", hint: "Funding secured and payouts released." },
  { key: "email_brand_posts", label: "Brand posts", hint: "Brands you subscribe to publish something new." },
];

function NotificationPreferencesPage() {
  const fetchPrefs = useServerFn(getNotificationPrefs);
  const savePrefs = useServerFn(saveNotificationPrefs);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["notification-prefs"], queryFn: () => fetchPrefs({ data: undefined }) });
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    if (query.data) setPrefs(query.data);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => savePrefs({ data: prefs ?? {} }),
    onSuccess: () => {
      toast.success("Preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Notification preferences"
        subtitle="In-app alerts always appear in your bell. Choose which of them also reach your inbox."
      />
      <Panel className="mt-6 space-y-5">
        {!prefs ? (
          <div className="grid py-10 place-items-center">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {ROWS.map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                <Switch
                  checked={prefs[row.key]}
                  onCheckedChange={(v) => setPrefs({ ...prefs, [row.key]: v })}
                  aria-label={row.label}
                />
              </div>
            ))}
            <Button
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Save preferences
            </Button>
          </>
        )}
      </Panel>

      <MessagingPrefsPanel />
    </main>
  );
}

function MessagingPrefsPanel() {
  const fetchSettings = useServerFn(getMessagingSettings);
  const saveSettings = useServerFn(updateMessagingPreferences);
  const unblock = useServerFn(unblockUser);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["messaging-settings"], queryFn: () => fetchSettings({ data: undefined }) });
  const [allowCreatorRequests, setAllowCreatorRequests] = useState(true);
  const [allowBrandRequests, setAllowBrandRequests] = useState(true);

  useEffect(() => {
    if (query.data) {
      setAllowCreatorRequests(query.data.preferences.allowCreatorRequests);
      setAllowBrandRequests(query.data.preferences.allowBrandRequests);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveSettings({ data: { allowCreatorRequests, allowBrandRequests } }),
    onSuccess: () => {
      toast.success("Messaging preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["messaging-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (targetUserId: string) => unblock({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success("Unblocked");
      void queryClient.invalidateQueries({ queryKey: ["messaging-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Panel className="mt-6 space-y-5">
      <div>
        <p className="font-display text-lg font-semibold">Who can reach you</p>
        <p className="text-xs text-muted-foreground">
          New conversations arrive as a request you can accept or decline. Brands can always reach creators.
        </p>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Requests from creators</p>
              <p className="text-xs text-muted-foreground">Let creators send you a message request.</p>
            </div>
            <Switch
              checked={allowCreatorRequests}
              onCheckedChange={setAllowCreatorRequests}
              aria-label="Requests from creators"
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Requests from brands</p>
              <p className="text-xs text-muted-foreground">Let brands start a conversation with you.</p>
            </div>
            <Switch
              checked={allowBrandRequests}
              onCheckedChange={setAllowBrandRequests}
              aria-label="Requests from brands"
            />
          </div>

          <Button
            className="bg-gradient-brand text-primary-foreground hover:opacity-90"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Save messaging preferences
          </Button>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold">Blocked accounts</p>
            {(query.data?.blocked ?? []).length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">You haven't blocked anyone.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(query.data?.blocked ?? []).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {b.name}
                      {b.kind ? <span className="text-muted-foreground"> · {b.kind}</span> : null}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(b.userId)}
                    >
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

