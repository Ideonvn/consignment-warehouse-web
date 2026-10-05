"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { deleteMe } from "@/lib/api/endpoints";
import { AccountNotDeletableError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { disconnectRealtime } from "@/lib/realtime/socket";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Closing the account. Irreversible, so the sheet says what actually happens rather than asking
 * "are you sure?" — a confirmation nobody can act on is just a speed bump.
 *
 * **What it honestly cannot promise is deletion of everything.** Bids and ledger entries are
 * financial records the law requires keeping, and the backend could not remove them even if it
 * wanted to. So the copy says what goes and what stays, in those words. Claiming "all your data
 * is deleted" would be the easy wording and a false one.
 */
export function DeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const endSession = useSession((state) => state.endSession);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<AccountNotDeletableError | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setBlocked(null);
    setError(null);
    try {
      await deleteMe();
    } catch (cause) {
      if (cause instanceof AccountNotDeletableError) {
        setBlocked(cause);
      } else {
        setError(cause instanceof Error ? cause.message : "Couldn't close the account.");
      }
      setBusy(false);
      return;
    }
    // The token is dead the moment that returns, so nothing is retried and nothing is refetched.
    disconnectRealtime();
    queryClient.clear();
    endSession();
    router.replace("/login");
  }

  return (
    <>
      <Button
        variant="danger"
        fullWidth
        onClick={() => {
          setBlocked(null);
          setError(null);
          setOpen(true);
        }}
      >
        Close my account
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Close your account">
        <div className="px-5 pt-2 pb-6">
          {blocked ? (
            <Blocked blocked={blocked} onClose={() => setOpen(false)} />
          ) : (
            <>
              <p className="text-sm text-text-muted">
                This cannot be undone. You can sign up again with the same number afterwards, but it
                will be a new account with nothing carried over.
              </p>

              <div className="mt-4 rounded-2xl border border-border bg-surface-raised p-4 text-sm">
                <p className="font-semibold">What is removed</p>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-text-muted">
                  <li>Your name, email address and phone number</li>
                  <li>Any addresses you have saved</li>
                  <li>Your notification settings and message history</li>
                  <li>Every signed-in device</li>
                </ul>

                <p className="mt-4 font-semibold">What is kept</p>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-text-muted">
                  <li>
                    Your bids, and the lots you won or paid for. These are financial records and we
                    are required to keep them.
                  </li>
                </ul>
                <p className="mt-2 text-xs text-text-muted">
                  They are no longer connected to your name or your number. Bid histories already
                  only ever showed a handle.
                </p>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-2xl border border-danger/40 bg-danger/5 p-3 text-sm text-danger"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-6 flex flex-col gap-2">
                <Button variant="danger" size="lg" fullWidth loading={busy} onClick={confirm}>
                  Close my account permanently
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Keep my account
                </Button>
              </div>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

/**
 * The refusal, as the three things it can actually be. Every non-zero blocker is listed, because
 * the server sends them all at once precisely so nobody has to come back twice.
 */
function Blocked({
  blocked,
  onClose,
}: {
  blocked: AccountNotDeletableError;
  onClose: () => void;
}) {
  const currency = blocked.currencyCode;
  const owes = blocked.balanceMinor < 0;
  const inCredit = blocked.balanceMinor > 0;

  return (
    <>
      <p className="text-lg font-semibold">There&apos;s something to settle first</p>
      <p className="mt-2 text-sm text-text-muted">
        We can&apos;t close an account while money or a live bid is outstanding — that would leave
        it unresolved for both of us.
      </p>

      <ul className="mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface-raised p-4 text-sm">
        {owes ? (
          <li>
            <span className="font-semibold">
              <Money minor={Math.abs(blocked.balanceMinor)} currency={currency} /> owing
            </span>
            <span className="block text-text-muted">
              Settle this with the warehouse and the account can be closed.
            </span>
          </li>
        ) : null}
        {inCredit ? (
          <li>
            <span className="font-semibold">
              <Money minor={blocked.balanceMinor} currency={currency} /> in credit
            </span>
            <span className="block text-text-muted">
              This is money we owe you. Contact the warehouse to have it paid back rather than
              losing it.
            </span>
          </li>
        ) : null}
        {blocked.depositHeldMinor > 0 ? (
          <li>
            <span className="font-semibold">
              <Money minor={blocked.depositHeldMinor} currency={currency} /> deposit held
            </span>
            <span className="block text-text-muted">
              Ask the warehouse to return your deposit first.
            </span>
          </li>
        ) : null}
        {blocked.liveBidCount > 0 ? (
          <li>
            <span className="font-semibold">
              {blocked.liveBidCount} bid{blocked.liveBidCount === 1 ? "" : "s"} still live
            </span>
            <span className="block text-text-muted">
              You could still win {blocked.liveBidCount === 1 ? "it" : "one of them"}. Wait for
              {blocked.liveBidCount === 1 ? " that lot" : " those lots"} to close.
            </span>
          </li>
        ) : null}
      </ul>

      <Button variant="secondary" size="lg" fullWidth className="mt-6" onClick={onClose}>
        Done
      </Button>
    </>
  );
}
