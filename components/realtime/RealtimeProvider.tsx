"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { applyServerMessage } from "@/lib/realtime/events";
import { realtime } from "@/lib/realtime/socket";
import { formatMoney } from "@/lib/format/money";
import { useToast } from "@/components/ui/Toast";

/** Connects the socket while signed in and routes its events into the cache. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const status = useSession((state) => state.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    realtime.setListener((message) =>
      applyServerMessage(queryClient, message, {
        onOutbid: (lot) =>
          showToast({
            title: "You've been outbid",
            description: `${lot.title} is now at ${formatMoney(lot.current_bid_minor ?? 0)}.`,
            tone: "danger",
            durationMs: 8000,
            action: { label: "Raise my maximum", onClick: () => router.push(`/lots/${lot.id}`) },
          }),
        onExtended: () =>
          showToast({
            title: "Bidding extended",
            description: "A late bid pushed this lot's closing time out.",
            tone: "neutral",
          }),
      }),
    );
    realtime.start();

    return () => {
      realtime.setListener(null);
      realtime.stop();
    };
  }, [status, queryClient, showToast, router]);

  return <>{children}</>;
}
