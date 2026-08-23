import type { BrowseLayout } from "@/lib/browse/layoutPreference";
import { cn } from "@/lib/utils/cn";

/**
 * A shape, not a screenshot. Someone choosing a layout needs to recognise the
 * arrangement at a glance; a miniature of the real thing would be unreadable at
 * this size and would go stale the first time either layout changed.
 */
export function LayoutPreview({ layout, className }: { layout: BrowseLayout; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-bg p-2",
        className,
      )}
    >
      {layout === "stack" ? (
        <span className="relative block h-full w-8">
          <span className="absolute inset-x-0 top-1 h-full rounded-md border border-border bg-surface-raised" />
          <span className="absolute inset-x-0 top-0 h-full rounded-md border border-accent-text/70 bg-surface" />
        </span>
      ) : layout === "list" ? (
        <span className="flex h-full w-full flex-col justify-center gap-1">
          {[0, 1, 2].map((row) => (
            <span key={row} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-accent-text/70" />
              <span className="h-1 flex-1 rounded-full bg-border" />
            </span>
          ))}
        </span>
      ) : (
        <span className="grid h-full w-full grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((tile) => (
            <span key={tile} className="rounded-[3px] bg-accent-text/70" />
          ))}
        </span>
      )}
    </span>
  );
}
