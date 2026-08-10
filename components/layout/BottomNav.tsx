"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Extra path prefixes that should light this tab up. */
  matches?: string[];
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Stack",
    matches: ["/auctions", "/lots"],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="6" y="3.5" width="12" height="14" rx="3" opacity="0.45" />
        <rect x="3.5" y="6.5" width="17" height="14" rx="3" />
      </svg>
    ),
  },
  {
    href: "/my-bids",
    label: "My bids",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 19h16" strokeLinecap="round" />
        <path d="M7 15V9M12 15V5M17 15v-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 19.5a7 7 0 0 1 14 0" strokeLinecap="round" />
      </svg>
    ),
  },
];

function isActive(pathname: string, tab: Tab): boolean {
  if (tab.href === "/") {
    return pathname === "/" || (tab.matches ?? []).some((prefix) => pathname.startsWith(prefix));
  }
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-(--app-width) items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] font-medium transition-colors",
                  active ? "text-accent-text" : "text-text-muted hover:text-text",
                )}
              >
                <span className="h-6 w-6">{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
