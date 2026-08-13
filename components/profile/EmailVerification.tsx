"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { requestEmailVerification, verifyEmail } from "@/lib/api/endpoints";
import { OTP_CODE_LENGTH } from "@/lib/auth/otpCode";
import { useSession } from "@/lib/auth/session";
import { useNow } from "@/lib/hooks/useTicker";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Used only when a 429 arrives without a usable `Retry-After`. */
const FALLBACK_RESEND_SECONDS = 60;

/**
 * The email limiter counts per hour, so its `Retry-After` is measured in
 * thousands of seconds. "3591s" is not a wait anyone can picture.
 */
function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

/**
 * An address has three states worth telling apart, and the middle one is the
 * dangerous one: **verified but bouncing** looks fine to the user while nothing
 * is delivered. Everything here is phrased as consequence — what will and won't
 * reach them — rather than as compliance.
 */
export function EmailVerification() {
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const { showToast } = useToast();

  const [code, setCode] = useState("");
  const [entering, setEntering] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);

  const now = useNow();
  const waitSeconds = now === null ? 0 : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      await requestEmailVerification();
      setEntering(true);
      setCode("");
      setResendAvailableAt(Date.now() + FALLBACK_RESEND_SECONDS * 1000);
      showToast({ title: "Code sent", description: "Check your email.", tone: "neutral" });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) {
        // Separate ceiling from the login OTP, and per address as well as per
        // user — so the wait is whatever this limiter says, not the login one.
        const seconds = cause.retryAfter ?? FALLBACK_RESEND_SECONDS;
        setResendAvailableAt(Date.now() + seconds * 1000);
        setError(`Too many codes requested. Try again in ${formatWait(seconds)}.`);
      } else {
        setError(cause instanceof Error ? cause.message : "Couldn't send that code.");
      }
    } finally {
      setSending(false);
    }
  }, [showToast]);

  const submit = useCallback(
    async (value: string) => {
      if (verifying) return;
      setVerifying(true);
      setError(null);
      try {
        setUser(await verifyEmail(value));
        setEntering(false);
        setCode("");
        showToast({ title: "Email verified", tone: "success" });
      } catch (cause) {
        setCode("");
        setError(
          cause instanceof ApiError && cause.status === 422
            ? "That code isn't right, or it has expired. Send a new one."
            : cause instanceof Error
              ? cause.message
              : "Couldn't verify that code.",
        );
      } finally {
        setVerifying(false);
      }
    },
    [verifying, setUser, showToast],
  );

  if (!user) return null;

  const address = user.email;
  const verified = Boolean(user.email_verified_at);
  const bounced = Boolean(user.email_bounced_at);

  if (!address) {
    return (
      <p className="mt-2 text-xs text-text-muted">
        No email on your account — everything goes to you by SMS. Add one above if you’d rather
        have invoices and win notices by email.
      </p>
    );
  }

  // Bouncing beats verified: the address is routable on paper and silent in
  // practice, and only correcting it fixes that — a fresh code would not.
  if (bounced) {
    return (
      <section className="mt-3 rounded-2xl border border-danger/40 bg-danger/10 p-3">
        <p className="text-sm font-semibold text-danger">Email to this address is failing</p>
        <p className="mt-1 text-sm text-text-muted">
          Mail we send to <span className="text-text">{address}</span> is bouncing back, so nothing
          is reaching you there. We’re texting you instead. Correct the address above and we’ll
          verify the new one.
        </p>
      </section>
    );
  }

  if (verified) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M4 13l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Email verified
      </p>
    );
  }

  return (
    <section className="mt-3 rounded-2xl border border-border bg-surface-raised p-3">
      <p className="text-sm font-semibold">Email not verified</p>
      <p className="mt-1 text-sm text-text-muted">
        We only send to an address once it’s confirmed, so until then everything — outbid alerts,
        wins, payment details — goes to you by SMS.
      </p>

      {entering ? (
        <div className="mt-3">
          <p className="text-xs text-text-muted">
            Enter the {OTP_CODE_LENGTH}-digit code we sent to{" "}
            <span className="text-text">{address}</span>.
          </p>
          <div className="mt-2">
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              length={OTP_CODE_LENGTH}
              disabled={verifying}
              invalid={Boolean(error)}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              fullWidth
              loading={verifying}
              disabled={code.length < OTP_CODE_LENGTH}
              onClick={() => submit(code)}
            >
              Verify
            </Button>
            <Button
              variant="ghost"
              loading={sending}
              disabled={waitSeconds > 0 || verifying}
              onClick={send}
            >
              {waitSeconds > 0 ? `Resend in ${formatWait(waitSeconds)}` : "Resend"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="mt-3"
          fullWidth
          loading={sending}
          disabled={waitSeconds > 0}
          onClick={send}
        >
          {waitSeconds > 0 ? `Try again in ${formatWait(waitSeconds)}` : "Send a verification code"}
        </Button>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
