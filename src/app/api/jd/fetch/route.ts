import { NextResponse } from "next/server";
import dns from "dns/promises";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500_000;
const MAX_REDIRECTS = 2;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_TEXT_CHARS = 12_000;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "metadata.google.internal",
]);

/**
 * Check whether an IP address is private/loopback/link-local/metadata.
 * Returns true if the IP MUST be blocked.
 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "0.0.0.0") return true;
  // AWS / GCP / Azure metadata service
  if (ip === "169.254.169.254") return true;
  // IPv4 private ranges
  const v4 = ip.split(".").map(Number);
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;        // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  // IPv6: block private/link-local prefixes
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe80:")) return true;                         // link-local
  if (lower === "::") return true;
  return false;
}

async function resolveAndValidate(hostname: string): Promise<void> {
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) {
    throw new Error("blocked-host");
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("dns-failed");
  }
  if (!addresses.length) throw new Error("dns-failed");
  for (const a of addresses) {
    if (isPrivateIp(a.address)) throw new Error("private-ip");
  }
}

interface FetchResult {
  text: string;
  contentType: string;
  finalUrl: string;
}

/**
 * Manual fetch with redirect limit, byte cap, and per-hop SSRF revalidation.
 * Each redirect hop has its hostname re-resolved and validated.
 */
async function safeFetch(initialUrl: string, signal: AbortSignal): Promise<FetchResult> {
  let url = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) throw new Error("bad-protocol");
    await resolveAndValidate(parsed.hostname);

    const res = await fetch(url, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "CareerCompassBot/1.0 (+https://career-compass-orpin-tau.vercel.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect-no-location");
      url = new URL(loc, url).toString();
      continue;
    }

    if (!res.ok) throw new Error(`http-${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!/^text\/|application\/(xhtml|xml|json)/i.test(contentType)) {
      throw new Error("bad-content-type");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("no-body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
    let offset = 0;
    for (const c of chunks) {
      const slice = c.subarray(0, Math.min(c.length, buf.length - offset));
      buf.set(slice, offset);
      offset += slice.length;
      if (offset >= buf.length) break;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return { text, contentType, finalUrl: url };
  }
  throw new Error("too-many-redirects");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Try to extract a JobPosting from JSON-LD structured data.
 * Works across any site that uses Schema.org JobPosting markup.
 */
function extractJsonLd(html: string): string | null {
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        const candidates = obj["@graph"]
          ? (obj["@graph"] as Record<string, unknown>[])
          : [obj];

        for (const c of candidates) {
          if (c["@type"] !== "JobPosting") continue;
          const parts: string[] = [];
          if (c.title) parts.push(`Title: ${c.title}`);
          if (c.hiringOrganization && typeof c.hiringOrganization === "object") {
            const org = c.hiringOrganization as Record<string, unknown>;
            if (org.name) parts.push(`Company: ${org.name}`);
          }
          if (c.jobLocation) {
            const locs = Array.isArray(c.jobLocation) ? c.jobLocation : [c.jobLocation];
            const locStrs = locs.map((l: unknown) => {
              if (typeof l === "string") return l;
              if (typeof l === "object" && l !== null) {
                const lo = l as Record<string, unknown>;
                const addr = lo.address as Record<string, unknown> | undefined;
                if (addr) {
                  return [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry]
                    .filter(Boolean).join(", ");
                }
                return (lo.name as string) ?? "";
              }
              return "";
            }).filter(Boolean);
            if (locStrs.length) parts.push(`Location: ${locStrs.join(" | ")}`);
          }
          if (c.employmentType) parts.push(`Type: ${Array.isArray(c.employmentType) ? c.employmentType.join(", ") : c.employmentType}`);
          if (c.description) {
            const clean = decodeEntities(stripTags(String(c.description)))
              .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
            parts.push(`\nDescription:\n${clean}`);
          }
          for (const key of ["qualifications", "skills", "responsibilities", "experienceRequirements", "educationRequirements"]) {
            if (c[key]) parts.push(`\n${key[0].toUpperCase() + key.slice(1)}:\n${c[key]}`);
          }
          const result = parts.join("\n").trim();
          if (result.length > 100) return result.slice(0, MAX_TEXT_CHARS);
        }
      }
    } catch { /* invalid JSON — try next block */ }
  }
  return null;
}

/**
 * Extract structured metadata from <meta> tags.
 * og:description / description often contain a decent JD summary.
 */
function extractMetaDescription(html: string): string | null {
  const metas: string[] = [];
  const re = /<meta\s[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/content\s*=\s*["']([^"']*?)["']/i);
    if (!nameMatch || !contentMatch) continue;
    const name = nameMatch[1].toLowerCase();
    if (["og:description", "description", "twitter:description"].includes(name)) {
      const val = decodeEntities(contentMatch[1]).trim();
      if (val.length > 50) metas.push(val);
    }
  }
  // Return the longest meta description
  if (!metas.length) return null;
  metas.sort((a, b) => b.length - a.length);
  return metas[0];
}

/**
 * Score a text block by how likely it is to be a real job description
 * vs. a sidebar listing, navigation menu, or boilerplate.
 */
function scoreBlock(text: string): number {
  if (text.length < 80) return 0;
  let score = text.length; // longer content = more likely to be the JD

  // Bonus for job-related keywords
  const jobKeywords = /\b(responsibilities|requirements|qualifications|experience|skills|salary|benefits|apply|role|position|team|collaborate|manage|develop|design|engineer|years)\b/gi;
  const keywordHits = (text.match(jobKeywords) ?? []).length;
  score += keywordHits * 200;

  // Bonus for list items (JDs have lots of bullet points)
  const listItems = (text.match(/[•·\-–—]\s|^\d+\.\s/gm) ?? []).length;
  score += listItems * 100;

  // Penalty for lots of very short lines (sidebar job listings, nav items)
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const shortLines = lines.filter((l) => l.trim().length < 40);
  const shortRatio = lines.length > 0 ? shortLines.length / lines.length : 0;
  if (shortRatio > 0.7 && lines.length > 10) score *= 0.2; // mostly short = sidebar noise

  // Penalty for high repetition (same text appearing many times)
  const lineCounts = new Map<string, number>();
  for (const l of lines) {
    const key = l.trim().toLowerCase().slice(0, 60);
    lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
  }
  const duplicates = [...lineCounts.values()].filter((c) => c > 2).length;
  if (duplicates > 3) score *= 0.3;

  return score;
}

/**
 * Generic content extraction: strip chrome, score candidate blocks,
 * pick the one most likely to be the actual job description.
 */
function extractMainText(html: string): { text: string; title: string | null } {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim().slice(0, 200) : null;

  cleaned = cleaned
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // Extract candidate blocks from semantic elements
  const candidates: { html: string; source: string }[] = [];
  for (const tag of ["main", "article", "section"]) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m;
    while ((m = re.exec(cleaned)) !== null) {
      candidates.push({ html: m[1], source: tag });
    }
  }
  // Also try role="main" divs
  const roleMain = cleaned.match(/<div[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/div>/gi);
  if (roleMain) {
    for (const rm of roleMain) {
      candidates.push({ html: rm, source: "role-main" });
    }
  }
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) candidates.push({ html: bodyMatch[1], source: "body" });
  if (!candidates.length) candidates.push({ html: cleaned, source: "full" });

  // Convert to text and score each block
  const scored = candidates.map((c) => {
    const text = decodeEntities(stripTags(c.html))
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+|\s+$/gm, "")
      .trim();
    return { text, score: scoreBlock(text), source: c.source };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.text ?? "";

  // Post-cleanup: deduplicate consecutive identical lines
  const lines = best.split("\n");
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && lines[i].trim() === lines[i - 1].trim() && lines[i].trim().length < 80) continue;
    deduped.push(lines[i]);
  }

  const text = deduped.join("\n").trim().slice(0, MAX_TEXT_CHARS);
  return { text, title };
}

interface FetchBody {
  url?: unknown;
}

export async function POST(req: Request) {
  const rl = await checkRateLimit(req, "jd-fetch", 10, 60);
  if (!rl.success) return rateLimitResponse(rl);

  let body: FetchBody;
  try {
    body = (await req.json()) as FetchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const fetched = await safeFetch(parsed.toString(), controller.signal);

    // Layer 1: Structured JSON-LD (best quality — works on most job boards)
    const jsonLdText = extractJsonLd(fetched.text);
    if (jsonLdText && jsonLdText.length >= 80) {
      const titleMatch = fetched.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim().slice(0, 200) : null;
      return NextResponse.json({
        text: jsonLdText,
        title,
        source_url: fetched.finalUrl,
        bytes: fetched.text.length,
      });
    }

    // Layer 2: Content-density scored HTML extraction
    const { text: htmlText, title } = extractMainText(fetched.text);

    // Layer 3: If HTML extraction is thin, supplement with meta description
    let text = htmlText;
    if (text.length < 200) {
      const metaDesc = extractMetaDescription(fetched.text);
      if (metaDesc) {
        const prefix = title ? `${title}\n\n` : "";
        text = `${prefix}${metaDesc}`.slice(0, MAX_TEXT_CHARS);
      }
    }

    if (text.length < 80) {
      return NextResponse.json(
        { error: "Couldn't extract a readable job description from that page. Try copy-pasting the text instead." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text,
      title,
      source_url: fetched.finalUrl,
      bytes: fetched.text.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch-failed";
    const userMessage =
      msg === "blocked-host" || msg === "private-ip"
        ? "That URL points to a private network and can't be fetched."
        : msg === "bad-protocol"
        ? "Only http/https URLs are allowed."
        : msg === "bad-content-type"
        ? "That URL didn't return an HTML page."
        : msg === "dns-failed"
        ? "Couldn't resolve that domain."
        : msg === "too-many-redirects"
        ? "That page redirected too many times."
        : msg.startsWith("http-")
        ? `The page returned ${msg.replace("http-", "HTTP ")}.`
        : (e as Error)?.name === "AbortError"
        ? "That page took too long to load (5s timeout)."
        : "Couldn't fetch the page. Try copy-pasting the text instead.";
    return NextResponse.json({ error: userMessage }, { status: 422 });
  } finally {
    clearTimeout(timer);
  }
}
