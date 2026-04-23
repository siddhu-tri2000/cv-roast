import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LogBody {
  journey_id?: unknown;
  resource_title?: unknown;
  minutes?: unknown;
  note?: unknown;
}

interface DeleteLogBody {
  id?: unknown;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: LogBody;
  try { body = (await req.json()) as LogBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const journey_id = typeof body.journey_id === "string" ? body.journey_id : "";
  const minutes = typeof body.minutes === "number" ? Math.floor(body.minutes) : 0;
  const resource_title = typeof body.resource_title === "string" ? body.resource_title.trim().slice(0, 200) : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!journey_id) return NextResponse.json({ error: "journey_id required" }, { status: 400 });
  if (minutes < 1 || minutes > 600) {
    return NextResponse.json({ error: "minutes must be between 1 and 600" }, { status: 400 });
  }

  // Verify the journey belongs to this user (RLS will enforce too, but explicit is friendlier)
  const { data: journey, error: jErr } = await supabase
    .from("skill_journeys")
    .select("id, hours_logged")
    .eq("id", journey_id)
    .eq("user_id", user.id)
    .single();

  if (jErr || !journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const { error: insErr } = await supabase.from("learning_logs").insert({
    journey_id,
    user_id: user.id,
    resource_title,
    minutes,
    note,
  });

  if (insErr) {
    console.error("log insert failed", insErr);
    return NextResponse.json({ error: "Could not save log" }, { status: 500 });
  }

  // Atomically bump hours_logged on the journey
  const newHours = Number(journey.hours_logged ?? 0) + minutes / 60;
  const { data: updated, error: upErr } = await supabase
    .from("skill_journeys")
    .update({
      hours_logged: Number(newHours.toFixed(2)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", journey_id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (upErr) {
    console.error("hours bump failed", upErr);
    return NextResponse.json({ error: "Logged but could not update total" }, { status: 500 });
  }

  return NextResponse.json({ journey: updated });
}

export async function DELETE(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: DeleteLogBody;
  try { body = (await req.json()) as DeleteLogBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Fetch to know minutes + journey
  const { data: log } = await supabase
    .from("learning_logs")
    .select("id, journey_id, minutes")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  const { error: delErr } = await supabase
    .from("learning_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (delErr) {
    return NextResponse.json({ error: "Could not delete log" }, { status: 500 });
  }

  // Decrement hours
  const { data: journey } = await supabase
    .from("skill_journeys")
    .select("hours_logged")
    .eq("id", log.journey_id)
    .eq("user_id", user.id)
    .single();

  if (journey) {
    const newHours = Math.max(0, Number(journey.hours_logged ?? 0) - log.minutes / 60);
    await supabase
      .from("skill_journeys")
      .update({
        hours_logged: Number(newHours.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.journey_id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "journey", RATE_LIMITS.journey.max, RATE_LIMITS.journey.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const url = new URL(req.url);
  const journey_id = url.searchParams.get("journey_id");

  let query = supabase
    .from("learning_logs")
    .select("id, journey_id, resource_title, minutes, note, logged_at")
    .order("logged_at", { ascending: false })
    .limit(200);

  if (journey_id) query = query.eq("journey_id", journey_id);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not load logs" }, { status: 500 });
  }
  return NextResponse.json({ logs: data ?? [] });
}
