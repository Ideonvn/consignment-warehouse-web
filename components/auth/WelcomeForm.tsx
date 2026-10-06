"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateMe } from "@/lib/api/endpoints";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

export function WelcomeForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [idNumber, setIdNumber] = useState(user?.id_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (firstName.trim().length === 0) {
      setError("Please tell us your first name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      setUser(
        await updateMe({
          first_name: firstName.trim(),
          last_name: lastName.trim() === "" ? null : lastName.trim(),
          id_number: idNumber.trim() === "" ? null : idNumber.trim(),
        }),
      );
      router.replace(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center py-12">
      <PhoneColumn>
        <h1 className="text-3xl font-semibold tracking-tight">What should we call you?</h1>
        <p className="mt-2 text-text-muted">
          Other bidders only see a handle like Bidder 872072 — this is for us.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          <Input
            label="First name"
            autoComplete="given-name"
            autoFocus
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            error={error}
          />
          <Input
            label="Last name (optional)"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          {/* Asked here because signing up is the one moment someone is willing to type it,
              and an invoice that has to print it cannot ask retrospectively. It stays
              OPTIONAL and `isProfileComplete` still turns on the first name alone — nothing
              in the product gates on an ID, so blocking the app over one would be a lie
              about what it is for. The hint says what it does and where it ends up; the
              same field and the same words are on /profile. */}
          <Input
            label="ID or passport number (optional)"
            inputMode="text"
            autoComplete="off"
            value={idNumber}
            onChange={(event) => setIdNumber(event.target.value)}
            hint="Printed on your invoices, which the warehouse needs for its records. You can add it later from your profile."
          />

          <Button type="submit" size="lg" fullWidth loading={saving} className="mt-2">
            Start bidding
          </Button>
        </form>
      </PhoneColumn>
    </main>
  );
}
