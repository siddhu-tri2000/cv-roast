import { NextResponse } from "next/server";
import { getServerSupabase, getAdminSupabase } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SURFACES = new Set([
  "map",
  "studio_polish",
  "studio_tailor",
  "ghost_detect",
  "ghost_diagnose",
  "journey",
  "general",
]);

interface Body {
  surface?: unknown;
  rating?: unknown;
  comment?: unknown;
  context?: unknown;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "feedback", RATE_LIMITS.feedback.max, RATE_LIMITS.feedback.window);
  if (!rl.success) return rateLimitResponse(rl);

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const surface = typeof body.surface === "string" ? body.surface : "";
  const rating = typeof body.rating === "number" ? body.rating : NaN;
  const comment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null;
  const context =
    body.context && typeof body.context === "object" ? body.context : null;

  if (!ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json({ error: "Invalid surface" }, { status: 400 });
  }
  if (rating !== 1 && rating !== -1) {
    return NextResponse.json({ error: "Rating must be 1 or -1" }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const supa = await getServerSupabase();
    const {
      data: { user },
    } = await supa.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* anon ok */
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  const admin = getAdminSupabase();
  const { error } = await admin.from("feedback").insert({
    user_id: userId,
    surface,
    rating,
    comment: comment && comment.length > 0 ? comment : null,
    context,
    user_agent: userAgent,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
