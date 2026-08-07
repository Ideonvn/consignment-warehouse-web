import { PhoneColumn } from "@/components/layout/PhoneColumn";
import { Skeleton } from "@/components/ui/Skeleton";

/** Route-level fallback: a shape of the screen, never a full-page spinner. */
export default function Loading() {
  return (
    <PhoneColumn className="py-6">
      <span className="sr-only" role="status">
        Loading
      </span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-64 w-full rounded-card" />
      <Skeleton className="mt-4 h-24 w-full rounded-card" />
    </PhoneColumn>
  );
}
