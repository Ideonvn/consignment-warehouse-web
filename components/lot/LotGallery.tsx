"use client";

import { useRef, useState } from "react";
import { LotImage } from "@/components/ui/LotImage";
import type { LotImage as LotImageType } from "@/types/api";
import { cn } from "@/lib/utils/cn";

/**
 * Full-bleed gallery. Native scroll-snap does the swiping — it beats a JS
 * carousel on momentum, accessibility and battery.
 */
export function LotGallery({
  images,
  fallbackSrc,
  title,
}: {
  images: LotImageType[];
  fallbackSrc: string | null;
  title: string;
}) {
  const ordered = [...images].sort((a, b) => a.position - b.position);
  const slides =
    ordered.length > 0
      ? ordered
      : [{ id: "primary", url: fallbackSrc ?? "", position: 0, is_primary: true, width: null, height: null }];

  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          setActive(Math.round(scrollLeft / Math.max(clientWidth, 1)));
        }}
        className="no-scrollbar flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {slides.map((image, index) => (
          <div key={image.id} className="relative h-full w-full shrink-0 snap-center">
            <LotImage
              src={image.url || null}
              alt={`${title} — photo ${index + 1} of ${slides.length}`}
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {slides.length > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {slides.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => {
                const track = trackRef.current;
                track?.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
              }}
              className="grid h-11 w-6 place-items-center"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  index === active ? "w-5 bg-accent-text" : "w-1.5 bg-text-muted/60",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
