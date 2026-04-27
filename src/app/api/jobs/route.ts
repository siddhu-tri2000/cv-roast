import { NextResponse } from "next/server";
import { fetchLiveJobs } from "@/lib/jobs";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = (url.searchParams.get("role") ?? "").trim();
  const location = (url.searchParams.get("location") ?? "").trim() || undefined;

  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const rl = await checkRateLimit(req, "jobs", 30, 60);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const result = await fetchLiveJobs(role, location);
    return NextResponse.json(result);
  } catch (e) {
    console.error("/api/jobs failed", e);
    return NextResponse.json(
      { listings: [], source: "none", cached: false },
      { status: 200 },
    );
  }
}
