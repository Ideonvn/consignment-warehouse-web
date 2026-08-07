"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { requestOtp } from "@/lib/api/endpoints";
import { isValidE164, normalisePhone, useLoginFlow } from "@/lib/auth/loginFlow";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { Wordmark } from "@/components/layout/Wordmark";

export function LoginPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const status = useSession((state) => state.status);
  const startVerification = useLoginFlow((state) => state.startVerification);

  const [phone, setPhone] = useState("+27");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const e164 = normalisePhone(phone);

    if (!isValidE164(e164)) {
      setError("Enter your number in full international format, e.g. +27 82 123 4567.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(e164);
      // The response is identical whether or not the number is registered, and
      // the UI must not imply otherwise.
      startVerification(e164, null);
      router.push(`/login/verify?next=${encodeURIComponent(next)}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 429) {
        const wait = cause.retryAfter ?? 60;
        setError(`Too many attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`);
        startVerification(e164, wait);
      } else if (cause instanceof ApiError && cause.status === 422) {
        setError("That doesn't look like a valid phone number.");
      } else {
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <PhoneColumn>
        <Wordmark className="mb-10" />

        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-text-muted">
          We&apos;ll text you a code. No password to forget.
        </p>

        <form onSubmit={onSubmit} className="mt-8" noValidate>
          <Input
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={error}
            hint="Include your country code — for South Africa that's +27."
            placeholder="+27 82 123 4567"
          />

          <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-6">
            Send code
          </Button>
        </form>
      </PhoneColumn>
    </main>
  );
}
