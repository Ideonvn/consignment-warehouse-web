import Link from "next/link";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center">
      <PhoneColumn className="text-center">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-text-muted">
          That page, lot or auction isn&apos;t here any more.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink"
        >
          Back to auctions
        </Link>
      </PhoneColumn>
    </main>
  );
}
