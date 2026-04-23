import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { MatchResult, GapWithResources, LearningResource } from "@/lib/prompts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SearchRow {
  id: string;
  target_role: string | null;
  location: string | null;
  created_at: string;
  result: MatchResult;
}

function resourceUrl(r: LearningResource): string {
  const q = encodeURIComponent(r.search_query || r.title);
  if (r.type === "youtube") return `https://www.youtube.com/results?search_query=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

function resourceIcon(t: LearningResource["type"]): string {
  switch (t) {
    case "youtube":
      return "▶️";
    case "course":
      return "🎓";
    case "docs":
      return "📘";
    case "article":
      return "📰";
    case "practice":
      return "🛠";
    default:
      return "🔗";
  }
}

function isGapWithResources(g: unknown): g is GapWithResources {
  return typeof g === "object" && g !== null && "skill" in g;
}

export default async function HistoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data, error } = await supabase
    .from("searches")
    .select("id, target_role, location, created_at, result")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();
  const row = data as unknown as SearchRow;
  const result = row.result;

  const dateLabel = new Date(row.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-white to-white">
      <nav className="sticky top-0 z-30 border-b border-neutral-200/60 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/history" className="flex items-center gap-2 text-base font-bold text-neutral-900">
            <span className="text-2xl">🧭</span>
            <span>← History</span>
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
          >
            🧭 Run a fresh map
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">Snapshot · {dateLabel}</div>
          <h1 className="mt-1 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
            {row.target_role || result.profile?.primary_industry || "Career map"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {result.profile?.seniority && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-800">
                {result.profile.seniority}
              </span>
            )}
            {result.profile?.primary_industry && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                {result.profile.primary_industry}
              </span>
            )}
            {row.location && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                📍 {row.location}
              </span>
            )}
          </div>
        </header>

        {/* Industry demand */}
        {result.industry_demand && (
          <section className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm text-neutral-800">
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-700">Market context at the time</div>
            {result.industry_demand}
          </section>
        )}

        {/* Apply today */}
        {result.apply_today?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-extrabold text-neutral-900">✅ Apply today</h2>
            <div className="space-y-3">
              {result.apply_today.map((r, i) => (
                <article key={i} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-bold text-neutral-900">{r.title}</h3>
                  {r.why_you_fit && <p className="mt-1 text-sm text-neutral-700">{r.why_you_fit}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Stretch */}
        {result.stretch_roles?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-extrabold text-neutral-900">🚀 Stretch roles (1–2 steps away)</h2>
            <div className="space-y-3">
              {result.stretch_roles.map((r, i) => (
                <article key={i} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-bold text-neutral-900">{r.title}</h3>
                  {r.estimated_time_to_ready && (
                    <p className="mt-1 text-xs font-medium text-amber-800">
                      ⏱ Time to ready: {r.estimated_time_to_ready}
                    </p>
                  )}
                  {r.gaps?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {r.gaps.map((g, j) => {
                        if (!isGapWithResources(g)) {
                          return (
                            <div key={j} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
                              🎯 {String(g)}
                            </div>
                          );
                        }
                        return (
                          <div key={j} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                            <div className="font-semibold text-neutral-900">🎯 {g.skill}</div>
                            {g.why_it_matters && (
                              <div className="mt-0.5 text-sm text-neutral-700">{g.why_it_matters}</div>
                            )}
                            {g.resources && g.resources.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm">
                                {g.resources.map((res, k) => (
                                  <li key={k}>
                                    <a
                                      href={resourceUrl(res)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-indigo-700 underline hover:text-indigo-900"
                                    >
                                      {resourceIcon(res.type)} {res.title} · {res.provider}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Pivot */}
        {result.pivot_roles?.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-extrabold text-neutral-900">🔄 Adjacent paths to consider</h2>
            <div className="space-y-3">
              {result.pivot_roles.map((r, i) => (
                <article key={i} className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-bold text-neutral-900">{r.title}</h3>
                  {r.why_it_works && <p className="mt-1 text-sm text-neutral-700">{r.why_it_works}</p>}
                  {r.transferable_skills?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.transferable_skills.map((s, j) => (
                        <span key={j} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Target role gap */}
        {result.target_role_gap && (
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-extrabold text-neutral-900">
              🎯 Gap to {result.target_role_gap.target}
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              {typeof result.target_role_gap.overall_readiness === "number" && (
                <div className="mb-3 text-sm">
                  <span className="font-bold">Readiness:</span>{" "}
                  <span className="text-indigo-700">{result.target_role_gap.overall_readiness}%</span>
                </div>
              )}
              {result.target_role_gap.summary && (
                <p className="mb-3 text-sm text-neutral-700">{result.target_role_gap.summary}</p>
              )}
              {result.target_role_gap.gaps?.length > 0 && (
                <div className="space-y-2">
                  {result.target_role_gap.gaps.map((g, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{g.skill}</div>
                        {g.severity && (
                          <span className="text-xs font-bold uppercase">{g.severity.replace("_", " ")}</span>
                        )}
                      </div>
                      {g.how_to_close && <div className="mt-1 text-sm">{g.how_to_close}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
          >
            🧭 Run a fresh map
          </Link>
          <Link
            href="/history"
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
          >
            ← Back to history
          </Link>
        </div>
      </main>
    </div>
  );
}
