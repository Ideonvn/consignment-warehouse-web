/**
 * Which build of the web app this is.
 *
 * **The commit, not a version number.** `package.json` says `0.1.0` and nothing bumps it, so a
 * version here would be a number somebody has to remember to change — and a forgotten bump is
 * worse than no version at all, because it asserts something false. `amplify.yml` re-exports
 * Amplify's own `AWS_COMMIT_ID` as `NEXT_PUBLIC_BUILD_SHA` at build time (Next inlines nothing
 * else), which is the one value that genuinely identifies a deploy.
 *
 * It is read at module scope rather than in the component on purpose: `process.env.NEXT_PUBLIC_*`
 * is substituted literally at build time, so a dynamic lookup would not be replaced and would
 * read `undefined` in the browser.
 *
 * Absent locally and absent if the variable is ever lost, in which case this renders nothing
 * rather than "Build unknown" — the mobile app is where "what version are you on" really matters,
 * since a browser reloads to the newest build on its own.
 */
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA;

export function BuildVersion() {
  if (!BUILD_SHA) return null;

  return (
    <p className="mt-6 text-center text-xs text-text-muted">
      {/* select-all so it can be copied into a message rather than transcribed. */}
      Build <span className="tabular select-all">{BUILD_SHA.slice(0, 7)}</span>
    </p>
  );
}
