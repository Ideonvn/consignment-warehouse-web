"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { requestOtp } from "@/lib/api/endpoints";
import { isValidE164, useLoginFlow } from "@/lib/auth/loginFlow";
import { DEFAULT_COUNTRY, type Country } from "@/lib/auth/countries";
import { toE164 } from "@/lib/auth/phone";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { PhoneField } from "@/components/auth/PhoneField";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { Wordmark } from "@/components/layout/Wordmark";

export function LoginPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const status = useSession((state) => state.status);
  const startVerification = useLoginFlow((state) => state.startVerification);

  // Country and national digits are kept apart: the field formats the national
  // part for the eye, and only `toE164` ever produces what the wire sees.
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const e164 = toE164(country, national);

    if (!isValidE164(e164)) {
      setError(`That number looks incomplete. Check the digits after +${country.dial}.`);
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
          <PhoneField
            country={country}
            national={national}
            onChange={(next) => {
              setCountry(next.country);
              setNational(next.national);
            }}
            autoFocus
            error={error}
            hint="We'll text a code to this number."
          />

          <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-6">
            Send code
          </Button>
        </form>
      </PhoneColumn>
    </main>
  );
}
