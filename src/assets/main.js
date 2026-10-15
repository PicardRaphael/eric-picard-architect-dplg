// Eric Picard — interactions (sans dépendance)
document.documentElement.classList.add("js");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* En-tête : état au défilement, masqué en descendant */
const header = document.querySelector(".site-header");
if (header) {
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle("scrolled", y > 40);
    header.classList.toggle("hidden", y > 400 && y > lastY && !document.body.classList.contains("menu-open"));
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* Menu mobile */
const menuBtn = document.querySelector(".menu-btn");
menuBtn?.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  menuBtn.setAttribute("aria-expanded", String(open));
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("menu-open")) menuBtn.click();
});

/* Apparition au défilement */
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }),
  { rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

/* Bouton « Copier l'adresse » : fonctionne même sans messagerie installée */
document.querySelectorAll("[data-copy]").forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    btn.textContent = "Adresse copiée ✓";
    btn.classList.add("done");
    setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, 2400);
  });
});

/* Compteurs animés */
const counters = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  counters.unobserve(e.target);
  const el = e.target;
  const end = Number(el.dataset.count);
  if (reduceMotion) return;
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1600);
    el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), { threshold: .6 });
document.querySelectorAll("[data-count]").forEach((el) => counters.observe(el));

/* Diaporama d'accueil */
const hero = document.querySelector(".hero");
if (hero) {
  const slides = [...hero.querySelectorAll(".hero-slide")];
  const count = hero.querySelector(".count");
  const link = hero.querySelector(".hero-caption a");
  const bar = hero.querySelector(".hero-progress i");
  const dots = [...hero.querySelectorAll(".hero-dots button")];
  // Défilement conservé même avec « animations réduites » : simple fondu, sans zoom (géré en CSS).
  const ms = 7000;
  hero.style.setProperty("--slide-ms", ms + "ms");
  let i = 0;
  let timer;
  const load = (s) => {
    const img = s.querySelector("img");
    if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
  };
  const show = (n) => {
    slides[i].classList.remove("active");
    dots[i]?.removeAttribute("aria-current");
    i = (n + slides.length) % slides.length;
    const s = slides[i];
    load(s);
    load(slides[(i + 1) % slides.length]); // précharge la suivante
    s.classList.add("active");
    dots[i]?.setAttribute("aria-current", "true");
    count.textContent = String(i + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0");
    link.href = s.dataset.href;
    link.querySelector("b").textContent = s.dataset.title;
    bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run");
  };
  const stop = () => { clearInterval(timer); bar.classList.remove("run"); };
  const play = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), ms); bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run"); };
  const go = (n) => { show(n); play(); };
  hero.querySelector(".hero-prev")?.addEventListener("click", () => go(i - 1));
  hero.querySelector(".hero-next")?.addEventListener("click", () => go(i + 1));
  dots.forEach((d, k) => d.addEventListener("click", () => go(k)));
  hero.addEventListener("mouseenter", stop);
  hero.addEventListener("mouseleave", play);
  hero.addEventListener("focusin", stop);
  let x0 = null;
  hero.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1);
    x0 = null;
  });
  show(0);
  play();
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
}

/* Parallaxe légère : data-speed = fraction du décalage au centre de l'écran (désactivée si animations réduites) */
const layers = [...document.querySelectorAll("[data-speed]")];
if (layers.length && !reduceMotion) {
  let ticking = false;
  const update = () => {
    const vh = innerHeight;
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const offset = (r.top + r.height / 2 - vh / 2) * Number(el.dataset.speed);
      el.style.transform = `translate3d(0, ${Math.max(-80, Math.min(80, offset)).toFixed(1)}px, 0)`;
    }
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener("resize", update);
  update();
}

/* Curseur personnalisé : souris uniquement, jamais sur écran tactile ni avec animations réduites */
if (matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
  const cur = document.createElement("div");
  cur.className = "cursor";
  cur.setAttribute("aria-hidden", "true");
  cur.innerHTML = "<b></b>";
  document.body.append(cur);
  const label = cur.querySelector("b");
  let x = 0, y = 0, cx = 0, cy = 0;
  addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; cur.classList.add("on"); }, { passive: true });
  document.addEventListener("mouseleave", () => cur.classList.remove("on"));
  const loop = () => {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.addEventListener("mouseover", (e) => {
    const big = e.target.closest("[data-cursor], .gallery button");
    const link = !big && e.target.closest("a, button");
    cur.classList.toggle("big", !!big);
    cur.classList.toggle("link", !!link);
    label.textContent = big ? (big.dataset.cursor ?? "Agrandir") : "";
  });
}

/* Visionneuse */
const groups = new Map();
document.querySelectorAll("[data-lb]").forEach((btn) => {
  const g = btn.dataset.lb;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(btn);
});
if (groups.size) {
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Visionneuse d’images");
  lb.innerHTML = `
    <figure><img alt=""></figure>
    <div class="lb-bar"><span class="lb-cap"></span><span class="lb-count"></span></div>
    <button class="lb-btn lb-prev" aria-label="Image précédente"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="lb-btn lb-next" aria-label="Image suivante"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M9 5l7 7-7 7"/></svg></button>
    <button class="lb-close" aria-label="Fermer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 5l14 14M19 5L5 19"/></svg></button>`;
  document.body.append(lb);
  const img = lb.querySelector("img");
  const cap = lb.querySelector(".lb-cap");
  const cnt = lb.querySelector(".lb-count");
  let list = [];
  let idx = 0;
  let opener = null;

  const render = () => {
    const b = list[idx];
    img.classList.remove("ready");
    img.onload = () => img.classList.add("ready");
    img.src = b.dataset.full;
    img.alt = b.querySelector("img")?.alt ?? "";
    cap.textContent = b.dataset.cap ?? "";
    cnt.textContent = `${idx + 1} / ${list.length}`;
    // Précharge la suivante
    const next = list[(idx + 1) % list.length];
    if (next) new Image().src = next.dataset.full;
  };
  const open = (btn) => {
    list = groups.get(btn.dataset.lb);
    idx = list.indexOf(btn);
    opener = btn;
    render();
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    lb.querySelector(".lb-close").focus();
  };
  const close = () => {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    img.removeAttribute("src");
    opener?.focus();
  };
  const step = (d) => { idx = (idx + d + list.length) % list.length; render(); };

  groups.forEach((items) => items.forEach((b) => b.addEventListener("click", () => open(b))));
  lb.querySelector(".lb-prev").addEventListener("click", () => step(-1));
  lb.querySelector(".lb-next").addEventListener("click", () => step(1));
  lb.querySelector(".lb-close").addEventListener("click", close);
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") close(); });
  addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  let x0 = null;
  lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
}
