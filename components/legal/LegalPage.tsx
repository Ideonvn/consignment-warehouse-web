import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Who stands behind the service, in one place. Both documents name the operator
 * and give the address for privacy, deletion and support requests; the Play
 * listing's privacy and deletion URLs point at these pages, so a stale value
 * here is a request that reaches nobody.
 */
export const OPERATOR_NAME = "Irithmetic Consulting";
export const CONTACT_EMAIL = "irithmetic@gmail.com";

export function LegalPage({
  title,
  effective,
  intro,
  children,
}: {
  title: string;
  effective: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 lg:py-12">
        <header className="mb-8 border-b border-border pb-6">
          <nav className="mb-4 text-sm text-text-muted" aria-label="Breadcrumb">
            <Link className="text-accent-text underline-offset-4 hover:underline" href="/">
              Consignment Warehouse
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span>{title}</span>
          </nav>

          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-text-muted">Effective {effective}</p>
          <p className="mt-5 text-base leading-7 text-text-muted">{intro}</p>
        </header>

        <article className="space-y-8">{children}</article>

        <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link className="text-accent-text underline-offset-4 hover:underline" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="text-accent-text underline-offset-4 hover:underline" href="/terms-of-service">
            Terms of Service
          </Link>
          <ContactEmail />
        </footer>
      </div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{heading}</h2>
      <div className="space-y-3 text-base leading-7 text-text-muted">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

export function ContactEmail({ subject }: { subject?: string }) {
  const href = `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a className="text-accent-text underline underline-offset-4" href={href}>
      {CONTACT_EMAIL}
    </a>
  );
}
