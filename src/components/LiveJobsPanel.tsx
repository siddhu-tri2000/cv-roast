"use client";

import { useEffect, useState } from "react";
import { buildJobLinks } from "@/lib/jobLinks";
import type { JobListing, JobsResponse } from "@/lib/jobs/types";

interface LiveJobsPanelProps {
  role: string;
  location: string;
}

const PREVIEW_COUNT = 2;

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recent";
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function salaryLabel(j: JobListing): string | null {
  if (!j.salary_min && !j.salary_max) return null;
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}k`;
  if (j.salary_min && j.salary_max && j.salary_min !== j.salary_max) {
    return `${fmt(j.salary_min)} – ${fmt(j.salary_max)}`;
  }
  return fmt(j.salary_min ?? j.salary_max ?? 0);
}

export default function LiveJobsPanel({ role, location }: LiveJobsPanelProps) {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const portalLinks = buildJobLinks(role, location);
  const linkedIn = portalLinks.find((l) => l.name.toLowerCase().includes("linkedin"));

  useEffect(() => {
    if (!role.trim()) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({ role });
        if (location.trim()) params.set("location", location.trim());
        const res = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as JobsResponse;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Couldn't fetch live openings — try the portal links below.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, location]);

  const listings = data?.listings ?? [];
  const visible = showAll ? listings : listings.slice(0, PREVIEW_COUNT);
  const moreCount = Math.max(0, listings.length - PREVIEW_COUNT);

  return (
    <div className="mt-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base">📡</span>
          <div>
            <div className="text-sm font-bold text-neutral-900">
              Live openings
              {location.trim() ? (
                <span className="font-normal text-neutral-500"> · {location.trim()}</span>
              ) : null}
            </div>
            {!loading && data && (
              <div className="text-[11px] text-neutral-500">
                {listings.length > 0
                  ? `${listings.length} live ${listings.length === 1 ? "match" : "matches"}${data.cached ? " · cached" : " · fresh"}`
                  : "No live matches right now"}
              </div>
            )}
          </div>
        </div>

        {linkedIn && (
          <a
            href={linkedIn.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#084e96]"
          >
            <span aria-hidden>{linkedIn.emoji}</span>
            <span>Search on LinkedIn</span>
            <span aria-hidden className="opacity-80">↗</span>
          </a>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-white"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
          No live matches via Adzuna right now. Try the portal links below — LinkedIn typically has the deepest catalogue.
        </div>
      )}

      {!loading && visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((j, idx) => {
            const sal = salaryLabel(j);
            return (
              <li
                key={`${j.apply_url}-${idx}`}
                className="rounded-lg border border-neutral-200 bg-white p-3 transition hover:border-indigo-300 hover:shadow-sm"
              >
                <a
                  href={j.apply_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-neutral-900 group-hover:text-indigo-700">
                        {j.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-medium text-neutral-700">
                        {j.company}
                        {j.location ? <span className="text-neutral-500"> · {j.location}</span> : null}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                      Apply ↗
                    </span>
                  </div>

                  {j.snippet && (
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-neutral-600">
                      {j.snippet}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                    <span>🕒 {relativeDate(j.posted_at)}</span>
                    {sal && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">
                        💰 {sal}
                      </span>
                    )}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && moreCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 transition hover:border-indigo-400 hover:bg-indigo-50"
        >
          {showAll ? "Show fewer" : `Show ${moreCount} more live ${moreCount === 1 ? "opening" : "openings"}`}
        </button>
      )}

      {portalLinks.length > 0 && (
        <div className="mt-3 border-t border-indigo-100 pt-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Also search on
          </div>
          <div className="flex flex-wrap gap-1.5">
            {portalLinks
              .filter((l) => !l.name.toLowerCase().includes("linkedin"))
              .map((l) => (
                <a
                  key={l.name}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
                >
                  <span>{l.emoji}</span>
                  <span>{l.name}</span>
                </a>
              ))}
          </div>
        </div>
      )}

      {data?.attribution && (
        <p className="mt-2 text-[10px] text-neutral-400">
          Powered by{" "}
          <a
            href={data.attribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-600"
          >
            {data.attribution.name}
          </a>
        </p>
      )}
    </div>
  );
}
