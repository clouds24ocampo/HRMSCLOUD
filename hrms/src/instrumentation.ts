// Runs once when the server starts. Background job: the automatic time-out sweep, every minute (see lib/auto-timeout.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as { __hrmsSweep?: ReturnType<typeof setInterval> };
  if (g.__hrmsSweep) return; // dev reloads call register again: keep one timer
  const { sweepAutoTimeouts } = await import("@/lib/auto-timeout");
  const tick = () => sweepAutoTimeouts().catch((e) => console.error("[hrms] automatic time-out failed", e));
  g.__hrmsSweep = setInterval(tick, 60_000);
  setTimeout(tick, 10_000);
}
