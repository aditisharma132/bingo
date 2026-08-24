import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, MapPin, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Chip, EmptyState, Panel } from "@/components/bingo-ui";
import { ProfileMediaEditor } from "@/components/profile-media";
import { TagEditor } from "@/components/tag-editor";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { startConversation } from "@/lib/messaging.functions";
import { inviteCreator } from "@/lib/campaigns.functions";
import { getCreatorProfile } from "@/lib/social.functions";
import { safeHref } from "@/lib/safe-url";

export const Route = createFileRoute("/_authenticated/creators/$creatorId")({
  validateSearch: (search: Record<string, unknown>): { campaign?: string; match?: string } => ({
    ...(typeof search["campaign"] === "string" ? { campaign: search["campaign"] } : {}),
    ...(typeof search["match"] === "string" ? { match: search["match"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Creator profile | Bingo" },
      { name: "description", content: "Creator portfolio, craft, categories and collaboration preferences on Bingo." },
      { property: "og:title", content: "Creator profile | Bingo" },
      { property: "og:description", content: "Creator portfolio, craft, categories and collaboration preferences on Bingo." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatorProfilePage,
});

function CreatorProfilePage() {
  const { creatorId } = Route.useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getCreatorProfile);
  const startChat = useServerFn(startConversation);

  const query = useQuery({
    queryKey: ["creator-profile", creatorId],
    queryFn: () => fetchProfile({ data: { creatorId } }),
  });

  const chat = useMutation({
    mutationFn: () => startChat({ data: { creatorId } }),
    onSuccess: (result) => navigate({ to: "/messages", search: { c: result.conversationId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const { campaign: campaignId, match: matchId } = Route.useSearch();
  const sendInvite = useServerFn(inviteCreator);
  const [invited, setInvited] = useState(false);
  const invite = useMutation({
    mutationFn: () => sendInvite({ data: { matchId: matchId! } }),
    onSuccess: () => {
      setInvited(true);
      toast.success("Invite sent — the creator can accept and open a chat.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen">
        <div className="grid py-32 place-items-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  if (query.error || !query.data) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState title="Profile unavailable" description={(query.error as Error)?.message ?? "Not found."} />
        </main>
      </div>
    );
  }

  const { creator, isSelf } = query.data;
  const links = Array.isArray(creator.portfolio_links) ? creator.portfolio_links : [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ProfileMediaEditor
          name={creator.display_name}
          avatar={creator.avatar_url}
          cover={creator.cover_url}
          editable={isSelf}
        />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{creator.display_name}</h1>
            {creator.headline ? <p className="mt-1 text-muted-foreground">{creator.headline}</p> : null}
            {campaignId ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Reviewing this creator for one of your campaigns.
              </p>
            ) : null}
            {creator.location ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {creator.location}
              </p>
            ) : null}
          </div>
          {!isSelf && role === "brand" ? (
            <div className="flex flex-wrap items-center gap-2">
              {matchId ? (
                <Button
                  variant={invited ? "outline" : "default"}
                  onClick={() => invite.mutate()}
                  disabled={invite.isPending}
                >
                  {invite.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Send className="mr-1 size-4" />
                  )}
                  {invited ? "Invite again" : "Invite to campaign"}
                </Button>
              ) : null}
              <Button
                className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90"
                onClick={() => chat.mutate()}
                disabled={chat.isPending}
              >
                {chat.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : <MessageSquare className="mr-1 size-4" />}
                Message
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel>
              <h2 className="font-display text-lg font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {creator.bio || "This creator hasn't written an about section yet."}
              </p>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-semibold">Portfolio</h2>
              {links.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No portfolio links added yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {links.map((link: any, index: number) => (
                    <li key={index}>
                      <a
                        href={safeHref(typeof link === "string" ? link : link.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {typeof link === "string" ? link : (link.label ?? link.url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {creator.dna ? (
              <Panel>
                <h2 className="font-display text-lg font-semibold">Creator DNA</h2>
                <p className="mt-2 text-sm text-muted-foreground">{creator.dna.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(creator.dna.content_style ?? []).map((s: string) => (
                    <Chip key={s} label={s} />
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>

          <div className="space-y-6">
            <Panel>
              <h2 className="font-display text-lg font-semibold">Craft</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(creator.creator_types ?? []).map((t: string) => (
                  <Chip key={t} label={t} />
                ))}
              </div>
              <h3 className="mt-5 text-sm font-semibold">Categories</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {(creator.categories ?? []).map((c: string) => (
                  <Chip key={c} label={c} />
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-semibold">Custom tags</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Used for matching alongside the standard categories.
              </p>
              <div className="mt-3">
                <TagEditor entityType="creator" entityId={creatorId} editable={isSelf} />
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-semibold">Collaboration</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Starting price:{" "}
                <span className="font-semibold text-foreground">
                  {creator.starting_price_inr ? `₹${creator.starting_price_inr.toLocaleString("en-IN")}` : "On request"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {creator.open_to_paid ? <Chip label="Open to paid" /> : null}
                {creator.open_to_barter ? <Chip label="Open to barter" /> : null}
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
