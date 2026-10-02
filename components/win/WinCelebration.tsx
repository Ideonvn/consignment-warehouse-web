"use client";

import { useId } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useNewWins } from "@/lib/hooks/useNewWins";
import { Button } from "@/components/ui/Button";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { PaymentDetails } from "@/components/account/PaymentDetails";

/**
 * Winning is the moment the whole app exists for, so it gets said properly —
 * and then immediately answered with what happens next: how to pay and how to
 * collect.
 *
 * **It states no total.** It used to itemise hammer, commission and prior balance
 * and reconcile them against `/me/account`, and investor feedback removed that as
 * too much accounting for the moment someone has just won something. The money is
 * the account screen's job; this says only that commission is added on top, so
 * nobody reads the hammer price as the final figure.
 */
export function WinCelebration() {
  const { newWins, acknowledge } = useNewWins();
  // The visible heading is the dialog's accessible name; see `Sheet`'s
  // `labelledBy`.
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  if (newWins.length === 0) return null;

  const many = newWins.length > 1;

  return (
    <Sheet open onClose={acknowledge} title="You won!" labelledBy={titleId}>
      <div className="px-5 pt-1 pb-6">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="text-center"
        >
          <p aria-hidden className="text-5xl">
            🎉
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold">
            {many ? `You won ${newWins.length} lots!` : "You won!"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {many
              ? "They're yours — here's what you took home."
              : "It's yours. Here's what happens next."}
          </p>
        </motion.div>

        <ul className="mt-5 flex flex-col gap-2">
          {newWins.map((win) => (
            <li
              key={win.lot_id}
              className="flex items-center gap-3 rounded-2xl border border-success/40 bg-success/5 p-3"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <LotImage src={win.primary_image_url} alt={win.title} sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{win.title}</p>
                <p className="text-xs text-text-muted">Lot {win.lot_number}</p>
              </div>
              <p className="shrink-0 text-base font-semibold text-success">
                <Money minor={win.current_bid_minor ?? 0} />
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-sm text-text-muted">
          Commission is added on top — see your account for the full total.
        </p>

        <PaymentDetails className="mt-3" />

        <p className="mt-3 text-sm text-text-muted">
          Get in touch to arrange collection — bring your reference and some ID.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href="/account"
            onClick={acknowledge}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
          >
            See my account
          </Link>
          <Button variant="secondary" size="lg" fullWidth onClick={acknowledge}>
            Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
