// Mini serveur statique de prévisualisation (aucune dépendance).
// Usage : node scripts/serve.mjs [dossier] [port] [--base=/new]
//   /media/… est servi depuis media/ (comme sur OVH, où media/ est à la racine de www/).
//   --base=/new simule la version de validation envoyée dans www/new/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const base = process.argv.find((a) => a.startsWith("--base="))?.slice(7) ?? "";
const root = resolve(args[0] ?? "dist");
const mediaRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "media");
const port = Number(process.env.PORT ?? args[1] ?? 4321);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".mp4": "video/mp4", ".xml": "application/xml", ".txt": "text/plain",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

const send = async (res, file, status = 200) => {
  const body = await readFile(file);
  res.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(body);
};

createServer(async (req, res) => {
  let url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let dir = root;
  if (url.startsWith("/media/")) { dir = mediaRoot; url = url.slice(6); }
  else if (base) {
    if (url === "/") { res.writeHead(302, { location: base + "/" }); return res.end(); }
    if (!url.startsWith(base + "/") && url !== base) { res.writeHead(404); return res.end("hors de " + base); }
    url = url.slice(base.length) || "/";
  }
  let file = normalize(join(dir, url));
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    await send(res, file);
  } catch {
    await send(res, join(root, "404.html"), 404).catch(() => { res.writeHead(404); res.end("404"); });
  }
}).listen(port, () => console.log(`http://localhost:${port}${base}/ → ${root}`));
