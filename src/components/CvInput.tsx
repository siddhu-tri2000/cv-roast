"use client";

import { useRef, useState } from "react";
import { parseCvFile } from "@/lib/parseCv";
import { SAMPLE_CV } from "@/lib/sampleCv";

interface CvInputProps {
  value: string;
  onChange: (text: string) => void;
}

type Mode = "upload" | "paste";

export default function CvInput({ value, onChange }: CvInputProps) {
  const [mode, setMode] = useState<Mode>("upload");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    setFilename(file.name);
    try {
      const text = await parseCvFile(file);
      onChange(text);
      setMode("paste"); // Show extracted text so user can review/edit
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the file.");
      setFilename(null);
    } finally {
      setParsing(false);
    }
  }

  function loadSample() {
    onChange(SAMPLE_CV);
    setMode("paste");
    setError(null);
    setFilename("sample-cv.txt");
  }

  function clearAll() {
    onChange("");
    setFilename(null);
    setError(null);
  }

  const charCount = value.length;
  const tooShort = charCount > 0 && charCount < 200;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-base font-semibold text-neutral-800">
          Step 1 — Add your CV
        </label>
        <button
          type="button"
          onClick={loadSample}
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
        >
          Try with a sample CV
        </button>
      </div>

      <div className="mb-3 inline-flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "upload"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          📎 Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "paste"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          ✍️ Paste text
        </button>
      </div>

      {mode === "upload" ? (
        <div>
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
              if (file) void handleFile(file);
            }}
            className={`flex h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragOver
                ? "border-indigo-700 bg-indigo-50"
                : "border-neutral-300 bg-neutral-50 hover:border-indigo-500 hover:bg-indigo-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = ""; // allow re-upload of same file
              }}
            />
            {parsing ? (
              <>
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-700" />
                <p className="text-sm font-medium text-neutral-700">
                  Reading {filename}…
                </p>
              </>
            ) : value && filename ? (
              <>
                <div className="mb-3 text-4xl">✅</div>
                <p className="mb-1 text-base font-semibold text-neutral-900">
                  {filename}
                </p>
                <p className="mb-4 text-sm text-neutral-500">
                  {charCount.toLocaleString()} characters extracted
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setMode("paste");
                    }}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
                  >
                    Review text
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      clearAll();
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Clear
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-4xl">📄</div>
                <p className="mb-1 text-base font-semibold text-neutral-800">
                  Drop your CV here or click to upload
                </p>
                <p className="text-sm text-neutral-500">
                  PDF, DOCX, or TXT · max 5 MB · stays in your browser
                </p>
              </>
            )}
          </label>
        </div>
      ) : (
        <div>
          <textarea
            id="resume"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste your full CV here — name, summary, experience, skills, education..."
            className="h-72 w-full resize-y rounded-lg border border-neutral-300 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-700 focus:bg-white focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between text-sm text-neutral-600">
            <span>{charCount.toLocaleString()} characters</span>
            {tooShort ? (
              <span className="text-amber-700">Need at least 200 characters</span>
            ) : value ? (
              <button
                type="button"
                onClick={clearAll}
                className="font-medium text-neutral-500 hover:text-red-700"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
