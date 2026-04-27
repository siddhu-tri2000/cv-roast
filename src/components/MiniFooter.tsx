import Link from "next/link";
import { Compass } from "lucide-react";

export default function MiniFooter() {
  return (
    <footer className="mx-auto mt-16 max-w-6xl border-t border-white/[0.06] px-4 pb-10 pt-10 text-white sm:px-6">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-white/85">
            <Compass className="h-4 w-4 text-white/65" strokeWidth={1.75} />
            CareerCompass
          </div>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/40">
            Honest, AI-powered career advice. Built in public.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4 text-[13px]">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">Tools</span>
            <Link href="/map" className="text-white/50 transition hover:text-white">Career Map</Link>
            <Link href="/studio" className="text-white/50 transition hover:text-white">Resume Studio</Link>
            <Link href="/ghost-buster" className="text-white/50 transition hover:text-white">JD Ghost Buster</Link>
            <Link href="/journey" className="text-white/50 transition hover:text-white">Career Journey</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">Legal</span>
            <Link href="/privacy" className="text-white/50 transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="text-white/50 transition hover:text-white">Terms</Link>
            <a
              href="https://github.com/siddhu-tri2000/career-compass"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-white/50 transition hover:text-white"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </div>
      <div className="mt-8 border-t border-white/[0.04] pt-6 text-center text-[12px] text-white/25">
        © {new Date().getFullYear()} CareerCompass. All rights reserved.
      </div>
    </footer>
  );
}
