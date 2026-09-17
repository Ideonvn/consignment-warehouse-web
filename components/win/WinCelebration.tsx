"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { getMyAccount } from "@/lib/api/endpoints";
import { describeBalance, winBreakdown } from "@/lib/format/account";
import { useNewWins } from "@/lib/hooks/useNewWins";
import { Button } from "@/components/ui/Button";
import { LotImage } from "@/components/ui/LotImage";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";
import { PaymentDetails } from "@/components/account/PaymentDetails";

/**
 * Winning is the moment the whole app exists for, so it gets said properly —
 * and then immediately answered with what happens next. Someone who has just won
 * three lots needs to know what they owe and how to collect, not only that they
 * won.
 */
export function WinCelebration() {
  const { newWins, acknowledge } = useNewWins();
  const reduceMotion = useReducedMotion();

  const { data: account, isPending: accountPending } = useQuery({
    // Its own key: the summary elsewhere holds one entry, and this needs the
    // won lots' charges plus the entry before them.
    queryKey: ["account", "win-breakdown"],
    queryFn: () => getMyAccount({ limit: 50, offset: 0 }),
    enabled: newWins.length > 0,
    // The winning charge is posted at close, so a cached balance from before the
    // win would understate what they owe on the one screen that states it.
    staleTime: 0,
  });

  // Wait for the balance rather than let the card arrive after first paint and
  // push the sheet taller. On an error the modal opens without it, as before.
  if (newWins.length === 0 || accountPending) return null;

  const currency = account?.data.currency_code ?? "ZAR";
  const standing = account ? describeBalance(account.data.balance_minor) : null;
  const many = newWins.length > 1;
  const breakdown = account
    ? winBreakdown(
        account.data,
        newWins.map((win) => win.lot_id),
      )
    : null;

  return (
    <Sheet open onClose={acknowledge} title={many ? "You won!" : "You won!"} hideTitle>
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
          <h2 className="mt-2 text-2xl font-semibold">
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
                <Money minor={win.current_bid_minor ?? 0} currency={currency} />
              </p>
            </li>
          ))}
        </ul>

        {standing ? (
          <div className="mt-5 rounded-2xl border border-border bg-surface-raised p-4">
            {breakdown ? (
              <dl className="mb-3 flex flex-col gap-1.5 border-b border-border pb-3 text-sm">
                {breakdown.lots.map((lot) => {
                  const win = newWins.find((row) => row.lot_id === lot.lotId);
                  if (!win) return null;
                  return (
                    <Fragment key={lot.lotId}>
                      <BreakdownLine
                        label={`Lot ${win.lot_number} · ${win.title}`}
                        amount={<Money minor={lot.hammerMinor} currency={currency} />}
                      />
                      {lot.premiumMinor !== null ? (
                        <BreakdownLine
                          label={`Buyer's premium · Lot ${win.lot_number}`}
                          amount={<Money minor={lot.premiumMinor} currency={currency} />}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
                {breakdown.beforeMinor > 0 ? (
                  <BreakdownLine
                    label="Credit already on account"
                    amount={
                      <>
                        −<Money minor={breakdown.beforeMinor} currency={currency} />
                      </>
                    }
                  />
                ) : breakdown.beforeMinor < 0 ? (
                  <BreakdownLine
                    label="Already owing"
                    amount={<Money minor={-breakdown.beforeMinor} currency={currency} />}
                  />
                ) : null}
              </dl>
            ) : null}
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-text-muted">
                {breakdown && standing.tone === "due" ? "To pay" : "Your balance"}
              </span>
              <span
                className={
                  standing.tone === "due"
                    ? "text-xl font-semibold text-danger"
                    : "text-xl font-semibold text-text"
                }
              >
                <Money minor={standing.amountMinor} currency={currency} />
                <span className="ml-1 text-sm font-normal text-text-muted">
                  {standing.headline}
                </span>
              </span>
            </p>
            {standing.tone !== "due" ? (
              <p className="mt-1 text-xs text-text-muted">
                Your deposit covers this — nothing further to pay right now.
              </p>
            ) : null}
          </div>
        ) : null}

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

function BreakdownLine({ label, amount }: { label: string; amount: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-text-muted">{label}</dt>
      <dd className="shrink-0 text-text">{amount}</dd>
    </div>
  );
}
