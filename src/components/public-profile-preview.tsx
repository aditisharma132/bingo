import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { Chip, Panel } from "@/components/bingo-ui";
import { MediaImage } from "@/components/media-image";
import { Button } from "@/components/ui/button";
import { getBrandProfile, getCreatorProfile } from "@/lib/social.functions";

function Shell({
  name,
  cover,
  avatar,
  headline,
  location,
  about,
  chips,
  footer,
  link,
}: {
  name: string;
  cover: string | null;
  avatar: string | null;
  headline: string | null;
  location?: string | null;
  about: string | null;
  chips: string[];
  footer?: React.ReactNode;
  link: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        This is how your profile appears to everyone else on Bingo.
      </p>
      <Panel className="overflow-hidden p-0">
        <div className="h-40 w-full overflow-hidden border-b border-border">
          <MediaImage value={cover} alt={`${name} cover`} className="h-full w-full" fallback={name} />
        </div>
        <div className="p-6">
          <div className="-mt-16 mb-4 size-20 overflow-hidden rounded-2xl border-4 border-background">
            <MediaImage value={avatar} alt={name} className="h-full w-full" fallback={name} />
          </div>
          <h3 className="font-display text-2xl font-bold">{name}</h3>
          {headline ? <p className="mt-1 text-muted-foreground">{headline}</p> : null}
          {location ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" /> {location}
            </p>
          ) : null}
          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
            {about || "No about section yet — add one so brands know what you're about."}
          </p>
          {chips.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <Chip key={c} label={c} />
              ))}
            </div>
          ) : null}
          {footer}
          <div className="mt-6">{link}</div>
        </div>
      </Panel>
    </div>
  );
}

/** Read-only "how others see me" preview for the signed-in creator or brand. */
export function PublicProfilePreview({ role, id }: { role: "creator" | "brand"; id: string }) {
  const fetchCreator = useServerFn(getCreatorProfile);
  const fetchBrand = useServerFn(getBrandProfile);

  const query = useQuery({
    queryKey: ["public-preview", role, id],
    queryFn: async (): Promise<unknown> =>
      role === "creator"
        ? await fetchCreator({ data: { creatorId: id } })
        : await fetchBrand({ data: { brandId: id } }),
  });

  if (query.isLoading || !query.data) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading preview…
      </div>
    );
  }

  if (role === "creator") {
    const c = (query.data as { creator: any }).creator;
    return (
      <Shell
        name={c.display_name}
        cover={c.cover_url}
        avatar={c.avatar_url}
        headline={c.headline}
        location={c.location}
        about={c.bio}
        chips={[...(c.creator_types ?? []), ...(c.categories ?? [])]}
        footer={
          <p className="mt-4 text-sm text-muted-foreground">
            Starting price:{" "}
            <span className="font-semibold text-foreground">
              {c.starting_price_inr ? `₹${c.starting_price_inr.toLocaleString("en-IN")}` : "On request"}
            </span>
          </p>
        }
        link={
          <Button asChild variant="outline" size="sm">
            <Link to="/creators/$creatorId" params={{ creatorId: id }}>
              Open full public page <ExternalLink className="ml-1 size-4" />
            </Link>
          </Button>
        }
      />
    );
  }

  const b = (query.data as { brand: any }).brand;
  return (
    <Shell
      name={b.brand_name}
      cover={b.cover_url}
      avatar={b.logo_url}
      headline={b.industry}
      about={b.about}
      chips={b.campaign_categories ?? []}
      link={
        <Button asChild variant="outline" size="sm">
          <Link to="/brands/$brandId" params={{ brandId: id }}>
            Open full public page <ExternalLink className="ml-1 size-4" />
          </Link>
        </Button>
      }
    />
  );
}
