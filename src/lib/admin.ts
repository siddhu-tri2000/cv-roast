/**
 * Admin utilities — single source of truth for who counts as an admin.
 * Driven by the ADMIN_EMAILS env var (comma-separated list, case-insensitive).
 *
 * Admins:
 *   - Bypass the daily quota (`checkQuota` returns ok with `unlimited: true`).
 *   - Have access to /admin/* dashboards (waitlist, feedback).
 */

export function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}
