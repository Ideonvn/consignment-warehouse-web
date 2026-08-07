"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useRealtimeStatus } from "@/lib/realtime/store";

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Quiet when healthy, honest when not: offline first, then a degraded live
 * connection. Never both, and never a permanent badge.
 */
export function ConnectionBanner() {
  const queryClient = useQueryClient();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const realtime = useRealtimeStatus();

  useEffect(() => {
    // Coming back from offline: everything on screen is suspect.
    if (online) void queryClient.invalidateQueries();
  }, [online, queryClient]);

  const message =
    !online ? "You're offline — prices may be out of date."
    : realtime === "reconnecting" ? "Reconnecting to live updates…"
    : realtime === "offline" ? "Live updates paused. Pull to refresh for the latest."
    : null;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="sticky top-0 z-30 overflow-hidden bg-surface-raised text-center"
        >
          <p className="px-4 py-2 text-xs text-text-muted">{message}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
