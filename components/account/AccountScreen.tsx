"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyAccount, getMyDeposit, logout, updateMe } from "@/lib/api/endpoints";
import { describeBalance } from "@/lib/format/account";
import { formatPhoneForDisplay } from "@/lib/auth/loginFlow";
import { useSession } from "@/lib/auth/session";
import { disconnectRealtime } from "@/lib/realtime/socket";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { Money } from "@/components/ui/Money";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { ThemeSetting } from "@/components/theme/ThemeSetting";
import { EmailVerification } from "@/components/profile/EmailVerification";
import { DeleteAccount } from "@/components/profile/DeleteAccount";
import { InvoicesSection } from "@/components/invoices/InvoicesSection";
import { cn } from "@/lib/utils/cn";

/**
 * One Account tab: the money and the profile, matching the mobile app screen
 * for screen. There was a `/profile` tab with `/account` pushed behind it and a
 * summary link between them; the app has always had a single tab, and the two
 * products are meant to behave the same.
 *
 * **Balance first, then deposit, then invoices — and the first is a reversal.**
 * The deposit used to lead, on the reasoning that "why can't I bid" is the
 * commoner question and the balance is never its answer. That still holds as a
 * statement about questions; it was outweighed on 2026-10-07 by what the screen
 * is for now that invoices exist. What somebody opens this screen to see is what
 * they owe. The deposit keeps its place ahead of invoices, so "can I bid" is
 * still answered before "what did you send me".
 *
 * **There is no statement.** A running ledger of every charge and payment was
 * here, paged, and is now gone outright rather than hidden: an invoice is the
 * document a bidder is actually billed against, and two renderings of the same
 * money — one of which nobody is billed against — is a question ("why does this
 * say something different?") with no good answer. `GET /me/account` is still
 * called for `balance_minor` and now asks for one entry rather than
 * twenty-five it would render nowhere.
 *
 * **The money tiles are summaries that open something.** The deposit's
 * movements live on `/account/deposit`; invoices preview three and open
 * `/account/invoices`.
 *
 * `MarketingPreferences` is deliberately not rendered; the component is kept
 * intact so restoring it is one line. Consent is still editable through the API
 * and nothing in the routing layer changed — a channel with no recorded opt-in
 * was already treated as a refusal.
 */
export function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const endSession = useSession((state) => state.endSession);

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [idNumber, setIdNumber] = useState(user?.id_number ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Only the balance is read here, so ask for the smallest page the endpoint allows.
  const account = useQuery({
    queryKey: ["account", "summary"],
    queryFn: () => getMyAccount({ limit: 1, offset: 0 }),
  });
  // Its own query, and it fails QUIETLY: the balance is this screen's reason for
  // existing and must not be taken down by the deposit call.
  const deposit = useQuery({
    queryKey: ["deposit", "summary"],
    queryFn: () => getMyDeposit({ limit: 1, offset: 0 }),
  });

  async function save() {
    setSaving(true);
    setError(null);
    try {
      setUser(
        await updateMe({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          id_number: idNumber.trim() || null,
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

  const balance = account.data?.data.balance_minor ?? 0;
  const currency = account.data?.data.currency_code ?? "ZAR";
  const standing = describeBalance(balance);

  return (
    <PhoneColumn className="pb-8">
      <ScreenHeader title="Account" subtitle={formatPhoneForDisplay(user?.phone_e164 ?? "")} />

      {account.isPending ? (
        <Skeleton className="h-32 w-full rounded-card" />
      ) : account.error ? (
        <ErrorState
          error={account.error}
          onRetry={() => void account.refetch()}
          title="Couldn't load your balance"
        />
      ) : (
        <section
          className={cn(
            "rounded-card border p-5",
            standing.tone === "due" ? "border-danger/40 bg-danger/5" : "border-border bg-surface",
          )}
        >
          <p className="text-xs tracking-wide text-text-muted uppercase">Your balance</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-4xl font-semibold",
                standing.tone === "due" ? "text-danger" : "text-accent-text",
              )}
            >
              <Money minor={standing.amountMinor} currency={currency} />
            </span>
            <span className="text-lg text-text-muted">{standing.headline}</span>
          </p>
          <p className="mt-2 text-sm text-text-muted">{standing.detail}</p>
        </section>
      )}

      {/* A summary that opens the real thing. The figure answers "can I bid";
          everything else — what a deposit is for, how to pay one in, where this
          one came from — is a tap away rather than four paragraphs here. */}
      {deposit.isPending ? (
        <Skeleton className="mt-4 h-28 w-full rounded-card" />
      ) : deposit.data ? (
        <Link
          href="/account/deposit"
          className="mt-4 block rounded-card border border-border bg-surface p-5 hover:border-border-strong"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-xs tracking-wide text-text-muted uppercase">Deposit held</span>
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5 shrink-0 text-text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M8 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="mt-1 block text-4xl font-semibold text-accent-text">
            <Money
              minor={deposit.data.data.held_minor}
              currency={deposit.data.data.currency_code}
            />
          </span>
          <span className="mt-2 block text-sm text-text-muted">
            {deposit.data.data.held_minor > 0
              ? "Held as your deposit, not spent. Tap for movements and how to pay more in."
              : "No deposit with us yet, so auctions that ask for one will refuse a bid. Tap to pay one in."}
          </span>
        </Link>
      ) : null}

      <InvoicesSection />

      <div className="mt-6 flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
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
        {/* Reads off the session user, which `save` replaces with the PATCH
            response — so changing an address shows as unverified immediately
            rather than keeping a stale tick until the next fetch. */}
        <EmailVerification />
        {/* Optional, and nothing in the product gates on it. The hint says what
            it is actually for rather than implying a verification step that
            does not exist — and says plainly that it lands on a document,
            because an invoice cannot be unprinted. Not `type="number"`: a
            passport number is a legitimate answer and a leading zero on an SA
            ID is significant. */}
        <Input
          label="ID or passport number (optional)"
          inputMode="text"
          autoComplete="off"
          value={idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
          hint="Printed on your invoices, which the warehouse needs for its records. Leave it blank and your invoices simply omit the row."
        />
        <Button onClick={save} loading={saving} fullWidth>
          Save changes
        </Button>
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
        Other bidders only ever see a handle like Bidder 872072 — never your name or number.
      </p>

      {/* Last on the screen, after signing out, because it is the one action here that cannot be
          undone. Required to be reachable in-app by both app stores. */}
      <div className="mt-8 border-t border-border pt-6">
        <DeleteAccount />
      </div>
    </PhoneColumn>
  );
}
