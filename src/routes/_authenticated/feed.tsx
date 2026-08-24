import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import { listSubscribedFeed } from "@/lib/social.functions";
import { safeHref } from "@/lib/safe-url";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Your feed | Bingo" },
      { name: "description", content: "Campaign drops and newsletters from the brands you subscribe to." },
      { property: "og:title", content: "Your feed | Bingo" },
      { property: "og:description", content: "Campaign drops and newsletters from the brands you subscribe to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const fetchFeed = useServerFn(listSubscribedFeed);
  const query = useQuery({ queryKey: ["subscribed-feed"], queryFn: () => fetchFeed({ data: undefined }) });
  const posts = query.data ?? [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Subscriptions"
          title="Your feed"
          subtitle="Campaign drops and newsletters from every brand you follow."
        />

        <div className="mt-8 space-y-5">
          {query.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              title="Nothing in your feed yet"
              description="Subscribe to brands from their profile and their posts will land here."
              action={
                <Button asChild variant="outline">
                  <Link to="/discover">Browse the marketplace</Link>
                </Button>
              }
            />
          ) : (
            posts.map((post) => (
              <Panel key={post.id}>
                <div className="flex items-center gap-3">
                  <div className="size-10 overflow-hidden rounded-full">
                    <MediaImage value={post.brand_logo ?? null} alt={post.brand_name ?? "Brand"} className="h-full w-full" />
                  </div>
                  <div>
                    <Link
                      to="/brands/$brandId"
                      params={{ brandId: post.brand_id }}
                      className="text-sm font-semibold hover:underline"
                    >
                      {post.brand_name}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">
                      {post.kind} · {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <h2 className="mt-3 font-display text-lg font-semibold">{post.title}</h2>
                {post.image_url ? (
                  <MediaImage value={post.image_url} alt={post.title} className="mt-3 h-56 w-full rounded-xl" fallback={post.title} />
                ) : null}
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{post.body}</p>
                {post.cta_url ? (
                  <a href={safeHref(post.cta_url)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                    Learn more
                  </a>
                ) : null}
              </Panel>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
