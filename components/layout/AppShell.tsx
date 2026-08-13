"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";
import { WinCelebration } from "@/components/win/WinCelebration";

/** Everything behind the sign-in wall shares this frame. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RealtimeProvider>
        <div className="flex min-h-dvh flex-col pb-[calc(var(--nav-h)+env(safe-area-inset-bottom))]">
          <ConnectionBanner />
          {children}
        </div>
        <BottomNav />
        {/* App-wide: a win must land wherever the user happens to be, and on
            next open for anything that closed while they were away. */}
        <WinCelebration />
      </RealtimeProvider>
    </AuthGuard>
  );
}
