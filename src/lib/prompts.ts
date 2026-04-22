export type Tone = "roast" | "honest" | "encouraging";

// ===== ROAST =====

export interface SectionFinding {
  name: string;
  score: number;
  issues: string[];
  verdict: string;
}

export interface RoastResult {
  overall_roast: string;
  overall_score: number;
  sections: SectionFinding[];
  top_3_fixes: string[];
}

const TONE_GUIDANCE: Record<Tone, string> = {
  roast:
    "Witty, sharp, slightly brutal — like a brutally honest friend who works in HR. Make people laugh while landing real critique. Never insult the person, only the writing. Use plain English, no jargon.",
  honest:
    "Direct, professional, no jokes. Plain English. Like a senior recruiter giving a straight assessment in 60 seconds. Respect the user's time.",
  encouraging:
    "Supportive and constructive. Frame every issue as an opportunity. Acknowledge what is working before pointing out what to improve. Best for career changers and recent grads.",
};

export function buildRoastPrompt(resume: string, tone: Tone): string {
  return `You are an expert career coach and former tech recruiter reviewing a resume.

TONE: ${tone.toUpperCase()} — ${TONE_GUIDANCE[tone]}

You will return a JSON object with this exact shape (no extra keys, no markdown, no commentary outside the JSON):

{
  "overall_roast": "<2 short paragraphs in the selected tone>",
  "overall_score": <integer 0-100, your honest assessment of resume strength>,
  "sections": [
    {
      "name": "<section name e.g. Summary, Experience, Skills, Education, Formatting>",
      "score": <integer 0-10>,
      "issues": ["<short specific issue>", "<another>"],
      "verdict": "<one-line takeaway>"
    }
  ],
  "top_3_fixes": ["<actionable fix 1>", "<actionable fix 2>", "<actionable fix 3>"]
}

Rules:
- Never fabricate facts about the user. If a section is missing, score it 0 and say so.
- Cover at minimum: Summary, Experience, Skills, Education, Formatting/Length.
- Be specific. "Add numbers" is bad. "Quantify the team-lead bullet under Acme Corp" is good.
- Be conservative with scores. A genuinely strong resume scores 75-85. 90+ is rare.
- Output JSON ONLY. No prose before or after.

RESUME:
"""
${resume}
"""`;
}

export const ROAST_SCHEMA = {
  type: "object",
  properties: {
    overall_roast: { type: "string" },
    overall_score: { type: "integer" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "integer" },
          issues: { type: "array", items: { type: "string" } },
          verdict: { type: "string" },
        },
        required: ["name", "score", "issues", "verdict"],
      },
    },
    top_3_fixes: { type: "array", items: { type: "string" } },
  },
  required: ["overall_roast", "overall_score", "sections", "top_3_fixes"],
};

// ===== JOB MATCH =====

export interface RoleSuggestion {
  title: string;
  why_you_fit: string;
}

export interface StretchRole {
  title: string;
  gaps: string[];
  estimated_time_to_ready: string;
}

export interface PivotRole {
  title: string;
  transferable_skills: string[];
  why_it_works: string;
}

export interface SkillGapItem {
  skill: string;
  severity: "critical" | "important" | "nice_to_have";
  how_to_close: string;
}

export interface CandidateProfile {
  seniority: string;
  years_experience: number;
  primary_industry: string;
  top_skills: string[];
}

export interface MatchResult {
  profile: CandidateProfile;
  apply_today: RoleSuggestion[];
  stretch_roles: StretchRole[];
  pivot_roles: PivotRole[];
  industry_demand: string;
  target_role_gap?: {
    target: string;
    overall_readiness: number;
    gaps: SkillGapItem[];
    summary: string;
  } | null;
}

export function buildMatchPrompt(resume: string, targetRole: string | null): string {
  return `You are a senior career coach who has placed thousands of professionals into roles.

Analyse this resume and produce job-matching recommendations.

${targetRole ? `The user's stated target role is: "${targetRole}". You MUST include the target_role_gap analysis.` : "The user did not specify a target role. Set target_role_gap to null."}

Return a JSON object with this exact shape (no extra keys, no markdown, no prose outside the JSON):

{
  "profile": {
    "seniority": "<e.g. Junior, Mid, Senior, Staff, Director>",
    "years_experience": <integer>,
    "primary_industry": "<e.g. SaaS, Fintech, Healthcare>",
    "top_skills": ["<skill1>", "<skill2>", "<up to 8>"]
  },
  "apply_today": [
    { "title": "<specific role title>", "why_you_fit": "<1-2 sentence explanation>" }
  ],
  "stretch_roles": [
    {
      "title": "<role 1-2 levels up>",
      "gaps": ["<specific gap 1>", "<specific gap 2>"],
      "estimated_time_to_ready": "<e.g. 6-12 months>"
    }
  ],
  "pivot_roles": [
    {
      "title": "<adjacent role they may not have considered>",
      "transferable_skills": ["<skill1>", "<skill2>"],
      "why_it_works": "<1-2 sentence explanation>"
    }
  ],
  "industry_demand": "<2-3 sentences on which industries are actively hiring this profile right now>",
  "target_role_gap": ${targetRole ? `{
    "target": "${targetRole}",
    "overall_readiness": <integer 0-100>,
    "gaps": [
      { "skill": "<missing skill or experience>", "severity": "critical|important|nice_to_have", "how_to_close": "<specific actionable advice>" }
    ],
    "summary": "<2-3 sentence honest assessment of where they stand>"
  }` : "null"}
}

Rules:
- Provide 3 apply_today roles, 2 stretch_roles, 2 pivot_roles.
- Use REAL, current job titles. Do NOT invent companies. Do NOT quote salary bands.
- Be specific about gaps. "More leadership" is bad. "Experience managing managers, not just ICs" is good.
- For 'severity': critical = blocks them entirely; important = noticeable disadvantage; nice_to_have = polish.
- Be honest. If the resume doesn't support a target role, say so.
- Output JSON ONLY.

RESUME:
"""
${resume}
"""`;
}

export const MATCH_SCHEMA = {
  type: "object",
  properties: {
    profile: {
      type: "object",
      properties: {
        seniority: { type: "string" },
        years_experience: { type: "integer" },
        primary_industry: { type: "string" },
        top_skills: { type: "array", items: { type: "string" } },
      },
      required: ["seniority", "years_experience", "primary_industry", "top_skills"],
    },
    apply_today: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          why_you_fit: { type: "string" },
        },
        required: ["title", "why_you_fit"],
      },
    },
    stretch_roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          gaps: { type: "array", items: { type: "string" } },
          estimated_time_to_ready: { type: "string" },
        },
        required: ["title", "gaps", "estimated_time_to_ready"],
      },
    },
    pivot_roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          transferable_skills: { type: "array", items: { type: "string" } },
          why_it_works: { type: "string" },
        },
        required: ["title", "transferable_skills", "why_it_works"],
      },
    },
    industry_demand: { type: "string" },
    target_role_gap: {
      type: "object",
      nullable: true,
      properties: {
        target: { type: "string" },
        overall_readiness: { type: "integer" },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              skill: { type: "string" },
              severity: { type: "string", enum: ["critical", "important", "nice_to_have"] },
              how_to_close: { type: "string" },
            },
            required: ["skill", "severity", "how_to_close"],
          },
        },
        summary: { type: "string" },
      },
      required: ["target", "overall_readiness", "gaps", "summary"],
    },
  },
  required: [
    "profile",
    "apply_today",
    "stretch_roles",
    "pivot_roles",
    "industry_demand",
  ],
};
