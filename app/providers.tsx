"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionExpiredError } from "@/lib/api/errors";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";
import { ToastProvider } from "@/components/ui/Toast";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // A dead session or a rejected request will not fix itself.
          if (error instanceof SessionExpiredError) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionBootstrap>{children}</SessionBootstrap>
      </ToastProvider>
    </QueryClientProvider>
  );
}
