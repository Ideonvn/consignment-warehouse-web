import { create } from "zustand";
import { clearBrowseSessions } from "@/lib/browse/browseSession";
import type { User } from "@/types/api";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

/**
 * A hint that this device had a session recently. **Not authority** — it grants
 * nothing and is never read by anything that decides access.
 *
 * It exists because the refresh cookie is HttpOnly on the API's own origin, so
 * neither the server nor the client can tell whether a visitor is signed in
 * until the refresh call returns. Without a hint, every shared link would have
 * to pick one wrong first paint: a skeleton for the strangers this is built
 * for, or a flash of the anonymous view for members. With it, each gets the
 * loading state that matches them, and the worst case is the wrong one.
 */
const SESSION_HINT_KEY = "cw.had_session";

export function noteSessionHint(): void {
  try {
    window.localStorage.setItem(SESSION_HINT_KEY, "1");
  } catch {
    // A blocked storage costs a nicer first paint, nothing else.
  }
}

function clearSessionHint(): void {
  try {
    window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // As above.
  }
}

export function hadSessionRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

type SessionState = {
  status: SessionStatus;
  /** In memory only — never localStorage, which any injected script can read. */
  accessToken: string | null;
  user: User | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  signIn: (token: string, user: User | null) => void;
  endSession: () => void;
};

export const useSession = create<SessionState>((set) => ({
  status: "loading",
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => {
    noteSessionHint();
    set({ user, status: "authenticated" });
  },
  signIn: (accessToken, user) =>
    set({ accessToken, user, status: user ? "authenticated" : "loading" }),
  endSession: () => {
    /*
     * Browse state goes with the session, wherever the session ends — the
     * profile's sign-out, a failed refresh, or bootstrap finding no cookie.
     *
     * It is memory-only, so it would otherwise outlive a sign-out in the same
     * tab and the next person on a shared device would inherit the previous
     * one's skips and undo history. Undoing into an inherited entry would send
     * `DELETE /swipe` for a lot this user never touched.
     */
    clearBrowseSessions();
    // Alongside the browse state, and for the same reason: this runs on a failed
    // refresh too, not just the sign-out button, so the hint dies with the
    // session rather than outliving it and choosing a skeleton forever.
    clearSessionHint();
    set({ accessToken: null, user: null, status: "anonymous" });
  },
}));

export function getAccessToken(): string | null {
  return useSession.getState().accessToken;
}

/** True once the user has a name; new accounts land on /welcome first. */
export function isProfileComplete(user: User | null): boolean {
  return Boolean(user?.first_name && user.first_name.trim().length > 0);
}
