const DEVICE_ID_KEY = "cw.device_id";
const DEVICE_NAME_FALLBACK = "Web browser";

/**
 * Stable per-browser device id. It identifies the refresh-token family, so a
 * fresh one on every load would orphan sessions on the backend.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getDeviceName(): string {
  if (typeof navigator === "undefined") return DEVICE_NAME_FALLBACK;

  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";

  const platform =
    /Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "web";

  return `${browser} on ${platform}`;
}
