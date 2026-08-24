import { useMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function MediaImage({
  value,
  alt,
  className,
  fallback,
}: {
  value: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const url = useMediaUrl(value);
  if (!url) {
    return (
      <div className={cn("grid place-items-center bg-gradient-brand text-primary-foreground", className)}>
        <span className="font-display text-xl font-bold">{(fallback ?? alt).charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
