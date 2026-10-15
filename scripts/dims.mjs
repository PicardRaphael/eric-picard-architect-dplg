// Lit la largeur/hauteur de chaque image de media/ (en-têtes JPEG, PNG, WebP) → content/dims.json.
// Sert à poser width/height sur chaque <img> : la place est réservée avant le chargement (pas de saut, pas de case vide).
// Usage : node scripts/dims.mjs (après fetch-media.mjs)
import { open, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(ROOT, "media");

async function head(file, size = 64 * 1024) {
  const fh = await open(file, "r");
  try {
    const buf = Buffer.alloc(size);
    const { bytesRead } = await fh.read(buf, 0, size, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function jpeg(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15 sauf DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}
const png = (b) => (b.toString("ascii", 1, 4) === "PNG" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);
function webp(b) {
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  if (chunk === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  return null;
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const dims = {};
const failed = [];
for (const file of await walk(MEDIA)) {
  const b = await head(file);
  const d = /\.png$/i.test(file) ? png(b) : /\.webp$/i.test(file) ? webp(b) : jpeg(b);
  const key = relative(MEDIA, file).replaceAll("\\", "/");
  if (d && d.w && d.h) dims[key] = [d.w, d.h];
  else failed.push(key);
}
await writeFile(join(ROOT, "content/dims.json"), JSON.stringify(dims));
console.log(`${Object.keys(dims).length} images mesurées, ${failed.length} illisibles${failed.length ? " : " + failed.slice(0, 5).join(", ") : ""}.`);
