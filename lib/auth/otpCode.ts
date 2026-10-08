/**
 * How many boxes the code inputs render, for both the login OTP and email
 * verification.
 *
 * **A constant, and deliberately no longer configurable.** It used to read
 * `NEXT_PUBLIC_OTP_CODE_LENGTH`, set to `4` in `.env.local` so a local backend's
 * four-digit `OTP_DEV_CODE` could be typed in. That made the length true in four
 * places — here, the app's own env var, the backend's generator, and the dev code
 * — and false in at least one of them: a six-digit code generated for an admin
 * demo sign-in could not be entered on a local build at all.
 *
 * The backend now holds the single definition (`OTP_CODE_LENGTH` in
 * `app/core/config.py`) and refuses an `OTP_DEV_CODE` of any other length, so the
 * local dev code is `000000` and there is no environment that wants a different
 * number of boxes. Changing it means changing both ends in one release.
 */
export const OTP_CODE_LENGTH = 6;
