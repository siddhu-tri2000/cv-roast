"use client";

import { useState } from "react";

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
        <h3 className="text-sm font-bold text-neutral-900">{label}</h3>
        <span className="text-[11px] text-neutral-500">
          Paste a URL <span className="text-neutral-400">or</span> the JD text below
        </span>
      </div>

      <div className="mb-2 space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-2.5">
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
            placeholder="🔗 Paste a job-posting URL (LinkedIn, Naukri, Greenhouse, Lever…) and we'll fetch it"
            disabled={fetching || disabled}
            className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
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
          <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
            ⚠️ {fetchError}
          </div>
        )}
      </div>

      {source && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900">
          <span aria-hidden>📥</span>
          <span className="font-semibold">Imported from</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-[60%] truncate underline hover:text-emerald-700"
            title={source.url}
          >
            {source.title || source.url}
          </a>
          <button
            type="button"
            onClick={clearSource}
            className="ml-auto rounded px-1.5 text-[11px] font-semibold text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-900"
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
        className={`w-full resize-y rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60 ${textareaClassName}`}
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
        <span>
          {chars.toLocaleString()} chars
          {tooShort ? ` · need ≥ ${minChars}` : ""}
        </span>
        {chars > maxChars * 0.9 && (
          <span className="font-semibold text-amber-700">{(maxChars - chars).toLocaleString()} left</span>
        )}
      </div>
    </div>
  );
}
