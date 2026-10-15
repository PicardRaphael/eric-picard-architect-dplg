// Inventaire de l'ancien site Sitely : textes, images (meilleure résolution), vidéos.
// Usage : node scripts/crawl.mjs  → content/raw.json
import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://picard-architecte.fr/";
const PAGES = [
  "architecte-decoration.html", "ESSAI/public.html", "collectifs.html", "logts-a-lyon-8.html",
  "logts-a-craponne-1.html", "lotissements.html", "maisons-groupees.html", "bureaux-sports.html",
  "podologie.html", "maisons-individuelles-1.html", "animations.html", "lyon-8.html", "simandres.html",
  "megeve.html", "annecy.html", "annecy-1.html", "plan-de-la-tour.html", "sainte-maxime.html",
  "septeme.html", "bouliac.html", "st-pierre-de-chandieu.html", "oullins.html", "mions.html",
  "dardilly.html", "hauteville.html", "maisons-individuelles-2.html", "maisons-individuelles-3.html",
  "apartements.html", "duchere.html", "duchere-plaza.html", "lyon-6.html", "lyon-4.html", "bron.html",
  "decoration.html", "saint-raphael.html", "dolce.html", "emilia-g.html", "villeurbanne.html",
  "etudes-diverse.html", "espace-fete.html", "dossier-plans.html", "Livre/dossier-historique.html",
  "Livre/sculpture.html", "Livre/contact.html",
];
const SKIP = /image-collee-(170|188|162|1992)\.|thumb-|madewithsitely|instagram|carbon_fibre|garde-annonce/;

const abs = (p, page) => new URL(p, BASE + page).href;

function parsePictures(html, page) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<picture[\s\S]*?<\/picture>/g)) {
    const block = m[0];
    // Sitely range les <source> du plus petit au plus grand écran : la dernière source jpg/png
    // est la version desktop (2x = pleine résolution, 1x = vignette).
    let full = null;
    let md = null;
    let wfull = null;
    let wmd = null;
    for (const tag of block.matchAll(/<source\b[^>]*>/g)) {
      const t = tag[0];
      const webp = /type="image\/webp"/.test(t);
      const set = t.match(/(?:data-srcset|srcset)="([^"]+)"/)?.[1];
      if (!set) continue;
      if (webp) wfull = wmd = null;
      else full = md = null;
      for (const part of set.split(",")) {
        const [url, desc] = part.trim().split(/\s+/);
        if (!url) continue;
        if (webp !== url.endsWith(".webp")) continue;
        if (webp) { if (desc === "2x") wfull = url; else wmd = url; }
        else if (desc === "2x") full = url;
        else md = url;
      }
    }
    full ??= md ?? block.match(/<img[^>]*?(?:data-src|src)="([^"]+)"/)?.[1];
    md ??= full;
    if (!full || full === "null" || SKIP.test(full)) continue;
    const key = full.replace(/^.*\//, "").replace(/-\d+(-\d+)?\.(jpe?g|png)$/i, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const webpOk = wfull && wmd;
    out.push({
      src: abs(full, page),
      md: abs(md, page),
      ...(webpOk ? { webp: abs(wfull, page), webpMd: abs(wmd, page) } : {}),
      pos: m.index,
    });
  }
  // Images isolées (collages)
  for (const m of html.matchAll(/<img[^>]*?src="([^"]+)"/g)) {
    const url = m[1];
    if (SKIP.test(url) || url === "null") continue;
    const a = abs(url, page);
    if (!out.some((o) => o.src === a) && /image-collee|\.jpg/.test(url) && !html.includes(`srcset="${url}`)) out.push({ src: a, md: a });
  }
  return out;
}

function parseVideos(html, page) {
  const vids = [...html.matchAll(/(?:src|data-src)="([^"]+\.(?:mp4|m4v|mov))"/gi)].map((m) => abs(m[1], page));
  const posters = [...html.matchAll(/poster="([^"]+)"/gi)].map((m) => abs(m[1], page));
  return { videos: [...new Set(vids)], posters: [...new Set(posters)] };
}

function parseText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/g, " ")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/(p|div|h\d|li)>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

const raw = {};
for (const page of PAGES) {
  const res = await fetch(BASE + page);
  const html = await res.text();
  raw[page] = {
    status: res.status,
    title: html.match(/<title>([^<]*)<\/title>/)?.[1],
    images: parsePictures(html, page),
    ...parseVideos(html, page),
    text: parseText(html),
  };
  if (page === "Livre/sculpture.html") {
    // Position des intertitres de séries, pour répartir les images par série.
    let from = 0;
    raw[page].markers = ["Sur la MER", "HAUT -RELIEF", "DIVERS", "MURALES"].map((label) => {
      from = html.indexOf(label, from);
      return { label, pos: from };
    });
  }
  console.log(page, res.status, raw[page].images.length, "img", raw[page].videos.length, "vid");
}
await mkdir(new URL("../content/", import.meta.url), { recursive: true });
await writeFile(new URL("../content/raw.json", import.meta.url), JSON.stringify(raw, null, 2));
