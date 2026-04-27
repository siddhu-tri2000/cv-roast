import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiting backed by Upstash Redis.
 *
 * If UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN are missing
 * (e.g. local dev, or before the env is configured), this becomes a no-op
 * that always allows the request — so the app keeps working without it.
 */

interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const enabled = Boolean(url && token);

const redis = enabled ? new Redis({ url: url!, token: token! }) : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, max: number, windowSec: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${name}:${max}:${windowSec}`;
  const cached = limiters.get(key);
  if (cached) return cached;
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    analytics: true,
    prefix: `cc:rl:${name}`,
  });
  limiters.set(key, rl);
  return rl;
}

/**
 * Extract the best-available IP from a Next.js request.
 * Falls back to a single anonymous bucket if no IP can be derived
 * (which is fine — Upstash will rate-limit as a whole).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anon";
}

/**
 * Check rate limit. Returns { success: true, ... } if allowed.
 * If Upstash is not configured, always allows (success=true, limit=0).
 */
export async function checkRateLimit(
  req: Request,
  bucket: string,
  max: number,
  windowSec: number,
): Promise<LimitResult> {
  if (!enabled) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const ip = getClientIp(req);
  const limiter = getLimiter(bucket, max, windowSec);
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const result = await limiter.limit(ip);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export const RATE_LIMITS = {
  match: { max: 10, window: 60 },     // 10 maps / minute / IP
  ghost: { max: 15, window: 60 },     // 15 ghost analyses / minute / IP
  analyse: { max: 10, window: 60 },   // 10 CV reviews / minute / IP
  pulse: { max: 30, window: 60 },     // 30 daily-pulse fetches / minute / IP
  journey: { max: 60, window: 60 },   // 60 journey writes / minute / IP
  subscribe: { max: 10, window: 60 }, // 10 subscribe ops / minute / IP
  studio: { max: 10, window: 60 },    // 10 studio runs / minute / IP
  feedback: { max: 20, window: 60 },  // 20 feedback submits / minute / IP
  jobs: { max: 30, window: 60 },      // 30 live-job fetches / minute / IP (cached)
} as const;

export function rateLimitResponse(result: LimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: `You're going a bit fast. Try again in ${retryAfter}s.`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    },
  );
}

export function isRateLimitEnabled(): boolean {
  return enabled;
}
