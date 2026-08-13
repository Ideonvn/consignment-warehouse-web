"use client";

import { PAYMENT_INSTRUCTIONS } from "@/lib/config/payments";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

/**
 * How to pay, in one place. Anywhere the app asks someone for money it also
 * shows the reference they must quote — a payment without it is a payment the
 * operator has to chase.
 */
export function PaymentDetails({ className }: { className?: string }) {
  const reference = useSession((state) => state.user?.payment_reference);

  return (
    <div className={cn("rounded-2xl border border-border bg-surface-raised p-3", className)}>
      <p className="text-xs text-text-muted">{PAYMENT_INSTRUCTIONS}</p>
      {reference ? (
        <p className="mt-2 flex items-baseline gap-2 text-xs">
          <span className="text-text-muted">Your reference</span>
          <span className="tabular font-semibold text-text select-all">{reference}</span>
        </p>
      ) : null}
    </div>
  );
}
