import type { QueryClient } from "@tanstack/react-query";
import { getLot } from "@/lib/api/endpoints";
import { patchLot, patchMyBid } from "@/lib/api/cache";
import { queryKeys } from "@/lib/api/queryKeys";
import { hasSequenceGap, isStaleSequence, useRealtimeStore } from "@/lib/realtime/store";
import { realtime } from "@/lib/realtime/socket";
import type { LotDetail, ServerMessage } from "@/types/api";

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

      const cached = queryClient.getQueryData<LotDetail>(queryKeys.lot(message.lot_id));

      patchLot(queryClient, message.lot_id, {
        current_bid_minor: message.amount_minor,
        bid_count: message.bid_count,
        bid_sequence: message.sequence,
      });
      patchMyBid(queryClient, message.lot_id, { current_bid_minor: message.amount_minor });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bids(message.lot_id) });

      // The bid event carries no `minimum_next_bid_minor`, and only the server
      // knows whether this displaced the user — a rival's maximum is invisible
      // to us. So refetch the lot whenever anyone has it loaded.
      if (cached) {
        void queryClient
          .fetchQuery({
            queryKey: queryKeys.lot(message.lot_id),
            queryFn: () => getLot(message.lot_id),
            // The patch above just marked this entry fresh; without this the
            // fetch would be served from cache and never see `am_i_leading`
            // flip, or the new minimum next bid.
            staleTime: 0,
          })
          .then((fresh) => {
            if (cached.am_i_leading && !fresh.am_i_leading) effects.onOutbid(fresh);
          })
          .catch(() => undefined);

        if (cached.am_i_leading || cached.my_auto_bid_max_minor !== null) {
          void queryClient.invalidateQueries({ queryKey: ["my-bids"] });
        }
      }
      return;
    }

    case "lot_extended": {
      patchLot(queryClient, message.lot_id, {
        effective_ends_at: message.effective_ends_at,
        extension_count: message.extension_count,
      });
      patchMyBid(queryClient, message.lot_id, { effective_ends_at: message.effective_ends_at });
      effects.onExtended(message.lot_id, message.effective_ends_at);
      return;
    }

    case "lot_rescheduled": {
      // An admin moved the auction's clock. Unlike an anti-snipe extension this
      // can pull the close time *earlier*, so the new value is applied as-is
      // rather than treated as a later bound.
      patchLot(queryClient, message.lot_id, {
        scheduled_ends_at: message.scheduled_ends_at,
        effective_ends_at: message.effective_ends_at,
        extension_count: message.extension_count,
      });
      patchMyBid(queryClient, message.lot_id, {
        effective_ends_at: message.effective_ends_at,
      });
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
