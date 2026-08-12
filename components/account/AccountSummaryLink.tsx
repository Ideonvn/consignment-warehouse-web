"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMyAccount } from "@/lib/api/endpoints";
import { describeBalance } from "@/lib/format/account";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

/** Profile's way in to the statement, with where they stand shown up front. */
export function AccountSummaryLink() {
  const { data, isPending } = useQuery({
    queryKey: ["account", "summary"],
    // Only the balance is needed here, so ask for the smallest page.
    queryFn: () => getMyAccount({ limit: 1, offset: 0 }),
  });

  const balance = data?.data.balance_minor ?? 0;
  const currency = data?.data.currency_code ?? "ZAR";
  const standing = describeBalance(balance);

  return (
    <Link
      href="/account"
      className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">Account</p>
        {isPending ? (
          <Skeleton className="mt-1 h-5 w-32" />
        ) : (
          <p className="mt-0.5 text-sm text-text-muted">
            <span
              className={cn(
                "font-semibold",
                standing.tone === "due" ? "text-danger" : "text-text",
              )}
            >
              <Money minor={standing.amountMinor} currency={currency} />
            </span>{" "}
            {standing.headline}
          </p>
        )}
      </div>
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M8 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
