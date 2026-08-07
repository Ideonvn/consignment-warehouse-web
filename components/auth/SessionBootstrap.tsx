"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { refreshAccessToken } from "@/lib/api/client";
import { getMe } from "@/lib/api/endpoints";
import { useSession } from "@/lib/auth/session";

/**
 * Restores a session on first load. The access token lives in memory only, so
 * after a reload the HttpOnly refresh cookie is the only thing left — one
 * refresh, then fetch the user.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const { setUser, endSession } = useSession.getState();

    void (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        endSession();
        return;
      }
      try {
        setUser(await getMe());
      } catch {
        endSession();
      }
    })();
  }, []);

  return <>{children}</>;
}
