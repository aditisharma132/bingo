import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/bingo-ui";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPeople, startConversation } from "@/lib/messaging.functions";
import { CATEGORIES, CREATOR_TYPES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Find a creator or brand by name, tag, location, craft or category and open a chat. */
export function PeopleSearch() {
  const navigate = useNavigate();
  const run = useServerFn(searchPeople);
  const startChat = useServerFn(startConversation);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "creator" | "brand">("all");
  const [location, setLocation] = useState("");
  const [creatorTypes, setCreatorTypes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const active = q.trim() || location.trim() || creatorTypes.length || categories.length;

  const query = useQuery({
    queryKey: ["people-search", q, kind, location, creatorTypes, categories],
    queryFn: () => run({ data: { q, kind, location, creatorTypes, categories } }),
    enabled: Boolean(active),
  });

  const chat = useMutation({
    mutationFn: (row: { id: string; kind: "creator" | "brand" }) =>
      startChat({ data: row.kind === "creator" ? { creatorId: row.id } : { brandId: row.id } }),
    onSuccess: (result) => {
      if (result.status === "pending") toast.success("Request sent — you can chat once it's accepted.");
      navigate({ to: "/messages", search: { c: result.conversationId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 border-b border-border p-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search creators, brands or tags"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Filters"
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </div>

      {showFilters ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex gap-1 text-xs">
            {(["all", "creator", "brand"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full px-3 py-1 capitalize",
                  kind === k ? "bg-gradient-brand text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {k === "all" ? "Everyone" : `${k}s`}
              </button>
            ))}
          </div>
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Creator type</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CREATOR_TYPES.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={creatorTypes.includes(t)}
                  onClick={() => setCreatorTypes(toggle(creatorTypes, t))}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={categories.includes(c)}
                  onClick={() => setCategories(toggle(categories, c))}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {active ? (
        query.isLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </div>
        ) : (query.data ?? []).length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No people match those filters.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {(query.data ?? []).map((row) => (
              <li key={`${row.kind}-${row.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60">
                <div className="size-9 shrink-0 overflow-hidden rounded-full border border-border">
                  <MediaImage value={row.avatar} alt={row.name} className="h-full w-full" fallback={row.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {row.kind} · {[row.headline, row.location].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`Message ${row.name}`}
                  disabled={chat.isPending}
                  onClick={() => chat.mutate({ id: row.id, kind: row.kind })}
                >
                  <MessageSquare className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
