// ===== COVER LETTER GENERATION =====
// Used by /api/studio/cover-letter

export type CoverLetterTone = "professional" | "warm" | "direct";
export type CoverLetterLength = "short" | "standard" | "detailed";

export interface CoverLetterOutput {
  greeting: string;            // e.g. "Dear Hiring Manager," or "Hi Acme team,"
  opening_hook: string;        // 1-2 sentence opening line(s)
  body_paragraphs: string[];   // 1–4 paragraphs depending on length
  closing: string;             // closing paragraph (call to action / thanks)
  signoff: string;             // "Sincerely," or "Best,"
  candidate_name: string;      // pulled from resume
  company_name: string | null; // pulled from JD if identifiable, else null
  role_title: string | null;   // pulled from JD if identifiable, else null
}

const TONE_GUIDANCE: Record<CoverLetterTone, string> = {
  professional:
    "Tone: Professional. Confident, polished, formal but not stiff. Third-person factual claims about the candidate's work. No slang. Avoid clichés like 'I am writing to apply' or 'team player'.",
  warm:
    "Tone: Warm. Genuine, human, slightly conversational. Show curiosity about the company and connect personal motivation to the role. Still professional — not casual or jokey.",
  direct:
    "Tone: Direct. Punchy, results-led, every sentence earns its place. Open with the strongest credential. No filler, no throat-clearing, no 'I would like to'.",
};

const LENGTH_GUIDANCE: Record<CoverLetterLength, string> = {
  short:
    "Length: Short (~150 words total). 1 body paragraph plus opening hook and closing. body_paragraphs MUST have exactly 1 entry.",
  standard:
    "Length: Standard (~250-300 words total). 2 body paragraphs. body_paragraphs MUST have exactly 2 entries.",
  detailed:
    "Length: Detailed (~400 words total). 3 body paragraphs covering: relevant experience, specific accomplishments tied to JD requirements, why this company. body_paragraphs MUST have exactly 3 entries.",
};

export function buildCoverLetterPrompt(
  resume: string,
  jd: string,
  tone: CoverLetterTone,
  length: CoverLetterLength,
): string {
  return `You are an expert career coach who has written hundreds of cover letters that won interviews at top companies.

Write a cover letter from THIS candidate's resume, targeted at THIS specific job description.

${TONE_GUIDANCE[tone]}

${LENGTH_GUIDANCE[length]}

CRITICAL RULES — ANTI-HALLUCINATION:
- Use ONLY facts present in the resume. NEVER invent metrics, employers, projects, dates, or technologies.
- If the resume does not mention a specific accomplishment, do not claim it.
- candidate_name: extract exactly from the resume.
- company_name: extract from the JD only if explicitly named. Otherwise null.
- role_title: extract from the JD if explicitly stated. Otherwise null.
- greeting: prefer "Dear <company> Hiring Team," if company_name known, else "Dear Hiring Manager,".
- Do NOT include any placeholder text like "[Your name]", "[Company]", "[Date]", or square-bracketed gaps. Every field must be a finished sentence.
- Do NOT include the candidate's address, the date, or the recipient's address — body content only.

CONTENT GUIDANCE:
- opening_hook: lead with a strong, specific credential that maps to the JD's top must-have. No "I am writing to express my interest…".
- body_paragraphs: each paragraph should connect 1-2 specific resume accomplishments to JD requirements. Use real numbers from the resume where present. Do NOT just restate the resume — synthesise WHY this candidate is a fit.
- closing: a confident, low-pressure ask. e.g. "I'd welcome the chance to discuss how I can contribute to <team>." Avoid "Looking forward to hearing from you" — too generic.
- signoff: "Sincerely," for professional, "Warmly," for warm, "Best," for direct.

Return STRICT JSON, no markdown, no commentary outside the JSON:

{
  "greeting": "<...>",
  "opening_hook": "<1-2 sentences>",
  "body_paragraphs": ["<para 1>", "<para 2>"],
  "closing": "<closing paragraph>",
  "signoff": "<...>",
  "candidate_name": "<extracted from resume>",
  "company_name": <"<name>" or null>,
  "role_title": <"<title>" or null>
}

RESUME:
"""
${resume}
"""

JOB DESCRIPTION:
"""
${jd}
"""

Return ONLY the JSON.`;
}

export const COVER_LETTER_SCHEMA = {
  type: "object",
  properties: {
    greeting: { type: "string" },
    opening_hook: { type: "string" },
    body_paragraphs: { type: "array", items: { type: "string" } },
    closing: { type: "string" },
    signoff: { type: "string" },
    candidate_name: { type: "string" },
    company_name: { type: "string", nullable: true },
    role_title: { type: "string", nullable: true },
  },
  required: [
    "greeting",
    "opening_hook",
    "body_paragraphs",
    "closing",
    "signoff",
    "candidate_name",
  ],
};

/**
 * Flatten a cover letter into copy-pasteable plain text.
 * Used by the modal Copy button and as the body for .docx export.
 */
export function coverLetterToPlainText(letter: CoverLetterOutput): string {
  const lines: string[] = [];
  lines.push(letter.greeting);
  lines.push("");
  lines.push(letter.opening_hook);
  lines.push("");
  for (const p of letter.body_paragraphs) {
    lines.push(p);
    lines.push("");
  }
  lines.push(letter.closing);
  lines.push("");
  lines.push(letter.signoff);
  lines.push(letter.candidate_name);
  return lines.join("\n").trim();
}
