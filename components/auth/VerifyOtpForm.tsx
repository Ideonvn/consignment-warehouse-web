"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { getMe, requestOtp, verifyOtp } from "@/lib/api/endpoints";
import { getDeviceId, getDeviceName } from "@/lib/auth/device";
import { formatPhoneForDisplay, useLoginFlow } from "@/lib/auth/loginFlow";
import { OTP_CODE_LENGTH } from "@/lib/auth/otpCode";
import { isProfileComplete, useSession } from "@/lib/auth/session";
import { useNow } from "@/lib/hooks/useTicker";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/auth/OtpInput";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { Wordmark } from "@/components/layout/Wordmark";

const CODE_LENGTH = OTP_CODE_LENGTH;

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const phone = useLoginFlow((state) => state.phone);
  const resendAvailableAt = useLoginFlow((state) => state.resendAvailableAt);
  const noteResend = useLoginFlow((state) => state.noteResend);
  const resetFlow = useLoginFlow((state) => state.reset);
  const signIn = useSession((state) => state.signIn);
  const setUser = useSession((state) => state.setUser);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const now = useNow();
  const resendIn = now === null ? 0 : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    // A reload drops the pending number; start over rather than guess.
    if (!phone) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [phone, next, router]);

  const submit = useCallback(
    async (value: string) => {
      if (!phone || submitting) return;

      setSubmitting(true);
      setError(null);
      try {
        const tokens = await verifyOtp({
          phone,
          code: value,
          device_id: getDeviceId(),
          device_name: getDeviceName(),
        });

        signIn(tokens.access_token, null);
        const user = await getMe();
        setUser(user);
        resetFlow();

        router.replace(
          isProfileComplete(user) ? next : `/welcome?next=${encodeURIComponent(next)}`,
        );
      } catch (cause) {
        setCode("");
        if (cause instanceof ApiError && cause.status === 401) {
          setError("That code isn't right, or it has expired. Try again.");
        } else if (cause instanceof ApiError && cause.status === 403) {
          setError("This account has been suspended. Please contact support.");
        } else if (cause instanceof ApiError && cause.status === 429) {
          setError(`Too many attempts. Wait ${cause.retryAfter ?? 60}s and try again.`);
        } else {
          setError(cause instanceof Error ? cause.message : "Something went wrong.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [phone, submitting, signIn, setUser, resetFlow, router, next],
  );

  async function resend() {
    if (!phone || resendIn > 0) return;
    setResending(true);
    setError(null);
    try {
      await requestOtp(phone);
      noteResend(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) {
        noteResend(cause.retryAfter);
        setError("Too many codes requested. Please wait a moment.");
      } else {
        setError(cause instanceof Error ? cause.message : "Couldn't resend the code.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <PhoneColumn>
        <Wordmark className="mb-10" />

        <h1 className="text-3xl font-semibold tracking-tight">Enter your code</h1>
        <p className="mt-2 text-text-muted">
          Sent to <span className="tabular text-text">{formatPhoneForDisplay(phone ?? "")}</span>.{" "}
          <Link href="/login" className="text-accent-text underline underline-offset-4">
            Change
          </Link>
        </p>

        {/* The code boxes auto-submit when the last one is filled, but a form is
            what makes the keyboard's action key work for someone who typed the
            last digit and reached for it anyway. `submit` guards on `submitting`
            either way. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(code);
          }}
        >
          <div className="mt-8">
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              length={CODE_LENGTH}
              disabled={submitting}
              invalid={Boolean(error)}
            />
            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            className="mt-6"
            loading={submitting}
            disabled={code.length < CODE_LENGTH}
          >
            Verify
          </Button>
        </form>

        <Button
          variant="ghost"
          fullWidth
          className="mt-2"
          loading={resending}
          disabled={resendIn > 0}
          onClick={resend}
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </Button>
      </PhoneColumn>
    </main>
  );
}
