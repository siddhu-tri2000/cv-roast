"use client";

import { useState } from "react";
import { Link2, AlertTriangle, Download } from "lucide-react";

interface JdSourceInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional callback fired when the URL fetch successfully populates the textarea. */
  onFetched?: (info: { source_url: string; title: string | null }) => void;
  /** Min/max chars shown in the helper line — purely informational. */
  minChars?: number;
  maxChars?: number;
  rows?: number;
  placeholder?: string;
  /** Heading shown above the input. */
  label?: string;
  /** Extra className applied to the textarea. */
  textareaClassName?: string;
  /** Disable the input (e.g. while the parent is loading). */
  disabled?: boolean;
}

interface SourceInfo {
  url: string;
  title: string | null;
}

const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/**
 * Shared JD entry component used by Studio Tailor and Ghost Buster.
 * Always shows both the URL fetch row and the textarea.
 * On successful fetch, extracted text populates the textarea (still editable).
 */
export default function JdSourceInput({
  value,
  onChange,
  onFetched,
  minChars = 80,
  maxChars = 12_000,
  rows = 12,
  placeholder = "Paste the full job description here…",
  label = "Job description",
  textareaClassName = "",
  disabled = false,
}: JdSourceInputProps) {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [source, setSource] = useState<SourceInfo | null>(null);

  const chars = value.length;
  const tooShort = chars > 0 && chars < minChars;

  async function fetchFromUrl() {
    setFetchError(null);
    const trimmed = url.trim();
    if (!URL_PATTERN.test(trimmed)) {
      setFetchError("Enter a full http/https URL.");
      return;
    }
    setFetching(true);
    try {
      const res = await fetch("/api/jd/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as { text?: string; title?: string | null; source_url?: string; error?: string };
      if (!res.ok || !data.text) {
        setFetchError(data.error ?? "Couldn't fetch that page.");
        return;
      }
      onChange(data.text);
      const info = { url: data.source_url ?? trimmed, title: data.title ?? null };
      setSource(info);
      onFetched?.({ source_url: info.url, title: info.title });
    } catch {
      setFetchError("Network error — try again or paste the JD text directly.");
    } finally {
      setFetching(false);
    }
  }

  function clearSource() {
    setSource(null);
    setUrl("");
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{label}</h3>
        <span className="text-[11px] text-white/50">
          Paste a URL <span className="text-white/35">or</span> the JD text below
        </span>
      </div>

      <div className="mb-2 space-y-2 rounded-lg border border-indigo-400/20 bg-indigo-400/10 p-2.5">
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void fetchFromUrl();
              }
            }}
            placeholder="Paste a job-posting URL (LinkedIn, Naukri, Greenhouse, Lever…) and we'll fetch it"
            disabled={fetching || disabled}
            className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void fetchFromUrl()}
            disabled={fetching || disabled || !url.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fetching ? "Fetching…" : "Fetch JD"}
          </button>
        </div>
        {fetchError && (
          <div className="flex items-center gap-1.5 rounded border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-200">
            <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} />
            {fetchError}
          </div>
        )}
      </div>

      {source && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
          <Download className="h-3 w-3 shrink-0" strokeWidth={2} />
          <span className="font-semibold">Imported from</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[60%] truncate underline hover:text-emerald-300"
            title={source.url}
          >
            {source.title || source.url}
          </a>
          <button
            type="button"
            onClick={clearSource}
            className="ml-auto rounded px-1.5 text-[11px] font-semibold text-emerald-200/70 hover:bg-emerald-400/15 hover:text-emerald-200"
            aria-label="Clear source"
          >
            ✕
          </button>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxChars}
        className={`w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-white placeholder:text-white/35 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-60 ${textareaClassName}`}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
        <span>
          {chars.toLocaleString()} chars
          {tooShort ? ` · need ≥ ${minChars}` : ""}
        </span>
        {chars > maxChars * 0.9 && (
          <span className="font-semibold text-amber-300">{(maxChars - chars).toLocaleString()} left</span>
        )}
      </div>
    </div>
  );
}
