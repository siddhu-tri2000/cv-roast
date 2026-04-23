import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscribeBody {
  email?: unknown;
}

interface UpdateBody {
  paused?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  const rl = await checkRateLimit(req, "subscribe", RATE_LIMITS.subscribe.max, RATE_LIMITS.subscribe.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ subscription: null }, { status: 200 });

  const { data, error } = await supabase
    .from("email_subscriptions")
    .select("id, email, frequency, paused, last_sent_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data ?? null });
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "subscribe", RATE_LIMITS.subscribe.max, RATE_LIMITS.subscribe.window);
  if (!rl.success) return rateLimitResponse(rl);

  let body: SubscribeBody = {};
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });

  const { data, error } = await supabase
    .from("email_subscriptions")
    .upsert(
      {
        user_id: user.id,
        email,
        frequency: "weekly",
        paused: false,
      },
      { onConflict: "user_id" },
    )
    .select("id, email, frequency, paused")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}

export async function PATCH(req: Request) {
  const rl = await checkRateLimit(req, "subscribe", RATE_LIMITS.subscribe.max, RATE_LIMITS.subscribe.window);
  if (!rl.success) return rateLimitResponse(rl);

  let body: UpdateBody = {};
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paused = body.paused === true;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const { data, error } = await supabase
    .from("email_subscriptions")
    .update({ paused })
    .eq("user_id", user.id)
    .select("id, email, paused")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscription: data });
}

export async function DELETE(req: Request) {
  const rl = await checkRateLimit(req, "subscribe", RATE_LIMITS.subscribe.max, RATE_LIMITS.subscribe.window);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });

  const { error } = await supabase
    .from("email_subscriptions")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
