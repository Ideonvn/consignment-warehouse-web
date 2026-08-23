import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The link that went dead.
 *
 * Shown only for something this session had already rendered, so it is not a
 * guess: the auction was public a moment ago and is not now. The API can only
 * say 404 — telling private things apart from missing ones would confirm that
 * private things exist — but the client watched it happen.
 */
export function GoneState({ kind }: { kind: "auction" | "lot" }) {
  return (
    <div className="mx-auto w-full max-w-(--app-width) px-4 py-10">
      <EmptyState
        title={kind === "auction" ? "This auction is no longer available" : "This lot is no longer available"}
        description="It was public a moment ago and has since been closed to the public. If you were sent this link, whoever shared it can tell you more."
        action={
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-accent-edge bg-accent px-5 font-semibold text-accent-ink"
          >
            See what’s on
          </Link>
        }
      />
    </div>
  );
}
