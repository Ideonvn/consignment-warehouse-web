import { create } from "zustand";

type LoginFlowState = {
  /** E.164 number the OTP was sent to. Kept out of the URL. */
  phone: string | null;
  /** Epoch ms when a resend becomes allowed, driven by `Retry-After`. */
  resendAvailableAt: number;
  startVerification: (phone: string, retryAfterSeconds: number | null) => void;
  noteResend: (retryAfterSeconds: number | null) => void;
  reset: () => void;
};

const DEFAULT_RESEND_SECONDS = 60;

export const useLoginFlow = create<LoginFlowState>((set) => ({
  phone: null,
  resendAvailableAt: 0,
  startVerification: (phone, retryAfterSeconds) =>
    set({
      phone,
      resendAvailableAt: Date.now() + (retryAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000,
    }),
  noteResend: (retryAfterSeconds) =>
    set({ resendAvailableAt: Date.now() + (retryAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000 }),
  reset: () => set({ phone: null, resendAvailableAt: 0 }),
}));

/** Digits typed by a human into an E.164 number the backend will accept. */
export function normalisePhone(raw: string): string {
  const trimmed = raw.replace(/[^\d+]/g, "");
  if (trimmed.startsWith("+")) return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  // A local "0821234567" is a South African number with the trunk 0 dropped.
  if (trimmed.startsWith("0")) return `+27${trimmed.slice(1)}`;
  return `+${trimmed}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** "+27 82 123 4567" — display only; the wire always gets the raw E.164. */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone.startsWith("+27") || phone.length !== 12) return phone;
  return `+27 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
}
