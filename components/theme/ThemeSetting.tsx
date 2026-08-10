"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils/cn";

/** False on the server and in the hydration render, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export function ThemeSetting() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // The server cannot know the stored preference, so nothing theme-dependent
  // renders until hydration — otherwise the two markups disagree.
  const mounted = useHydrated();
  const active = mounted ? (theme ?? "dark") : null;

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-text-muted">
        Dark is built for the auction floor at night. Light is easier in daylight.
      </p>

      <div
        role="radiogroup"
        aria-label="Colour theme"
        className="mt-3 flex gap-2"
      >
        {OPTIONS.map((option) => {
          const selected = active === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                "min-h-11 flex-1 rounded-full border px-3 text-sm font-medium transition-colors",
                selected
                  ? "border-accent-edge bg-accent text-accent-ink"
                  : "border-border bg-surface-raised text-text-muted hover:text-text",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 min-h-5 text-xs text-text-muted">
        {mounted && active === "system"
          ? `Following your browser — currently ${resolvedTheme === "light" ? "light" : "dark"}.`
          : "This device only. Your other devices keep their own setting."}
      </p>
    </section>
  );
}
