import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, Loader2, MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, EmptyState, Panel } from "@/components/bingo-ui";
import { MediaImage } from "@/components/media-image";
import { ProfileMediaEditor } from "@/components/profile-media";
import { TagEditor } from "@/components/tag-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { uploadMedia } from "@/lib/media";
import { expressInterest } from "@/lib/campaigns.functions";
import { startConversation } from "@/lib/messaging.functions";

import { createBrandPost, deleteBrandPost, getBrandProfile, toggleSubscription } from "@/lib/social.functions";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/safe-url";

export const Route = createFileRoute("/_authenticated/brands/$brandId")({
  head: () => ({
    meta: [
      { title: "Brand profile | Bingo" },
      { name: "description", content: "Brand story, active campaigns and newsletter posts for creators on Bingo." },
      { property: "og:title", content: "Brand profile | Bingo" },
      { property: "og:description", content: "Brand story, active campaigns and newsletter posts for creators on Bingo." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrandProfilePage,
});

function BrandProfilePage() {
  const { brandId } = Route.useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getBrandProfile);
  const subscribe = useServerFn(toggleSubscription);
  const startChat = useServerFn(startConversation);
  const createPost = useServerFn(createBrandPost);
  const deletePost = useServerFn(deleteBrandPost);
  const showInterest = useServerFn(expressInterest);


  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"campaign" | "newsletter" | "update">("update");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const key = ["brand-profile", brandId];
  const query = useQuery({ queryKey: key, queryFn: () => fetchProfile({ data: { brandId } }) });

  const subMutation = useMutation({
    mutationFn: () => subscribe({ data: { brandId } }),
    onSuccess: (result) => {
      toast.success(result.subscribed ? "Subscribed — you'll get alerts" : "Unsubscribed");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chat = useMutation({
    mutationFn: () => startChat({ data: { brandId } }),
    onSuccess: (result) => navigate({ to: "/messages", search: { c: result.conversationId } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const interestMutation = useMutation({
    mutationFn: (campaignId: string) => showInterest({ data: { campaignId } }),
    onSuccess: (result) => {
      toast.success(result.already ? "You already showed interest" : "Interest sent to the brand");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const postMutation = useMutation({
    mutationFn: () => createPost({ data: { title, body, kind, imageUrl: imagePath, ctaUrl: ctaUrl || null } }),
    onSuccess: () => {
      toast.success("Posted — subscribers have been alerted");
      setTitle("");
      setBody("");
      setCtaUrl("");
      setImagePath(null);
      setShowComposer(false);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost({ data: { postId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
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

  const { brand, posts, subscriberCount, isSubscribed, isSelf, campaigns, activity } = query.data;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <ProfileMediaEditor name={brand.brand_name} avatar={brand.logo_url} cover={brand.cover_url} editable={isSelf} />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{brand.brand_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand.industry ?? "Brand"} · {subscriberCount} subscriber{subscriberCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  activity.level === "high" && "border-primary/40 text-primary",
                  activity.level === "medium" && "border-border text-foreground",
                  (activity.level === "low" || activity.level === "new") && "border-border text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    activity.level === "high" ? "bg-primary" : activity.level === "medium" ? "bg-accent" : "bg-muted-foreground",
                  )}
                />
                {activity.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {activity.liveCampaigns} live campaign{activity.liveCampaigns === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isSelf ? (
              <>
                <Button
                  variant={isSubscribed ? "outline" : "default"}
                  className={cn(!isSubscribed && "bg-gradient-brand text-primary-foreground glow-primary hover:opacity-90")}
                  onClick={() => subMutation.mutate()}
                  disabled={subMutation.isPending}
                >
                  {isSubscribed ? <BellRing className="mr-1 size-4" /> : <Bell className="mr-1 size-4" />}
                  {isSubscribed ? "Subscribed" : "Subscribe"}
                </Button>
                {role === "creator" ? (
                  <Button variant="outline" onClick={() => chat.mutate()} disabled={chat.isPending}>
                    <MessageSquare className="mr-1 size-4" /> Message
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                onClick={() => setShowComposer((v) => !v)}
              >
                {showComposer ? "Close" : "New post"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {isSelf && showComposer ? (
              <Panel className="space-y-4">
                <h2 className="font-display text-lg font-semibold">New post</h2>
                <div className="flex gap-2">
                  {(["update", "campaign", "newsletter"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm capitalize",
                        kind === k
                          ? "border-transparent bg-gradient-brand text-primary-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-body">Content</Label>
                  <Textarea id="post-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="post-cta">Link (optional)</Label>
                    <Input id="post-cta" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-image">Image (optional)</Label>
                    <Input
                      id="post-image"
                      type="file"
                      accept="image/*"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          setImagePath(await uploadMedia(file, "post"));
                          toast.success("Image ready");
                        } catch (error) {
                          toast.error((error as Error).message);
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </div>
                </div>
                <Button
                  className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                  disabled={postMutation.isPending}
                  onClick={() => postMutation.mutate()}
                >
                  {postMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Publish & alert subscribers
                </Button>
              </Panel>
            ) : null}

            <Panel>
              <h2 className="font-display text-lg font-semibold">About us</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {brand.about || "This brand hasn't written an about section yet."}
              </p>
              {brand.website ? (
                <a href={safeHref(brand.website)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                  {brand.website}
                </a>
              ) : null}
            </Panel>

            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold">Posts</h2>
              {posts.length === 0 ? (
                <EmptyState
                  title="No posts yet"
                  description={isSelf ? "Share a campaign or newsletter to reach your subscribers." : "This brand hasn't posted yet."}
                />
              ) : (
                posts.map((post) => (
                  <Panel key={post.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
                          {post.kind}
                        </span>
                        <h3 className="mt-2 font-display text-lg font-semibold">{post.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        {isSelf ? (
                          <button
                            type="button"
                            aria-label="Delete post"
                            onClick={() => deleteMutation.mutate(post.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {post.image_url ? (
                      <MediaImage
                        value={post.image_url}
                        alt={post.title}
                        className="mt-3 h-56 w-full rounded-xl"
                        fallback={post.title}
                      />
                    ) : null}
                    <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{post.body}</p>
                    {post.cta_url ? (
                      <a href={safeHref(post.cta_url)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                        Learn more
                      </a>
                    ) : null}
                  </Panel>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Panel>
              <h2 className="font-display text-lg font-semibold">Campaign categories</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(brand.campaign_categories ?? []).map((c: string) => (
                  <Chip key={c} label={c} />
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-semibold">Custom tags</h2>
              <p className="mt-1 text-xs text-muted-foreground">Matching uses these alongside the standard categories.</p>
              <div className="mt-3">
                <TagEditor entityType="brand" entityId={brandId} editable={isSelf} />
              </div>
            </Panel>

            <Panel>
              <h2 className="font-display text-lg font-semibold">Active campaigns</h2>
              {campaigns.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No published campaigns right now.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {campaigns.map((c: any) => (
                    <li key={c.id} className="rounded-xl border border-border p-3">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground capitalize">
                        {c.compensation_type}
                        {c.budget_min ? ` · ₹${Number(c.budget_min).toLocaleString("en-IN")}+` : ""}
                      </p>
                      {role === "creator" && !isSelf ? (
                        c.interest_status ? (
                          <p className="mt-2 text-xs text-primary capitalize">Interest {c.interest_status}</p>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            disabled={interestMutation.isPending}
                            onClick={() => interestMutation.mutate(c.id)}
                          >
                            {interestMutation.isPending && interestMutation.variables === c.id ? (
                              <Loader2 className="mr-1 size-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-1 size-3.5" />
                            )}
                            I'm interested
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

          </div>
        </div>
      </main>
    </div>
  );
}
