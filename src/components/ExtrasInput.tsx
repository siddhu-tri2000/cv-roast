"use client";

import { useRef, useState } from "react";
import { parseCvFile } from "@/lib/parseCv";
import { Link2, FileText, Upload } from "lucide-react";
import {
  hasExtras,
  MAX_EXTRAS_CHARS,
  type ResumeExtras,
} from "@/lib/mergeResume";

interface ExtrasInputProps {
  value: ResumeExtras;
  onChange: (next: ResumeExtras) => void;
  /** Force the panel open on first render. Default: collapsed when empty, summary-mode when filled. */
  startOpen?: boolean;
  /** Optional label override; useful if a host page wants different framing. */
  label?: string;
}

const NOTES_HARD_CAP = 6_000;

export default function ExtrasInput({
  value,
  onChange,
  startOpen,
  label = "Add LinkedIn export or extra notes",
}: ExtrasInputProps) {
  const filled = hasExtras(value);
  const [open, setOpen] = useState<boolean>(startOpen ?? !filled);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleLinkedinFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const text = await parseCvFile(file);
      onChange({
        ...value,
        linkedinText: text,
        linkedinFilename: file.name,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't read that file. Try LinkedIn → More → Save to PDF.",
      );
    } finally {
      setParsing(false);
    }
  }

  function clearLinkedin() {
    onChange({ ...value, linkedinText: "", linkedinFilename: null });
  }

  function clearNotes() {
    onChange({ ...value, notes: "" });
  }

  function clearAll() {
    onChange({ linkedinText: "", linkedinFilename: null, notes: "" });
  }

  const notesCount = value.notes.length;
  const notesNearCap = notesCount > NOTES_HARD_CAP - 200;
  const liChars = value.linkedinText.length;

  // ---- Collapsed summary view (filled + closed) ----
  if (!open && filled) {
    return (
      <div className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 shadow-sm transition hover:border-indigo-400/30 hover:shadow-md hover:shadow-indigo-900/30">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4L8.5 12l6.8-6.7a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-white/90">Boost active</span>
            {value.linkedinFilename && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-400/10 px-1.5 py-0.5 font-medium text-indigo-200 ring-1 ring-indigo-400/20">
                <span aria-hidden><Link2 className="h-3 w-3" strokeWidth={2} /></span>
                <span className="max-w-[140px] truncate">{value.linkedinFilename}</span>
              </span>
            )}
            {value.notes.trim() && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-200 ring-1 ring-amber-400/20">
                <span aria-hidden><FileText className="h-3 w-3" strokeWidth={2} /></span>
                <span>{value.notes.trim().length.toLocaleString()} chars of notes</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg px-2.5 py-1 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-400/10"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={clearAll}
            aria-label="Remove all extras"
            className="rounded-lg p-1.5 text-white/35 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // ---- Collapsed empty view ----
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-white/[0.1] bg-[#0C0D10] px-4 py-2.5 text-left transition hover:border-indigo-400 hover:bg-indigo-400/10 hover:shadow-sm"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-white/50 ring-1 ring-white/[0.08] transition group-hover:bg-indigo-400/15 group-hover:text-indigo-300 group-hover:ring-indigo-400/30">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white/90 group-hover:text-indigo-900">
              {label}
            </span>
            <span className="block text-xs text-white/50">
              Optional · gives the AI more accurate signal about you
            </span>
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-indigo-300 opacity-0 transition group-hover:opacity-100">
          Open →
        </span>
      </button>
    );
  }

  // ---- Expanded view ----
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">Extras</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/65">
            Optional
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-white/35 transition hover:bg-white/[0.05] hover:text-white/80"
          aria-label="Hide extras"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M14.78 12.78a.75.75 0 0 1-1.06 0L10 9.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* LinkedIn column */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#0a66c2] text-[11px] font-bold text-white">in</span>
            <span className="text-sm font-bold text-white/90">LinkedIn export</span>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-white/65">
            On LinkedIn → <span className="font-medium text-white/90">More → Save to PDF</span>, then drop it here.
          </p>

          {value.linkedinFilename ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-300">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4L8.5 12l6.8-6.7a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white/90">
                    {value.linkedinFilename}
                  </span>
                  <span className="block text-xs text-white/50">
                    {liChars.toLocaleString()} characters extracted
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={clearLinkedin}
                aria-label="Remove LinkedIn export"
                className="shrink-0 rounded-md p-1.5 text-white/35 transition hover:bg-red-50 hover:text-red-600"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleLinkedinFile(file);
              }}
              className={`flex h-[112px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition ${
                parsing
                  ? "border-indigo-400 bg-indigo-400/10"
                  : dragOver
                  ? "border-indigo-500 bg-indigo-400/10"
                  : "border-white/[0.1] bg-white/[0.03] hover:border-indigo-400 hover:bg-indigo-400/10"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLinkedinFile(file);
                  e.target.value = "";
                }}
              />
              {parsing ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-indigo-300">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400/20 border-t-indigo-700" />
                  Reading export…
                </span>
              ) : (
                <>
                  <Upload className="mb-1 h-6 w-6 text-white/50" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-white/80">
                    Drop file or click to upload
                  </span>
                  <span className="mt-1 text-xs text-white/50">
                    PDF · DOCX · TXT · max 5 MB
                  </span>
                </>
              )}
            </label>
          )}
        </div>

        {/* Notes column */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-white/60" strokeWidth={1.75} />
              <span className="text-sm font-bold text-white/90">Anything we missed?</span>
            </div>
            {value.notes.trim() && (
              <button
                type="button"
                onClick={clearNotes}
                className="text-xs font-medium text-white/50 transition hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mb-3 text-sm leading-relaxed text-white/65">
            Recent wins, certifications, side projects — anything not on the CV yet.
          </p>
          <textarea
            value={value.notes}
            onChange={(e) =>
              onChange({ ...value, notes: e.target.value.slice(0, NOTES_HARD_CAP) })
            }
            placeholder={
              "e.g. Led 4-person team migrating Razorpay to UPI 2.0.\nAWS Solutions Architect Associate (Mar 2026).\nOpen to Singapore relocation."
            }
            rows={4}
            className="w-full resize-y rounded-lg border border-white/[0.1] bg-white/[0.03] p-3 text-sm leading-relaxed text-white placeholder:text-white/35 transition focus:border-indigo-500 focus:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-white/50">
            <span>{notesCount.toLocaleString()} / {NOTES_HARD_CAP.toLocaleString()}</span>
            {notesNearCap && <span className="text-amber-300">Approaching limit</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-xs text-white/65">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white/35">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V8H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 7V5.5a3 3 0 0 0-6 0V8h6Z" clipRule="evenodd" />
        </svg>
        <span>
          Stored only in your browser · combined extras capped at {MAX_EXTRAS_CHARS.toLocaleString()} characters when sent to AI
        </span>
      </div>
    </div>
  );
}
