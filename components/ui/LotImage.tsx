"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Photo-first, with a graceful placeholder — plenty of seeded lots have no
 * image and a broken icon on a hero surface looks like a broken app.
 */
export function LotImage({
  src,
  alt,
  className,
  sizes = "(max-width: 448px) 100vw, 448px",
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          // Mirrors next/image `fill` so callers can use one positioned wrapper.
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-raised to-surface",
          className,
        )}
        aria-label={`${alt} — no photo`}
        role="img"
      >
        <svg viewBox="0 0 24 24" className="h-10 w-10 text-border" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="M4 17l5-4.5 3.5 3L16 12l4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      // Without this the browser's native image drag starts instead, and it
      // swallows the pointer stream any swipe gesture depends on.
      draggable={false}
      className={cn("object-cover select-none", className)}
    />
  );
}
