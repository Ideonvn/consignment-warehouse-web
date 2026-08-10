"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { BiddingList } from "@/components/mybids/BiddingList";
import { SwipedList } from "@/components/mybids/SwipedList";
import { cn } from "@/lib/utils/cn";

type View = "bidding" | "interested" | "passed";

const TABS: Array<{ id: View; label: string }> = [
  { id: "bidding", label: "Bidding" },
  { id: "interested", label: "Interested" },
  { id: "passed", label: "Passed" },
];

function isView(value: string | null): value is View {
  return value === "bidding" || value === "interested" || value === "passed";
}

export function MyBidsScreen() {
  const requested = useSearchParams().get("view");
  const [view, setView] = useState<View>(isView(requested) ? requested : "bidding");

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="My bids" />

      <div role="tablist" aria-label="My bids views" className="flex gap-2 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={view === tab.id}
            onClick={() => setView(tab.id)}
            className={cn(
              "min-h-11 flex-1 rounded-full border px-3 text-sm font-medium transition-colors",
              view === tab.id
                ? "border-accent-edge bg-accent text-accent-ink"
                : "border-border bg-surface-raised text-text-muted hover:text-text",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "bidding" ? (
        <BiddingList />
      ) : (
        <SwipedList direction={view === "passed" ? "pass" : "interested"} />
      )}
    </PhoneColumn>
  );
}
