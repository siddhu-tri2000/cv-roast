import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BulletGroup {
  section: string;
  bullets: string[];
}

interface ExportRequestBody {
  full_name?: unknown;
  contact_line?: unknown;   // "email · phone · city · linkedin"
  summary?: unknown;
  skills?: unknown;          // string[] or comma-separated string
  experience?: unknown;      // BulletGroup[]
  education?: unknown;       // BulletGroup[]
  filename?: unknown;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function asGroups(v: unknown): BulletGroup[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((g): g is { section?: unknown; bullets?: unknown } => typeof g === "object" && g !== null)
    .map((g) => ({
      section: asString(g.section),
      bullets: asStringArray(g.bullets),
    }))
    .filter((g) => g.section.length > 0);
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function plain(text: string, opts: { bold?: boolean; size?: number; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: 80 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size })],
  });
}

export async function POST(req: Request) {
  let payload: ExportRequestBody;
  try {
    payload = (await req.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = asString(payload.full_name) || "Your Name";
  const contact = asString(payload.contact_line);
  const summary = asString(payload.summary);
  const skills = asStringArray(payload.skills);
  const experience = asGroups(payload.experience);
  const education = asGroups(payload.education);
  const filename = (asString(payload.filename) || "resume").replace(/[^a-z0-9-_]/gi, "_");

  const children: Paragraph[] = [];

  // Header
  children.push(plain(fullName, { bold: true, size: 32, align: AlignmentType.CENTER }));
  if (contact) children.push(plain(contact, { size: 20, align: AlignmentType.CENTER }));

  // Summary
  if (summary) {
    children.push(heading("Professional Summary"));
    children.push(plain(summary, { size: 22 }));
  }

  // Skills
  if (skills.length > 0) {
    children.push(heading("Skills"));
    children.push(plain(skills.join(", "), { size: 22 }));
  }

  // Experience
  if (experience.length > 0) {
    children.push(heading("Experience"));
    for (const group of experience) {
      children.push(plain(group.section, { bold: true, size: 22 }));
      for (const b of group.bullets) children.push(bullet(b));
    }
  }

  // Education
  if (education.length > 0) {
    children.push(heading("Education"));
    for (const group of education) {
      children.push(plain(group.section, { bold: true, size: 22 }));
      for (const b of group.bullets) children.push(bullet(b));
    }
  }

  const doc = new Document({
    creator: "CareerCompass",
    title: `${fullName} — Resume`,
    sections: [{ properties: {}, children }],
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
