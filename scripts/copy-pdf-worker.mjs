// Copies pdfjs-dist worker file to /public so it can be served by Next.js.
// Runs before `next build` (see package.json "prebuild" script).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dest = resolve(root, "public/pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] source not found:", src);
  process.exit(0);
}
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("[copy-pdf-worker] copied →", dest);
