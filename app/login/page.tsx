import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPhoneForm } from "@/components/auth/LoginPhoneForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPhoneForm />
    </Suspense>
  );
}
