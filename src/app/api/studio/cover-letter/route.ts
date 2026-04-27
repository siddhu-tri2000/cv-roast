import { NextResponse } from "next/server";
import { LlmError, coverLetterWithGemini } from "@/lib/gemini";
import type { CoverLetterTone, CoverLetterLength } from "@/lib/coverLetterPrompts";
import { getServerSupabase, getAdminSupabase } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { checkQuota, quotaBlockedResponse, recordUsage } from "@/lib/usage";

const MIN_RESUME_CHARS = 200;
const MAX_RESUME_CHARS = 35_000;
const MIN_JD_CHARS = 80;
const MAX_JD_CHARS = 12_000;

const VALID_TONES: ReadonlySet<CoverLetterTone> = new Set(["professional", "warm", "direct"]);
const VALID_LENGTHS: ReadonlySet<CoverLetterLength> = new Set(["short", "standard", "detailed"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CoverLetterRequestBody {
  resume?: unknown;
  jd?: unknown;
  tone?: unknown;
  length?: unknown;
  name?: unknown;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "studio", RATE_LIMITS.studio.max, RATE_LIMITS.studio.window);
  if (!rl.success) return rateLimitResponse(rl);

  const quota = await checkQuota(req, "studio");
  if (!quota.ok) return quotaBlockedResponse(quota);

  let payload: CoverLetterRequestBody;
  try {
    payload = (await req.json()) as CoverLetterRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resume = typeof payload.resume === "string" ? payload.resume.trim() : "";
  const jd = typeof payload.jd === "string" ? payload.jd.trim() : "";
  const toneRaw = typeof payload.tone === "string" ? payload.tone.trim().toLowerCase() : "professional";
  const lengthRaw = typeof payload.length === "string" ? payload.length.trim().toLowerCase() : "standard";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 80) : null;

  if (resume.length < MIN_RESUME_CHARS) {
    return NextResponse.json({ error: `Need at least ${MIN_RESUME_CHARS} characters of your CV.` }, { status: 400 });
  }
  if (resume.length > MAX_RESUME_CHARS) {
    return NextResponse.json({ error: `CV is too long. Trim under ${MAX_RESUME_CHARS} characters.` }, { status: 400 });
  }
  if (jd.length < MIN_JD_CHARS) {
    return NextResponse.json({ error: `Need at least ${MIN_JD_CHARS} characters of the job description.` }, { status: 400 });
  }
  if (jd.length > MAX_JD_CHARS) {
    return NextResponse.json({ error: `JD is too long. Trim under ${MAX_JD_CHARS} characters.` }, { status: 400 });
  }

  const tone = (VALID_TONES.has(toneRaw as CoverLetterTone) ? toneRaw : "professional") as CoverLetterTone;
  const length = (VALID_LENGTHS.has(lengthRaw as CoverLetterLength) ? lengthRaw : "standard") as CoverLetterLength;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  try {
    const result = await coverLetterWithGemini(resume, jd, tone, length, apiKey);
    void recordUsage(req, "studio");
    void saveVersion({ name, originalText: resume, jdText: jd, output: { ...result, tone, length } });
    return NextResponse.json({ result, tone, length });
  } catch (err) {
    if (err instanceof LlmError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Unexpected /api/studio/cover-letter error", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

async function saveVersion(args: {
  name: string | null;
  originalText: string;
  jdText: string;
  output: unknown;
}) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    let userId: string | null = null;
    try {
      const supa = await getServerSupabase();
      const { data } = await supa.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      /* anon */
    }
    if (!userId) return;
    const admin = getAdminSupabase();
    await admin.from("studio_versions").insert({
      user_id: userId,
      mode: "cover_letter",
      name: args.name,
      original_text: args.originalText,
      jd_text: args.jdText,
      output: args.output,
      ats_score: null,
    });
  } catch (e) {
    console.error("saveVersion (cover_letter) failed (non-fatal)", e);
  }
}
