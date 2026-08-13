"use client";

import { useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { LotCardFace } from "@/components/lot/LotCardFace";
import { cn } from "@/lib/utils/cn";
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

/** How far a drag must travel before the hint says anything at all. */
const HINT_DISTANCE = 24;

/** What sent the card away — drives the exit animation via AnimatePresence. */
export type CardExit = SwipeDirection | "skip";

type HintKind = "pass" | "bid" | "skip" | "undo" | "nothing-to-undo";
type Hint = { kind: HintKind; armed: boolean };

/**
 * One visual language for all four gestures: an outline while the pull is
 * *pending*, the same colour filled once it is *armed* and would commit on
 * release. Both states sit on an opaque background, because these are read over
 * user photography of unknown brightness.
 */
const TONES: Record<HintKind, { pending: string; armed: string }> = {
  pass: {
    pending: "border-danger text-danger",
    armed: "border-danger bg-danger text-on-fill",
  },
  bid: {
    pending: "border-accent-text text-accent-text",
    armed: "border-accent-edge bg-accent text-accent-ink",
  },
  skip: {
    pending: "border-text-muted text-text-muted",
    armed: "border-text-muted bg-text-muted text-on-fill",
  },
  undo: {
    pending: "border-undo text-undo",
    armed: "border-undo bg-undo text-on-fill",
  },
  // Never arms: there is nothing behind this pull, and the card bounces instead.
  "nothing-to-undo": {
    pending: "border-border text-text-muted",
    armed: "border-border text-text-muted",
  },
};

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
  const dragging = useRef(false);

  // Rotation is proportional to offset so the card feels hinged to the thumb.
  const rotate = useTransform(x, [-240, 240], [-13, 13]);

  /*
   * The hint lives inside the card so it can sit at the card's centre, and then
   * undoes the card's own transform: the counter-translate keeps it where the
   * eye already is instead of riding off-screen with the card, and the
   * counter-rotate keeps the words level while the card tilts. A point at the
   * centre of a rotating box doesn't move, so cancelling x and y is enough to
   * pin it. What remains is a small lean in the direction of travel, which is
   * what makes the *direction* readable without chasing the card.
   */
  const lean = (value: number) => Math.max(-44, Math.min(44, value * 0.2));
  const hintX = useTransform(x, (value) => -value + lean(value));
  const hintY = useTransform(y, (value) => -value + lean(value));
  const hintRotate = useTransform(rotate, (value) => -value);

  const [hint, setHint] = useState<Hint | null>(null);

  const readHint = () => {
    const dx = x.get();
    const dy = y.get();

    // `dragDirectionLock` picks one axis; the hint follows the same choice so it
    // can never contradict what the release will actually do.
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (Math.abs(dx) < HINT_DISTANCE) return null;
      return {
        kind: dx > 0 ? ("bid" as const) : ("pass" as const),
        armed: Math.abs(dx) > COMMIT_DISTANCE,
      };
    }
    if (Math.abs(dy) < HINT_DISTANCE) return null;
    if (dy < 0) return { kind: "skip" as const, armed: -dy > SKIP_DISTANCE };
    if (!canUndo) return { kind: "nothing-to-undo" as const, armed: false };
    return { kind: "undo" as const, armed: dy > SKIP_DISTANCE };
  };

  const syncHint = () => {
    // Only while a finger is actually on the card. Without this the exit
    // animation — which drives x out to ±700 — re-armed the hint and left it
    // hanging in the middle of the screen after the card had gone.
    if (!dragging.current) return;
    const next = readHint();
    setHint((current) => {
      if (current === null && next === null) return current;
      if (current && next && current.kind === next.kind && current.armed === next.armed) {
        return current;
      }
      return next;
    });
  };

  useMotionValueEvent(x, "change", syncHint);
  useMotionValueEvent(y, "change", syncHint);

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
        dragging.current = true;
      }}
      onDragEnd={(_, info) => {
        dragging.current = false;
        setHint(null);
        // `dragDirectionLock` already committed to one axis; follow it rather
        // than letting a mostly-sideways drag also count as a skip.
        if (Math.abs(info.offset.x) >= Math.abs(info.offset.y)) {
          // The flick check has to agree in sign with the pull. Taking velocity
          // on its own let a fast yank *back* to centre commit — offset near
          // zero, speed high — and the direction then came from whichever side
          // of centre the thumb happened to land on. Pulling right and changing
          // your mind could pass the lot, which is the one thing a hint that
          // says "BID" must never do.
          const flicked =
            Math.abs(info.velocity.x) > COMMIT_VELOCITY &&
            Math.sign(info.velocity.x) === Math.sign(info.offset.x);
          if (Math.abs(info.offset.x) > COMMIT_DISTANCE || flicked) {
            onDecide(info.offset.x > 0 ? "interested" : "pass");
          }
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

      {/* Centred, level and opaque — see the transform note above. Rendering
          nothing until the drag is meaningful keeps the card readable. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {hint ? (
          <motion.div
            style={{ x: hintX, y: hintY, rotate: hintRotate }}
            initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: hint.armed && !reduceMotion ? 1.06 : 1, opacity: 1 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 26 }
            }
            className={cn(
              "rounded-2xl border-2 bg-surface px-5 py-2.5 text-2xl font-bold tracking-widest uppercase shadow-lg shadow-black/40",
              hint.armed ? TONES[hint.kind].armed : TONES[hint.kind].pending,
              // Armed is meant to read at a glance, so the border thickens as
              // well as filling — colour alone is not a signal everyone gets.
              hint.armed && "border-4",
            )}
          >
            {hint.kind === "pass"
              ? "Pass"
              : hint.kind === "bid"
                ? bidLabel
                : hint.kind === "skip"
                  ? "Skip"
                  : hint.kind === "undo"
                    ? "Undo"
                    : "Nothing to undo"}
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}
