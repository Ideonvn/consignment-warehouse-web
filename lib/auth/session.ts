import { create } from "zustand";
import type { User } from "@/types/api";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

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
  setUser: (user) => set({ user, status: "authenticated" }),
  signIn: (accessToken, user) =>
    set({ accessToken, user, status: user ? "authenticated" : "loading" }),
  endSession: () => set({ accessToken: null, user: null, status: "anonymous" }),
}));

export function getAccessToken(): string | null {
  return useSession.getState().accessToken;
}

/** True once the user has a name; new accounts land on /welcome first. */
export function isProfileComplete(user: User | null): boolean {
  return Boolean(user?.first_name && user.first_name.trim().length > 0);
}
