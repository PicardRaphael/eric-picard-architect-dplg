// Copie dans media/ les photos et vidéos utilisées par le site (liste produite par build.mjs).
// Reprend là où il s'est arrêté : les fichiers déjà présents et complets sont ignorés.
// Usage : node scripts/build.mjs && node scripts/fetch-media.mjs
import { readFile, writeFile, mkdir, stat, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "media");
const ORIGIN = "https://picard-architecte.fr";
const urls = JSON.parse(await readFile(join(ROOT, "content/media-manifest.json"), "utf8"));

// images/x/fichier → media/x/fichier ; video/fichier → media/video/fichier
const target = (url) => join(OUT, url.replace(ORIGIN + "/images/", "").replace(ORIGIN + "/video/", "video/"));

let done = 0;
let skipped = 0;
let bytes = 0;
const failed = [];

async function fetchOne(url) {
  if (!url.startsWith(ORIGIN + "/images/") && !url.startsWith(ORIGIN + "/video/")) return failed.push(`hors périmètre ${url}`);
  const file = target(url);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const size = Number(res.headers.get("content-length") ?? 0);
      const existing = await stat(file).catch(() => null);
      if (existing && size && existing.size === size) { await res.body?.cancel(); skipped++; return; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (size && buf.length !== size) throw new Error("téléchargement incomplet");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file + ".part", buf);
      await rename(file + ".part", file);
      bytes += buf.length;
      done++;
      return;
    } catch (e) {
      if (attempt === 3) failed.push(`${e.message} ${url}`);
    }
  }
}

const queue = [...urls];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) {
    await fetchOne(queue.shift());
    const n = done + skipped + failed.length;
    if (n % 100 === 0) console.log(`${n}/${urls.length}…`);
  }
});
await Promise.all(workers);

console.log(`${done} fichiers copiés (${Math.round(bytes / 1e6)} Mo), ${skipped} déjà présents, ${failed.length} échecs.`);
if (failed.length) console.log(failed.join("\n"));
process.exitCode = failed.length ? 1 : 0;
