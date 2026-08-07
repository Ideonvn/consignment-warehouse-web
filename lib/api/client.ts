import type { ZodType } from "zod";
import { getAccessToken, useSession } from "@/lib/auth/session";
import { recordServerDate } from "@/lib/format/clock";
import {
  ApiError,
  NetworkError,
  ResponseShapeError,
  SessionExpiredError,
  toApiError,
} from "@/lib/api/errors";
import { tokenPairSchema } from "@/lib/api/schemas";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export type PageMeta = {
  /** `X-Next-Cursor`; null when the list is exhausted. */
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiResult<T> = {
  data: T;
  meta: PageMeta;
};

type RequestOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Response validator. Omit for 204s. */
  schema?: ZodType<T>;
  /** Send the bearer token and refresh on 401. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function readRetryAfter(res: Response): number | null {
  const header = res.headers.get("Retry-After");
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : null;
}

function readMeta(res: Response): PageMeta {
  const cursor = res.headers.get("X-Next-Cursor");
  return {
    nextCursor: cursor && cursor.length > 0 ? cursor : null,
    hasMore: res.headers.get("X-Has-More")?.toLowerCase() === "true",
  };
}

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  const startedAt = Date.now();
  let res: Response;
  try {
    // `credentials: include` carries the HttpOnly refresh cookie.
    res = await fetch(url, { ...init, credentials: "include" });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  recordServerDate(res.headers.get("Date"), startedAt);
  return res;
}

/* ------------------------------------------------- single-flight refresh --- */

let refreshInFlight: Promise<string | null> | null = null;

/**
 * At most one refresh at a time. Parallel 401s all await the same promise —
 * firing several would replay a rotated token and the backend would revoke the
 * whole family as suspected theft.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function performRefresh(): Promise<string | null> {
  try {
    const res = await rawFetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    if (!res.ok) {
      useSession.getState().endSession();
      return null;
    }

    const tokens = tokenPairSchema.parse(await res.json());
    useSession.getState().setAccessToken(tokens.access_token);
    return tokens.access_token;
  } catch {
    // Never retry a failed refresh: a replayed token has already killed the family.
    useSession.getState().endSession();
    return null;
  }
}

/* ----------------------------------------------------------- the client --- */

export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, query, schema, auth = true, signal } = options;
  const url = buildUrl(path, query);

  const send = (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return rawFetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  };

  let token = auth ? getAccessToken() : null;

  // No access token yet but the cookie may still hold a live session.
  if (auth && !token) {
    token = await refreshAccessToken();
    if (!token) throw new SessionExpiredError();
  }

  let res = await send(token);

  if (res.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) throw new SessionExpiredError();
    res = await send(refreshed);
    if (res.status === 401) {
      useSession.getState().endSession();
      throw new SessionExpiredError();
    }
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw toApiError(res.status, payload, readRetryAfter(res));
  }

  const meta = readMeta(res);

  if (res.status === 204 || !schema) {
    return { data: undefined as T, meta };
  }

  const payload = await res.json().catch((cause: unknown) => {
    throw new ResponseShapeError(path, cause);
  });

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ResponseShapeError(path, parsed.error);
  }

  return { data: parsed.data, meta };
}

/** Convenience wrapper for the common case where pagination headers don't matter. */
export async function apiGet<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { data } = await apiRequest<T>(path, options);
  return data;
}

export { ApiError };
