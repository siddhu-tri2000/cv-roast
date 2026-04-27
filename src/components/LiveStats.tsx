"use client";

import { useEffect, useState } from "react";

const MIN_TO_DISPLAY = 25;

type Stats = { searches_total: number; searches_7d: number; users_total: number };

export default function LiveStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => {});
  }, []);

  if (!stats) return null;
  if (stats.searches_total < MIN_TO_DISPLAY) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/75">
      <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-400" aria-hidden />
      <span>
        <span className="font-semibold text-white">{stats.searches_total.toLocaleString()}</span> analyses run
      </span>
    </span>
  );
}
