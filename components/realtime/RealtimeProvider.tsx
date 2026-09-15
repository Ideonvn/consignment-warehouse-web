"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/session";
import { applyServerMessage, refetchLots } from "@/lib/realtime/events";
import { realtime } from "@/lib/realtime/socket";
import { useToast } from "@/components/ui/Toast";

/** Connects the socket while signed in and routes its events into the cache. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const status = useSession((state) => state.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    realtime.setListener((message) =>
      applyServerMessage(queryClient, message, {
        onExtended: () =>
          showToast({
            title: "Bidding extended",
            description: "A late bid pushed this lot's closing time out.",
            tone: "neutral",
          }),
      }),
    );
    // If the server refuses our resume points there is no replay coming, so the
    // affected lots are refilled over REST rather than left with a hole.
    realtime.setResumeRejectedHandler((lotIds) => refetchLots(queryClient, lotIds));
    realtime.start();

    return () => {
      realtime.setListener(null);
      realtime.setResumeRejectedHandler(null);
      realtime.stop();
    };
  }, [status, queryClient, showToast]);

  return <>{children}</>;
}
