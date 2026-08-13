"use client";

import { useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { LotCardFace } from "@/components/lot/LotCardFace";
import type { LotCard, SwipeDirection } from "@/types/api";

/** Past this much horizontal travel, releasing commits the swipe. */
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 550;
/**
 * The vertical gestures need a longer, faster pull than left or right. They
 * share an axis with the page's own scrolling, so each has to be unmistakably
 * deliberate — up sets a lot aside, down brings the last one back.
 */
const SKIP_DISTANCE = 150;
const SKIP_VELOCITY = 700;

/** What sent the card away — drives the exit animation via AnimatePresence. */
export type CardExit = SwipeDirection | "skip";

export function SwipeCard({
  lot,
  currency,
  onDecide,
  onSkip,
  onUndo,
  canUndo,
  onOpen,
  bidLabel,
}: {
  lot: LotCard;
  currency: string;
  onDecide: (direction: SwipeDirection) => void;
  onSkip: () => void;
  /** Pulling down reverses the last gesture — the natural inverse of skipping. */
  onUndo: () => void;
  canUndo: boolean;
  onOpen: () => void;
  /** "Bid" once bidding is open, "Save" before it opens. */
  bidLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragged = useRef(false);

  // Rotation is proportional to offset so the card feels hinged to the thumb.
  const rotate = useTransform(x, [-240, 240], [-13, 13]);
  const passOpacity = useTransform(x, [-COMMIT_DISTANCE, -24], [1, 0]);
  const bidOpacity = useTransform(x, [24, COMMIT_DISTANCE], [0, 1]);
  const skipOpacity = useTransform(y, [-SKIP_DISTANCE, -32], [1, 0]);
  const undoOpacity = useTransform(y, [32, SKIP_DISTANCE], [0, 1]);

  return (
    <motion.div
      // `touch-none` on the card only: the browser must not scroll the page
      // while a finger is on a card, or an upward swipe becomes a scroll. The
      // rest of the screen still scrolls normally.
      className="absolute inset-0 touch-none select-none"
      style={{ x, y, rotate }}
      drag
      dragDirectionLock
      // No constraints: the card tracks the finger 1:1. Released below the
      // threshold it springs back to origin; past it, the exit animation takes
      // over. (A zero-width `dragConstraints` box pins the card in place.)
      dragSnapToOrigin
      dragMomentum={false}
      onPointerDown={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={(_, info) => {
        // `dragDirectionLock` already committed to one axis; follow it rather
        // than letting a mostly-sideways drag also count as a skip.
        if (Math.abs(info.offset.x) >= Math.abs(info.offset.y)) {
          const committed =
            Math.abs(info.offset.x) > COMMIT_DISTANCE ||
            Math.abs(info.velocity.x) > COMMIT_VELOCITY;
          if (committed) onDecide(info.offset.x > 0 ? "interested" : "pass");
          return;
        }

        const skipped =
          info.offset.y < -SKIP_DISTANCE ||
          (info.offset.y < -40 && info.velocity.y < -SKIP_VELOCITY);
        if (skipped) {
          onSkip();
          return;
        }

        const pulledBack =
          info.offset.y > SKIP_DISTANCE ||
          (info.offset.y > 40 && info.velocity.y > SKIP_VELOCITY);
        if (!pulledBack) return;

        if (canUndo) {
          onUndo();
          return;
        }
        // Nothing to bring back: resist rather than swallow the gesture, so it
        // stays discoverable without implying something happened.
        if (!reduceMotion) {
          animate(y, [0, 26, 0], { duration: 0.34, ease: "easeOut", times: [0, 0.4, 1] });
        }
      }}
      initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      variants={{
        // `custom` comes from AnimatePresence, so the card leaves the way it was
        // actually sent — including by button or keyboard.
        exit: (exit: CardExit) =>
          reduceMotion
            ? { opacity: 0, transition: { duration: 0.1 } }
            : exit === "skip"
              ? { y: -700, opacity: 0, transition: { duration: 0.26, ease: "easeOut" } }
              : {
                  x: exit === "interested" ? 700 : -700,
                  rotate: exit === "interested" ? 20 : -20,
                  opacity: 0,
                  transition: { duration: 0.28, ease: "easeOut" },
                },
      }}
      exit="exit"
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <button
        type="button"
        onClick={() => {
          // A drag that ends over the card must never read as a tap.
          if (dragged.current) return;
          onOpen();
        }}
        aria-label={`Open details for lot ${lot.lot_number}, ${lot.title}`}
        className="block h-full w-full cursor-grab text-left active:cursor-grabbing"
      >
        <LotCardFace lot={lot} currency={currency} priority />
      </button>

      <motion.div
        aria-hidden
        style={{ opacity: reduceMotion ? 0 : passOpacity }}
        className="pointer-events-none absolute top-8 left-6 -rotate-12 rounded-xl border-2 border-danger px-4 py-2 text-lg font-bold tracking-widest text-danger uppercase"
      >
        Pass
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: reduceMotion ? 0 : bidOpacity }}
        className="pointer-events-none absolute top-8 right-6 rotate-12 rounded-xl border-2 border-accent-text bg-accent/10 px-4 py-2 text-lg font-bold tracking-widest text-accent-text uppercase"
      >
        {bidLabel}
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: reduceMotion ? 0 : skipOpacity }}
        className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-xl border-2 border-text-muted px-4 py-2 text-lg font-bold tracking-widest text-text-muted uppercase"
      >
        Skip
      </motion.div>
      {/* Only promised when there is something to bring back. */}
      {canUndo ? (
        <motion.div
          aria-hidden
          style={{ opacity: reduceMotion ? 0 : undoOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-xl border-2 border-text-muted px-4 py-2 text-lg font-bold tracking-widest text-text-muted uppercase"
        >
          Undo
        </motion.div>
      ) : null}
    </motion.div>
  );
}
