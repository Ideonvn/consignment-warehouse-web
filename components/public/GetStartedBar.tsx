"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The whole of the anonymous chrome: one call to action, bottom of the screen.
 *
 * Exactly `--nav-h` tall, in the bottom nav's place, so every page's padding and
 * the `dvh` maths hold without a second set of numbers.
 *
 * One CTA and no more. `CLAUDE.md` records that browsing is ungated for signed-in
 * users — no deposit, no blur, no nag — and the same restraint applies here: a
 * stranger should be able to walk a whole auction and *then* decide. Nothing on
 * these pages is hidden behind signing up.
 */
export function GetStartedBar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur">
      <div
        className="mx-auto flex w-full max-w-(--app-width) items-center justify-between gap-3 px-4"
        style={{ height: "var(--nav-h)" }}
      >
        <p className="min-w-0 truncate text-xs text-text-muted">Bidding needs an account.</p>
        <Link
          // Back to where they were reading, not to a generic home.
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-accent-edge bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          Get started
        </Link>
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
