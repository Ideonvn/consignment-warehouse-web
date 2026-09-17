import type { ReactNode } from "react";
import type { AuctionStatus } from "@/types/api";
import { EmptyState } from "@/components/ui/EmptyState";

type Listed = { id: string; status: AuctionStatus; ends_at: string };

type Empty = { title: string; description: string };

/**
 * The auction list split into what is running and what has finished, shared by
 * the member and the anonymous list.
 *
 * **The server decides which finished sales are listed** — the last day's, plus
 * the most recent one whenever it ended. This only groups what came back, by
 * status; there is no date arithmetic here and there must never be, or it is a
 * second copy of that window. Status is fine for grouping because it labels an
 * outcome; nothing here decides whether anyone can bid.
 */
export function AuctionSections<T extends Listed>({
  auctions,
  renderCard,
  empty,
  emptyWithFinished,
  className,
}: {
  /** In the order the current section should show them. */
  auctions: T[];
  renderCard: (auction: T) => ReactNode;
  /** Nothing at all came back. */
  empty: Empty;
  /** Nothing is running, but a finished sale is listed below. */
  emptyWithFinished: Empty;
  className?: string;
}) {
  const current = auctions.filter((a) => a.status === "live" || a.status === "scheduled");
  const finished = auctions
    .filter((a) => a.status !== "live" && a.status !== "scheduled")
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at));

  if (auctions.length === 0) {
    return (
      <div className={className}>
        <EmptyState {...empty} />
      </div>
    );
  }

  const list = (items: T[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((auction) => (
        <li key={auction.id}>{renderCard(auction)}</li>
      ))}
    </ul>
  );

  return (
    <div className={className}>
      <div className="flex flex-col gap-6">
        {current.length > 0 ? (
          <section>
            {finished.length > 0 ? <SectionHeading>Now and upcoming</SectionHeading> : null}
            {list(current)}
          </section>
        ) : (
          <EmptyState {...emptyWithFinished} />
        )}

        {finished.length > 0 ? (
          <section>
            <SectionHeading>{finished.length === 1 ? "Last auction" : "Recently ended"}</SectionHeading>
            {list(finished)}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
      {children}
    </h2>
  );
}
