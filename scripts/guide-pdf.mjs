// Transforme SEO.md en PDF lisible (A4) pour Eric Picard : guide-seo.pdf
// Usage : node scripts/guide-pdf.mjs   (utilise Google Chrome ou Microsoft Edge installé)
import { readFile, writeFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = await readFile(join(ROOT, "SEO.md"), "utf8");

/* ---------- Markdown → HTML (le sous-ensemble utilisé par SEO.md) ---------- */
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<span class="code">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:)]|$)/g, "$1<em>$2</em>")
    .replace(/(https?:\/\/[^\s<)|]+)/g, '<a href="$1">$1</a>')
    .replace(/ → /g, " → ");

const lines = md.split(/\r?\n/);
let html = "";
let i = 0;
let list = null; // "ul" | "ol"
const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

while (i < lines.length) {
  const line = lines[i];
  if (/^```/.test(line)) {
    closeList();
    const buf = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
    html += `<div class="paste"><div class="paste-label">À copier-coller</div><pre>${esc(buf.join("\n"))}</pre></div>`;
    i++;
    continue;
  }
  if (/^\|/.test(line)) {
    closeList();
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
    const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const [head, , ...body] = rows;
    html += `<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    continue;
  }
  let m;
  if ((m = line.match(/^# (.*)/))) { closeList(); html += `<h1>${inline(m[1])}</h1>`; }
  else if ((m = line.match(/^## (.*)/))) { closeList(); html += `<h2>${inline(m[1])}</h2>`; }
  else if ((m = line.match(/^### (.*)/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; }
  else if (/^---\s*$/.test(line)) { closeList(); html += `<hr>`; }
  else if ((m = line.match(/^\s{2,}- (.*)/))) { html += `<div class="sub">• ${inline(m[1])}</div>`; }
  else if ((m = line.match(/^(\d+)\. (.*)/))) {
    if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
    html += `<li>${inline(m[2])}</li>`;
  }
  else if ((m = line.match(/^- (.*)/))) {
    if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
    html += `<li>${inline(m[1])}</li>`;
  }
  else if (/^\s*$/.test(line)) { /* ligne vide : on garde la liste ouverte si la suite continue */ if (!/^(\d+\.|-|\s{2,}-)\s/.test(lines[i + 1] ?? "")) closeList(); }
  else {
    // Continuation d'un élément de liste (texte indenté) ou paragraphe
    if (list && /^\s{2,}\S/.test(line)) html = html.replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  i++;
}
closeList();

/* ---------- Mise en page A4 ---------- */
const fonts = pathToFileURL(join(ROOT, "src/assets/fonts")).href;
const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Guide SEO — picard-architecte.fr</title>
<style>
@font-face { font-family: "Instrument Serif"; src: url("${fonts}/instrument-serif-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Instrument Serif"; font-style: italic; src: url("${fonts}/instrument-serif-latin-400-italic.woff2") format("woff2"); }
@font-face { font-family: "Inter Tight"; src: url("${fonts}/inter-tight-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Inter Tight"; font-weight: 500 700; src: url("${fonts}/inter-tight-latin-500-normal.woff2") format("woff2"); }
@page { size: A4; margin: 18mm 18mm 20mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 12.5pt/1.55 "Inter Tight", Arial, sans-serif; color: #1c1b19; }
.cover { border-bottom: 3px solid #b3311f; padding-bottom: 14mm; margin-bottom: 10mm; }
.cover .eyebrow { font: 600 9.5pt/1 "Inter Tight", sans-serif; letter-spacing: .18em; text-transform: uppercase; color: #b3311f; }
.cover h1 { font: 400 38pt/1 "Instrument Serif", serif; margin: 6mm 0 4mm; }
.cover h1 em { color: #b3311f; }
.cover p { margin: 0; color: #55524c; font-size: 12pt; }
h1 { display: none; }
h2 { font: 400 22pt/1.1 "Instrument Serif", serif; margin: 10mm 0 3mm; padding-top: 3mm; border-top: 1px solid #ddd6ca; break-after: avoid; }
h3 { font: 600 13pt/1.3 "Inter Tight", sans-serif; margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 3mm; }
ul, ol { margin: 0 0 4mm; padding-left: 7mm; }
li { margin: 0 0 2mm; }
.sub { margin: -1mm 0 1.5mm 12mm; }
strong { font-weight: 600; }
a { color: #1c1b19; text-decoration: underline; text-decoration-color: #b3311f; word-break: break-all; }
.code { font-family: Consolas, monospace; font-size: 10.5pt; background: #f1ede6; padding: 0 1.5mm; border-radius: 1mm; }
hr { display: none; }
.paste { border: 1.5px solid #b3311f; border-radius: 2mm; margin: 3mm 0 5mm; break-inside: avoid; }
.paste-label { background: #b3311f; color: #fff; font: 600 9pt/1 "Inter Tight", sans-serif; letter-spacing: .14em; text-transform: uppercase; padding: 2mm 4mm; }
.paste pre { margin: 0; padding: 4mm; white-space: pre-wrap; font: 11pt/1.5 "Inter Tight", sans-serif; background: #faf8f4; }
table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 11pt; break-inside: avoid; }
th { text-align: left; background: #1c1b19; color: #fff; font-weight: 600; padding: 2.5mm 3mm; }
td { padding: 2.5mm 3mm; border-bottom: 1px solid #ddd6ca; vertical-align: top; }
tr:nth-child(even) td { background: #faf8f4; }
</style></head><body>
<div class="cover">
  <div class="eyebrow">Eric Picard — Architecte D.P.L.G & sculpteur</div>
  <h1 style="display:block">Être trouvé <em>sur Google</em></h1>
  <p>Le guide des actions gratuites, étape par étape, pour faire connaître picard-architecte.fr.</p>
</div>
${html}
</body></html>`;

const htmlPath = join(ROOT, "guide-seo.html");
const pdfPath = join(ROOT, "guide-seo.pdf");
await writeFile(htmlPath, page);

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];
let exe = null;
for (const b of browsers) { try { await access(b); exe = b; break; } catch {} }
if (!exe) throw new Error("Ni Chrome ni Edge trouvé");
execFileSync(exe, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { stdio: "ignore" });
console.log("PDF créé :", pdfPath);
