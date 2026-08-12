"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { placeBid, setAutoBid } from "@/lib/api/endpoints";
import { applyBidResult } from "@/lib/api/cache";
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
  maxAmountMinor: number;
  /** Reused across retries of the same intent so a double tap can't bid twice. */
  clientRequestId: string;
  /** Set when they already have a proxy on this lot: raising is its own call. */
  isRaise: boolean;
};

export function useBidSubmit() {
  const queryClient = useQueryClient();
  const [inFlight, setInFlight] = useState(false);

  const submit = useCallback(
    async (input: SubmitInput): Promise<BidOutcome> => {
      setInFlight(true);
      try {
        const result = input.isRaise
          ? await setAutoBid(input.lotId, {
              max_amount_minor: input.maxAmountMinor,
              client_request_id: input.clientRequestId,
            })
          : await placeBid(input.lotId, {
              amount_minor: input.amountMinor,
              max_amount_minor: input.maxAmountMinor,
              client_request_id: input.clientRequestId,
            });

        applyBidResult(queryClient, result);
        // `is_replay` means an idempotent retry landed — success, silently.
        return { kind: result.am_i_leading ? "leading" : "outbid", result };
      } catch (cause) {
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
