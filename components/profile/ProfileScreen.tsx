"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { logout, updateMe } from "@/lib/api/endpoints";
import { formatPhoneForDisplay } from "@/lib/auth/loginFlow";
import { useSession } from "@/lib/auth/session";
import { disconnectRealtime } from "@/lib/realtime/socket";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useToast } from "@/components/ui/Toast";
import { ThemeSetting } from "@/components/theme/ThemeSetting";
import { AccountSummaryLink } from "@/components/account/AccountSummaryLink";

export function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const endSession = useSession((state) => state.endSession);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      setUser(
        await updateMe({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
        }),
      );
      showToast({ title: "Profile saved", tone: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut(allDevices: boolean) {
    setSigningOut(true);
    try {
      await logout(allDevices);
    } catch {
      // The local session goes either way; a failed call just means the server
      // already considers this token dead.
    } finally {
      disconnectRealtime();
      queryClient.clear();
      endSession();
      setSigningOut(false);
      router.replace("/login");
    }
  }

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Profile" subtitle={formatPhoneForDisplay(user?.phone_e164 ?? "")} />

      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
        <Input
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <Input
          label="Last name"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
        <Input
          label="Email (optional)"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          hint="Used for win notifications and invoices."
        />
        <Button onClick={save} loading={saving} fullWidth>
          Save changes
        </Button>
      </div>

      <div className="mt-6">
        <AccountSummaryLink />
      </div>

      <div className="mt-6">
        <ThemeSetting />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="secondary" fullWidth loading={signingOut} onClick={() => signOut(false)}>
          Sign out
        </Button>
        <Button variant="ghost" fullWidth disabled={signingOut} onClick={() => signOut(true)}>
          Sign out on all devices
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        Bidders only ever see your pseudonymous handle, never your name or number.
      </p>
    </PhoneColumn>
  );
}
