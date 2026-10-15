// Génère le site statique à partir de content/*.json.
// Dév.       : node scripts/build.mjs             → dist/, médias chargés depuis l'ancien site
// Validation : node scripts/build.mjs --staging   → dist-staging/ (à envoyer dans www/new/), non indexé
// Production : node scripts/build.mjs --prod      → dist/ (à envoyer dans www/)
// En validation et en production, les médias sont servis depuis /media/ (dossier media/, envoyé une fois).
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = process.argv.includes("--prod");
const STAGING = process.argv.includes("--staging");
const LOCAL_MEDIA = PROD || STAGING;
const BASE = STAGING ? "/new" : "";
const DIST = join(ROOT, STAGING ? "dist-staging" : "dist");
const OLD_ORIGIN = "https://picard-architecte.fr";
const usedMedia = new Set();

const site = JSON.parse(await readFile(join(ROOT, "content/site.json"), "utf8"));
const projects = JSON.parse(await readFile(join(ROOT, "content/projects.json"), "utf8"));
const raw = JSON.parse(await readFile(join(ROOT, "content/raw.json"), "utf8"));
// Dimensions réelles des images (scripts/dims.mjs) : width/height réservent la place avant chargement.
const dims = JSON.parse(await readFile(join(ROOT, "content/dims.json"), "utf8").catch(() => "{}"));
const sizeOf = (url) => {
  const d = dims[url.replace(OLD_ORIGIN + "/images/", "")];
  return d ? `width="${d[0]}" height="${d[1]}"` : "";
};
const YEAR = new Date().getFullYear();

/* ---------- Utilitaires ---------- */
const esc = (s = "") => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// URL d'un média : l'ancien site en dév., /media/<dossier>/<fichier> sinon (images/x/… → media/x/…, video/… → media/video/…).
const media = (url) => {
  usedMedia.add(url);
  return LOCAL_MEDIA ? url.replace(OLD_ORIGIN, "").replace(/^\/images\//, "/media/").replace(/^\/video\//, "/media/video/") : url;
};
const abs = (path) => site.url + path;
const keyOf = (url) => url.replace(/^.*\//, "").replace(/-\d+(-\d+)?\.(jpe?g|png)$/i, "");
const arrow = `<svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M0 6h20M15 1l5 5-5 5"/></svg>`;
const diag = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const cats = Object.fromEntries(site.categories.map((c) => [c.id, c]));
const statusTag = (p) => (p.status ? `<span class="status" data-s="${esc(p.status)}">${esc(p.status)}</span>` : "");
const yearsOf = (p) => (String(p.years ?? "").match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
const lastYear = (p) => Math.max(0, ...yearsOf(p));

/* ---------- Projets : images, vidéos, héros ---------- */
for (const p of projects) {
  const seen = new Set();
  const all = p.sources.flatMap((s) => raw[s]?.images ?? []);
  const photos = all.filter((im) => !/image-collee|00-garde|notice-de-presentation/.test(im.src));
  p.images = (photos.length ? photos : all).filter((im) => {
    const k = keyOf(im.src);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const vids = new Map();
  for (const s of p.sources) (raw[s]?.videos ?? []).forEach((v, i) => vids.set(v, raw[s].posters?.[i]));
  for (const name of p.videoNames ?? []) {
    const a = raw["animations.html"];
    a.videos.forEach((v, i) => { if (v.includes(name)) vids.set(v, a.posters[i]); });
  }
  p.videos = [...vids].map(([src, poster]) => ({ src, poster }));
  p.cover = p.images.find((im) => p.hero && im.src.includes(p.hero)) ?? p.images[0] ?? (p.videos[0] && { src: p.videos[0].poster, md: p.videos[0].poster });
  p.url = `/projets/${p.slug}/`;
}
const ordered = [...projects].sort((a, b) => lastYear(b) - lastYear(a));
const featured = projects.filter((p) => p.featured).sort((a, b) => a.featured - b.featured);

/* ---------- Sculptures ---------- */
const sRaw = raw["Livre/sculpture.html"];
const SERIES_TITLES = { "Sur la MER": "Sur la mer", "HAUT -RELIEF": "Haut-relief en Afrique", DIVERS: "Divers", MURALES: "Murales" };
const series = sRaw.markers.map((m, i, arr) => ({
  title: SERIES_TITLES[m.label],
  id: SERIES_TITLES[m.label].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-"),
  images: sRaw.images.filter((im) => im.pos > m.pos && (!arr[i + 1] || im.pos < arr[i + 1].pos)),
}));
const sculptureCount = series.reduce((n, s) => n + s.images.length, 0);

/* ---------- Gabarit ---------- */
const NAV = [
  ["/projets/", "Projets"],
  ["/architecte-lyon/", "Missions"],
  ["/sculptures/", "Sculptures"],
  ["/recherches/", "Recherches"],
  ["/atelier/", "L’atelier"],
  ["/contact/", "Contact"],
];

function layout({ title, description, path, body, header = "solid", bodyClass = "", image, jsonld = [], noindex = false, context = "" }) {
  const ogImage = image ? media(image) : media(featured[0].cover.src);
  const ogAbs = ogImage.startsWith("http") ? ogImage : abs(ogImage);
  // « Accueil » en tête du menu sur toutes les pages sauf l'accueil : le retour doit être évident.
  const navItems = path === "/" ? NAV : [["/", "Accueil"], ...NAV];
  const nav = navItems.map(([href, label]) => `<a href="${href}"${href !== "/" && path.startsWith(href) ? ' aria-current="page"' : ""}${href === "/" ? ' class="nav-home"' : ""}>${label}</a>`).join("");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(path)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(site.studio)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${esc(ogAbs)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#141413">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/instrument-serif-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-tight-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/style.css">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
</head>
<body class="${bodyClass}">
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-header ${header}">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Eric Picard, architecte — accueil"><span class="brand-name">Eric Picard<i>.</i></span><span class="brand-tag">Architecte D.P.L.G & sculpteur — Lyon</span>${context ? `<span class="h-context">${esc(context)}</span>` : ""}</a>
    <button class="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
    <nav class="nav" id="nav" aria-label="Navigation principale">${nav}</nav>
    ${context ? `<a class="h-cta" href="/contact/#architecture">Parlons-en</a>` : ""}
  </div>
</header>
<main id="contenu">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="top">
      <div>
        <div class="f-brand">Eric Picard<i>.</i></div>
        <p>${esc(site.studio)} — architecte D.P.L.G, certifié ADEME HQE. ${esc(site.street)}, ${esc(site.postalCode)} ${esc(site.locality)}.</p>
      </div>
      <div>
        <h3>Projets</h3>
        <ul>${site.categories.map((c) => `<li><a href="/projets/${c.id}/">${esc(c.label)}</a></li>`).join("")}<li><a href="/architecte-lyon/">Architecte à Lyon</a></li><li><a href="/sculpture-sur-commande/">Sculpture sur commande</a></li></ul>
      </div>
      <div>
        <h3>Explorer</h3>
        <ul><li><a href="/">Accueil</a></li>${NAV.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h3>Contact</h3>
        <ul>
          <li><a href="mailto:${site.email}">${site.email}</a></li>
          <li><a href="tel:${site.phoneIntl}">${site.phone}</a></li>
          <li><a href="${site.instagram}" rel="noopener">Instagram</a></li>
          <li><a href="${site.facebook}" rel="noopener">Facebook</a></li>
        </ul>
      </div>
    </div>
    <div class="bottom"><span>© ${YEAR} Eric Picard, architecte & sculpteur</span><a href="/mentions-legales/">Mentions légales</a></div>
    <div class="f-giant" aria-hidden="true">Eric Picard<em>.</em></div>
  </div>
</footer>
<nav class="call-bar" aria-label="Contact rapide">
  <a href="tel:${site.phoneIntl}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>Appeler</a>
  <a href="/contact/#architecture">Écrire</a>
</nav>
<button type="button" class="to-top" aria-label="Revenir en haut de la page"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20V4M5 11l7-7 7 7"/></svg></button>
<script src="/assets/main.js" defer></script>
</body>
</html>
`;
}

const personLd = {
  "@type": "Person",
  "@id": site.url + "/#eric-picard",
  name: site.name,
  jobTitle: "Architecte D.P.L.G et sculpteur",
  sameAs: [site.instagram, site.facebook],
};
const businessLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": site.url + "/#atelier",
  name: `${site.name} Architecte D.P.L.G`,
  alternateName: site.studio,
  description: "Atelier d’architecture et de sculpture à Lyon, à la Croix-Rousse (Lyon 4e) : maisons individuelles, extensions, logements collectifs, réhabilitation d’appartements et aménagement de commerces.",
  url: site.url + "/",
  telephone: site.phoneIntl,
  email: site.email,
  image: abs(media(featured[0].cover.src).replace(site.url, "")),
  address: { "@type": "PostalAddress", streetAddress: "9, rue d’Austerlitz", postalCode: site.postalCode, addressLocality: site.locality, addressRegion: site.region, addressCountry: "FR" },
  areaServed: ["Lyon", "Rhône", "Auvergne-Rhône-Alpes"],
  knowsAbout: ["Extension de maison", "Maison contemporaine", "Rénovation d’appartement", "Réhabilitation", "Permis de construire", "Aménagement de commerces", "Accessibilité PMR", "Haute qualité environnementale", "Sculpture"],
  founder: personLd,
  sameAs: [site.instagram, site.facebook],
};
const crumbsLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});
const crumbs = (items, cls = "") =>
  `<nav class="crumbs ${cls}" aria-label="Fil d’Ariane">${items
    .map(([n, h], i) => (i < items.length - 1 ? `<a href="${h}">${esc(n)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(n)}</span>`))
    .join("")}</nav>`;

// <picture> : WebP (≈30 % plus léger) quand l'ancien site en fournit, JPEG/PNG sinon.
/* Deux portes d'entrée : une mission d'architecte, une sculpture. Missions tirées des projets de l'atelier. */
// Les liens « mailto: » échouent sans messagerie installée : on renvoie vers la page Contact,
// qui affiche l'adresse en clair avec un bouton « Copier ».
const mailArchi = "/contact/#architecture";
const mailSculpt = "/contact/#sculpture";
const mailBox = (label) => `
    <div class="cta-mail">
      <span class="eyebrow">${label}</span>
      <a href="mailto:${site.email}">${site.email}</a>
      <button type="button" class="copy-btn" data-copy="${site.email}">Copier l’adresse</button>
    </div>`;
const MISSIONS = [
  "Extension et réhabilitation de maisons",
  "Rénovation et aménagement d’appartements",
  "Aménagement de commerces et de cabinets",
  "Études de faisabilité et permis de construire",
  "Mission complète, jusqu’au suivi de chantier",
  "Accessibilité PMR (Ad’AP) et démarche HQE",
];
const ctaBlock = ({ onContact = false } = {}) => `
<div class="cta-duo">
  <div class="cta-card" id="architecture" data-reveal>
    <p class="eyebrow"><b>01</b> — Architecture</p>
    <h3>Un projet de maison, d’extension ou de rénovation&nbsp;?</h3>
    <ul class="missions">${MISSIONS.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    ${onContact ? mailBox("Écrire à l’atelier") : ""}
    <div class="cta-actions">
      <a class="btn" href="tel:${site.phoneIntl}">${site.phone}</a>
      ${onContact ? "" : `<a class="btn btn-ghost" href="${mailArchi}">Écrire à l’atelier</a>`}
    </div>
  </div>
  <div class="cta-card cta-dark" id="sculpture" data-reveal>
    ${series[0].images[2] ? `<div class="cta-bg" aria-hidden="true">${img(series[0].images[2], "")}</div>` : ""}
    <p class="eyebrow"><b>02</b> — Sculpture</p>
    <h3>Une œuvre vous attire&nbsp;?</h3>
    <p>Acquisition d’une pièce existante ou sculpture sur commande : écrivez en précisant l’œuvre qui vous intéresse.</p>
    ${onContact ? mailBox("Écrire au sculpteur") : ""}
    <div class="cta-actions">
      ${onContact ? `<a class="btn btn-light" href="/sculpture-sur-commande/">Commander une sculpture</a><a class="btn btn-ghost-light" href="tel:${site.phoneIntl}">${site.phone}</a>` : `<a class="btn btn-light" href="/sculpture-sur-commande/">Commander une sculpture</a>`}
      <a class="btn btn-ghost-light" href="${site.instagram}" rel="noopener">Instagram</a><a class="btn btn-ghost-light" href="${site.facebook}" rel="noopener">Facebook</a>
    </div>
  </div>
</div>
<p class="cta-address" data-reveal>${esc(site.studio)} — ${esc(site.street)}, ${site.postalCode} ${site.locality} — ${site.email}</p>`;

const img = (im, alt, { eager = false, full = false, lazy = true } = {}) => {
  const load = eager ? 'fetchpriority="high"' : lazy ? 'loading="lazy"' : "";
  const tag = `<img src="${esc(media(full ? im.src : im.md))}" ${sizeOf(full ? im.src : im.md)} alt="${esc(alt)}" ${load} decoding="async">`;
  const webp = full ? im.webp : im.webpMd;
  return webp ? `<picture><source srcset="${esc(media(webp))}" type="image/webp">${tag}</picture>` : tag;
};

// Série en bande horizontale : un seul composant pour les sculptures et les dossiers de recherche.
const railSection = ({ id, num, titleHtml, countLabel, images, cap, alt }) => `
  <section class="series" id="${id}">
    <div class="series-head">
      <h2 data-reveal>${num ? `<span class="series-num">${num}</span>` : ""}${titleHtml}</h2>
      <div class="series-tools">
        <span>${countLabel}</span>
        <button type="button" class="rail-btn" data-rail="${id}" data-dir="-1" aria-label="Précédent"><svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M22 6H2M7 1L2 6l5 5"/></svg></button>
        <button type="button" class="rail-btn" data-rail="${id}" data-dir="1" aria-label="Suivant">${arrow}</button>
        <button type="button" class="btn btn-ghost" data-lb-open="${id}">Plein écran</button>
      </div>
    </div>
    <div class="rail-wrap">
      <div class="rail" id="rail-${id}" tabindex="0" role="region" aria-label="${esc(alt)} : faire défiler horizontalement">
        ${images.map((im, k) => `<button type="button" data-lb="${id}" data-full="${esc(media(im.src))}" data-cap="${esc(cap)} — ${k + 1} / ${images.length}" data-cursor="Voir" aria-label="Agrandir ${k + 1}">${img(im, `${alt} — ${k + 1}`, { lazy: k >= 4 })}</button>`).join("")}
      </div>
    </div>
    <div class="rail-foot" aria-hidden="true">
      <span class="rail-count" data-rail-count="${id}">01 / ${String(images.length).padStart(2, "0")}</span>
      <span class="rail-progress"><i data-rail-bar="${id}"></i></span>
      <span class="rail-hint"><span class="h-mouse">Faites défiler</span><span class="h-touch">Glissez</span> <svg width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M0 6h24M19 1l5 5-5 5"/></svg></span>
    </div>
  </section>`;

const card = (p, tag = "h2") => `
<a class="card" href="${p.url}" data-reveal>
  <div class="work-media">${p.cover ? img(p.cover, p.title) : ""}</div>
  <${tag}>${esc(p.title)}</${tag}>
  <div class="meta"><span>${esc(p.short)}</span>${statusTag(p)}</div>
</a>`;

/* ---------- Pages ---------- */
const pages = new Map();
const yearsAll = projects.flatMap(yearsOf);
const yMin = Math.min(...yearsAll);
const yMax = Math.max(...yearsAll);

// Accueil
{
  // Carrousel : 6 projets + une sculpture en 3e position, pour montrer les deux métiers dès l'arrivée.
  const sculptSlide = series[0].images[2] && {
    url: "/sculptures/",
    short: "Sculpture — Sur la mer",
    title: "Sculpture d’Eric Picard",
    commune: "série Sur la mer",
    cover: series[0].images[2],
  };
  // 5 images au plus : au-delà, presque personne ne les voit (champ « carousel » de projects.json).
  const heroItems = projects.filter((p) => p.carousel).sort((a, b) => a.carousel - b.carousel);
  if (sculptSlide) heroItems.splice(2, 0, sculptSlide);
  const slides = heroItems.map((p, i) => `
    <div class="hero-slide${i === 0 ? " active" : ""}" data-href="${p.url}" data-title="${esc(p.short)}">
      <img ${i === 0 ? `src="${esc(media(p.cover.webp ?? p.cover.src))}" fetchpriority="high"` : `data-src="${esc(media(p.cover.webp ?? p.cover.src))}"`} ${sizeOf(p.cover.src)} alt="${esc(p.title + " — " + p.commune)}">
    </div>`).join("");
  // Les dessins de l'architecte (dossier de l'Espace de la fête), en filigrane derrière les sections.
  const drawing = (name) => (raw["dossier-plans.html"].images ?? []).find((im) => im.src.includes(name));
  const texture = (im, cls) => (im ? `<div class="drawing ${cls}" aria-hidden="true"><img src="${esc(media(im.md))}" ${sizeOf(im.md)} alt="" loading="lazy" decoding="async"></div>` : "");
  // Vitrine : 5 projets, un par typologie (champ « showcase » de projects.json) ; le carrousel garde les 6 premiers « featured ».
  const showcase = projects.filter((p) => p.showcase).sort((a, b) => a.showcase - b.showcase);
  const shows = showcase.map((p, i) => `
    <article class="show${i % 2 ? " show-r" : ""}">
      <a class="show-media" href="${p.url}" data-reveal="wipe" data-cursor="Voir" tabindex="-1" aria-hidden="true"><div class="parallax" data-speed="0.08">${img(p.cover, p.title, { full: true })}</div></a>
      <div class="show-text" data-reveal>
        <span class="show-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <p class="eyebrow"><b>${esc(cats[p.category].label)}</b>${yearsOf(p).length ? " — " + Math.max(...yearsOf(p)) : ""}</p>
        <h3><a href="${p.url}">${esc(p.title)}</a></h3>
        <p class="show-place">${esc(p.commune)}</p>
        <p class="show-desc">${esc(p.description)}</p>
        <a class="link-arrow" href="${p.url}">Voir le projet ${arrow}</a>
      </div>
    </article>`).join("");
  const catRows = site.categories.map((c, i) => {
    const list = projects.filter((p) => p.category === c.id);
    return `<a class="cat-row" href="/projets/${c.id}/">
      <span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${esc(c.label)}</span><span class="c">${list.length} projet${list.length > 1 ? "s" : ""}</span>${diag}
    </a>`;
  }).join("");
  const sPick = [series[0].images[2], series[1].images[3], series[0].images[20], series[2].images[5], series[3].images[1], series[1].images[10]].filter(Boolean);
  const words = ["Architecture", "Sculpture", "Maisons", "Intérieurs", "Commerces", "Lyon"];
  const marquee = [...words, ...words].map((w) => `<span>${w}</span>`).join("");
  const body = `
<section class="hero" aria-label="Projets à la une">
  ${slides}
  <div class="hero-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <p class="hero-side" aria-hidden="true">Architecte D.P.L.G — Sculpteur — Lyon</p>
  <p class="hero-coords" aria-hidden="true">45°46′ N<br>4°50′ E</p>
  <div class="seal" role="img" aria-label="Architecte diplômé par le gouvernement (D.P.L.G)">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs><path id="seal-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>
      <g class="seal-ring"><text><textPath href="#seal-path" startOffset="0">Architecte diplômé par le gouvernement • Architecte diplômé par le gouvernement •</textPath></text></g>
      <circle cx="100" cy="100" r="58" class="seal-inner"/>
      <text x="100" y="98" text-anchor="middle" class="seal-big">D.P.L.G</text>
      <text x="100" y="122" text-anchor="middle" class="seal-small">Eric Picard</text>
    </svg>
  </div>
  <div class="hero-content">
    <div class="wrap">
      <div>
        <h1><span class="l"><span>Eric</span></span><span class="l"><span><em>Picard</em></span></span></h1>
        <p class="hero-kicker">Architecte D.P.L.G & sculpteur — Lyon 4e</p>
        <div class="hero-actions">
          <a class="btn btn-light" href="${mailArchi}">Parlons de votre projet</a>
          <a class="btn btn-ghost-light" href="tel:${site.phoneIntl}">${site.phone}</a>
        </div>
      </div>
      <div class="hero-caption">
        <div class="hero-ctrl">
          <div class="count">01 / ${String(heroItems.length).padStart(2, "0")}</div>
          <button type="button" class="hero-prev" aria-label="Projet précédent"><svg width="22" height="12" viewBox="0 0 22 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M22 6H2M7 1L2 6l5 5"/></svg></button>
          <button type="button" class="hero-next" aria-label="Projet suivant">${arrow}</button>
        </div>
        <a href="${heroItems[0].url}"><b>${esc(heroItems[0].short)}</b> <span>→</span></a>
        <div class="hero-progress"><i></i></div>
        <div class="hero-dots" style="grid-template-columns:repeat(${heroItems.length},1fr)">${heroItems.map((p, k) => `<button type="button" aria-label="${esc(p.short)}">${img(p.cover, "", { lazy: false })}<span>${String(k + 1).padStart(2, "0")}</span></button>`).join("")}</div>
      </div>
    </div>
  </div>
  <div class="scroll-cue" aria-hidden="true"></div>
</section>

<div class="marquee" aria-hidden="true"><div class="marquee-track">${marquee}</div></div>

<section class="section">
  ${texture(drawing("06-belvedere"), "drawing-right")}
  <div class="wrap">
    <div class="intro">
      <p class="eyebrow" data-reveal><b>01</b> — L’atelier</p>
      <div>
        <p class="lead" data-reveal>Des volumes simples, de la lumière, <em>et une écoute attentive de ceux qui habiteront les lieux.</em></p>
        <p class="lead-sub" data-reveal>Maisons, logements, intérieurs et commerces, conçus depuis l’atelier de la rue d’Austerlitz, à la Croix-Rousse (Lyon 4e) — de l’esquisse au suivi de chantier.</p>
        <a class="link-arrow" href="/atelier/" data-reveal>Découvrir l’atelier ${arrow}</a>
      </div>
    </div>
    <div class="intro-foot" data-reveal>
      <div class="stat"><strong><span data-count="${projects.length}">${projects.length}</span></strong><span>projets présentés</span></div>
      <div class="stat"><strong><span data-count="${yMax - yMin}">${yMax - yMin}</span><small>ans</small></strong><span>de projets, ${yMin} — ${yMax}</span></div>
      <div class="stat"><strong><span data-count="${sculptureCount}">${sculptureCount}</span></strong><span>sculptures en quatre séries</span></div>
      <div class="stat stat-dplg"><strong>D.P.L.G</strong><span>architecte diplômé par le gouvernement</span></div>
    </div>
  </div>
</section>

<section class="section-tight" style="padding-top:0">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-reveal><b>02</b> — Réalisations</p>
      <h2 data-reveal>Projets <em>choisis</em></h2>
      <a class="link-arrow" href="/projets/" data-reveal>Tous les projets ${arrow}</a>
    </div>
    ${shows}
  </div>
</section>

<section class="section">
  ${texture(drawing("08-coupes"), "drawing-left")}
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-reveal><b>03</b> — Typologies</p>
      <h2 data-reveal>Par <em>typologie</em></h2>
    </div>
    <div class="cats" data-reveal>${catRows}</div>
  </div>
</section>

<section class="section dark">
  <div class="wrap sculpt-feature">
    <div class="sculpt-copy" data-reveal>
      <p class="eyebrow"><b>04</b> — Le sculpteur</p>
      <h2>Et de la <em>sculpture…</em></h2>
      <p>Parallèlement à l’architecture, Eric Picard sculpte : la mer, des hauts-reliefs réalisés en Afrique, des pièces murales. ${sculptureCount} œuvres réunies en quatre séries, à découvrir, à acquérir ou à commander.</p>
      <div class="cta-links"><a class="link-arrow" href="/sculptures/">Voir les sculptures ${arrow}</a><a class="link-arrow" href="/sculpture-sur-commande/">Sculpture sur commande ${arrow}</a></div>
    </div>
    <div class="sculpt-cols">
      <div class="col" data-speed="-0.05">${sPick.slice(0, 3).map((im) => `<a href="/sculptures/" data-reveal="wipe" data-cursor="Voir" tabindex="-1" aria-hidden="true">${img(im, "")}</a>`).join("")}</div>
      <div class="col" data-speed="0.07">${sPick.slice(3).map((im) => `<a href="/sculptures/" data-reveal="wipe" data-cursor="Voir" tabindex="-1" aria-hidden="true">${img(im, "")}</a>`).join("")}</div>
    </div>
  </div>
</section>

<section class="section-tight">
  <div class="wrap">
    <div class="creds" data-reveal>
      ${site.credentials.map((c) => `<div class="cred"><h3>${esc(c.label)}</h3><p>${esc(c.detail)}</p></div>`).join("")}
    </div>
  </div>
</section>

<section class="section" style="padding-top:clamp(40px,6vw,80px)">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow" data-reveal><b>05</b> — Contact</p>
      <h2 data-reveal>Un projet, <em>une œuvre</em>&nbsp;?</h2>
    </div>
    ${ctaBlock()}
  </div>
</section>`;
  pages.set("/", layout({
    title: "Eric Picard, architecte D.P.L.G à Lyon — Atelier d’architecture",
    description: "Eric Picard, architecte D.P.L.G et sculpteur à Lyon 4e : extensions et maisons contemporaines, rénovation d’appartements, commerces, permis de construire — et sculptures à acquérir.",
    path: "/",
    header: "on-dark",
    body,
    jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: site.studio, url: site.url + "/", inLanguage: "fr-FR" }, businessLd],
  }));
}

// Liste des projets (toutes catégories + une page par catégorie)
for (const c of [null, ...site.categories]) {
  const list = ordered.filter((p) => !c || p.category === c.id);
  const path = c ? `/projets/${c.id}/` : "/projets/";
  const chips = [["Tous", "/projets/", projects.length], ...site.categories.map((x) => [x.label, `/projets/${x.id}/`, projects.filter((p) => p.category === x.id).length])]
    .map(([l, h, n]) => `<a class="chip" href="${h}"${h === path ? ' aria-current="page"' : ""}>${esc(l)} <sup>${n}</sup></a>`).join("");
  const crumbItems = c ? [["Accueil", "/"], ["Projets", "/projets/"], [c.label, path]] : [["Accueil", "/"], ["Projets", "/projets/"]];
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbs(crumbItems)}
    <h1>${c ? esc(c.label) : "Pro<em>jets</em>"}</h1>
    <p class="intro-text">${c ? esc(c.intro ?? c.description) : "Constructions neuves, extensions, réhabilitations, intérieurs et commerces : une sélection de projets de l’atelier, du plus récent au plus ancien."}</p>
  </div>
</section>
<section class="wrap" style="padding-bottom:clamp(80px,10vw,140px)">
  <nav class="filters" aria-label="Filtrer par typologie">${chips}</nav>
  <div class="grid">${list.map((p) => card(p)).join("")}</div>
  ${!c || c.id === "logements" ? `<div class="archive-note"><p>Les projets publics, les collectifs, les lotissements et les maisons groupées restent consultables sur l’ancien site de l’atelier.</p><a class="link-arrow" href="${site.oldSite}" rel="noopener">Ancien site ${arrow}</a></div>` : ""}
</section>`;
  pages.set(path, layout({
    title: c ? `${c.label} — projets à Lyon | Eric Picard` : "Projets d’architecture à Lyon | Eric Picard",
    description: c ? `${c.description} Réalisations et études d’Eric Picard, architecte D.P.L.G à Lyon.` : `${projects.length} projets de l’atelier Eric Picard, architecte D.P.L.G à Lyon : maisons contemporaines, extensions, logements, appartements et commerces.`,
    path,
    body,
    jsonld: [crumbsLd(crumbItems)],
  }));
}

// Fiches projet
ordered.forEach((p, i) => {
  const prev = ordered[(i - 1 + ordered.length) % ordered.length];
  const next = ordered[(i + 1) % ordered.length];
  const cat = cats[p.category];
  const rows = [
    ["Lieu", p.address ?? p.commune],
    ["Maître d’ouvrage", p.client],
    ["Programme", p.operation],
    ["Surface", p.surface],
    ["Coût des travaux", p.cost],
    ["Années", p.years],
    ["Statut", p.status],
    ["Typologie", `<a href="/projets/${cat.id}/">${esc(cat.label)}</a>`],
  ].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${k === "Typologie" ? v : esc(v)}</dd></div>`).join("");
  const [first, ...rest] = p.text;
  const crumbItems = [["Accueil", "/"], ["Projets", "/projets/"], [cat.label, `/projets/${cat.id}/`], [p.short, p.url]];
  // Galerie éditoriale : 4 grandes images mises en scène (large, paire, large), puis une planche de vignettes.
  // Toutes ouvrent la même visionneuse, dans l'ordre.
  // Images mises en avant : celles choisies dans projects.json (« features »), sinon les premières.
  const picked = (p.features ?? []).map((k) => p.images.find((im) => im !== p.cover && im.src.includes(k))).filter(Boolean);
  const shots = [...picked, ...p.images.filter((im) => im !== p.cover && !picked.includes(im))];
  const lbBtn = (im, n, inner, cls = "") =>
    `<button type="button" class="${cls}" data-lb="p" data-full="${esc(media(im.src))}" data-cap="${esc(p.title)} — ${n + 1} / ${shots.length}" data-cursor="Voir" aria-label="Agrandir l’image ${n + 1}">${inner}</button>`;
  const alt = (n) => `${p.title}, ${p.commune} — vue ${n + 1}`;
  const feat = shots.slice(0, 4);
  const blocks = [];
  if (feat[0]) blocks.push(`<div class="f-wide" data-reveal>${lbBtn(feat[0], 0, img(feat[0], alt(0), { full: true }))}</div>`);
  if (feat[1]) blocks.push(`<div class="f-pair">${feat.slice(1, 3).map((im, k) => `<div data-reveal>${lbBtn(im, k + 1, img(im, alt(k + 1), { full: true }))}</div>`).join("")}</div>`);
  if (feat[3]) blocks.push(`<div class="f-wide" data-reveal>${lbBtn(feat[3], 3, img(feat[3], alt(3), { full: true }))}</div>`);
  const sheet = shots.slice(4).map((im, k) => lbBtn(im, k + 4, img(im, alt(k + 4)), "thumb")).join("");
  const gallery = blocks.length
    ? `<section class="p-gallery" aria-label="Galerie">${blocks.join("")}${sheet ? `<div class="sheet-head"><h2>Toutes les images</h2><span>${shots.length} vues</span></div><div class="sheet">${sheet}</div>` : ""}</section>`
    : "";
  const videos = p.videos.map((v) => `
    <figure class="video" data-reveal>
      <video controls preload="none" playsinline ${v.poster ? `poster="${esc(media(v.poster))}"` : ""}><source src="${esc(media(v.src))}" type="video/mp4"></video>
      <figcaption>Animation 3D du projet</figcaption>
    </figure>`).join("");
  const body = `
<section class="p-hero">
  ${p.cover ? img(p.cover, `${p.title} — ${p.commune}`, { eager: true, full: true }) : ""}
  <div class="wrap">
    ${crumbs(crumbItems)}
    <h1>${esc(p.title)}</h1>
    <p class="place">${esc(p.commune)}${p.years ? " · " + esc(p.years) : ""}</p>
  </div>
</section>
<div class="wrap">
  <div class="p-body">
    <aside class="fiche" aria-label="Fiche technique"><p class="eyebrow" style="margin-bottom:16px">Fiche technique</p><dl>${rows}</dl></aside>
    <div class="p-text" data-reveal>
      <p class="first">${esc(first)}</p>
      ${rest.map((t) => `<p>${esc(t)}</p>`).join("")}
    </div>
  </div>
  ${videos ? `<div class="videos">${videos}</div>` : ""}
  ${gallery}
  <aside class="p-cta" data-reveal>
    <div>
      <p class="eyebrow"><b>—</b> ${esc(cat.label)}</p>
      <h2>Un projet similaire&nbsp;? <em>Parlons-en.</em></h2>
      <p>Eric Picard, architecte D.P.L.G, vous répond directement, de l’étude de faisabilité au suivi de chantier.</p>
    </div>
    <div class="cta-actions">
      <a class="btn" href="tel:${site.phoneIntl}">${site.phone}</a>
      <a class="btn btn-ghost" href="${mailArchi}">Écrire à l’atelier</a>
    </div>
  </aside>
  <nav class="p-nav" aria-label="Autres projets">
    <a href="${prev.url}">${prev.cover ? img(prev.cover, "") : ""}<span><span class="eyebrow">Projet précédent</span><strong>${esc(prev.short)}</strong></span></a>
    <a href="${next.url}">${next.cover ? img(next.cover, "") : ""}<span><span class="eyebrow">Projet suivant</span><strong>${esc(next.short)}</strong></span></a>
  </nav>
</div>
<div style="height:clamp(60px,8vw,120px)"></div>`;
  pages.set(p.url, layout({
    // Premier titre de 65 caractères maximum : Google tronque au-delà.
    title: [
      `${p.title} — ${p.commune.replace(/\s*\(.*\)/, "")} | Eric Picard`,
      `${p.title} — ${p.commune.replace(/\s*\(.*\)/, "")}`,
      `${p.short} | Eric Picard, architecte`,
    ].find((t) => t.length <= 65) ?? p.short,
    description: p.description,
    path: p.url,
    header: "on-dark",
    context: p.short,
    image: p.cover?.src,
    body,
    jsonld: [
      crumbsLd(crumbItems),
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: p.title,
        description: p.description,
        url: abs(p.url),
        image: p.images.slice(0, 6).map((im) => media(im.src)).map((u) => (u.startsWith("http") ? u : abs(u))),
        creator: personLd,
        locationCreated: { "@type": "Place", name: p.commune },
        ...(yearsOf(p).length ? { dateCreated: String(Math.max(...yearsOf(p))) } : {}),
      },
    ],
  }));
});

// Sculptures
{
  // Page d'artiste : une œuvre en grand, puis chaque série sur une bande horizontale (une série ≈ un écran).
  const sHero = series[0].images[2] ?? series[0].images[0];
  const body = `
<section class="s-hero">
  <div class="wrap s-hero-grid">
    <div class="s-hero-copy">
      ${crumbs([["Accueil", "/"], ["Sculptures", "/sculptures/"]])}
      <p class="eyebrow"><b>—</b> Le sculpteur</p>
      <h1>Et de la <em>sculpture…</em></h1>
      <p class="intro-text">Sculpteur à Lyon, dans son atelier de la Croix-Rousse, Eric Picard porte sur la matière le même regard que sur l’architecture : des volumes, de la lumière, le travail de la main. ${sculptureCount} œuvres réunies en quatre séries — la mer, des hauts-reliefs réalisés en Afrique, des pièces murales. Des pièces à acquérir, et des sculptures sur commande.</p>
      <div class="cta-actions"><a class="btn btn-light" href="/sculpture-sur-commande/">Sculpture sur commande</a><a class="btn btn-ghost-light" href="#${series[0].id}">Découvrir les séries</a></div>
    </div>
    <figure class="s-hero-img">${img(sHero, "Sculpture d’Eric Picard, série Sur la mer", { eager: true, full: true })}</figure>
  </div>
</section>
<nav class="series-bar" aria-label="Séries">
  <div class="wrap">${series.map((s, n) => `<a class="chip" href="#${s.id}"><b>${String(n + 1).padStart(2, "0")}</b> ${esc(s.title)} <sup>${s.images.length}</sup></a>`).join("")}</div>
</nav>
<div class="wrap">
  ${series.map((s, n) => railSection({
    id: s.id, num: String(n + 1).padStart(2, "0"), titleHtml: esc(s.title), countLabel: `${s.images.length} œuvres`,
    images: s.images, cap: s.title, alt: `Sculpture d’Eric Picard, série ${s.title}`,
  })).join("")}
  <section class="series sculpt-cta" data-reveal>
    <h2>Acquérir une œuvre, <em>passer commande</em></h2>
    <p>Pièces existantes ou sculptures sur commande : écrivez à Eric Picard en indiquant la série et l’œuvre qui vous intéressent, il vous répondra sur les disponibilités.</p>
    <div class="cta-actions"><a class="btn btn-light" href="/sculpture-sur-commande/">Sculpture sur commande</a><a class="btn btn-ghost-light" href="${mailSculpt}">Écrire au sculpteur</a><a class="btn btn-ghost-light" href="tel:${site.phoneIntl}">${site.phone}</a><a class="btn btn-ghost-light" href="${site.instagram}" rel="noopener">Instagram</a><a class="btn btn-ghost-light" href="${site.facebook}" rel="noopener">Facebook</a></div>
  </section>
</div>
<div style="height:clamp(60px,8vw,120px)"></div>`;
  pages.set("/sculptures/", layout({
    title: "Sculpteur à Lyon, Croix-Rousse — œuvres | Eric Picard",
    description: `Eric Picard, sculpteur et architecte D.P.L.G à Lyon, Croix-Rousse (4e) : ${sculptureCount} sculptures — pièces marines, hauts-reliefs, pièces murales. Œuvres à acquérir et sculptures sur commande.`,
    path: "/sculptures/",
    header: "night",
    bodyClass: "night",
    image: series[0].images[2]?.src,
    body,
    jsonld: [crumbsLd([["Accueil", "/"], ["Sculptures", "/sculptures/"]])],
  }));
}

// Page « Sculpture sur commande » : ce qu'on peut commander, déroulé, devis, contact.
{
  const pick = (si, ii) => series[si]?.images[ii] ?? series[si]?.images[0];
  const KINDS = [
    ["Pièces à poser", "Sculptures en volume, à poser sur un meuble, un socle ou en extérieur — comme la série « Sur la mer ».", pick(0, 2), "sur-la-mer"],
    ["Hauts-reliefs", "Des scènes et des figures qui sortent du fond, à fixer au mur ou à intégrer dans un lieu — comme la série réalisée en Afrique.", pick(1, 3), "haut-relief-en-afrique"],
    ["Pièces murales", "Des œuvres pensées pour un mur précis : une entrée, un séjour, une boutique, un cabinet.", pick(3, 1), "murales"],
  ];
  const STEPS = [
    ["Échange", "Votre idée, le lieu qui accueillera l’œuvre, le format souhaité, votre budget."],
    ["Esquisse", "Dessins et premières propositions, ajustés avec vous avant de commencer."],
    ["Réalisation", "Le travail de la matière à l’atelier, avec des nouvelles de l’avancement en photos."],
    ["Remise", "Finitions, puis remise de l’œuvre — et, si besoin, conseils pour son installation."],
  ];
  const FAQ = [
    ["Combien coûte une sculpture sur commande ?", "Chaque pièce fait l’objet d’un devis, établi après le premier échange : il dépend du format, de la matière et de la complexité de l’œuvre."],
    ["Quel délai prévoir ?", "Il varie selon la pièce. Il est précisé dans le devis, avant tout engagement."],
    ["Peut-on acquérir une œuvre existante ?", "Oui : parcourez les séries, puis écrivez en indiquant l’œuvre qui vous intéresse — Eric Picard vous répondra sur sa disponibilité."],
  ];
  const body = `
<section class="s-hero">
  <div class="wrap s-hero-grid">
    <div class="s-hero-copy">
      ${crumbs([["Accueil", "/"], ["Sculptures", "/sculptures/"], ["Sculpture sur commande", "/sculpture-sur-commande/"]])}
      <p class="eyebrow"><b>—</b> Le sculpteur</p>
      <h1>Sculpture <em>sur commande</em></h1>
      <p class="intro-text">Une œuvre pensée pour un lieu, une personne, une histoire. Eric Picard, architecte D.P.L.G et sculpteur installé à la Croix-Rousse (Lyon 4e), réalise des sculptures sur commande : pièces à poser, hauts-reliefs, pièces murales — avec le regard d’un architecte sur l’espace qui les accueillera.</p>
      <div class="cta-actions"><a class="btn btn-light" href="${mailSculpt}">Demander un devis</a><a class="btn btn-ghost-light" href="/sculptures/">Voir les œuvres</a></div>
    </div>
    <figure class="s-hero-img">${img(pick(2, 5), "Sculpture d’Eric Picard", { eager: true, full: true })}</figure>
  </div>
</section>
<div class="wrap">
  <section class="series">
    <div class="series-head"><h2 data-reveal>Ce que l’on peut <em>commander</em></h2></div>
    <div class="kinds">
      ${KINDS.map(([t, d, im, id], i) => `
      <a class="kind" href="/sculptures/#${id}" data-reveal data-cursor="Voir">
        <div class="kind-img">${im ? img(im, `${t} — sculpture d’Eric Picard`) : ""}</div>
        <span class="series-num">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(t)}</h3>
        <p>${esc(d)}</p>
      </a>`).join("")}
    </div>
  </section>
  <section class="series">
    <div class="series-head"><h2 data-reveal>Comment ça <em>se passe</em></h2></div>
    <ol class="steps steps-4">${STEPS.map(([t, d], i) => `<li data-reveal><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join("")}</ol>
  </section>
  <section class="series">
    <div class="series-head"><h2 data-reveal>Questions <em>fréquentes</em></h2></div>
    <div class="faq">${FAQ.map(([q, a]) => `<details data-reveal><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  </section>
  <section class="series sculpt-cta" data-reveal>
    <h2>Parlons de <em>votre œuvre</em></h2>
    <p>Décrivez votre idée en quelques lignes — le lieu, le format, ce qui vous touche. Eric Picard vous répondra personnellement.</p>
    <div class="cta-actions"><a class="btn btn-light" href="${mailSculpt}">Écrire au sculpteur</a><a class="btn btn-ghost-light" href="tel:${site.phoneIntl}">${site.phone}</a><a class="btn btn-ghost-light" href="${site.instagram}" rel="noopener">Instagram</a><a class="btn btn-ghost-light" href="${site.facebook}" rel="noopener">Facebook</a></div>
  </section>
</div>
<div style="height:clamp(60px,8vw,120px)"></div>`;
  pages.set("/sculpture-sur-commande/", layout({
    title: "Sculpture sur commande à Lyon | Eric Picard, sculpteur",
    description: "Sculptures sur commande par Eric Picard, sculpteur et architecte D.P.L.G à Lyon : pièces à poser, hauts-reliefs, pièces murales. Devis personnalisé.",
    path: "/sculpture-sur-commande/",
    header: "night",
    bodyClass: "night",
    image: pick(2, 5)?.src,
    body,
    jsonld: [
      crumbsLd([["Accueil", "/"], ["Sculptures", "/sculptures/"], ["Sculpture sur commande", "/sculpture-sur-commande/"]]),
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "Sculpture sur commande",
        serviceType: "Sculpture sur commande",
        description: "Pièces à poser, hauts-reliefs et pièces murales réalisés sur commande par Eric Picard, sculpteur à Lyon.",
        provider: { ...personLd, jobTitle: "Architecte D.P.L.G et sculpteur" },
        areaServed: "France",
        url: abs("/sculpture-sur-commande/"),
      },
    ],
  }));
}

// Recherches : l'espace de la fête
{
  const plans = (raw["dossier-plans.html"].images ?? []).filter((im) => !/image-collee|article/.test(im.src));
  const histo = raw["Livre/dossier-historique.html"].images ?? [];
  const article = (raw["dossier-plans.html"].images ?? []).find((im) => /article/.test(im.src));
  const cover = histo[0] ?? plans[0];
  const body = `
<section class="s-hero">
  <div class="wrap s-hero-grid">
    <div class="s-hero-copy">
      ${crumbs([["Accueil", "/"], ["Recherches", "/recherches/"]])}
      <p class="eyebrow"><b>—</b> Recherches · Projet de diplôme</p>
      <h1>L’espace <em>de la fête</em></h1>
      <p class="intro-text">Utopie ou réalité ? Un essai de définition et de représentation de l’espace de la fête : une architecture organique sur les berges du Rhône — forum, belvédère, espaces nautiques. Sujet de diplôme, ce travail a reçu le Grand Prix de la Société Académique d’Architecture de Lyon.</p>
      <div class="cta-actions"><a class="btn btn-light" href="#plans">Voir les planches</a><a class="btn btn-ghost-light" href="#historique">Le dossier historique</a></div>
    </div>
    <figure class="s-hero-img s-hero-paper">${img(cover, "L’espace de la fête — dessin d’Eric Picard", { eager: true, full: true })}</figure>
  </div>
</section>
<nav class="series-bar" aria-label="Dossiers">
  <div class="wrap"><a class="chip" href="#plans"><b>01</b> Le dossier de plans <sup>${plans.length}</sup></a><a class="chip" href="#historique"><b>02</b> Le dossier historique <sup>${histo.length}</sup></a>${article ? `<a class="chip" href="#presse"><b>03</b> Dans la presse</a>` : ""}</div>
</nav>
<div class="wrap">
  ${railSection({ id: "plans", num: "01", titleHtml: "Le dossier <em>de plans</em>", countLabel: `${plans.length} planches`, images: plans, cap: "L’espace de la fête — dossier de plans", alt: "L’espace de la fête, dossier de plans, planche" })}
  ${railSection({ id: "historique", num: "02", titleHtml: "Le dossier <em>historique</em>", countLabel: `${histo.length} feuillets`, images: histo, cap: "L’espace de la fête — dossier historique", alt: "L’espace de la fête, dossier historique, feuillet" })}
  ${article ? `<section class="series" id="presse">
    <div class="split">
      <div data-reveal>
        <h2 class="press-title"><span class="series-num">03</span>Dans la <em>presse</em></h2>
        <p class="press-text">Une architecture organique pensée pour accueillir la fête — un projet qui attend toujours son mécène.</p>
      </div>
      <div data-reveal><button type="button" class="map-link" data-lb="article" data-full="${esc(media(article.src))}" data-cap="Article de presse" data-cursor="Lire" aria-label="Agrandir l’article">${img(article, "Article de presse consacré au projet")}</button></div>
    </div>
  </section>` : ""}
</div>
<div style="height:clamp(60px,8vw,120px)"></div>`;
  pages.set("/recherches/", layout({
    title: "L’espace de la fête — Recherches | Eric Picard, architecte",
    description: "Essai de définition et de représentation de l’espace de la fête : une architecture organique sur les berges du Rhône, lauréate de la Société Académique d’Architecture de Lyon.",
    path: "/recherches/",
    header: "night",
    bodyClass: "night",
    image: plans[0]?.src,
    body,
    jsonld: [crumbsLd([["Accueil", "/"], ["Recherches", "/recherches/"]])],
  }));
}

// Page « Architecte à Lyon » : missions, exemples réels, déroulé, questions fréquentes.
{
  const bySlug = (s) => projects.find((p) => p.slug === s);
  const links = (slugs) => slugs.map(bySlug).filter(Boolean).map((p) => `<a href="${p.url}">${esc(p.short)}</a>`).join(" · ");
  const MISSION_BLOCKS = [
    ["Extension de maison", "Agrandir sans dénaturer : un volume simple qui prolonge l’existant, pensé avec le terrain, la lumière et le budget. Du relevé à la déclaration préalable ou au permis de construire, puis au suivi de chantier.", ["extension-maison-dardilly", "extension-maison-lyon-8", "extension-oullins", "extension-saint-pierre-de-chandieu"]],
    ["Maison neuve contemporaine", "Une imbrication de volumes simples, implantée au plus juste dans son site — terrain en pente, vue sur un lac, restanques.", ["maison-contemporaine-annecy-le-vieux", "maison-plan-de-la-tour", "maison-contemporaine-bouliac", "trois-maisons-septeme"]],
    ["Rénovation et réhabilitation", "Maisons bourgeoises, corps de ferme : restructurer les volumes, ouvrir à la lumière, mettre aux normes thermiques, en respectant le caractère du bâti.", ["maison-bourgeoise-hauteville-lompnes", "corps-de-ferme-simandres", "maison-bourgeoise-villeurbanne"]],
    ["Appartements et intérieurs", "Restructuration lourde, décoration, mobilier sur mesure : un travail de détail mené avec les artisans.", ["loft-lyon-4", "appartement-art-deco-lyon-6", "tour-panoramique-la-duchere", "veranda-bron", "chalet-megeve", "appartement-saint-raphael"]],
    ["Commerces et cabinets", "Boutiques, salons, cabinets médicaux : mise en scène, lumière, accessibilité PMR, travaux par phases pour maintenir l’activité.", ["boutique-dolce-lyon-2", "salon-emilia-g-lyon-2", "cabinet-podologie-lyon"]],
    ["Logements collectifs et faisabilité", "Études de faisabilité et opérations de logements, en lien avec l’architecte conseil de la commune.", ["residence-seniors-craponne", "residence-favre-lyon-8"]],
  ];
  const STEPS = [
    ["Rencontre et programme", "Visite des lieux, écoute de vos besoins, de vos contraintes et de votre budget."],
    ["Esquisse et faisabilité", "Premières propositions de volumes et d’implantation, vérification des règles d’urbanisme (PLU)."],
    ["Autorisations", "Constitution et dépôt de la déclaration préalable ou du permis de construire."],
    ["Consultation des entreprises", "Plans, descriptifs, mise en concurrence des artisans et des entreprises."],
    ["Suivi de chantier et réception", "Réunions de chantier, contrôle de l’exécution, réception des travaux."],
  ];
  const FAQ = [
    ["Quand l’architecte est-il obligatoire ?", "Pour un particulier, le recours à un architecte est obligatoire pour un permis de construire dès que la surface de plancher totale (existant + projet) dépasse 150 m². En dessous, il reste recommandé : il vous aide à concevoir, à obtenir l’autorisation et à suivre les travaux."],
    ["Extension : déclaration préalable ou permis de construire ?", "En règle générale, une extension jusqu’à 20 m² relève d’une déclaration préalable — jusqu’à 40 m² en zone urbaine d’un PLU. Au-delà, un permis de construire est nécessaire. Le règlement d’urbanisme de votre commune fait foi : c’est l’une des premières vérifications de l’atelier."],
    ["Intervenez-vous en dehors de Lyon ?", "Oui. L’atelier est installé à Lyon 4e et a mené des projets dans tout le Rhône (Dardilly, Craponne, Oullins, Bron, Villeurbanne, Simandres…), dans l’Ain, en Isère, en Haute-Savoie, dans le Var et en Gironde."],
    ["Que comprend une mission complète ?", "Les études (esquisse, avant-projet), le dossier d’autorisation, la consultation des entreprises, puis le suivi du chantier jusqu’à la réception des travaux. Une mission peut aussi être limitée à l’étude ou au permis de construire."],
    ["Et pour un commerce ou un cabinet ?", "L’atelier aménage boutiques, salons et cabinets, avec la mise aux normes d’accessibilité PMR (Ad’AP), et peut organiser les travaux par phases pour que l’activité continue."],
  ];
  const plan = (raw["dossier-plans.html"].images ?? []).find((im) => im.src.includes("02-organisation"));
  const body = `
<section class="page-head">
  ${plan ? `<div class="drawing drawing-right" aria-hidden="true"><img src="${esc(media(plan.md))}" ${sizeOf(plan.md)} alt="" loading="lazy" decoding="async"></div>` : ""}
  <div class="wrap">
    ${crumbs([["Accueil", "/"], ["Architecte à Lyon", "/architecte-lyon/"]])}
    <p class="eyebrow"><b>—</b> Missions</p>
    <h1>Architecte <em>à Lyon</em></h1>
    <p class="intro-text">Eric Picard, architecte D.P.L.G installé rue d’Austerlitz, à la Croix-Rousse (Lyon 4e), accompagne particuliers, commerçants et maîtres d’ouvrage : extension de maison, maison contemporaine, rénovation d’appartement, aménagement de commerce — de l’étude de faisabilité au suivi de chantier.</p>
    <div class="cta-actions"><a class="btn btn-light" href="${mailArchi}">Parlons de votre projet</a><a class="btn btn-ghost-light" href="tel:${site.phoneIntl}">${site.phone}</a></div>
  </div>
</section>
<div class="wrap">
  <section class="missions-grid">
    ${MISSION_BLOCKS.map(([t, d, slugs], i) => `
    <article class="mission" data-reveal>
      <span class="series-num">${String(i + 1).padStart(2, "0")}</span>
      <h2>${esc(t)}</h2>
      <p>${esc(d)}</p>
      <p class="mission-links"><span class="eyebrow">Exemples</span> ${links(slugs)}</p>
    </article>`).join("")}
  </section>
  <section class="series">
    <div class="series-head"><h2 data-reveal>Le <em>déroulé</em> d’une mission</h2></div>
    <ol class="steps">${STEPS.map(([t, d], i) => `<li data-reveal><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join("")}</ol>
  </section>
  <section class="series">
    <div class="series-head"><h2 data-reveal>Questions <em>fréquentes</em></h2></div>
    <div class="faq">${FAQ.map(([q, a]) => `<details data-reveal><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
  </section>
  <section class="series">${ctaBlock()}</section>
</div>
<div style="height:clamp(40px,6vw,80px)"></div>`;
  pages.set("/architecte-lyon/", layout({
    title: "Architecte à Lyon — extension, rénovation | Eric Picard",
    description: "Eric Picard, architecte D.P.L.G à Lyon 4e : extension de maison, maison contemporaine, rénovation d’appartement, commerces, permis de construire et suivi de chantier.",
    path: "/architecte-lyon/",
    body,
    jsonld: [
      crumbsLd([["Accueil", "/"], ["Architecte à Lyon", "/architecte-lyon/"]]),
      {
        ...businessLd,
        makesOffer: MISSION_BLOCKS.map(([t, d]) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: t, description: d, areaServed: "Lyon" } })),
      },
    ],
  }));
}

// L'atelier
{
  const tl = ordered.filter((p) => yearsOf(p).length).map((p) =>
    `<li><time>${esc(p.years.replace(/^(Études|Études )\s*/i, ""))}</time><span><a href="${p.url}">${esc(p.title)}</a><small>${esc(p.commune)}</small></span></li>`).join("");
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbs([["Accueil", "/"], ["L’atelier", "/atelier/"]])}
    <h1>L’<em>atelier</em></h1>
    <p class="intro-text">${esc(site.studio)}, ${esc(site.street)}, Lyon 4e.</p>
  </div>
</section>
<div class="wrap">
  <div class="split">
    <div class="prose" data-reveal>
      <p class="lead serif" style="font-size:clamp(26px,2.6vw,38px);line-height:1.2;color:var(--ink)">Architecte D.P.L.G installé à Lyon, Eric Picard conçoit des maisons, des logements, des intérieurs et des commerces, de l’étude de faisabilité jusqu’au suivi de chantier.</p>
      <p>Chaque projet part d’un dialogue étroit avec ses clients : une imbrication de volumes simples, une attention au site, à la lumière et à l’existant, et un travail mené avec les artisans — ébénistes, staffeurs, marbriers, serruriers.</p>
      <p>L’atelier affiche les certifications ADEME HQE (mention Très Bien) et Ad’AP. Eric Picard a été lauréat de la Société Académique d’Architecture de Lyon.</p>
      <p>En parallèle, Eric Picard poursuit un travail de <a href="/sculptures/">sculpteur</a>.</p>
      <h2>Distinctions & certifications</h2>
      <ul>${site.credentials.map((c) => `<li><strong>${esc(c.label)}</strong> — ${esc(c.detail)}</li>`).join("")}</ul>
    </div>
    <div data-reveal>
      <p class="eyebrow" style="margin-bottom:16px">Projets, du plus récent au plus ancien</p>
      <ol class="timeline">${tl}</ol>
    </div>
  </div>
</div>
<div style="height:clamp(80px,10vw,160px)"></div>`;
  pages.set("/atelier/", layout({
    title: "L’atelier — Eric Picard, architecte D.P.L.G à Lyon 4e",
    description: "Eric Picard, architecte D.P.L.G à Lyon 4e, certifié ADEME HQE : maisons, logements, intérieurs et commerces, de l’étude au suivi de chantier.",
    path: "/atelier/",
    body,
    jsonld: [crumbsLd([["Accueil", "/"], ["L’atelier", "/atelier/"]]), { "@context": "https://schema.org", ...personLd, worksFor: { "@id": site.url + "/#atelier" } }],
  }));
}

// Contact
{
  const osm = "https://www.openstreetmap.org/search?query=" + encodeURIComponent("9 rue d'Austerlitz 69004 Lyon");
  const photo = projects.find((p) => p.slug === "loft-lyon-4").images[4];
  const body = `
<section class="page-head">
  <div class="wrap">
    ${crumbs([["Accueil", "/"], ["Contact", "/contact/"]])}
    <h1>Con<em>tact</em></h1>
  </div>
</section>
<div class="wrap">
  ${ctaBlock({ onContact: true })}
  <div class="split" style="padding:clamp(64px,8vw,120px) 0 clamp(80px,10vw,160px)">
    <div class="contact-band" data-reveal>
      <h2 style="font-size:clamp(40px,5.4vw,84px)"><a href="mailto:${site.email}">${site.email.replace("@", "@<wbr>")}</a></h2>
      <div class="contact-grid" style="grid-template-columns:1fr 1fr">
        <div><span class="eyebrow">Téléphone</span><a href="tel:${site.phoneIntl}">${site.phone}</a></div>
        <div><span class="eyebrow">Adresse</span>${esc(site.street)}<br>${site.postalCode} ${site.locality}<br><a href="${osm}" rel="noopener" style="font-size:14px;color:var(--muted)">Voir sur la carte →</a></div>
        <div><span class="eyebrow">Instagram</span><a href="${site.instagram}" rel="noopener">@picardarchitecte</a></div>
        <div><span class="eyebrow">Facebook</span><a href="${site.facebook}" rel="noopener">picardarchi</a></div>
      </div>
    </div>
    <div data-reveal><a class="map-link" href="${osm}" rel="noopener" aria-label="Localiser l’atelier sur OpenStreetMap">${photo ? img(photo, "Intérieur réalisé par l’atelier à Lyon 4e") : ""}</a></div>
  </div>
</div>`;
  pages.set("/contact/", layout({
    title: "Contact — Eric Picard, architecte à Lyon 4e",
    description: `Contacter Eric Picard, architecte et sculpteur à Lyon 4e, pour un projet d’architecture ou une sculpture : ${site.phone} — ${site.email}.`,
    path: "/contact/",
    body,
    jsonld: [crumbsLd([["Accueil", "/"], ["Contact", "/contact/"]]), businessLd],
  }));
}

// Mentions légales
pages.set("/mentions-legales/", layout({
  title: "Mentions légales | Eric Picard, architecte",
  description: "Mentions légales du site de l’atelier d’architecture Eric Picard.",
  path: "/mentions-legales/",
  body: `
<section class="page-head"><div class="wrap">${crumbs([["Accueil", "/"], ["Mentions légales", "/mentions-legales/"]])}<h1>Mentions <em>légales</em></h1></div></section>
<div class="wrap" style="padding-bottom:clamp(80px,10vw,160px)">
  <div class="prose">
    <h2>Éditeur</h2>
    <p>${esc(site.studio)} — Eric Picard, architecte D.P.L.G<br>${esc(site.street)}, ${site.postalCode} ${site.locality}<br>Téléphone : ${site.phone} — E-mail : <a href="mailto:${site.email}">${site.email}</a><br>Directeur de la publication : Eric Picard.</p>
    <p>Inscription à l’Ordre des architectes et SIRET : informations en cours de mise à jour.</p>
    <h2>Hébergement</h2>
    <p>OVH SAS — 2, rue Kellermann, 59100 Roubaix, France.</p>
    <h2>Propriété intellectuelle</h2>
    <p>Les projets, photographies, perspectives, plans et sculptures présentés sur ce site sont la propriété d’Eric Picard ou de leurs auteurs. Toute reproduction sans autorisation est interdite.</p>
    <h2>Données personnelles</h2>
    <p>Ce site ne dépose aucun cookie, n’utilise aucun outil de mesure d’audience et ne fait appel à aucun service tiers : polices, images et vidéos sont hébergées sur le site.</p>
  </div>
</div>`,
}));

// 404
pages.set("/404.html", layout({
  title: "Page introuvable | Eric Picard, architecte",
  description: "Cette page n’existe pas ou a été déplacée. Retrouvez les projets, les sculptures et les coordonnées de l’atelier Eric Picard.",
  path: "/404.html",
  noindex: true,
  body: `<section class="err"><div><h1 class="serif">404</h1><p style="margin:16px 0 32px">Cette page n’existe pas ou a été déplacée.</p><a class="link-arrow" href="/projets/">Voir les projets ${arrow}</a></div></section>`,
}));

/* ---------- Écriture ---------- */
await rm(DIST, { recursive: true, force: true });
// Validation : liens internes préfixés par /new (sauf /media, partagé à la racine) et pages non indexées.
const forBase = (html) => !BASE ? html : html
  .replace(/(href|src|srcset|data-href|data-src|data-full|data-img|poster)="\/(?!\/|media\/)/g, `$1="${BASE}/`)
  .replace('<meta name="viewport"', '<meta name="robots" content="noindex, nofollow">\n<meta name="viewport"');
for (const [path, html] of pages) {
  const file = path.endsWith(".html") ? join(DIST, path) : join(DIST, path, "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, forBase(html));
}
await writeFile(join(ROOT, "content/media-manifest.json"), JSON.stringify([...usedMedia].sort(), null, 1));
await cp(join(ROOT, "src/assets"), join(DIST, "assets"), { recursive: true });
await writeFile(join(DIST, "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#141413"/><text x="32" y="45" font-family="Georgia,serif" font-size="38" text-anchor="middle" fill="#f3f0ea">P</text><circle cx="47" cy="44" r="3.5" fill="#b3311f"/></svg>`);

// SEO : sitemap, robots
const urls = [...pages.keys()].filter((p) => !p.endsWith(".html"));
const today = new Date().toISOString().slice(0, 10);
const absMedia = (u) => { const m = media(u); return m.startsWith("http") ? m : abs(m); };
const pageImages = (u) => {
  const p = projects.find((x) => x.url === u);
  if (p) return [p.cover, ...p.images.filter((im) => im !== p.cover)].filter(Boolean).slice(0, 12).map((im) => [absMedia(im.src), p.title]);
  if (u === "/sculptures/") return series.flatMap((x) => x.images.map((im) => [absMedia(im.src), `Sculpture d’Eric Picard, série ${x.title}`]));
  if (u === "/") return featured.slice(0, 6).map((x) => [absMedia(x.cover.src), x.title]);
  return [];
};
const xmlEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
await writeFile(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${today}</lastmod><priority>${u === "/" ? "1.0" : u === "/architecte-lyon/" ? "0.9" : u.split("/").length > 3 ? "0.7" : "0.8"}</priority>${pageImages(u).map(([loc, title]) => `<image:image><image:loc>${xmlEsc(loc)}</image:loc><image:title>${xmlEsc(title)}</image:title></image:image>`).join("")}</url>`).join("\n")}
</urlset>
`);
await writeFile(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);

// Redirections 301 des anciennes pages Sitely vers les nouvelles URL
const redirects = new Map([
  ["/architecte-decoration.html", "/"],
  ["/ESSAI/public.html", "/projets/logements/"],
  ["/collectifs.html", "/projets/logements/"],
  ["/lotissements.html", "/projets/logements/"],
  ["/maisons-groupees.html", "/projets/logements/"],
  ["/bureaux-sports.html", "/projets/commerces/"],
  ["/maisons-individuelles-1.html", "/projets/maisons/"],
  ["/maisons-individuelles-2.html", "/projets/maisons/"],
  ["/maisons-individuelles-3.html", "/projets/maisons/"],
  ["/animations.html", "/projets/maisons/"],
  ["/apartements.html", "/projets/interieurs/"],
  ["/decoration.html", "/projets/interieurs/"],
  ["/espace-fete.html", "/recherches/"],
  ["/dossier-plans.html", "/recherches/"],
  ["/Livre/dossier-historique.html", "/recherches/"],
  ["/Livre/sculpture.html", "/sculptures/"],
  ["/Livre/contact.html", "/contact/"],
]);
for (const p of projects) for (const s of p.sources) redirects.set("/" + s, p.url);
if (STAGING) {
  await rm(join(DIST, "sitemap.xml"));
  await rm(join(DIST, "robots.txt"));
  await writeFile(join(DIST, ".htaccess"), `# Version de validation (www/new/) — non indexée
DirectoryIndex index.html
ErrorDocument 404 ${BASE}/404.html
AddDefaultCharset utf-8
<IfModule mod_headers.c>
  Header always set X-Robots-Tag "noindex, nofollow"
</IfModule>
`);
}
else await writeFile(join(DIST, ".htaccess"), `# Eric Picard — configuration Apache (OVH mutualisé)
Options -Indexes
ErrorDocument 404 /404.html
DirectoryIndex index.html
AddDefaultCharset utf-8
AddType font/woff2 .woff2

# HTTPS et domaine sans www
RewriteEngine On
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\.picard-architecte\\.fr$ [NC]
RewriteRule ^(.*)$ https://picard-architecte.fr/$1 [R=301,L]

# Anciennes pages (Sitely) → nouvelles pages
${[...redirects].map(([from, to]) => `Redirect 301 ${from} ${to}`).join("\n")}

# Compression et cache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json image/svg+xml application/xml text/plain
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType text/javascript "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType video/mp4 "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-Frame-Options "SAMEORIGIN"
</IfModule>
`);

const mode = PROD ? "production" : STAGING ? "validation (www/new/)" : "dév. : médias de " + OLD_ORIGIN;
console.log(`${pages.size} pages générées dans ${DIST.replace(ROOT, "").slice(1)}/ (${mode}), ${usedMedia.size} médias, ${STAGING ? 0 : redirects.size} redirections.`);
