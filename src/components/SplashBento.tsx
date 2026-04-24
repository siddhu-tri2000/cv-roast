"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

interface Props {
  href: string;
  tone: "indigo" | "emerald" | "rose" | "amber" | "sky";
  className?: string;
  children: ReactNode;
}

/**
 * Bento card with mouse-tracking spotlight + animated gradient ring.
 * Pure CSS variables — no per-frame React state, so it stays cheap.
 */
export default function SplashBento({ href, tone, className = "", children }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  }

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      className={`bento-splash tone-${tone} group block ${className}`}
    >
      {children}
    </Link>
  );
}
