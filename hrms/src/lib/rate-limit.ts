// ponytail: in-memory, per-process. Move to DB/Redis if the app ever runs on more than one server.
const hits = new Map<string, { n: number; reset: number }>();

export function tooManyAttempts(key: string, max = 5, windowMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  h.n += 1;
  return h.n > max;
}

// Read-only check, plus a separate recorder: lets a caller count only successes.
export function isLimited(key: string, max: number) {
  const h = hits.get(key);
  return !!h && h.reset >= Date.now() && h.n >= max;
}

export function recordHit(key: string, windowMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
  else h.n += 1;
}

export function clearAttempts(key: string) {
  hits.delete(key);
}
