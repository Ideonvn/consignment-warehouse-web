/**
 * How many boxes the code inputs render, for both the login OTP and email
 * verification — the backend issues the same six digits for both.
 *
 * It is configurable only because a local backend with `OTP_DEV_CODE` set
 * returns that fixed code instead (`0000` in the seeded setup), and a six-box
 * input can never be completed with four digits. Production has no dev code, so
 * the default is the only value that ships.
 */
const parsed = Number(process.env.NEXT_PUBLIC_OTP_CODE_LENGTH);

export const OTP_CODE_LENGTH =
  Number.isInteger(parsed) && parsed >= 4 && parsed <= 10 ? parsed : 6;
