"use client";

import { useMemo, useState } from "react";
import { setNotificationPreferences } from "@/lib/api/endpoints";
import { useSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format/time";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import type { NotificationChannel, NotificationPreference } from "@/types/api";

const CHANNELS: { channel: NotificationChannel; label: string }[] = [
  { channel: "email", label: "Email" },
  { channel: "sms", label: "SMS" },
  { channel: "whatsapp", label: "WhatsApp" },
];

/**
 * Marketing consent only.
 *
 * The framing is the point: someone who believes they have muted everything and
 * then misses being outbid is a support call nobody can answer well. So the
 * screen says out loud, twice, that auction messages are not what these control.
 *
 * An empty `notification_preferences` means nobody has ever asked — which reads
 * as "Not set", never as a refusal.
 */
export function MarketingPreferences() {
  const user = useSession((state) => state.user);
  const setUser = useSession((state) => state.setUser);
  const { showToast } = useToast();

  const [draft, setDraft] = useState<Partial<Record<NotificationChannel, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saved = useMemo(() => {
    const map = new Map<NotificationChannel, NotificationPreference>();
    for (const row of user?.notification_preferences ?? []) map.set(row.channel, row);
    return map;
  }, [user]);

  // Only what the user actually moved: the server leaves omitted channels alone,
  // so restating the other two would stamp a consent date on choices they never
  // made.
  const changed = CHANNELS.filter(
    ({ channel }) => draft[channel] !== undefined && draft[channel] !== saved.get(channel)?.marketing_opt_in,
  ).map(({ channel }) => channel);

  async function save() {
    if (changed.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = Object.fromEntries(changed.map((channel) => [channel, draft[channel]!]));
      setUser(await setNotificationPreferences(body));
      setDraft({});
      showToast({ title: "Preferences saved", tone: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Marketing messages</h2>
      <p className="mt-1 text-sm text-text-muted">
        Catalogue announcements and news about upcoming auctions. Choose where we may send them.
      </p>

      <div className="mt-3 divide-y divide-border">
        {CHANNELS.map(({ channel, label }) => {
          const row = saved.get(channel);
          const value = draft[channel] ?? row?.marketing_opt_in ?? false;
          const status =
            draft[channel] !== undefined && draft[channel] !== row?.marketing_opt_in
              ? "Not saved yet"
              : row
                ? row.marketing_opt_in
                  ? `On since ${formatDateTime(row.consent_at ?? user.created_at)}`
                  : `Off since ${formatDateTime(row.consent_at ?? user.created_at)}`
                : "Not set — we haven't asked yet";

          return (
            <Switch
              key={channel}
              label={label}
              description={status}
              checked={value}
              disabled={saving}
              onChange={(next) => setDraft((current) => ({ ...current, [channel]: next }))}
            />
          );
        })}
      </div>

      <p className="mt-3 rounded-2xl border border-border bg-surface-raised p-3 text-xs text-text-muted">
        <span className="font-semibold text-text">These are marketing only.</span> Messages about
        your bidding — outbid alerts, lots you’ve won, what you owe and how to pay — are always
        sent and cannot be switched off here.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        className="mt-3"
        // Nothing to save is the resting state of this card, so it shouldn't sit
        // there looking like a greyed-out call to action.
        variant={changed.length === 0 ? "secondary" : "primary"}
        fullWidth
        loading={saving}
        disabled={changed.length === 0}
        onClick={save}
      >
        {changed.length === 0 ? "Saved" : `Save ${changed.length === 1 ? "change" : "changes"}`}
      </Button>
    </section>
  );
}
