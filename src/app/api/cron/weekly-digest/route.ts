import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminSupabase } from "@/lib/supabase/server";
import { pulseInsightWithGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://career-compass-orpin-tau.vercel.app";

interface JourneyRow {
  id: string;
  skill: string;
  status: string;
  hours_logged: number;
  target_role: string | null;
}

interface SubscriberRow {
  id: string;
  user_id: string | null;
  email: string;
  unsub_token: string;
  last_sent_at: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: {
  insightHtml: string;
  journeysHtml: string;
  unsubUrl: string;
  weekLabel: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Your CareerCompass weekly</title></head>
<body style="margin:0;padding:0;background:#f7f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 32px 16px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4f46e5;">CareerCompass · Weekly</div>
          <h1 style="margin:8px 0 4px;font-size:24px;font-weight:800;color:#0a0a0a;">Your week in motion</h1>
          <div style="font-size:13px;color:#666;">${escapeHtml(opts.weekLabel)}</div>
        </td></tr>

        <tr><td style="padding:8px 32px 16px;">
          <h2 style="margin:16px 0 8px;font-size:18px;font-weight:800;color:#1a1a1a;">📈 This week's insight</h2>
          ${opts.insightHtml}
        </td></tr>

        <tr><td style="padding:8px 32px 16px;">
          <h2 style="margin:16px 0 8px;font-size:18px;font-weight:800;color:#1a1a1a;">🧗 Your skill journey</h2>
          ${opts.journeysHtml}
        </td></tr>

        <tr><td style="padding:8px 32px 32px;">
          <a href="${SITE_URL}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open CareerCompass →</a>
        </td></tr>

        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;">
          You're getting this because you subscribed to CareerCompass weekly digest.<br />
          <a href="${opts.unsubUrl}" style="color:#888;text-decoration:underline;">Unsubscribe</a> · <a href="${SITE_URL}/journey" style="color:#888;text-decoration:underline;">Manage</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildInsightHtml(insight: { headline: string; body: string; emoji: string; source_hint: string } | null): string {
  if (!insight) {
    return `<div style="padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;color:#666;font-size:14px;">No insight available this week — open the app for fresh ones.</div>`;
  }
  return `<div style="padding:16px;border:1px solid #e0e7ff;border-radius:12px;background:linear-gradient(135deg,#eef2ff,#fdf4ff);">
    <div style="font-size:16px;font-weight:800;color:#0a0a0a;margin-bottom:6px;">${insight.emoji} ${escapeHtml(insight.headline)}</div>
    <div style="font-size:14px;line-height:1.55;color:#333;">${escapeHtml(insight.body)}</div>
    ${insight.source_hint ? `<div style="margin-top:8px;font-size:12px;font-style:italic;color:#666;">💡 ${escapeHtml(insight.source_hint)}</div>` : ""}
  </div>`;
}

function buildJourneysHtml(rows: JourneyRow[], weekHours: number): string {
  if (rows.length === 0) {
    return `<div style="padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;color:#666;font-size:14px;">
      No tracked skills yet. <a href="${SITE_URL}" style="color:#4f46e5;font-weight:600;">Run a career map</a> and tap "Track this skill" on any gap.
    </div>`;
  }
  const inProgress = rows.filter((r) => r.status === "in_progress");
  const HOURS_TO_CV = 5;
  const items = inProgress.slice(0, 5).map((r) => {
    const pct = Math.min(100, Math.round((Number(r.hours_logged) / HOURS_TO_CV) * 100));
    const ready = pct >= 100;
    return `<div style="padding:12px;border:1px solid #eee;border-radius:10px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#1a1a1a;">
        <span>${escapeHtml(r.skill)}</span>
        <span style="color:${ready ? "#059669" : "#666"};font-weight:600;">${Number(r.hours_logged).toFixed(1)}h${ready ? " ✓" : ""}</span>
      </div>
      <div style="margin-top:6px;height:6px;background:#eee;border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${ready ? "#10b981" : "#6366f1"};"></div>
      </div>
    </div>`;
  }).join("");
  const summary = `<div style="margin:0 0 12px;font-size:14px;color:#333;">
    You logged <strong>${weekHours.toFixed(1)} hours</strong> this week across ${inProgress.length} active skill${inProgress.length === 1 ? "" : "s"}.
  </div>`;
  return summary + items;
}

async function generateInsightSafe(profile: { seniority?: string; industry?: string; top_skills?: string[] } | null) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    return await pulseInsightWithGemini(profile, apiKey);
  } catch (e) {
    console.error("digest insight failed", e);
    return null;
  }
}

function weekLabel(): string {
  const now = new Date();
  const end = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const startD = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
  const start = startD.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${start} – ${end}`;
}

export async function GET(req: Request) {
  // Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}` automatically when CRON_SECRET is set.
  // Also accept a `?key=` for manual invocation/testing.
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const keyParam = url.searchParams.get("key") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${expected}` && keyParam !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }
  const fromAddress = process.env.EMAIL_FROM ?? "CareerCompass <onboarding@resend.dev>";

  const admin = getAdminSupabase();
  const sevenDaysAgoISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Fetch subscribers due for send: not paused, never sent OR sent > 6 days ago
  const sixDaysAgoISO = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
  const { data: subs, error: subErr } = await admin
    .from("email_subscriptions")
    .select("id, user_id, email, unsub_token, last_sent_at")
    .eq("paused", false)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sixDaysAgoISO}`)
    .limit(100);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  const subscribers = (subs ?? []) as SubscriberRow[];

  const resend = new Resend(resendKey);
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const sub of subscribers) {
    try {
      let journeys: JourneyRow[] = [];
      let weekHours = 0;
      let profileForInsight: { seniority?: string; industry?: string; top_skills?: string[] } | null = null;

      if (sub.user_id) {
        const { data: jrows } = await admin
          .from("skill_journeys")
          .select("id, skill, status, hours_logged, target_role")
          .eq("user_id", sub.user_id)
          .order("status", { ascending: true })
          .order("updated_at", { ascending: false })
          .limit(20);
        journeys = (jrows ?? []) as JourneyRow[];

        const { data: logs } = await admin
          .from("learning_logs")
          .select("minutes")
          .eq("user_id", sub.user_id)
          .gte("logged_at", sevenDaysAgoISO);
        weekHours = ((logs ?? []) as { minutes: number }[]).reduce(
          (sum, l) => sum + (Number(l.minutes) || 0) / 60,
          0,
        );

        const top = journeys.slice(0, 5).map((j) => j.skill);
        if (top.length) profileForInsight = { top_skills: top };
      }

      const insight = await generateInsightSafe(profileForInsight);
      const html = buildEmailHtml({
        insightHtml: buildInsightHtml(insight),
        journeysHtml: buildJourneysHtml(journeys, weekHours),
        unsubUrl: `${SITE_URL}/unsubscribe?token=${encodeURIComponent(sub.unsub_token)}`,
        weekLabel: weekLabel(),
      });

      const subject = insight?.headline
        ? `🧭 ${insight.headline}`
        : `🧭 Your weekly career pulse`;

      const { error: sendErr } = await resend.emails.send({
        from: fromAddress,
        to: sub.email,
        subject,
        html,
      });

      if (sendErr) {
        results.push({ email: sub.email, ok: false, error: sendErr.message });
        continue;
      }

      await admin
        .from("email_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", sub.id);

      results.push({ email: sub.email, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ email: sub.email, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    total: subscribers.length,
    results,
  });
}
