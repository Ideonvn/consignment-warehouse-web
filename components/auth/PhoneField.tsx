"use client";

import { useId, useMemo, useState } from "react";
import { COUNTRIES, flagEmoji, type Country } from "@/lib/auth/countries";
import { formatNational, parseEntry } from "@/lib/auth/phone";
import { cn } from "@/lib/utils/cn";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Country prefix plus a grouped national number. The grouping is presentation
 * only — `lib/auth/phone.ts` composes the E.164 string that goes on the wire,
 * and the backend, which infers nothing, gets exactly that.
 */
export function PhoneField({
  country,
  national,
  onChange,
  error,
  hint,
  autoFocus = false,
}: {
  country: Country;
  national: string;
  onChange: (next: { country: Country; national: string }) => void;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length === 0) return COUNTRIES;
    const digits = term.replace(/\D/g, "");
    return COUNTRIES.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.iso.toLowerCase() === term ||
        (digits.length > 0 && row.dial.startsWith(digits)),
    );
  }, [search]);

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-text-muted">
        Mobile number
      </label>

      <div
        className={cn(
          "field flex items-stretch rounded-2xl border bg-surface-raised",
          "focus-within:border-accent-text/60",
          error ? "border-danger/60" : "border-border-strong",
        )}
      >
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setPicking(true);
          }}
          aria-label={`Country: ${country.name}, +${country.dial}. Change`}
          // The field's ring covers the whole wrapper, so the selector needs its
          // own mark to say which half of the field the keyboard is on.
          className="flex shrink-0 items-center gap-1.5 rounded-l-2xl pr-2 pl-4 text-text hover:bg-surface focus-visible:bg-surface"
        >
          <span aria-hidden className="text-lg leading-none">
            {/* An unrecognised dial code has no flag to show — and no code to
                show either, because the number itself carries it. */}
            {country.iso === "" ? "🌐" : flagEmoji(country.iso)}
          </span>
          <span className="tabular text-base">+{country.dial}</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span aria-hidden className="my-3 w-px shrink-0 bg-border" />

        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="go"
          autoFocus={autoFocus}
          value={formatNational(national, country)}
          onChange={(event) => onChange(parseEntry(event.target.value, country))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          placeholder={country.iso === "ZA" ? "82 123 4567" : "Phone number"}
          className="tabular min-h-14 w-full bg-transparent px-3 text-base text-text outline-none placeholder:text-text-muted/60"
        />
      </div>

      {hint && !error ? (
        <p id={`${inputId}-hint`} className="mt-2 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose your country">
        <div className="px-5 pb-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search country or code"
            aria-label="Search country or dial code"
            className="field min-h-12 w-full rounded-2xl border border-border-strong bg-surface-raised px-4 text-base outline-none placeholder:text-text-muted/60"
          />

          <ul className="mt-3 flex flex-col">
            {matches.map((row) => (
              <li key={row.iso}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ country: row, national });
                    setPicking(false);
                  }}
                  aria-current={row.iso === country.iso || undefined}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left",
                    row.iso === country.iso ? "bg-accent/10 text-accent-text" : "hover:bg-surface-raised",
                  )}
                >
                  <span aria-hidden className="text-lg">
                    {flagEmoji(row.iso)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
                  <span className="tabular shrink-0 text-sm text-text-muted">+{row.dial}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-text-muted">
                No match. You can still type your number with its `+` code — we&apos;ll send it as
                you write it.
              </li>
            ) : null}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
