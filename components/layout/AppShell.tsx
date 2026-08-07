"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";
import { RealtimeProvider } from "@/components/realtime/RealtimeProvider";

/** Everything behind the sign-in wall shares this frame. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RealtimeProvider>
        <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
          <ConnectionBanner />
          {children}
        </div>
        <BottomNav />
      </RealtimeProvider>
    </AuthGuard>
  );
}
