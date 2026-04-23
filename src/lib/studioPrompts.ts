// ===== RESUME STUDIO =====
// Two modes: ATS Polish (no JD) and JD Tailor (with JD)

export interface AtsScoreBreakdown {
  overall: number;
  impact: number;
  brevity: number;
  ats_format: number;
  keywords: number;
}

export interface AtsCheck {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
}

export interface BulletRewrite {
  section: string;
  original: string;
  rewritten: string;
  why_better: string;
}

export interface PolishOutput {
  ats_score: AtsScoreBreakdown;
  one_line_summary: string;
  checks: AtsCheck[];
  rewritten_bullets: BulletRewrite[];
  rewritten_summary: string | null;
  top_suggestions: string[];
}

export interface KeywordChip {
  keyword: string;
  importance: "must_have" | "nice_to_have";
}

export interface TailorOutput {
  match_score: number;
  match_reason: string;
  hard_skills_matched: KeywordChip[];
  hard_skills_missing: KeywordChip[];
  soft_skills_matched: KeywordChip[];
  soft_skills_missing: KeywordChip[];
  rewritten_summary: string;
  rewritten_bullets: BulletRewrite[];
  ats_format_warnings: string[];
  cover_letter_hook: string;
}

const ATS_SCORE_RUBRIC = `Score 0-100 on FOUR axes (and an overall):
- impact: Do bullets show measurable outcomes (numbers, %, $, INR, time saved, scale)?
- brevity: Is it under 2 pages, no bloat, no soft padding?
- ats_format: Single column? No tables, headers, footers, images, columns, fancy fonts? Clear sections (Summary, Experience, Skills, Education)?
- keywords: Does it use industry-standard terminology a recruiter would search for?
overall = weighted avg (impact 0.35, keywords 0.25, ats_format 0.25, brevity 0.15), rounded.`;

const ANTI_HALLUCINATION = `CRITICAL: ANTI-HALLUCINATION
- Use ONLY facts present in the resume. NEVER invent numbers, dates, employers, achievements, or technologies.
- If a bullet has no numbers and you can't truthfully add one, rewrite it for clarity but DO NOT make up metrics.
- If you genuinely cannot improve a bullet without inventing facts, you may keep "rewritten" identical to "original" and explain in why_better.`;

export function buildPolishPrompt(resume: string): string {
  return `You are an expert ATS resume reviewer who has rewritten thousands of resumes for top recruiters at Google, Microsoft, McKinsey, and India's top product companies.

Your job: take this resume and produce an ATS-friendly rewrite with a score and per-bullet improvements.

${ANTI_HALLUCINATION}

${ATS_SCORE_RUBRIC}

Return STRICT JSON, no markdown, no commentary outside the JSON:

{
  "ats_score": {
    "overall": <0-100 int>,
    "impact": <0-100 int>,
    "brevity": <0-100 int>,
    "ats_format": <0-100 int>,
    "keywords": <0-100 int>
  },
  "one_line_summary": "<one honest sentence summarising the resume's current state>",
  "checks": [
    { "id": "single_column", "label": "Single-column layout", "passed": <true/false>, "hint": "<one short sentence>" },
    { "id": "no_tables", "label": "No tables or graphics", "passed": <bool>, "hint": "<...>" },
    { "id": "quantified", "label": "Bullets are quantified", "passed": <bool>, "hint": "<...>" },
    { "id": "action_verbs", "label": "Strong action verbs", "passed": <bool>, "hint": "<...>" },
    { "id": "consistent_tense", "label": "Consistent tense", "passed": <bool>, "hint": "<...>" },
    { "id": "summary_present", "label": "Has a professional summary", "passed": <bool>, "hint": "<...>" },
    { "id": "skills_section", "label": "Has a clear skills section", "passed": <bool>, "hint": "<...>" },
    { "id": "ats_safe_format", "label": "Free of headers/footers/images", "passed": <bool>, "hint": "<...>" }
  ],
  "rewritten_summary": "<a 2-3 line professional summary in third person, ATS-friendly. Use only facts from the resume. Or null if you cannot truthfully write one.>",
  "rewritten_bullets": [
    {
      "section": "<e.g. 'Experience — Senior PM at Acme'>",
      "original": "<the original bullet, verbatim>",
      "rewritten": "<rewritten: starts with action verb, quantified if possible, ATS-safe, under 2 lines>",
      "why_better": "<one short sentence>"
    }
  ],
  "top_suggestions": [
    "<3-5 highest-impact, prioritised, actionable suggestions. e.g. 'Add a Skills section with comma-separated keywords for ATS pickup', 'Move Education below Experience for senior roles', etc.>"
  ]
}

Rules:
- Pick the 6-10 highest-impact bullets to rewrite (don't try to rewrite every line).
- Action verbs: led, built, shipped, scaled, drove, owned, reduced, grew, automated, launched, etc.
- Indian context: ₹ for INR amounts. No "USD" for Indian roles unless original says so.
- Be HONEST in scoring. A weak resume should score 40-60. Don't sandbag, don't over-praise.

RESUME:
"""
${resume}
"""

Return ONLY the JSON.`;
}

export const POLISH_SCHEMA = {
  type: "object",
  properties: {
    ats_score: {
      type: "object",
      properties: {
        overall: { type: "integer" },
        impact: { type: "integer" },
        brevity: { type: "integer" },
        ats_format: { type: "integer" },
        keywords: { type: "integer" },
      },
      required: ["overall", "impact", "brevity", "ats_format", "keywords"],
    },
    one_line_summary: { type: "string" },
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          passed: { type: "boolean" },
          hint: { type: "string" },
        },
        required: ["id", "label", "passed", "hint"],
      },
    },
    rewritten_summary: { type: "string", nullable: true },
    rewritten_bullets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          original: { type: "string" },
          rewritten: { type: "string" },
          why_better: { type: "string" },
        },
        required: ["section", "original", "rewritten", "why_better"],
      },
    },
    top_suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["ats_score", "one_line_summary", "checks", "rewritten_bullets", "top_suggestions"],
};

export function buildTailorPrompt(resume: string, jd: string): string {
  return `You are an expert ATS resume tailor. Recruiters at top Indian and global companies use systems like Greenhouse, Lever, Workday, and Naukri RMS that do keyword-based matching first.

Given this resume and this job description, produce:
1. A 0-100 match score (how well this CV would survive the ATS for this JD)
2. The keywords from the JD: which are present in the CV (matched) and which are missing
3. A rewritten professional summary tailored to the JD
4. 6-10 rewritten bullets that surface the right keywords and outcomes for this JD
5. ATS format warnings if any
6. A 1-line cover-letter hook the user can use as the opening line

${ANTI_HALLUCINATION}

Match score guidance:
- 80-100: strong fit, recommend applying as-is after these tweaks
- 60-79: real fit, needs the rewrites + likely 1-2 missing skills called out
- 40-59: stretch, missing several must-haves
- below 40: don't apply, pick a closer role

Return STRICT JSON, no markdown:

{
  "match_score": <0-100 int>,
  "match_reason": "<2-3 sentences explaining the score honestly>",
  "hard_skills_matched": [
    { "keyword": "<exact term as it appears in JD>", "importance": "must_have" | "nice_to_have" }
  ],
  "hard_skills_missing": [
    { "keyword": "<JD term not in CV>", "importance": "must_have" | "nice_to_have" }
  ],
  "soft_skills_matched": [{ "keyword": "<...>", "importance": "<...>" }],
  "soft_skills_missing": [{ "keyword": "<...>", "importance": "<...>" }],
  "rewritten_summary": "<2-3 line summary tailored to the JD, using only facts from the CV. Should naturally include 3-5 of the must-have keywords if truthful.>",
  "rewritten_bullets": [
    {
      "section": "<e.g. 'Experience — Senior PM at Acme'>",
      "original": "<verbatim original bullet>",
      "rewritten": "<rewritten to surface JD keywords + outcomes. Truthful.>",
      "why_better": "<one short sentence on which JD keywords/outcomes this now hits>"
    }
  ],
  "ats_format_warnings": [
    "<short warnings about formatting that would hurt ATS — e.g. 'Resume uses tables in Skills section — flatten to comma-separated list', 'Multiple columns detected', etc. Empty array if none.>"
  ],
  "cover_letter_hook": "<one strong opening sentence the user could paste into a cover letter or recruiter DM>"
}

Rules:
- Hard skills = technologies, tools, frameworks, methodologies, certifications, domain terms
- Soft skills = leadership, communication, ownership, etc. (less weight)
- Pull keywords as they appear in the JD (preserve casing, e.g. "Kubernetes" not "kubernetes")
- 8-15 keywords total per matched/missing category, prioritised by importance
- Indian context: ₹ for INR. No fabricated metrics ever.
- If JD is for a role the CV is clearly unqualified for (e.g. 1yr exp applying to VP role), say so honestly in match_reason and score it low.

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

const KEYWORD_CHIP_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      keyword: { type: "string" },
      importance: { type: "string", enum: ["must_have", "nice_to_have"] },
    },
    required: ["keyword", "importance"],
  },
};

export const TAILOR_SCHEMA = {
  type: "object",
  properties: {
    match_score: { type: "integer" },
    match_reason: { type: "string" },
    hard_skills_matched: KEYWORD_CHIP_SCHEMA,
    hard_skills_missing: KEYWORD_CHIP_SCHEMA,
    soft_skills_matched: KEYWORD_CHIP_SCHEMA,
    soft_skills_missing: KEYWORD_CHIP_SCHEMA,
    rewritten_summary: { type: "string" },
    rewritten_bullets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          original: { type: "string" },
          rewritten: { type: "string" },
          why_better: { type: "string" },
        },
        required: ["section", "original", "rewritten", "why_better"],
      },
    },
    ats_format_warnings: { type: "array", items: { type: "string" } },
    cover_letter_hook: { type: "string" },
  },
  required: [
    "match_score",
    "match_reason",
    "hard_skills_matched",
    "hard_skills_missing",
    "soft_skills_matched",
    "soft_skills_missing",
    "rewritten_summary",
    "rewritten_bullets",
    "ats_format_warnings",
    "cover_letter_hook",
  ],
};
