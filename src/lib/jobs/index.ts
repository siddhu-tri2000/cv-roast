import { getAdminSupabase } from "@/lib/supabase/server";
import { fetchAdzuna } from "./adzuna";
import type { JobListing, JobsResponse } from "./types";

const CACHE_TTL_HOURS = 6;
const ADZUNA_ATTRIBUTION = { name: "Adzuna", url: "https://www.adzuna.in" };

function cacheKey(role: string, location?: string): string {
  return `${role.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`;
}

/**
 * Fetch live jobs for a role/location with a 6-hour Supabase-backed cache.
 * On upstream failure, serves stale cache if available; otherwise empty.
 */
export async function fetchLiveJobs(
  role: string,
  location?: string,
): Promise<JobsResponse> {
  const key = cacheKey(role, location);
  const admin = getAdminSupabase();

  const { data: cached } = await admin
    .from("job_listings_cache")
    .select("listings, expires_at")
    .eq("cache_key", key)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return {
      listings: cached.listings as JobListing[],
      source: "cache",
      cached: true,
      attribution: ADZUNA_ATTRIBUTION,
    };
  }

  try {
    const fresh = await fetchAdzuna(role, location, 5);
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600 * 1000).toISOString();
    await admin.from("job_listings_cache").upsert(
      {
        cache_key: key,
        role,
        location: location ?? null,
        listings: fresh,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" },
    );
    return {
      listings: fresh,
      source: "adzuna",
      cached: false,
      attribution: ADZUNA_ATTRIBUTION,
    };
  } catch (e) {
    console.error("fetchLiveJobs: upstream failed", e);
    if (cached) {
      return {
        listings: cached.listings as JobListing[],
        source: "cache",
        cached: true,
        attribution: ADZUNA_ATTRIBUTION,
      };
    }
    return { listings: [], source: "none", cached: false };
  }
}
