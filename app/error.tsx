"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center">
      <PhoneColumn className="text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-muted">
          {error.message || "An unexpected error interrupted this screen."}
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </PhoneColumn>
    </main>
  );
}
