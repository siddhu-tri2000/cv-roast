import { NextResponse } from "next/server";
import { getServerSupabase, getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAdmins(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function GET(req: Request) {
  const supa = await getServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  const admins = parseAdmins();
  if (!email || !admins.has(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 100)));
  const surface = searchParams.get("surface");

  const admin = getAdminSupabase();
  let query = admin
    .from("feedback")
    .select("id, user_id, surface, rating, comment, context, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (surface) query = query.eq("surface", surface);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: agg } = await admin.from("feedback").select("surface, rating");
  const summary: Record<string, { up: number; down: number }> = {};
  for (const row of agg ?? []) {
    const s = (row as { surface: string }).surface;
    const r = (row as { rating: number }).rating;
    if (!summary[s]) summary[s] = { up: 0, down: 0 };
    if (r === 1) summary[s].up += 1;
    else if (r === -1) summary[s].down += 1;
  }

  return NextResponse.json({ items: data ?? [], summary });
}
