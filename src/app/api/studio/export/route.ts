import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  BorderStyle,
  HeightRule,
} from "docx";
import type {
  StructuredResume,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
  ResumeCertification,
  ResumeSkillGroup,
} from "@/lib/studioPrompts";
import type { CoverLetterOutput } from "@/lib/coverLetterPrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportRequestBody {
  // Either a structured_resume (legacy / default kind=resume) OR a cover_letter payload.
  kind?: "resume" | "cover_letter";
  structured_resume?: StructuredResume;
  cover_letter?: CoverLetterOutput;
  filename?: unknown;
}

const FONT = "Calibri";
const SIZE_BODY = 22; // half-points (11pt)
const SIZE_NAME = 36; // 18pt
const SIZE_SECTION = 24; // 12pt
const SIZE_SUBHEAD = 22; // 11pt

function tr(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({
    text,
    font: FONT,
    size: opts.size ?? SIZE_BODY,
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color,
  });
}

function nameLine(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [tr(text, { bold: true, size: SIZE_NAME })],
  });
}

function contactLine(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [tr(text, { size: 20, color: "595959" })],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: {
      bottom: { color: "808080", space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [tr(text.toUpperCase(), { bold: true, size: SIZE_SECTION, color: "1F2A4A" })],
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120, line: 280 },
    children: [tr(text)],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 280 },
    indent: { left: 360, hanging: 200 },
    children: [tr(text)],
  });
}

// Title left, dates right (using a right-aligned tab stop)
function jobHeader(left: string, right: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      tr(left, { bold: true, size: SIZE_SUBHEAD }),
      tr("\t"),
      tr(right, { size: SIZE_SUBHEAD, color: "595959" }),
    ],
  });
}

function jobSubheader(left: string, right: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      tr(left, { italic: true, size: SIZE_BODY, color: "404040" }),
      tr("\t"),
      tr(right, { italic: true, size: SIZE_BODY, color: "595959" }),
    ],
  });
}

function buildContactString(c: StructuredResume["contact"]): string {
  return [c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" · ");
}

function dateRange(start: string, end: string): string {
  const s = (start || "").trim();
  const e = (end || "").trim();
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

function renderSkills(skills: ResumeSkillGroup[]): Paragraph[] {
  if (!skills?.length) return [];
  const out: Paragraph[] = [sectionHeading("Skills")];
  for (const group of skills) {
    if (!group?.items?.length) continue;
    out.push(
      new Paragraph({
        spacing: { after: 80, line: 280 },
        children: [
          tr(`${group.category}: `, { bold: true }),
          tr(group.items.join(", ")),
        ],
      }),
    );
  }
  return out;
}

function renderExperience(experience: ResumeExperience[]): Paragraph[] {
  if (!experience?.length) return [];
  const out: Paragraph[] = [sectionHeading("Experience")];
  for (const job of experience) {
    if (!job) continue;
    const titleAtCompany = [job.title, job.company].filter(Boolean).join(" · ");
    out.push(jobHeader(titleAtCompany, dateRange(job.start_date, job.end_date)));
    if (job.location) {
      out.push(jobSubheader(job.location, ""));
    } else {
      out.push(new Paragraph({ spacing: { after: 40 }, children: [tr("")] }));
    }
    for (const b of job.bullets ?? []) {
      if (b?.trim()) out.push(bulletParagraph(b.trim()));
    }
  }
  return out;
}

function renderEducation(education: ResumeEducation[]): Paragraph[] {
  if (!education?.length) return [];
  const out: Paragraph[] = [sectionHeading("Education")];
  for (const ed of education) {
    if (!ed) continue;
    const left = [ed.degree, ed.institution].filter(Boolean).join(" · ");
    out.push(jobHeader(left, dateRange(ed.start_date, ed.end_date)));
    if (ed.location || ed.details) {
      out.push(jobSubheader(ed.location || "", ed.details || ""));
    }
  }
  return out;
}

function renderProjects(projects: ResumeProject[]): Paragraph[] {
  if (!projects?.length) return [];
  const out: Paragraph[] = [sectionHeading("Projects")];
  for (const p of projects) {
    if (!p) continue;
    out.push(jobHeader(p.name, p.link || ""));
    if (p.description) {
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [tr(p.description, { italic: true, color: "404040" })],
        }),
      );
    }
    for (const b of p.bullets ?? []) {
      if (b?.trim()) out.push(bulletParagraph(b.trim()));
    }
  }
  return out;
}

function renderCertifications(certs: ResumeCertification[]): Paragraph[] {
  if (!certs?.length) return [];
  const out: Paragraph[] = [sectionHeading("Certifications")];
  for (const c of certs) {
    if (!c) continue;
    const left = [c.name, c.issuer].filter(Boolean).join(" — ");
    out.push(jobHeader(left, c.date || ""));
  }
  return out;
}

function buildCoverLetterChildren(letter: CoverLetterOutput): Paragraph[] {
  const out: Paragraph[] = [];
  const para = (text: string, opts: { spacingAfter?: number } = {}) =>
    new Paragraph({
      spacing: { after: opts.spacingAfter ?? 200, line: 300 },
      children: [tr(text)],
    });
  const blank = () => new Paragraph({ spacing: { after: 100 }, children: [tr("")] });

  out.push(para(letter.greeting, { spacingAfter: 240 }));
  if (letter.opening_hook?.trim()) out.push(para(letter.opening_hook));
  for (const p of letter.body_paragraphs ?? []) {
    if (p?.trim()) out.push(para(p));
  }
  if (letter.closing?.trim()) out.push(para(letter.closing, { spacingAfter: 240 }));
  out.push(new Paragraph({ spacing: { after: 60 }, children: [tr(letter.signoff || "Sincerely,")] }));
  out.push(blank());
  out.push(new Paragraph({ children: [tr(letter.candidate_name || "", { bold: true })] }));
  return out;
}

export async function POST(req: Request) {
  let payload: ExportRequestBody;
  try {
    payload = (await req.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const filename = (typeof payload.filename === "string" && payload.filename.trim()
    ? payload.filename.trim()
    : "document").replace(/[^a-z0-9-_]/gi, "_");

  // Discriminate on kind. Default to resume for backward compatibility.
  const kind = payload.kind === "cover_letter" ? "cover_letter" : "resume";

  let children: Paragraph[];
  let docTitle: string;

  if (kind === "cover_letter") {
    const letter = payload.cover_letter;
    if (!letter || !letter.candidate_name || !letter.body_paragraphs?.length) {
      return NextResponse.json({ error: "Missing cover_letter payload" }, { status: 400 });
    }
    children = buildCoverLetterChildren(letter);
    docTitle = `${letter.candidate_name} — Cover Letter`;
  } else {
    const sr = payload.structured_resume;
    if (!sr || !sr.full_name) {
      return NextResponse.json({ error: "Missing structured_resume" }, { status: 400 });
    }

    children = [];
    children.push(nameLine(sr.full_name));
    const contact = buildContactString(sr.contact);
    if (contact) children.push(contactLine(contact));

    if (sr.summary?.trim()) {
      children.push(sectionHeading("Professional Summary"));
      children.push(bodyParagraph(sr.summary.trim()));
    }
    children.push(...renderSkills(sr.skills ?? []));
    children.push(...renderExperience(sr.experience ?? []));
    children.push(...renderProjects(sr.projects ?? []));
    children.push(...renderEducation(sr.education ?? []));
    children.push(...renderCertifications(sr.certifications ?? []));

    docTitle = `${sr.full_name} — Resume`;
  }

  const doc = new Document({
    creator: "CareerCompass",
    title: docTitle,
    description: "Generated by CareerCompass Resume Studio",
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE_BODY } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5"
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
