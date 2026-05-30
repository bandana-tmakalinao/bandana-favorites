/**
 * Tiny in-memory fixed-window rate limiter — a guardrail for auth endpoints (sign-in, OAuth start).
 *
 * Single-instance only: state lives in this process. For a multi-instance production deploy, swap the
 * Map for a shared store (Redis / Cloudflare KV / Postgres) behind the same `rateLimit()` signature.
 */
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();

/** Returns {ok} and, when blocked, how many seconds until the window resets. */
export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = BUCKETS.get(key);
  if (!b || now > b.resetAt) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= max) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from common proxy headers (falls back to a shared bucket). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
