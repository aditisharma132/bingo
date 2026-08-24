import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip, EmptyState, PageHeader, Panel } from "@/components/bingo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPublicCreators } from "@/lib/campaigns.functions";
import { useAuth } from "@/hooks/use-auth";
import { startConversation } from "@/lib/messaging.functions";
import { CATEGORIES } from "@/lib/taxonomy";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: "Discover creators | Bingo" },
      {
        name: "description",
        content: "Browse creators by craft, category and content — not by follower count.",
      },
      { property: "og:title", content: "Discover creators | Bingo" },
      {
        property: "og:description",
        content: "Browse creators by craft, category and content — not by follower count.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { role } = useAuth();
  const canMessage = role === "brand";
  const fetchCreators = useServerFn(listPublicCreators);
  const startChat = useServerFn(startConversation);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [messaging, setMessaging] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["public-creators", categories],
    queryFn: () => fetchCreators({ data: { categories } }),
  });

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : prev.length < 3 ? [...prev, cat] : prev,
    );
  }

  const creators = useMemo(() => {
    const rows = query.data ?? [];
    if (!term.trim()) return rows;
    const t = term.toLowerCase();
    return rows.filter((c: any) =>
      [c.display_name, c.headline, c.location, ...(c.creator_types ?? []), ...(c.categories ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [query.data, term]);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Brand"
          title="Discover creators"
          subtitle="Search by craft, category or city. Follower count is context, never the ranking."
        />

        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="UGC skincare Bengaluru…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Category (up to 3):</span>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={categories.includes(cat)}
              onClick={() => toggleCategory(cat)}
            />
          ))}
        </div>

        {query.isLoading ? (
          <div className="grid py-20 place-items-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : creators.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {creators.map((c: any) => (
              <Panel key={c.id}>
                <p className="font-display text-lg font-bold">{c.display_name}</p>
                <p className="text-sm text-muted-foreground">{c.headline ?? "No headline yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.location ?? "Location not shared"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(c.creator_types ?? []).map((t: string) => (
                    <Chip key={t} label={t} />
                  ))}
                  {(c.categories ?? []).slice(0, 3).map((cat: string) => (
                    <Chip key={cat} label={cat} />
                  ))}
                </div>
                {c.dna?.summary ? (
                  <p className="mt-3 text-sm text-muted-foreground">{c.dna.summary}</p>
                ) : null}
                <p className="mt-3 text-sm">
                  {c.starting_price_inr
                    ? `From ₹${c.starting_price_inr.toLocaleString("en-IN")}`
                    : "Price on request"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/creators/$creatorId" params={{ creatorId: c.id }}>
                      View profile
                    </Link>
                  </Button>
                  {canMessage ? (
                    <Button
                      size="sm"
                      className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                      disabled={messaging === c.id}
                      onClick={() => {
                        setMessaging(c.id);
                        startChat({ data: { creatorId: c.id } })
                          .then((r) =>
                            navigate({ to: "/messages", search: { c: r.conversationId } }),
                          )
                          .catch((e: Error) => toast.error(e.message))
                          .finally(() => setMessaging(null));
                      }}
                    >
                      {messaging === c.id ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-1 size-4" />
                      )}
                      Message
                    </Button>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              title="No creators found"
              description="Try a different craft, category or city — or invite creators you already work with."
            />
          </div>
        )}
      </main>
    </div>
  );
}
