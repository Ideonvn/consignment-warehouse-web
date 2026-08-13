"use client";

import { cn } from "@/lib/utils/cn";

/**
 * A labelled on/off control. The whole row is the target — a 44px minimum on the
 * track alone leaves most of a settings row dead to the thumb.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 py-2 text-left disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="block text-xs text-text-muted">{description}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-accent-edge bg-accent" : "border-border-strong bg-surface-raised",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full transition-all",
            checked ? "left-6 bg-accent-ink" : "left-0.5 bg-text-muted",
          )}
        />
      </span>
    </button>
  );
}
