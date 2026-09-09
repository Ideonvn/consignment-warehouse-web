"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { placeBid, setAutoBid } from "@/lib/api/endpoints";
import { applyBidResult } from "@/lib/api/cache";
import { serverNow } from "@/lib/format/clock";
import { useRealtimeStore } from "@/lib/realtime/store";
import { ApiError, BidTooLowError, InsufficientCreditError } from "@/lib/api/errors";
import type { BidResult } from "@/types/api";

export type BidOutcome =
  /** Accepted and they hold the lot. */
  | { kind: "leading"; result: BidResult }
  /** Accepted, but a rival's hidden maximum is higher. A normal auction event. */
  | { kind: "outbid"; result: BidResult }
  /** Someone bid between render and submit; retry from the new minimum. */
  | { kind: "too-low"; minimumNextBidMinor: number }
  /** Not enough on account for this auction's deposit. */
  | {
      kind: "insufficient-credit";
      message: string;
      requiredMinor: number;
      balanceMinor: number;
      shortfallMinor: number;
      currencyCode: string;
    }
  | { kind: "closed" }
  | { kind: "error"; message: string; retryAfter: number | null };

type SubmitInput = {
  lotId: string;
  /** The visible bid — always the server's minimum, never their ceiling. */
  amountMinor: number;
  /**
   * The user's ceiling, or null for a bid with no headroom — the list's Bid
   * button sends exactly the server's minimum. The backend treats an absent
   * maximum as "the bid is the maximum", so omitting it expresses "no proxy".
   */
  maxAmountMinor: number | null;
  /** Reused across retries of the same intent so a double tap can't bid twice. */
  clientRequestId: string;
  /** Set when they already have a proxy on this lot: raising is its own call. */
  isRaise: boolean;
};

/** How long a lot stays claimed while our own bid is outstanding. */
const OWN_BID_WINDOW_MS = 10_000;

export function useBidSubmit() {
  const queryClient = useQueryClient();
  const [inFlight, setInFlight] = useState(false);

  const submit = useCallback(
    async (input: SubmitInput): Promise<BidOutcome> => {
      setInFlight(true);
      // Claimed BEFORE the request, because the socket echo of this bid usually
      // beats the response back. Cleared as soon as the result names the exact
      // sequences that were ours — or, in `catch`, as soon as the server says
      // there will be no bid at all.
      useRealtimeStore.getState().expectOwnBid(input.lotId, serverNow() + OWN_BID_WINDOW_MS);
      try {
        const result = input.isRaise
          ? await setAutoBid(input.lotId, {
              // A raise is a maximum by definition: `PUT /auto-bid` has nothing to
              // send without one, so this path never takes the no-headroom case.
              max_amount_minor: input.maxAmountMinor ?? input.amountMinor,
              client_request_id: input.clientRequestId,
            })
          : await placeBid(input.lotId, {
              amount_minor: input.amountMinor,
              ...(input.maxAmountMinor === null
                ? {}
                : { max_amount_minor: input.maxAmountMinor }),
              client_request_id: input.clientRequestId,
            });

        applyBidResult(queryClient, result);
        // `is_replay` means an idempotent retry landed — success, silently.
        return { kind: result.am_i_leading ? "leading" : "outbid", result };
      } catch (cause) {
        // **The claim is a prediction that a bid is about to appear on this
        // lot's channel, and a refusal is evidence the prediction is false.**
        // Holding a known-false prediction is strictly worse than dropping it:
        // for the rest of `OWN_BID_WINDOW_MS` a rival's genuine bid would be
        // read as this client's own echo and silently swallowed — no alert, on
        // a lot the user has just been told they are not on. The success path
        // already clears on evidence (`applyBidResult` records the exact
        // sequences that were ours); this is the failure path doing the same
        // with the evidence it has, which it previously threw away.
        //
        // **Only a 4xx is that evidence.** A 5xx, a dropped connection or an
        // unparseable body all leave open that the bid committed and its echo
        // is still on its way, so those keep the claim: suppressing one rival's
        // alert is the documented trade-off, and announcing the caller's own
        // bid back to them as somebody else's is the exact failure the claim
        // exists to prevent.
        if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
          useRealtimeStore.getState().releaseOwnBid(input.lotId);
        }

        if (cause instanceof BidTooLowError) {
          return { kind: "too-low", minimumNextBidMinor: cause.minimumNextBidMinor };
        }
        if (cause instanceof InsufficientCreditError) {
          return {
            kind: "insufficient-credit",
            message: cause.message,
            requiredMinor: cause.requiredMinor,
            balanceMinor: cause.balanceMinor,
            shortfallMinor: cause.shortfallMinor,
            currencyCode: cause.currencyCode,
          };
        }
        if (cause instanceof ApiError && cause.status === 409) {
          return { kind: "closed" };
        }
        if (cause instanceof ApiError) {
          return { kind: "error", message: cause.message, retryAfter: cause.retryAfter };
        }
        return {
          kind: "error",
          message: cause instanceof Error ? cause.message : "Something went wrong.",
          retryAfter: null,
        };
      } finally {
        setInFlight(false);
      }
    },
    [queryClient],
  );

  return { submit, inFlight };
}
