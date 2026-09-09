"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError, SessionExpiredError } from "@/lib/api/errors";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        /**
         * One retry rule for the whole app. Query-level `retry` overrides this
         * wholesale rather than composing with it, so a local predicate is a
         * second copy of this reasoning — and this rule was independently
         * rediscovered twice, for different status codes, before it was moved
         * here. Add a status to the list below, not a predicate to a hook.
         */
        retry: (failureCount, error) => {
          // Checked first because it does not necessarily carry a status of its
          // own to test: the session is over and no amount of asking revives it.
          if (error instanceof SessionExpiredError) return false;

          // **A 4xx is the server having considered the request and declined
          // it.** Retrying asks the same question and expects a different
          // answer — a 404 on a private auction, a 403 for a deposit not yet
          // paid, a 409 on a lot that has closed, a 422 on a search term or a
          // stale cursor. None of them change in the 200ms before the next try;
          // all it buys is three requests where one was the answer, and a
          // delay before the user is told.
          //
          // **A 429 in particular cannot be helped by retrying, and that is
          // measured rather than assumed.** Every limiter in this API goes
          // through one helper that sets the key's TTL only on the first write
          // — a fixed window, not a sliding one — so the window is 60s while
          // React Query's backoff is ~1s then ~2s. Both retries land well
          // inside the same window and are refused by construction: three
          // requests, two backoff delays, and the user told no sooner than if
          // we had shown them the first answer. (Checked against the running
          // API: `Retry-After` read 60s, and still 60s after two retry-shaped
          // requests. Against a *sliding* window it would be worse than futile
          // — each retry would push the user's own wait further out — which is
          // the reason not to relax this rule for 429 later.)
          //
          // **408 is the one 4xx that plausibly self-heals**, and it is ruled
          // out here rather than overlooked: this API never emits one. FastAPI
          // has no path that returns 408, and Caddy answers a timed-out
          // upstream with 504 — a 5xx, which this rule retries. So a blanket
          // "no 4xx" is right *for this API*; it would not be right in front of
          // one that does emit 408.
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }

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
      <ThemeProvider>
        <ToastProvider>
          <SessionBootstrap>{children}</SessionBootstrap>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
