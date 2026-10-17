/**
 * Runs once when the server process starts (Next.js instrumentation hook).
 * Reserved for observability setup; fatal errors are left to the host runtime
 * so it can replace a broken process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
}
