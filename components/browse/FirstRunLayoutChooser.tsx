"use client";

import { BROWSE_LAYOUTS, DEFAULT_LAYOUT, setBrowseLayout, type BrowseLayout } from "@/lib/browse/layoutPreference";
import { LayoutPreview } from "@/components/browse/LayoutPreview";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

const COPY: Record<BrowseLayout, { label: string; blurb: string }> = {
  stack: { label: "Cards", blurb: "One lot at a time. Swipe to pass or bid." },
  list: { label: "List", blurb: "Every lot in a row, with buttons." },
  gallery: { label: "Gallery", blurb: "All the photos. Tap one to open the cards there." },
};

/**
 * Asked once, on the first auction someone opens.
 *
 * Deliberately not on the auction list or straight after sign-in: choosing
 * between "cards", "list" and "gallery" with nothing to apply them to is
 * choosing blind, and the answer sticks. Here the words have a referent — the
 * auction is loading behind this sheet.
 *
 * Dismissing is a valid answer and stores the default, so the question is asked
 * exactly once either way and the app is never left with no layout.
 */
export function FirstRunLayoutChooser() {
  return (
    <Sheet open onClose={() => setBrowseLayout(DEFAULT_LAYOUT)} title="How do you want to browse?">
      <div className="px-5 pt-1 pb-6">
        <p className="text-sm text-text-muted">
          Three ways through an auction. Change it any time on your profile — it applies to this
          device only.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {BROWSE_LAYOUTS.map((layout) => (
            <li key={layout}>
              <button
                type="button"
                onClick={() => setBrowseLayout(layout)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-raised p-3 text-left hover:border-accent-text/60"
              >
                <LayoutPreview layout={layout} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{COPY[layout].label}</span>
                  <span className="block text-xs text-text-muted">{COPY[layout].blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <Button
          variant="ghost"
          fullWidth
          className="mt-3"
          onClick={() => setBrowseLayout(DEFAULT_LAYOUT)}
        >
          Skip — use cards
        </Button>
      </div>
    </Sheet>
  );
}
