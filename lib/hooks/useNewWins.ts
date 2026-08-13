"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyBids } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { soonestLotDueAt, useDueRefresh } from "@/lib/hooks/useDueRefresh";
import type { MyBid } from "@/types/api";

const SEEN_KEY = "cw.wins_seen";

/**
 * A won lot is one that has ended with this user still leading — the same two
 * fields `/me/bids` already carries, so no backend change.
 *
 * Which wins have been celebrated is per-device in `localStorage`: it is a
 * presentation detail, not something the business needs to know, and the cost of
 * being wrong is one repeat announcement rather than a lost record.
 */
function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]): void {
  try {
    // Bounded: only the most recent matter, and this must never grow forever.
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // A full or blocked storage is not worth breaking the app over; the worst
    // case is the celebration showing again.
  }
}

export function isWin(row: MyBid): boolean {
  return !row.is_open && row.am_i_leading;
}

export function useNewWins() {
  const [seen, setSeen] = useState<string[]>(readSeen);

  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.myBids(false),
    queryFn: () => listMyBids({ active_only: false, limit: 50 }),
  });

  // A win has to land wherever the user happens to be. Socket events only arrive
  // for lots the current screen subscribes to, so the closing time itself is
  // what triggers the check — otherwise someone browsing another auction hears
  // nothing until they navigate.
  useDueRefresh(
    soonestLotDueAt(
      (data ?? []).map((row) => ({ status: row.status, effective_ends_at: row.effective_ends_at })),
    ),
    () => {
      void queryClient.invalidateQueries({ queryKey: ["my-bids"] });
    },
  );

  const wins = useMemo(() => (data ?? []).filter(isWin), [data]);
  const seenSet = useMemo(() => new Set(seen), [seen]);
  const newWins = useMemo(() => wins.filter((row) => !seenSet.has(row.lot_id)), [wins, seenSet]);

  const acknowledge = useCallback(() => {
    setSeen((current) => {
      const next = [...new Set([...current, ...wins.map((row) => row.lot_id)])];
      writeSeen(next);
      return next;
    });
  }, [wins]);

  return { newWins, acknowledge };
}
