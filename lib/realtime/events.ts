import type { QueryClient } from "@tanstack/react-query";
import { getLot } from "@/lib/api/endpoints";
import { serverNow } from "@/lib/format/clock";
import { patchLot, patchMyBid } from "@/lib/api/cache";
import { queryKeys } from "@/lib/api/queryKeys";
import { hasSequenceGap, isOwnBid, isStaleSequence, useRealtimeStore } from "@/lib/realtime/store";
import { realtime } from "@/lib/realtime/socket";
import type { LotCard, LotDetail, ServerMessage } from "@/types/api";

export type EventEffects = {
  /** The user was leading this lot and no longer is. */
  onOutbid: (lot: LotDetail) => void;
  onExtended: (lotId: string, endsAt: string) => void;
};

/** Pulls the given lots back from REST when the socket cannot be trusted to. */
export function refetchLots(queryClient: QueryClient, lotIds: string[]): void {
  for (const lotId of lotIds) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.lot(lotId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.bids(lotId) });
  }
  void queryClient.invalidateQueries({ queryKey: ["lots"] });
  void queryClient.invalidateQueries({ queryKey: ["my-bids"] });
}

/**
 * The close time we currently hold for a lot, from whichever cache entry has it.
 * Read before a patch so the size of a move can be stated, not just its fact.
 */
function closeTimeInCache(queryClient: QueryClient, lotId: string): number | null {
  const detail = queryClient.getQueryData<LotDetail>(queryKeys.lot(lotId));
  if (detail) return Date.parse(detail.effective_ends_at);

  for (const [, data] of queryClient.getQueriesData({ queryKey: ["lots"] })) {
    const pages = (data as { pages?: { data: LotCard[] }[] } | undefined)?.pages;
    if (!pages) continue;
    for (const page of pages) {
      const lot = page.data.find((entry) => entry.id === lotId);
      if (lot) return Date.parse(lot.effective_ends_at);
    }
  }
  return null;
}

/**
 * Turns a socket message into cache writes. Components read the cache, so none
 * of them need socket wiring of their own.
 */
export function applyServerMessage(
  queryClient: QueryClient,
  message: ServerMessage,
  effects: EventEffects,
): void {
  const store = useRealtimeStore.getState();

  switch (message.type) {
    case "bid": {
      // Already applied — a replay from a batched `after_sequence`. Dropping it
      // keeps an old amount from overwriting the current price.
      if (isStaleSequence(message.lot_id, message.sequence)) return;

      // A jump of more than one means we missed events: ask for the replay.
      if (hasSequenceGap(message.lot_id, message.sequence)) {
        realtime.resync(message.lot_id);
      }
      store.noteSequence(message.lot_id, message.sequence);
      store.pulse(message.lot_id);

      // Honest FOMO: a real event, in the card it belongs to, saying nothing
      // about **who**. The payload carries a handle and we deliberately do not
      // use it. The echo of a bid this client just placed is not somebody else
      // bidding, so it raises nothing.
      const at = serverNow();
      if (!isOwnBid(message.lot_id, message.sequence, at)) {
        store.notice(message.lot_id, {
          kind: "bid",
          at,
          amountMinor: message.amount_minor,
        });
      }

      const cached = queryClient.getQueryData<LotDetail>(queryKeys.lot(message.lot_id));

      patchLot(queryClient, message.lot_id, {
        current_bid_minor: message.amount_minor,
        bid_count: message.bid_count,
        bid_sequence: message.sequence,
        // The row's Bid button follows the price from this, with no refetch.
        minimum_next_bid_minor: message.minimum_next_bid_minor,
      });
      const mine = patchMyBid(queryClient, message.lot_id, {
        current_bid_minor: message.amount_minor,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bids(message.lot_id) });

      // Whether this displaced the user is the server's to say — a rival's
      // maximum is invisible here — so any lot we hold a `/me/bids` row for is
      // re-asked. Without it the list keeps rendering "WINNING" next to an
      // alert saying somebody else just bid, which is a lie about their money.
      if (mine) void queryClient.invalidateQueries({ queryKey: ["my-bids"] });

      // **Not redundant, even though the minimum is now patched above.** The
      // event carries the price and the minimum, but never anyone's maximum, so
      // whether this bid displaced the user — a rival's hidden maximum taking the
      // lead back — is still only knowable from the server's `am_i_leading`. That
      // is what feeds `onOutbid`. So refetch the lot whenever anyone has it loaded.
      if (cached) {
        void queryClient
          .fetchQuery({
            queryKey: queryKeys.lot(message.lot_id),
            queryFn: () => getLot(message.lot_id),
            // The patch above just marked this entry fresh; without this the
            // fetch would be served from cache and never see `am_i_leading`
            // flip.
            staleTime: 0,
          })
          .then((fresh) => {
            if (cached.am_i_leading && !fresh.am_i_leading) effects.onOutbid(fresh);
          })
          .catch(() => undefined);

      }
      return;
    }

    case "lot_extended": {
      // Read the close time we currently hold *before* patching, so the card can
      // say by how much rather than only that something moved.
      const previous = closeTimeInCache(queryClient, message.lot_id);
      const addedMs = previous === null ? null : Date.parse(message.effective_ends_at) - previous;

      patchLot(queryClient, message.lot_id, {
        effective_ends_at: message.effective_ends_at,
        extension_count: message.extension_count,
      });
      patchMyBid(queryClient, message.lot_id, { effective_ends_at: message.effective_ends_at });
      store.notice(message.lot_id, { kind: "extended", at: serverNow(), addedMs });
      effects.onExtended(message.lot_id, message.effective_ends_at);
      return;
    }

    case "lot_rescheduled": {
      // An admin moved the auction's clock. Unlike an anti-snipe extension this
      // can pull the close time *earlier*, so the new value is applied as-is
      // rather than treated as a later bound — and the card says "changed",
      // never "extended".
      const before = closeTimeInCache(queryClient, message.lot_id);
      const deltaMs = before === null ? null : Date.parse(message.effective_ends_at) - before;

      patchLot(queryClient, message.lot_id, {
        scheduled_ends_at: message.scheduled_ends_at,
        effective_ends_at: message.effective_ends_at,
        extension_count: message.extension_count,
      });
      patchMyBid(queryClient, message.lot_id, {
        effective_ends_at: message.effective_ends_at,
      });
      store.notice(message.lot_id, { kind: "rescheduled", at: serverNow(), deltaMs });
      return;
    }

    case "lot_closed": {
      patchLot(queryClient, message.lot_id, {
        status: message.status,
        current_bid_minor: message.current_bid_minor,
      });
      patchMyBid(queryClient, message.lot_id, {
        status: message.status,
        current_bid_minor: message.current_bid_minor,
        is_open: false,
      });
      // The event carries the outcome but not whether *this* user won it, and a
      // reserve being accepted turns a lost lot into a won one. Refresh the lot
      // so `am_i_leading` is authoritative wherever it is being displayed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.lot(message.lot_id) });
      void queryClient.invalidateQueries({ queryKey: ["my-bids"] });
      return;
    }

    case "lot_opened": {
      patchLot(queryClient, message.lot_id, { status: message.status });
      return;
    }

    case "resync_complete": {
      store.noteSequence(message.lot_id, message.latest_sequence);
      patchLot(queryClient, message.lot_id, {
        status: message.status,
        current_bid_minor: message.current_bid_minor,
        effective_ends_at: message.effective_ends_at,
        bid_sequence: message.latest_sequence,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bids(message.lot_id) });
      // Like `bid`, this payload has no `minimum_next_bid_minor`; anything
      // actively displaying the lot needs the real figure.
      void queryClient.invalidateQueries({ queryKey: queryKeys.lot(message.lot_id) });
      return;
    }

    case "resync_too_far": {
      // No replay is coming, but the server still told us where the lot is now.
      // Recording it is what stops the next bid from looking like a fresh gap
      // and asking for a resync that can only be refused again.
      store.noteSequence(message.lot_id, message.latest_sequence);

      // The gap is beyond what the server will replay — refetch over REST.
      void queryClient.invalidateQueries({ queryKey: queryKeys.lot(message.lot_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bids(message.lot_id) });
      void queryClient.invalidateQueries({ queryKey: ["lots"] });
      return;
    }

    default:
      return;
  }
}
