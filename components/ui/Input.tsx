"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  prefix?: ReactNode;
  /** Hide the label visually but keep it for screen readers. */
  hideLabel?: boolean;
};

export function Input({
  label,
  hint,
  error,
  prefix,
  hideLabel = false,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full">
      <label
        htmlFor={inputId}
        className={cn(
          "mb-2 block text-sm font-medium text-text-muted",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>

      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-surface-raised px-4",
          "focus-within:border-accent/60",
          error ? "border-danger/60" : "border-border",
        )}
      >
        {prefix ? <span className="shrink-0 text-text-muted tabular">{prefix}</span> : null}
        <input
          {...props}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          className={cn(
            "min-h-14 w-full bg-transparent text-base text-text outline-none placeholder:text-text-muted/60",
            className,
          )}
        />
      </div>

      {hint && !error ? (
        <p id={`${inputId}-hint`} className="mt-2 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
