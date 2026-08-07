"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { LotCardFace } from "@/components/lot/LotCardFace";
import type { LotCard, SwipeDirection } from "@/types/api";

/** Past this much horizontal travel, releasing commits the swipe. */
const COMMIT_DISTANCE = 110;
const COMMIT_VELOCITY = 550;

export function SwipeCard({
  lot,
  currency,
  onDecide,
  onOpen,
}: {
  lot: LotCard;
  currency: string;
  onDecide: (direction: SwipeDirection) => void;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const dragged = useRef(false);

  // Rotation is proportional to offset so the card feels hinged to the thumb.
  const rotate = useTransform(x, [-240, 240], [-13, 13]);
  const passOpacity = useTransform(x, [-COMMIT_DISTANCE, -24], [1, 0]);
  const bidOpacity = useTransform(x, [24, COMMIT_DISTANCE], [0, 1]);

  return (
    <motion.div
      className="absolute inset-0 touch-pan-y select-none"
      style={{ x, rotate }}
      drag="x"
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
        const committed =
          Math.abs(info.offset.x) > COMMIT_DISTANCE ||
          Math.abs(info.velocity.x) > COMMIT_VELOCITY;
        if (committed) onDecide(info.offset.x > 0 ? "interested" : "pass");
      }}
      initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      variants={{
        // `custom` comes from AnimatePresence, so the card leaves in the
        // direction it was actually sent — including by button or keyboard.
        exit: (direction: SwipeDirection) =>
          reduceMotion
            ? { opacity: 0, transition: { duration: 0.1 } }
            : {
                x: direction === "interested" ? 700 : -700,
                rotate: direction === "interested" ? 20 : -20,
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
        className="pointer-events-none absolute top-8 right-6 rotate-12 rounded-xl border-2 border-accent bg-accent/10 px-4 py-2 text-lg font-bold tracking-widest text-accent uppercase"
      >
        Bid
      </motion.div>
    </motion.div>
  );
}
