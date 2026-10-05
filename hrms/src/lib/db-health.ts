// True when an error means "the database cannot be reached" (stopped, restarting, wrong port),
// as opposed to a bug in a query. Used to show a clear page instead of a stack trace.
const CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "P1001", "P1002", "P1017"]);

export function isDbDown(e: unknown): boolean {
  const seen = new Set<unknown>();
  for (let cur: unknown = e; cur && typeof cur === "object" && !seen.has(cur); cur = (cur as { cause?: unknown }).cause) {
    seen.add(cur);
    const x = cur as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof x.code === "string" && CODES.has(x.code)) return true;
    if (x.name === "PrismaClientInitializationError") return true;
    if (typeof x.message === "string" && /can't reach database|ECONNREFUSED|connection terminated|server closed the connection/i.test(x.message)) return true;
  }
  return false;
}

export const DB_DOWN_MESSAGE = "The system is starting up or its database is not running. Try again in a moment.";
