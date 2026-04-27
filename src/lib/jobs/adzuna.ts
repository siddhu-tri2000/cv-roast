import type { JobListing } from "./types";

interface AdzunaResult {
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  description?: string;
}

interface AdzunaResponse {
  count?: number;
  results?: AdzunaResult[];
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hit Adzuna's India search endpoint. Returns up to `results` listings.
 * Throws if not configured or upstream fails.
 */
export async function fetchAdzuna(
  role: string,
  location: string | undefined,
  results = 5,
): Promise<JobListing[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna API not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY missing)");
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(Math.min(results, 20)),
    what: role,
    "content-type": "application/json",
  });
  if (location?.trim()) params.set("where", location.trim());

  const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Adzuna API ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = (await res.json()) as AdzunaResponse;

  return (data.results ?? []).map<JobListing>((r) => ({
    title: r.title,
    company: r.company?.display_name ?? "—",
    location: r.location?.display_name ?? "",
    salary_min: r.salary_min ?? null,
    salary_max: r.salary_max ?? null,
    salary_currency: "INR",
    posted_at: r.created,
    snippet: stripHtml(r.description ?? "").slice(0, 240),
    apply_url: r.redirect_url,
    source: "adzuna",
  }));
}
