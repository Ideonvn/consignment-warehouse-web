"use client";

import { NetworkError } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";

/** Inline failure for a query, with the one action that ever helps: retry. */
export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message =
    error instanceof NetworkError ? error.message
    : error instanceof Error ? error.message
    : "Something went wrong.";

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-8 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-text-muted">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
