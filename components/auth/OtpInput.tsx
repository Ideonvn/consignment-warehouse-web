"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Fired once the last box is filled. */
  onComplete: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
};

/** Separate boxes, with paste and auto-advance — the pattern people expect. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 4,
  disabled = false,
  invalid = false,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === length && completedFor.current !== value) {
      completedFor.current = value;
      onComplete(value);
    }
    if (value.length < length) completedFor.current = null;
  }, [value, length, onComplete]);

  function focusBox(index: number) {
    inputs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  }

  function setDigit(index: number, digit: string) {
    const next = value.padEnd(length, " ").split("");
    next[index] = digit;
    onChange(next.join("").replace(/\s+$/, "").replace(/\s/g, ""));
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        focusBox(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (digits.length === 0) return;
    onChange(digits);
    focusBox(digits.length);
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={value[index] ?? ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            if (digits.length === 0) return;
            if (digits.length > 1) {
              onChange(digits.slice(0, length));
              focusBox(digits.length);
              return;
            }
            setDigit(index, digits);
            focusBox(index + 1);
          }}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          inputMode="numeric"
          enterKeyHint="go"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "tabular h-16 w-full rounded-2xl border bg-surface-raised text-center text-2xl font-semibold",
            "outline-none focus:border-accent-text disabled:opacity-50",
            invalid ? "border-danger/60" : "border-border-strong",
          )}
        />
      ))}
    </div>
  );
}
