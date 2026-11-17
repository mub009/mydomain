/** Next.js calls this once when the server starts: start the 9 AM Morning Session schedule. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/session/scheduler");
    startScheduler();
  }
}
