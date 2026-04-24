"use client";

import { useState } from "react";

type Surface =
  | "map"
  | "studio_polish"
  | "studio_tailor"
  | "ghost_detect"
  | "ghost_diagnose"
  | "journey"
  | "general";

interface Props {
  surface: Surface;
  context?: Record<string, unknown>;
  className?: string;
  label?: string;
}

export default function FeedbackWidget({
  surface,
  context,
  className = "",
  label = "Was this useful?",
}: Props) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(r: 1 | -1, withComment = false) {
    if (busy || submitted) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          rating: r,
          comment: withComment ? comment.trim() : undefined,
          context,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to send");
      }
      if (withComment) setSubmitted(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div
        className={`rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 ${className}`}
      >
        Thanks — we read every note. 🙏
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white/70 px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-neutral-700">{label}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRating(1);
              setShowComment(true);
              void send(1);
            }}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              rating === 1
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/50"
            }`}
            aria-label="Thumbs up"
          >
            👍 Yes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRating(-1);
              setShowComment(true);
              void send(-1);
            }}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              rating === -1
                ? "border-rose-400 bg-rose-50 text-rose-800"
                : "border-neutral-200 hover:border-rose-300 hover:bg-rose-50/50"
            }`}
            aria-label="Thumbs down"
          >
            👎 Not really
          </button>
        </div>
      </div>
      {showComment && (
        <div className="mt-3 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder={
              rating === 1
                ? "What worked? (optional)"
                : "What missed the mark? (optional)"
            }
            className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-400">
              {comment.length}/1000 · No CV text is sent.
            </span>
            <button
              type="button"
              disabled={busy || comment.trim().length === 0}
              onClick={() => rating && send(rating, true)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Send note
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
