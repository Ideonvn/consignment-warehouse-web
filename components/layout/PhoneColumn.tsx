import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** On desktop the app stays a phone-width column rather than stretching. */
export function PhoneColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-(--app-width) px-4", className)}>{children}</div>
  );
}
