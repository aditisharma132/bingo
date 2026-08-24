import type { MutableRefObject, ReactNode } from "react";
import { DeskScribe, type ScribeControl } from "@/components/desk-scribe";

/**
 * Decorative auth-side panel: ledger kicker, headline and the animated
 * desk scribe pinned to the bottom of the panel.
 */
export function ScribePanel({
  kicker,
  title,
  copy,
  footnote,
  fieldRefs,
  buttonRef,
  control,
}: {
  kicker: string;
  title: ReactNode;
  copy: string;
  footnote?: string;
  fieldRefs: MutableRefObject<(HTMLElement | null)[]>;
  buttonRef: MutableRefObject<HTMLElement | null>;
  control: MutableRefObject<ScribeControl>;
}) {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-muted/30 lg:flex">
      {/* ruled-paper backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 31px, var(--border) 31px 32px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-20 w-px bg-primary/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/3 size-64 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative px-12 pt-16 pl-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted-foreground">{kicker}</p>
        <h2 className="mt-5 max-w-md font-display text-4xl font-bold leading-[1.1] text-foreground">{title}</h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{copy}</p>
        {footnote ? (
          <p className="mt-8 max-w-sm border-l-2 border-primary/50 pl-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {footnote}
          </p>
        ) : null}
      </div>

      <DeskScribe
        fieldRefs={fieldRefs}
        buttonRef={buttonRef}
        control={control}
        className="relative mt-auto max-h-[58vh] w-full"
      />
    </div>
  );
}
