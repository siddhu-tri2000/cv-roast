export interface JobListing {
  title: string;
  company: string;
  location: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  posted_at: string;
  snippet: string;
  apply_url: string;
  source: "adzuna";
}

export interface JobsResponse {
  listings: JobListing[];
  source: "adzuna" | "cache" | "none";
  cached: boolean;
  attribution?: { name: string; url: string };
}
