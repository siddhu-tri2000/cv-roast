import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const SITE_URL = "https://career-compass-orpin-tau.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CareerCompass — Find the roles you should actually apply for",
  description:
    "Stop guessing which jobs to apply for. Paste your CV, get a personalised career map: roles you fit today, stretch roles 1–2 steps away, and adjacent paths you haven't considered. Free daily tries.",
  openGraph: {
    title: "CareerCompass — Find the roles you should actually apply for",
    description:
      "Paste your CV. Get a personalised India-aware career map in 30s. 5 free runs/day per tool.",
    url: SITE_URL,
    siteName: "CareerCompass",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "CareerCompass — find the roles you should actually apply for" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CareerCompass — Find the roles you should actually apply for",
    description:
      "Paste your CV. Get a personalised India-aware career map in 30s. 5 free runs/day per tool.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-[family-name:var(--font-inter)] bg-[#08090A] text-white antialiased">
        <div className="aurora" aria-hidden />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
