"use client";

import {
  BROWSE_LAYOUTS,
  setBrowseLayout,
  useBrowseLayoutPreference,
  DEFAULT_LAYOUT,
  type BrowseLayout,
} from "@/lib/browse/layoutPreference";
import { LayoutPreview } from "@/components/browse/LayoutPreview";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<BrowseLayout, string> = {
  stack: "Cards",
  list: "List",
  gallery: "Gallery",
};

/**
 * Same shape as the theme control, deliberately: both are per-device preferences
 * with three options, and a second pattern for the same kind of choice would
 * just be a second thing to learn.
 */
export function LayoutSetting() {
  const preference = useBrowseLayoutPreference();
  // Null until the client has read storage, which is also the "never asked" case
  // — either way the app is browsing with the default, so that is what shows.
  const active = preference ?? DEFAULT_LAYOUT;

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Browsing</h2>
      <p className="mt-1 text-sm text-text-muted">
        How an auction’s lots are shown. Cards are the default.
      </p>

      <div role="radiogroup" aria-label="Browsing layout" className="mt-3 flex gap-2">
        {BROWSE_LAYOUTS.map((layout) => {
          const selected = active === layout;
          return (
            <button
              key={layout}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setBrowseLayout(layout)}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center gap-2 rounded-2xl border p-2 text-sm font-medium transition-colors",
                selected
                  ? "border-accent-edge bg-accent text-accent-ink"
                  : "border-border bg-surface-raised text-text-muted hover:text-text",
              )}
            >
              <LayoutPreview layout={layout} className={selected ? "border-accent-ink/20" : undefined} />
              {LABELS[layout]}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-text-muted">
        This device only. Your other devices keep their own setting.
      </p>
    </section>
  );
}
