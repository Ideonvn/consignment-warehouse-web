import type { ZodType } from "zod";
import { ApiError, NetworkError, ResponseShapeError, toApiError } from "@/lib/api/errors";
import { API_BASE_URL } from "@/lib/api/apiBaseUrl";

/**
 * The anonymous client. Deliberately its own module, not a flag on
 * `lib/api/client.ts`.
 *
 * Four reasons, and the first is the one that would have hurt:
 *
 * 1. **This runs on the server.** `generateMetadata` fetches a lot in Node, and
 *    the authenticated client reaches into `useSession.getState()` and
 *    `recordServerDate()` — module-level state that, in a server process, is
 *    shared by every request being handled at once. One visitor's clock offset
 *    or session write would leak into another's request.
 * 2. **No cookies.** The authenticated client sends `credentials: "include"`
 *    unconditionally to carry the refresh cookie; a public request has nothing
 *    to carry and no reason to be a credentialed cross-origin call.
 * 3. **The refresh path must be unreachable, not merely untaken.** A 404 from a
 *    private lot must have no way to reach `endSession()`.
 * 4. **No `SessionExpiredError` can come out of here**, so React Query's retry
 *    rule never makes a session decision about anonymous traffic.
 *
 * The single-flight refresh in `client.ts` is untouched by any of this.
 */

type PublicRequestOptions<T> = {
  query?: Record<string, string | number | boolean | null | undefined>;
  schema: ZodType<T>;
  signal?: AbortSignal;
  /**
   * Seconds Next may reuse a cached response for. Server-side only, and it must
   * be set explicitly: App Router fetches are uncached by default and Next does
   * **not** derive a TTL from the response's own `Cache-Control`, so without
   * this a crawler walking 250 lots is 250 origin requests.
   */
  revalidate?: number;
};

export type PublicPage<T> = {
  data: T;
  nextCursor: string | null;
  hasMore: boolean;
};

function buildUrl(path: string, query?: PublicRequestOptions<unknown>["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function publicRequest<T>(
  path: string,
  options: PublicRequestOptions<T>,
): Promise<PublicPage<T>> {
  const { query, schema, signal, revalidate } = options;
  const url = buildUrl(path, query);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
      // No `credentials`, no `Authorization`: this endpoint takes neither, and
      // sending them would make an anonymous read look like a session.
      ...(revalidate === undefined ? {} : { next: { revalidate } }),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    // The public limiter's 429 carries a real `Retry-After`, and 404 covers
    // private, draft and non-existent alike — deliberately indistinguishable.
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfter = retryAfterHeader === null ? null : Number(retryAfterHeader);
    throw toApiError(
      res.status,
      payload,
      retryAfter !== null && Number.isFinite(retryAfter) ? retryAfter : null,
    );
  }

  const payload = await res.json().catch((cause: unknown) => {
    throw new ResponseShapeError(path, cause);
  });

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ResponseShapeError(path, parsed.error);

  const cursor = res.headers.get("X-Next-Cursor");
  return {
    data: parsed.data,
    nextCursor: cursor && cursor.length > 0 ? cursor : null,
    hasMore: res.headers.get("X-Has-More")?.toLowerCase() === "true",
  };
}

export async function publicGet<T>(
  path: string,
  options: PublicRequestOptions<T>,
): Promise<T> {
  const { data } = await publicRequest(path, options);
  return data;
}

export { ApiError };
