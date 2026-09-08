"use client";

import { useEffect, useRef, useState } from "react";
import { LotImage } from "@/components/ui/LotImage";
import type { LotImage as LotImageType } from "@/types/api";

/** What a lot may carry. The viewer pages rather than assuming a handful. */
type Slide = Pick<LotImageType, "id" | "url" | "position">;

/**
 * The lot's photographs, and the full-screen viewer behind them.
 *
 * **Nothing is cropped here.** These used to be `object-cover` in a 4:3 box, so
 * a landscape photo from a phone lost its ends and a tall portrait lost its top
 * and bottom — on the one screen where somebody is examining the item. They are
 * letterboxed against black instead: the whole frame, every time, with the bands
 * falling wherever the aspect ratio puts them. The *list* keeps its crop, because
 * a ragged list is worse than a cropped thumbnail.
 *
 * Native scroll-snap does the paging — it beats a JS carousel on momentum,
 * accessibility and battery — and a lot may now carry up to 20 photos, so the
 * position is stated as "3 / 20" rather than as a row of dots nobody can count.
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
  const slides: Slide[] =
    ordered.length > 0 ? ordered : [{ id: "primary", url: fallbackSrc ?? "", position: 0 }];

  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="relative bg-black">
        <div
          ref={trackRef}
          onScroll={(event) => {
            const { scrollLeft, clientWidth } = event.currentTarget;
            setActive(Math.round(scrollLeft / Math.max(clientWidth, 1)));
          }}
          className="no-scrollbar flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        >
          {slides.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setZoomed(index)}
              aria-label={`Open photo ${index + 1} of ${slides.length} full screen`}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <LotImage
                src={image.url || null}
                alt={`${title} — photo ${index + 1} of ${slides.length}`}
                priority={index === 0}
                // Letterbox: the whole photo, black either side of it.
                className="object-contain"
              />
            </button>
          ))}
        </div>

        {slides.length > 1 ? (
          <>
            <p
              aria-hidden
              className="tabular absolute right-3 bottom-3 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white"
            >
              {active + 1} / {slides.length}
            </p>
            {/* The count is decoration for a sighted user; this is the same fact
                for a screen reader, and the only one that has to be announced. */}
            <p role="status" aria-live="polite" className="sr-only">
              Photo {active + 1} of {slides.length}
            </p>
          </>
        ) : null}
      </div>

      {zoomed !== null ? (
        <FullScreenViewer
          slides={slides}
          title={title}
          startAt={zoomed}
          onClose={() => setZoomed(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Full screen, and pinch-zoomable by the browser rather than by us.
 *
 * **No gesture code and no dependency.** The overlay is a plain scroll-snap
 * track with `touch-action: pinch-zoom`, which tells the browser it may claim a
 * two-finger gesture on this element — so iOS Safari and Android Chrome do the
 * zooming themselves, with their own momentum, bounds and double-tap. The one
 * requirement is that the document permits user scaling, which it does:
 * `maximumScale: 5` in `app/layout.tsx`, no `userScalable: false`.
 *
 * Horizontal panning stays available so paging still works at 1×.
 */
function FullScreenViewer({
  slides,
  title,
  startAt,
  onClose,
}: {
  slides: Slide[];
  title: string;
  startAt: number;
  onClose: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startAt);

  // Open on the photo that was tapped. Not `scrollIntoView`: this track is the
  // scroll container itself, and a smooth scroll here would animate from 0.
  useEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = startAt * track.clientWidth;
  }, [startAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — photos`}
      className="fixed inset-0 z-50 bg-black"
    >
      <div
        ref={trackRef}
        onScroll={(event) => {
          const { scrollLeft, clientWidth } = event.currentTarget;
          setActive(Math.round(scrollLeft / Math.max(clientWidth, 1)));
        }}
        // `pinch-zoom` is the whole feature: it hands the two-finger gesture to
        // the browser. `pan-x` keeps paging; `pan-y` is deliberately absent so a
        // vertical drag cannot scroll the page underneath.
        style={{ touchAction: "pan-x pinch-zoom" }}
        className="no-scrollbar flex h-dvh w-full snap-x snap-mandatory overflow-x-auto overscroll-contain"
      >
        {slides.map((image, index) => (
          <div key={image.id} className="relative h-full w-full shrink-0 snap-center">
            <LotImage
              src={image.url || null}
              alt={`${title} — photo ${index + 1} of ${slides.length}`}
              sizes="100vw"
              priority={index === startAt}
              className="object-contain"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </button>

      {slides.length > 1 ? (
        <p
          aria-hidden
          className="tabular absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur"
        >
          {active + 1} / {slides.length}
        </p>
      ) : null}
    </div>
  );
}
