import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyOtpForm } from "@/components/auth/VerifyOtpForm";

export const metadata: Metadata = { title: "Enter your code" };

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}
