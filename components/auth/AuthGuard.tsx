"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isProfileComplete, useSession } from "@/lib/auth/session";
import { isPublicPath } from "@/lib/auth/publicPaths";
import { Skeleton } from "@/components/ui/Skeleton";
import { PhoneColumn } from "@/components/layout/PhoneColumn";

/**
 * Gates authenticated surfaces. An unauthenticated visitor is sent to /login
 * with their intended destination preserved, so the round trip lands them where
 * they were going.
 *
 * The exception is the handful of paths in `lib/auth/publicPaths.ts`, which
 * anonymous visitors are allowed to see. The guard stays here in the layout so
 * that anything new is private by default; opening a route is an edit to that
 * allowlist, which reads as a statement of intent.
 */
export function AuthGuard({
  children,
  requireProfile = true,
}: {
  children: ReactNode;
  requireProfile?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    // An anonymous visitor on a public path is not lost — they are the audience.
    if (status === "anonymous" && isPublic) return;
    if (status === "anonymous") {
      const query = searchParams.toString();
      const intended = query.length > 0 ? `${pathname}?${query}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(intended)}`);
      return;
    }
    if (status === "authenticated" && requireProfile && !isProfileComplete(user)) {
      router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, user, isPublic, requireProfile, router, pathname, searchParams]);

  if (status === "anonymous" && isPublic) return <>{children}</>;
  if (status !== "authenticated") return <AuthGuardSkeleton />;
  if (requireProfile && !isProfileComplete(user)) return <AuthGuardSkeleton />;

  return <>{children}</>;
}

function AuthGuardSkeleton() {
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
