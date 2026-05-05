"use client";

import { useEffect, useState } from "react";
import { Mail, AlertTriangle, CheckCircle2, FileText, Lock, Sparkles } from "lucide-react";
import PageChrome from "@/components/PageChrome";
import ContentContainer from "@/components/ContentContainer";
import CvInput from "@/components/CvInput";
import ExtrasInput from "@/components/ExtrasInput";
import JdSourceInput from "@/components/JdSourceInput";
import FeedbackWidget from "@/components/FeedbackWidget";
import QuotaModal, { type QuotaState } from "@/components/QuotaModal";
import QuotaBadge from "@/components/QuotaBadge";
import type { CoverLetterOutput, CoverLetterTone, CoverLetterLength } from "@/lib/coverLetterPrompts";
import { coverLetterToPlainText } from "@/lib/coverLetterPrompts";
import {
  EMPTY_EXTRAS,
  mergeResumeWithExtras,
  readExtrasFromStorage,
  writeExtrasToStorage,
  type ResumeExtras,
} from "@/lib/mergeResume";

const TONES: { id: CoverLetterTone; label: string; sub: string }[] = [
  { id: "professional", label: "Professional", sub: "Polished, formal" },
  { id: "warm", label: "Warm", sub: "Genuine, human" },
  { id: "direct", label: "Direct", sub: "Punchy, results-led" },
];

const LENGTHS: { id: CoverLetterLength; label: string; sub: string }[] = [
  { id: "short", label: "Short", sub: "~150 words" },
  { id: "standard", label: "Standard", sub: "~280 words" },
  { id: "detailed", label: "Detailed", sub: "~400 words" },
];

export default function CoverLetterPage() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [extras, setExtras] = useState<ResumeExtras>(EMPTY_EXTRAS);
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [length, setLength] = useState<CoverLetterLength>("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverLetterOutput | null>(null);
  const [quotaState, setQuotaState] = useState<QuotaState>(null);
  const [quotaRefresh, setQuotaRefresh] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Hydrate extras on mount
  useEffect(() => {
    setExtras(readExtrasFromStorage());
  }, []);

  useEffect(() => {
    writeExtrasToStorage(extras);
  }, [extras]);

  // Cache resume
  useEffect(() => {
    if (resume && resume.length > 100) {
      try {
        localStorage.setItem("cc:lastResume:v1", resume);
      } catch { /* ignore */ }
    }
  }, [resume]);

  // Restore cached resume on mount
  useEffect(() => {
    const cached = typeof window !== "undefined" ? localStorage.getItem("cc:lastResume:v1") : null;
    if (cached) setResume(cached);
  }, []);

  async function generate() {
    setError(null);
    setResult(null);
    if (resume.trim().length < 200) {
      setError("Please paste or upload at least 200 characters of your CV.");
      return;
    }
    if (jd.trim().length < 80) {
      setError("Please paste at least 80 characters of the job description.");
      return;
    }
    setLoading(true);
    try {
      const mergedResume = mergeResumeWithExtras(resume, extras);
      const res = await fetch("/api/studio/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: mergedResume, jd, tone, length }),
      });
      const data = await res.json();
      if (res.status === 401 && data?.code === "sign_in_required") {
        setQuotaState({ kind: "sign_in", tool: "studio" });
        return;
      }
      if (res.status === 402 && data?.code === "quota_exceeded") {
        setQuotaState({ kind: "waitlist", tool: "studio" });
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Something went wrong.");
      setResult(data.result as CoverLetterOutput);
      setQuotaRefresh((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(coverLetterToPlainText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function downloadTex() {
    if (!result) return;
    setDownloading(true);
    try {
      const baseFilename = `CareerCompass-CoverLetter-${(result.candidate_name || "letter").replace(/\s+/g, "_")}`;
      const res = await fetch("/api/studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "cover_letter", cover_letter: result, filename: baseFilename }),
      });
      if (!res.ok) throw new Error("Download failed");
      const latex = await res.text();
      const blob = new Blob([latex], { type: "application/x-tex; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseFilename}.tex`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <PageChrome>
      <ContentContainer width="wide">
        {/* HEADER */}
        <header className="mb-8">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex">
              <span className="sticker text-purple-200">
                <span className="float-y inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white shadow-sm">
                  <span className="text-[10px]"><Mail className="h-3 w-3" /></span>
                </span>
                <span>Cover Letter</span>
              </span>
            </div>
            <h1 className="hero-display pb-2">
              Write a cover letter that{" "}
              <span className="relative inline-block whitespace-nowrap" style={{ WebkitTextFillColor: "#C4B5FD" }}>
                actually gets read.
                <svg
                  aria-hidden
                  viewBox="0 0 220 14"
                  preserveAspectRatio="none"
                  className="absolute -bottom-1.5 left-0 h-2.5 w-full text-amber-400/60"
                >
                  <path d="M2 9 C 60 2, 120 14, 218 5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/65 sm:text-lg">
              Paste your CV + a job description. Get a tailored cover letter in seconds — 
              only facts from your CV, zero hallucinations.
              <span className="font-semibold text-white/90"> 5 free runs a day</span>.
            </p>
          </div>
        </header>

        {/* INPUT GRID */}
        <section className="grid gap-5 lg:grid-cols-12">
          <div className={`space-y-5 ${result ? "lg:col-span-12" : "lg:col-span-8"}`}>
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="bento glow-soft p-5 sm:p-6">
                <div className="mb-3 flex items-center justify-between">
                  <span className="eyebrow">Your CV</span>
                  <span className="text-[11px] font-medium text-white/50">PDF · DOCX · TXT</span>
                </div>
                <CvInput value={resume} onChange={setResume} />
                <div className="mt-3">
                  <ExtrasInput value={extras} onChange={setExtras} />
                </div>
              </div>

              <div className="bento surface-rose p-5 sm:p-6">
                <JdSourceInput
                  value={jd}
                  onChange={setJd}
                  minChars={80}
                  maxChars={12_000}
                  rows={16}
                  label="Job description"
                  placeholder="Paste the full job description here — title, responsibilities, requirements, the works…"
                  textareaClassName="bg-[#0C0D10] leading-relaxed focus:border-purple-400 focus:ring-purple-100"
                />
                <p className="mt-2 text-xs text-white/50">
                  Tip: paste the whole posting — we use the requirements + nice-to-haves.
                </p>
              </div>
            </div>

            {/* Tone & Length selectors */}
            <div className="grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0C0D10] p-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/80">Tone</label>
                <div className="grid grid-cols-3 gap-2">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`rounded-lg border p-2.5 text-left transition ${
                        tone === t.id
                          ? "border-purple-500 bg-purple-400/10 ring-1 ring-purple-500/30"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{t.label}</div>
                      <div className="mt-0.5 text-[11px] text-white/50">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-white/80">Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLength(l.id)}
                      className={`rounded-lg border p-2.5 text-left transition ${
                        length === l.id
                          ? "border-indigo-500 bg-indigo-400/10 ring-1 ring-indigo-500/30"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.1]"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{l.label}</div>
                      <div className="mt-0.5 text-[11px] text-white/50">{l.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#0C0D10] p-3 backdrop-blur sm:p-4">
              <button
                onClick={generate}
                disabled={loading}
                className="cta-sheen squish glow-purple inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 px-6 py-3.5 text-base font-bold text-white disabled:cursor-not-allowed disabled:from-neutral-300 disabled:via-neutral-300 disabled:to-neutral-300 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Writing your cover letter…</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5" />
                    <span>Generate cover letter</span>
                    <span>→</span>
                  </>
                )}
              </button>
              <QuotaBadge tool="studio" refreshKey={quotaRefresh} />
              {error && (
                <div className="flex w-full items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* HELPER ASIDE */}
          {!result && (
            <aside className="space-y-4 lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
              <div className="bento surface-lavender p-5">
                <span className="eyebrow">What you&apos;ll get</span>
                <ul className="mt-3 space-y-2.5 text-sm text-white/90">
                  <li className="flex gap-2.5">
                    <span className="float-y mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0C0D10] text-base shadow-sm ring-1 ring-white/[0.06]"><Mail className="h-4 w-4" /></span>
                    <span><span className="font-semibold">Full cover letter</span> tailored to the JD from your CV facts.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="float-y mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0C0D10] text-base shadow-sm ring-1 ring-white/[0.06]"><Sparkles className="h-4 w-4" /></span>
                    <span><span className="font-semibold">3 tone options</span> — professional, warm, or direct.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="float-y mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0C0D10] text-base shadow-sm ring-1 ring-white/[0.06]"><FileText className="h-4 w-4" /></span>
                    <span><span className="font-semibold">.tex download</span> — ready for Overleaf or pdflatex.</span>
                  </li>
                </ul>
              </div>

              <div className="bento surface-mint p-5">
                <span className="eyebrow">Tips for best results</span>
                <ul className="mt-3 space-y-2 text-sm text-white/90">
                  <li className="flex gap-2"><span><CheckCircle2 className="h-3.5 w-3.5" /></span><span>Include <span className="font-semibold">numbers</span> wherever you can — %, ₹, headcount, time.</span></li>
                  <li className="flex gap-2"><span><CheckCircle2 className="h-3.5 w-3.5" /></span><span>Paste the <span className="font-semibold">full JD</span> (or use the URL fetch).</span></li>
                  <li className="flex gap-2"><span><CheckCircle2 className="h-3.5 w-3.5" /></span><span>Use the <span className="font-semibold">Extras</span> field for wins your CV is missing.</span></li>
                </ul>
              </div>

              <div className="flex justify-center">
                <span className="sticker text-white/80">
                  <Lock className="h-4 w-4" />
                  <span>Sent to Gemini · <span className="font-semibold text-white">never stored</span>.</span>
                </span>
              </div>
            </aside>
          )}
        </section>

        {/* RESULTS */}
        {result && (
          <section className="mt-10 space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0C0D10] p-6">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-400" />
                <h3 className="text-lg font-bold text-white">Your cover letter</h3>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm leading-relaxed text-white">
                <pre className="whitespace-pre-wrap break-words font-sans">{coverLetterToPlainText(result)}</pre>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/90 hover:bg-white/[0.06]"
                >
                  {copied ? "✓ Copied" : "📋 Copy text"}
                </button>
                <button
                  type="button"
                  onClick={downloadTex}
                  disabled={downloading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-60"
                >
                  {downloading ? "Preparing…" : "📄 Download .tex"}
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.06] disabled:opacity-60"
                >
                  {loading ? "Regenerating…" : "🔄 Regenerate"}
                </button>
              </div>
            </div>

            <FeedbackWidget
              surface="studio_cover_letter"
              context={{}}
              label="Was this cover letter helpful?"
            />
          </section>
        )}
      </ContentContainer>
      <QuotaModal state={quotaState} onClose={() => setQuotaState(null)} />
    </PageChrome>
  );
}
