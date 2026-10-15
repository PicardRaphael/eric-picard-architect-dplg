// Vérifie chaque href/src interne des pages générées et un échantillon des médias distants.
// Usage : node scripts/check.mjs
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Usage : node scripts/check.mjs [dossier] [--base=/new]
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "dist");
const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "";
const MEDIA = join(ROOT, "media");

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

const exists = async (p) => stat(p).then(() => true, () => false);
const resolveLocal = async (url) => {
  let path = decodeURIComponent(url.split("#")[0].split("?")[0]);
  if (path.startsWith("/media/")) return exists(join(MEDIA, path.slice(7)));
  if (BASE) { if (!path.startsWith(BASE + "/")) return false; path = path.slice(BASE.length); }
  const file = join(DIST, path);
  if (path.endsWith("/")) return exists(join(file, "index.html"));
  return exists(file);
};

const files = await walk(DIST);
const missing = [];
const titles = new Map();
const remote = new Set();
let checked = 0;
for (const f of files) {
  const html = await readFile(f, "utf8");
  const page = f.slice(DIST.length).replaceAll("\\", "/");
  // Une seule balise H1 par page
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) missing.push(`${page} : ${h1} balise(s) h1`);
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  if (title.length < 10) missing.push(`${page} : title manquant`);
  if (title.length > 70) missing.push(`${page} : title trop long (${title.length})`);
  if (titles.has(title)) missing.push(`${page} : même title que ${titles.get(title)}`);
  titles.set(title, page);
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) missing.push(`${page} : description trop courte`);
  for (const m of html.matchAll(/(?:href|src|srcset|data-src|data-full|data-img|data-href|poster)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(mailto:|tel:|#)/.test(url)) continue;
    if (url.startsWith("/")) {
      checked++;
      if (!(await resolveLocal(url))) missing.push(`${page} → ${url}`);
    } else if (url.startsWith("https://picard-architecte.fr/images/") || url.startsWith("https://picard-architecte.fr/video/")) {
      remote.add(url);
    }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) missing.push(`${page} : img sans alt`);
  }
}

// Médias distants : requête HEAD sur chacun (en parallèle, par lots)
const urls = [...remote];
const bad = [];
let bytes = 0;
for (let i = 0; i < urls.length; i += 24) {
  await Promise.all(urls.slice(i, i + 24).map(async (u) => {
    const r = await fetch(u, { method: "HEAD" }).catch(() => null);
    if (!r || !r.ok) bad.push(`${r?.status ?? "ERR"} ${u}`);
    else bytes += Number(r.headers.get("content-length") ?? 0);
  }));
}

console.log(`${files.length} pages, ${checked} liens internes, ${urls.length} médias distants vérifiés (${Math.round(bytes / 1e6)} Mo).`);
if (missing.length) console.log("Problèmes :\n  " + missing.join("\n  "));
if (bad.length) console.log("Médias introuvables :\n  " + bad.join("\n  "));
if (!missing.length && !bad.length) console.log("Aucun problème.");
process.exitCode = missing.length || bad.length ? 1 : 0;
