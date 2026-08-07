import type { ReactNode } from "react";
import Link from "next/link";

export function ScreenHeader({
  title,
  subtitle,
  action,
  backHref,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pt-4 pb-3">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-flex min-h-11 items-center gap-1 text-sm text-text-muted hover:text-text"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </Link>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-text-muted">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </header>
  );
}
