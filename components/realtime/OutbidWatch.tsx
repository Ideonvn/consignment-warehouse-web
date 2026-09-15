"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queryKeys";
import { serverNow } from "@/lib/format/clock";
import { formatMoney } from "@/lib/format/money";
import { isLotOpen } from "@/lib/format/time";
import { myBidsQuery } from "@/lib/hooks/useMyBidStatus";
import { useLotSubscription } from "@/lib/hooks/useLotSubscription";
import { useNow } from "@/lib/hooks/useTicker";
import { MAX_LOTS } from "@/lib/realtime/socket";
import { useToast } from "@/components/ui/Toast";
import type { Auction, MyBid } from "@/types/api";

/**
 * Socket slots the stake subscription leaves for the rows on screen. **When the
 * two sets collide, the screen wins**: it is what the user is looking at, and a
 * stake lot still has the durable channel (email or SMS) behind it. 40 covers a
 * tall desktop viewport plus its one-viewport margin either side with room over.
 */
const ON_SCREEN_RESERVE = 40;
const STAKE_LOTS_MAX = MAX_LOTS - ON_SCREEN_RESERVE;

const TOAST_MS = 8000;

/**
 * Being outbid reaches the user wherever they are in the app.
 *
 * Two jobs. **Stay subscribed to the lots they have money on** while those lots
 * are open, whatever the screen shows — a union with the on-screen rule, not a
 * replacement: the socket client reference-counts, so a lot wanted by both is
 * one subscription and releasing one interest leaves the other. That is what
 * keeps `/me/bids` fresh, because a bid event on a lot we hold a row for
 * invalidates it. **Then announce a lead lost**, which is the server's to say:
 * a row that was `am_i_leading` and no longer is. A rival's maximum is never on
 * an event, so nothing here infers it from one.
 *
 * Not a notification centre: one transient toast with one tap target, and never
 * for a lot whose row is already on screen, where the card says it.
 */
export function OutbidWatch() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { showToast, dismissToast } = useToast();
  const now = useNow();

  const { data: rows } = useQuery(myBidsQuery);

  // Open on the clock, never on `status`; soonest to close first, so if the cap
  // ever bites it is the lots with the most time left that wait for a slot.
  const stake = useMemo(
    () =>
      (rows ?? [])
        .filter((row) => isLotOpen(row.status, row.effective_ends_at, now))
        .sort((a, b) => Date.parse(a.effective_ends_at) - Date.parse(b.effective_ends_at))
        .slice(0, STAKE_LOTS_MAX)
        .map((row) => ({ id: row.lot_id, sequence: row.bid_sequence })),
    [rows, now],
  );
  useLotSubscription(stake);

  const leading = useRef<Map<string, boolean> | null>(null);
  const toast = useRef<{ id: string; lots: Map<string, MyBid>; until: number } | null>(null);

  useEffect(() => {
    if (!rows) return;
    const previous = leading.current;
    leading.current = new Map(rows.map((row) => [row.lot_id, row.am_i_leading]));
    // The first answer is a starting point, not news: anything lost while the app
    // was closed went out by email or SMS.
    if (!previous) return;

    const at = serverNow();
    const lost = rows.filter(
      (row) =>
        previous.get(row.lot_id) === true &&
        !row.am_i_leading &&
        isLotOpen(row.status, row.effective_ends_at, at) &&
        !isShown(row.lot_id, pathname),
    );
    if (lost.length === 0) return;

    // One toast, however many leads were lost: a second loss while it is up
    // replaces it with a summary instead of stacking another beneath it.
    const wallClock = Date.now();
    const current = toast.current && toast.current.until > wallClock ? toast.current : null;
    const lots = new Map(current?.lots ?? []);
    for (const row of lost) lots.set(row.lot_id, row);
    if (toast.current) dismissToast(toast.current.id);

    const list = [...lots.values()].sort((a, b) => a.lot_number - b.lot_number);
    const single = list.length === 1 ? list[0] : null;
    const id = single
      ? showToast({
          // Plain, not alarming: a proxy counter landing seconds after a bid is
          // the designed behaviour, so this is common, and it is not a fault.
          title: `Someone bid higher on lot ${single.lot_number}`,
          description: `${single.title} is now ${formatMoney(
            single.current_bid_minor ?? single.minimum_next_bid_minor,
            currencyOf(queryClient, single),
          )}.`,
          tone: "neutral",
          durationMs: TOAST_MS,
          action: {
            label: `Go to lot ${single.lot_number}`,
            onClick: () => router.push(`/lots/${single.lot_id}`),
          },
        })
      : showToast({
          title: `Someone bid higher on ${list.length} of your lots`,
          description: `Lots ${listNumbers(list.map((row) => row.lot_number))}.`,
          tone: "neutral",
          durationMs: TOAST_MS,
          action: { label: "See my bids", onClick: () => router.push("/my-bids") },
        });
    toast.current = { id, lots, until: wallClock + TOAST_MS };
  }, [rows, pathname, queryClient, router, showToast, dismissToast]);

  return null;
}

/**
 * Whether the lot is already being shown: its own detail page, or a row carrying
 * `data-lot-id` that is actually inside the viewport. Read at the moment of
 * announcing, which is the only moment the answer matters.
 */
function isShown(lotId: string, pathname: string): boolean {
  if (pathname === `/lots/${lotId}`) return true;
  for (const node of document.querySelectorAll<HTMLElement>(`[data-lot-id="${lotId}"]`)) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight && rect.height > 0) return true;
  }
  return false;
}

function currencyOf(queryClient: ReturnType<typeof useQueryClient>, row: MyBid): string {
  for (const [, data] of queryClient.getQueriesData<Auction[]>({ queryKey: ["auctions"] })) {
    const auction = Array.isArray(data) ? data.find((entry) => entry.id === row.auction_id) : null;
    if (auction) return auction.currency_code;
  }
  void queryKeys;
  return "ZAR";
}

function listNumbers(numbers: number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}
