/**
 * How to pay, sourced from config rather than hardcoded.
 *
 * Payment is arranged manually with the operator today — there is no payment
 * flow in the product — so this is the one line that tells someone what to
 * actually do. It lives in an env var so it can change without a code change,
 * and falls back to an honest placeholder rather than inventing bank details.
 */
export const PAYMENT_INSTRUCTIONS =
  process.env.NEXT_PUBLIC_PAYMENT_INSTRUCTIONS?.trim() ||
  "Payment is arranged directly with the warehouse — contact the team to pay in or top up, and your account is updated once it reflects.";
