import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-6", className)}>{children}</section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-gradient-brand">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  const base =
    "rounded-full border px-3 py-1.5 text-sm transition-colors";
  if (!onClick) {
    return <span className={cn(base, "border-border bg-muted/50 text-muted-foreground")}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        base,
        selected
          ? "border-transparent bg-gradient-brand text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StepHeader({
  step,
  total,
  title,
  description,
}: {
  step: number;
  total: number;
  title: string;
  description?: string | undefined;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < step ? "bg-gradient-brand" : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Step {step} of {total}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

const fitStyles: Record<string, string> = {
  strong: "bg-gradient-brand text-primary-foreground",
  good: "bg-primary/15 text-primary",
  potential: "bg-muted text-muted-foreground",
  weak: "bg-muted/60 text-muted-foreground",
};

export function FitBadge({ fit }: { fit: "strong" | "good" | "potential" | "weak" }) {
  const label = `${fit.charAt(0).toUpperCase()}${fit.slice(1)} Fit`;
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", fitStyles[fit])}>{label}</span>
  );
}
