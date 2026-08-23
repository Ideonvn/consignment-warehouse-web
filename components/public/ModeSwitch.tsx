"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/auth/session";
import { hadSessionRecently } from "@/lib/auth/session";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

/**
 * The one place a shared route decides which experience it is.
 *
 * There are three of these in the whole app — the catalogue, an auction and a
 * lot. Nothing below is told which mode it is in: the presentational components
 * take a `LotSummary` either way, and the member affordances arrive as an
 * `actions` prop that anonymous simply does not pass.
 *
 * While the session resolves there is a choice of wrong first paint, because
 * the refresh cookie is HttpOnly on the API's origin and neither the server nor
 * the client can see it until the refresh returns. `hadSessionRecently()` picks:
 * a device that has signed in before waits behind a skeleton (no flash of the
 * anonymous view), and a device that has not gets the public content
 * immediately, which is the whole point of a shared link. The hint grants
 * nothing — being wrong costs one loading state.
 */
export function ModeSwitch({ member, public: publicView }: { member: ReactNode; public: ReactNode }) {
  const status = useSession((state) => state.status);

  if (status === "authenticated") return <>{member}</>;
  if (status === "anonymous") return <>{publicView}</>;
  return hadSessionRecently() ? <LoadingSkeleton /> : <>{publicView}</>;
}

function LoadingSkeleton() {
  return (
    <PhoneColumn className="py-6">
      <span className="sr-only" role="status">
        Loading
      </span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-64 w-full rounded-card" />
    </PhoneColumn>
  );
}
