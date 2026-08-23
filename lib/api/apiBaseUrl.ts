/**
 * Where the API lives.
 *
 * Its own module so the public client can read it without importing
 * `lib/api/client.ts`, which carries the session store and the clock offset —
 * module-level state that must never be pulled into a server render.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
