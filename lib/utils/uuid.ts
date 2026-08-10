/**
 * A v4 UUID that also works outside a secure context.
 *
 * `crypto.randomUUID` is secure-context only. `localhost` counts as secure, so
 * it is always there in normal development — but serving the app over the LAN
 * (`http://192.168.1.184:3000`, to test on a real phone) is *not* a secure
 * context, and there `crypto.randomUUID` is `undefined`. That would break the
 * device id, the bid idempotency key and toast ids.
 *
 * `crypto.getRandomValues` is not gated, so the fallback is still CSPRNG-backed
 * and the format is identical.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set the version (4) and variant (RFC 4122) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
