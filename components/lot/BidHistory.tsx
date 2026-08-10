"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { listBids } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/queryKeys";
import { formatRelativePast } from "@/lib/format/time";
import { useNow } from "@/lib/hooks/useTicker";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

export function BidHistory({ lotId, currency }: { lotId: string; currency: string }) {
  const now = useNow();
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: queryKeys.bids(lotId),
      queryFn: ({ pageParam }) => listBids(lotId, { limit: 25, cursor: pageParam ?? undefined }),
      initialPageParam: undefined as number | undefined,
      getNextPageParam: (lastPage) => {
        if (!lastPage.meta.hasMore || !lastPage.meta.nextCursor) return undefined;
        const cursor = Number(lastPage.meta.nextCursor);
        return Number.isFinite(cursor) ? cursor : undefined;
      },
    });

  const bids = data?.pages.flatMap((page) => page.data) ?? [];

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load bids" />;
  }

  if (bids.length === 0) {
    return <p className="py-6 text-center text-sm text-text-muted">No bids yet. Be the first.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col">
        {bids.map((bid) => (
          <li
            key={bid.id}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0",
              bid.status === "retracted" || bid.status === "void" ? "opacity-50" : null,
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {bid.is_mine ? (
                  <span className="text-accent-text">You</span>
                ) : (
                  <span className="text-text">{bid.bidder_handle}</span>
                )}
                {bid.is_auto ? (
                  <span
                    className="ml-2 text-xs text-text-muted"
                    title="Placed automatically by a bidder's maximum"
                  >
                    auto
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-text-muted">
                {now === null ? "" : formatRelativePast(bid.created_at, now)}
              </p>
            </div>
            <p className={cn("text-sm font-semibold", bid.is_mine ? "text-accent-text" : "text-text")}>
              <Money minor={bid.amount_minor} currency={currency} />
            </p>
          </li>
        ))}
      </ul>

      {hasNextPage ? (
        <Button
          variant="ghost"
          fullWidth
          className="mt-3"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Show earlier bids
        </Button>
      ) : null}
    </div>
  );
}
