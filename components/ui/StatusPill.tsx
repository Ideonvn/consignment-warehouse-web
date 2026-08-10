import { cn } from "@/lib/utils/cn";

type Tone = "live" | "muted" | "danger" | "success";

const TONES: Record<Tone, string> = {
  live: "border-accent-text/40 bg-accent/10 text-accent-text",
  muted: "border-border bg-surface-raised text-text-muted",
  danger: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success",
};

export function StatusPill({
  children,
  tone = "muted",
  pulse = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  /** The live dot — the one place a heartbeat is justified. */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {pulse ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current animate-live" />
      ) : null}
      {children}
    </span>
  );
}
