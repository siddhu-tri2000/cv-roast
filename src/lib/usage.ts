import { getServerSupabase, getAdminSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Daily free-tier quota (per tool, per Asia/Kolkata day).
 * Sign-in is required for all tools — anonymous-by-IP was too leaky to enforce
 * a meaningful cap (mobile NAT, IP rotation, edge variance).
 * After a signed-in user hits the cap, the API returns 402 and the client
 * opens the waitlist modal (we don't charge yet — we capture demand).
 *
 * Admins (ADMIN_EMAILS env var) bypass the quota entirely.
 */
export const DAILY_LIMITS = {
  user: 5,
} as const;

export type Tool = "map" | "ghost" | "studio";
export const TOOLS: readonly Tool[] = ["map", "ghost", "studio"] as const;

export type QuotaCheck =
  | { ok: true; tool: Tool; subject: "user"; remaining: number; limit: number; unlimited?: boolean }
  | { ok: false; code: "sign_in_required"; tool: Tool; remaining: 0; limit: number }
  | { ok: false; code: "quota_exceeded"; tool: Tool; remaining: 0; limit: number };

/** YYYY-MM-DD in Asia/Kolkata, suitable for SQL `date` column. */
export function dayIST(now: Date = new Date()): string {
  // 'en-CA' gives ISO YYYY-MM-DD format with the supplied timeZone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  try {
    const supa = await getServerSupabase();
    const { data } = await supa.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

async function readTodayTotal(userId: string, day: string): Promise<number> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("usage_daily")
    .select("count")
    .eq("subject_type", "user")
    .eq("subject_key", userId)
    .eq("day_ist", day);
  return (data ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

/**
 * Check whether the request is allowed under today's quota.
 * Quota is **shared across all tools** — 5 total runs/day per signed-in user.
 * Anonymous callers are always blocked with `sign_in_required`.
 * Admins (ADMIN_EMAILS env var) bypass the quota entirely.
 * Does NOT increment — call `recordUsage()` after a successful AI call.
 */
export async function checkQuota(_req: Request, tool: Tool): Promise<QuotaCheck> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      code: "sign_in_required",
      tool,
      remaining: 0,
      limit: DAILY_LIMITS.user,
    };
  }

  if (isAdminEmail(user.email)) {
    return {
      ok: true,
      tool,
      subject: "user",
      remaining: 9999,
      limit: 9999,
      unlimited: true,
    };
  }

  const used = await readTodayTotal(user.id, dayIST());
  const remaining = Math.max(0, DAILY_LIMITS.user - used);
  if (remaining <= 0) {
    return { ok: false, code: "quota_exceeded", tool, remaining: 0, limit: DAILY_LIMITS.user };
  }
  return { ok: true, tool, subject: "user", remaining, limit: DAILY_LIMITS.user };
}

/**
 * Record one successful AI call against today's bucket. Atomic via Postgres fn.
 * No-op for anonymous callers (they can't reach this — checkQuota blocks first).
 * Also a no-op for admins so analytics aren't polluted by internal usage.
 * Best-effort — failures are logged but never block the response.
 */
export async function recordUsage(_req: Request, tool: Tool): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    if (isAdminEmail(user.email)) return;
    const admin = getAdminSupabase();
    await admin.rpc("bump_usage", {
      p_subject_type: "user",
      p_subject_key: user.id,
      p_tool: tool,
      p_day_ist: dayIST(),
    });
  } catch (e) {
    console.error("recordUsage failed (non-fatal)", e);
  }
}

/** Standardised JSON response when the quota gate blocks the request. */
export function quotaBlockedResponse(check: Extract<QuotaCheck, { ok: false }>): Response {
  const status = check.code === "sign_in_required" ? 401 : 402;
  return new Response(
    JSON.stringify({
      error:
        check.code === "sign_in_required"
          ? "Please sign in to use this tool — 5 free runs per day."
          : "You've used today's 5 free runs. Pro packs are launching soon.",
      code: check.code,
      tool: check.tool,
      limit: check.limit,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/** Read today's usage for the signed-in caller (single combined counter). */
export async function getTodayUsageSummary(_req: Request): Promise<{
  signedIn: boolean;
  limit: number;
  used: number;
  remaining: number;
  isAdmin?: boolean;
}> {
  const user = await getCurrentUser();
  const limit = DAILY_LIMITS.user;
  if (!user) {
    return { signedIn: false, limit, used: 0, remaining: limit };
  }
  if (isAdminEmail(user.email)) {
    return { signedIn: true, limit: 9999, used: 0, remaining: 9999, isAdmin: true };
  }
  const used = await readTodayTotal(user.id, dayIST());
  return {
    signedIn: true,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
