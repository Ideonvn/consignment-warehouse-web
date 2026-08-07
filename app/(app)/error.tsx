"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

export default function AppError({
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
    <main className="flex flex-1 items-center">
      <PhoneColumn className="text-center">
        <h1 className="text-xl font-semibold">This screen didn&apos;t load</h1>
        <p className="mt-2 text-sm text-text-muted">
          {error.message || "Something went wrong on the way here."}
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </PhoneColumn>
    </main>
  );
}
