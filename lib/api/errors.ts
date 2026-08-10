/**
 * Typed API errors.
 *
 * The backend returns `{"detail": "..."}` almost everywhere, but two endpoints
 * return a structured `detail` object: bid-too-low (carries the new minimum) and
 * frozen-field. Callers need to branch on those without string matching.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
  /** Seconds, from the `Retry-After` header on a 429. */
  readonly retryAfter: number | null;

  constructor(
    status: number,
    message: string,
    detail: unknown = null,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

/** 422 on a bid: someone bid between render and submit. */
export class BidTooLowError extends ApiError {
  readonly minimumNextBidMinor: number;

  constructor(message: string, minimumNextBidMinor: number, detail: unknown) {
    super(422, message, detail);
    this.name = "BidTooLowError";
    this.minimumNextBidMinor = minimumNextBidMinor;
  }
}

/**
 * A field can no longer be changed (e.g. once bidding has started). Declared by
 * the backend as `FrozenFieldOut`: `{detail: {message, field}}`. Admin-only in
 * practice, so it should rarely reach this client at all.
 */
export class FrozenFieldError extends ApiError {
  readonly field: string;

  constructor(status: number, message: string, field: string, detail: unknown) {
    super(status, message, detail);
    this.name = "FrozenFieldError";
    this.field = field;
  }
}

/** The refresh token is gone or was replayed — the session is over. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, "Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

/** The request never reached the server. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Cannot reach the server. Check your connection and try again.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export class ResponseShapeError extends Error {
  constructor(path: string, cause: unknown) {
    super(`Unexpected response shape from ${path}`);
    this.name = "ResponseShapeError";
    this.cause = cause;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: "That request wasn't valid.",
  401: "You need to sign in to do that.",
  403: "You're not allowed to do that.",
  404: "We couldn't find that.",
  409: "That's no longer available.",
  422: "Some details weren't valid.",
  429: "Too many attempts. Please wait a moment.",
  500: "Something went wrong on our side.",
};

/** Turns a non-2xx response body into the most specific error class that fits. */
export function toApiError(status: number, body: unknown, retryAfter: number | null): ApiError {
  const envelope = asRecord(body);
  const detail = envelope ? envelope.detail : undefined;

  if (typeof detail === "string" && detail.length > 0) {
    return new ApiError(status, detail, detail, retryAfter);
  }

  const structured = asRecord(detail);
  if (structured) {
    const message =
      typeof structured.message === "string"
        ? structured.message
        : (STATUS_FALLBACKS[status] ?? "Something went wrong.");

    const minimum = structured.minimum_next_bid_minor;
    if (typeof minimum === "number") {
      return new BidTooLowError(message, minimum, detail);
    }

    if (typeof structured.field === "string") {
      return new FrozenFieldError(status, message, structured.field, detail);
    }

    return new ApiError(status, message, detail, retryAfter);
  }

  // FastAPI validation errors arrive as `detail: [{loc, msg, type}, ...]`.
  if (Array.isArray(detail)) {
    const first = asRecord(detail[0]);
    const msg = first && typeof first.msg === "string" ? first.msg : null;
    return new ApiError(status, msg ?? STATUS_FALLBACKS[422], detail, retryAfter);
  }

  return new ApiError(status, STATUS_FALLBACKS[status] ?? "Something went wrong.", body, retryAfter);
}
