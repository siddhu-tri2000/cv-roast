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
 * Strip script/style/nav/footer/header, take the largest of <main>/<article>/<body>.
 * Collapse whitespace. Returns plain text clamped to MAX_TEXT_CHARS.
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

  const candidates: string[] = [];
  for (const tag of ["main", "article"]) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m;
    while ((m = re.exec(cleaned)) !== null) candidates.push(m[1]);
  }
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) candidates.push(bodyMatch[1]);
  if (!candidates.length) candidates.push(cleaned);

  candidates.sort((a, b) => b.length - a.length);
  const best = candidates[0];

  const text = decodeEntities(stripTags(best))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim()
    .slice(0, MAX_TEXT_CHARS);

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
    const { text, title } = extractMainText(fetched.text);

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
