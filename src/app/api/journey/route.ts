import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import type { LearningResource } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateJourneyBody {
  skill?: unknown;
  target_role?: unknown;
  source?: unknown;
  why_it_matters?: unknown;
  resources?: unknown;
}

interface UpdateJourneyBody {
  id?: unknown;
  status?: unknown; // 'in_progress' | 'completed' | 'paused'
}

interface DeleteJourneyBody {
  id?: unknown;
}

const ALLOWED_STATUS = new Set(["in_progress", "completed", "paused"]);
const ALLOWED_SOURCE = new Set(["stretch", "target_gap", "manual"]);

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabase
    .from("skill_journeys")
    .select("id, skill, target_role, source, status, why_it_matters, resources, hours_logged, started_at, completed_at, updated_at")
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("journey GET failed", error);
    return NextResponse.json({ error: "Could not load journeys" }, { status: 500 });
  }
  return NextResponse.json({ journeys: data ?? [] });
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: CreateJourneyBody;
  try { body = (await req.json()) as CreateJourneyBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const skill = typeof body.skill === "string" ? body.skill.trim().slice(0, 120) : "";
  if (skill.length < 2) {
    return NextResponse.json({ error: "Skill name is required" }, { status: 400 });
  }

  const target_role = typeof body.target_role === "string" ? body.target_role.trim().slice(0, 120) : null;
  const sourceRaw = typeof body.source === "string" ? body.source : "manual";
  const source = ALLOWED_SOURCE.has(sourceRaw) ? sourceRaw : "manual";
  const why_it_matters = typeof body.why_it_matters === "string" ? body.why_it_matters.slice(0, 500) : null;

  // Resources is a snapshot of LearningResource[] — validate shape lightly
  let resources: LearningResource[] | null = null;
  if (Array.isArray(body.resources)) {
    resources = (body.resources as LearningResource[])
      .filter((r) => r && typeof r.title === "string" && typeof r.search_query === "string")
      .slice(0, 5);
  }

  // Case-insensitive dedup by (user_id, lower(skill)).
  // Supabase upsert can't use the lower(skill) functional index, so we do it
  // manually: look up an existing row by ilike, then update or insert.
  const { data: existing, error: lookupErr } = await supabase
    .from("skill_journeys")
    .select("id")
    .eq("user_id", user.id)
    .ilike("skill", skill)
    .maybeSingle();

  if (lookupErr) {
    console.error("journey POST lookup failed", lookupErr);
    return NextResponse.json({ error: "Could not save journey" }, { status: 500 });
  }

  const payload = {
    user_id: user.id,
    skill,
    target_role,
    source,
    why_it_matters,
    resources,
    status: "in_progress" as const,
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? supabase.from("skill_journeys").update(payload).eq("id", existing.id).select().single()
    : supabase.from("skill_journeys").insert(payload).select().single();

  const { data, error } = await query;

  if (error) {
    console.error("journey POST failed", error);
    return NextResponse.json({ error: "Could not save journey" }, { status: 500 });
  }
  return NextResponse.json({ journey: data });
}

export async function PATCH(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: UpdateJourneyBody;
  try { body = (await req.json()) as UpdateJourneyBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!id || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: "id + valid status required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "completed") patch.completed_at = new Date().toISOString();
  if (status === "in_progress") patch.completed_at = null;

  const { data, error } = await supabase
    .from("skill_journeys")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("journey PATCH failed", error);
    return NextResponse.json({ error: "Could not update journey" }, { status: 500 });
  }
  return NextResponse.json({ journey: data });
}

export async function DELETE(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: DeleteJourneyBody;
  try { body = (await req.json()) as DeleteJourneyBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("skill_journeys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("journey DELETE failed", error);
    return NextResponse.json({ error: "Could not delete journey" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
