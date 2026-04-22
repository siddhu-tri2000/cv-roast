export interface JobLink {
  name: string;
  url: string;
  emoji: string;
}

function kebab(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function buildJobLinks(role: string, location?: string): JobLink[] {
  const r = role.trim();
  if (!r) return [];

  const loc = (location ?? "").trim();
  const encR = encodeURIComponent(r);
  const encL = encodeURIComponent(loc);
  const slugR = kebab(r);
  const slugL = kebab(loc);

  const linkedin = `https://www.linkedin.com/jobs/search/?keywords=${encR}${
    loc ? `&location=${encL}` : ""
  }`;

  const naukri = loc
    ? `https://www.naukri.com/${slugR}-jobs-in-${slugL}`
    : `https://www.naukri.com/${slugR}-jobs`;

  const indeed = `https://www.indeed.com/jobs?q=${encR}${loc ? `&l=${encL}` : ""}`;

  const googleJobs = `https://www.google.com/search?q=${encR}+jobs${
    loc ? `+${encL}` : ""
  }&ibp=htl;jobs`;

  return [
    { name: "LinkedIn", url: linkedin, emoji: "💼" },
    { name: "Naukri", url: naukri, emoji: "🇮🇳" },
    { name: "Indeed", url: indeed, emoji: "🔍" },
    { name: "Google Jobs", url: googleJobs, emoji: "🌐" },
  ];
}
