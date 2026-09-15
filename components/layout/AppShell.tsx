"use client";

import type { ReactNode } from "react";
import { useSession } from "@/lib/auth/session";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { GetStartedBar } from "@/components/public/GetStartedBar";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";
import { OutbidWatch } from "@/components/realtime/OutbidWatch";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { WinCelebration } from "@/components/win/WinCelebration";

/**
 * The frame every screen with app chrome shares.
 *
 * `AuthGuard` stays here rather than moving onto the private pages, so a new
 * route is private unless it is named in `lib/auth/publicPaths.ts`. The chrome
 * then follows the session: three tabs for a member, one "Get started" for a
 * stranger, and no nav tabs pointing at pages they have no account for.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const signedIn = status === "authenticated";

  return (
    <AuthGuard>
      <RealtimeProvider>
        <div className="flex min-h-dvh flex-col pb-[calc(var(--nav-h)+env(safe-area-inset-bottom))]">
          <ConnectionBanner />
          {children}
        </div>
        {signedIn ? <BottomNav /> : <GetStartedBar />}
        {/* App-wide: a win must land wherever the user happens to be, and on
            next open for anything that closed while they were away. */}
        {signedIn ? <WinCelebration /> : null}
        {/* App-wide for the same reason: losing a lead must reach the user on
            whichever screen they are, not only on the one showing that lot. */}
        {signedIn ? <OutbidWatch /> : null}
      </RealtimeProvider>
    </AuthGuard>
  );
}
