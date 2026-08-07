import type { Metadata } from "next";
import { Suspense } from "react";
import { WelcomeForm } from "@/components/auth/WelcomeForm";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <AuthGuard requireProfile={false}>
        <WelcomeForm />
      </AuthGuard>
    </Suspense>
  );
}
