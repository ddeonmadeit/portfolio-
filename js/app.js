// ============================================================
//  DEON — app logic
//  Loads content from /content/data.json (edited via the
//  Pages CMS dashboard). Signature interaction: a smoothed,
//  scroll-driven camera dolly that flies through the wordmark
//  (the counter of the O) before the page content arrives.
// ============================================================

// Category filters are fixed (they map to the studio's disciplines).
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'design', label: 'Design' },
  { id: 'music', label: 'Music' },
  { id: 'web', label: 'Web' },
  { id: 'video', label: 'Video' },
  { id: 'clothing', label: 'Clothing' },
];

// Filled once content/data.json loads.
let SITE, DISCIPLINES, CLIENTS, WORK;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const CAT_LABEL = Object.fromEntries(FILTERS.map(f => [f.id, f.label]));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- populate static text ---------------- */
function fillText() {
  $('#hero-statement').textContent = SITE.statement;
  $('#hero-availability').textContent = SITE.availability;
  $('#hero-location').textContent = SITE.location;

  // hero contact rows (label + email), podium-style top block
  const hc = $('#hero-contacts');
  SITE.contact.channels.forEach(c => {
    const row = el('div', 'hc-row');
    row.append(el('span', 'hc-label', c.label));
    const a = el('a', null, c.email);
    a.href = `mailto:${c.email}`;
    row.append(a);
    hc.append(row);
  });

  // statement — split into word spans for the scroll scrub
  const intro = $('#studio-intro');
  const text = SITE.intro.join(' ');
  intro.innerHTML = text.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');

  $('#contact-head').textContent = SITE.contact.heading;
  const primary = SITE.contact.channels[0];
  if (primary) $('#contact-cta').href = `mailto:${primary.email}`;

  const channels = $('#contact-channels');
  SITE.contact.channels.forEach(c => {
    const block = el('div', 'channel');
    block.append(el('div', 'channel-label', c.label));
    const a = el('a', 'channel-email', c.email);
    a.href = `mailto:${c.email}`;
    block.append(a);
    channels.append(block);
  });

  const cs = $('#contact-socials');
  const ms = $('#menu-socials');
  SITE.socials.forEach(s => {
    const mk = () => { const a = el('a', null, s.label); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; return a; };
    cs.append(mk());
    ms.append(mk());
  });

  $('#footer-name').textContent = SITE.name;
  $('#footer-year').textContent = new Date().getFullYear();
  $('#footer-credit').textContent = `© ${new Date().getFullYear()} ${SITE.name}. ${SITE.credit}.`;
}

/* ---------------- what we do ---------------- */
function fillDisciplines() {
  const list = $('#discipline-list');
  DISCIPLINES.forEach(d => list.append(el('li', null, d.title)));
  $('#client-flow').textContent = (CLIENTS || []).join(', ') + (CLIENTS?.length ? '.' : '');
}

/* ---------------- work grid ---------------- */
function fillWork() {
  const grid = $('#work-grid');
  WORK.forEach((w, i) => {
    const tile = el('button', 'tile');
    tile.dataset.ratio = w.ratio || 'square';
    tile.dataset.cat = w.cat;
    if (w.ratio === 'landscape' && i % 5 === 0) tile.dataset.span = '2';
    tile.setAttribute('aria-label', `${w.title} — open`);

    if (w.img) {
      const img = el('img');
      img.src = w.img; img.alt = w.title; img.loading = 'lazy';
      tile.append(img);
    } else {
      tile.append(el('div', 'tile-ph'));
      tile.append(el('div', 'tile-ph-label', CAT_LABEL[w.cat] || w.cat));
    }
    const meta = el('div', 'tile-meta');
    meta.append(el('span', 'tile-title', w.title), el('span', 'tile-year', w.year || ''));
    tile.append(meta);

    tile.addEventListener('click', () => openLightbox(w));
    grid.append(tile);
  });
}

/* ---------------- filters ---------------- */
function fillFilters() {
  const wrap = $('#filters');
  FILTERS.forEach(f => {
    const b = el('button', 'filter' + (f.id === 'all' ? ' active' : ''), f.label);
    b.dataset.id = f.id;
    b.addEventListener('click', () => {
      $$('.filter').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $$('.tile').forEach(t => {
        const show = f.id === 'all' || t.dataset.cat === f.id;
        t.classList.toggle('hide', !show);
      });
    });
    wrap.append(b);
  });
}

/* ---------------- lightbox ---------------- */
const lb = $('#lightbox');
function openLightbox(w) {
  const media = $('#lightbox-media');
  media.innerHTML = w.img
    ? `<img src="${w.img}" alt="${w.title}">`
    : `<div class="ph">${CAT_LABEL[w.cat] || w.cat}</div>`;
  $('#lightbox-cat').textContent = `${CAT_LABEL[w.cat] || w.cat} · ${w.year || ''}`.trim();
  $('#lightbox-title').textContent = w.title;
  $('#lightbox-desc').textContent = w.desc || '';
  const link = $('#lightbox-link');
  if (w.link) { link.href = w.link; link.hidden = false; } else { link.hidden = true; }

  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lb.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { lb.hidden = true; }, 350);
}
$('#lightbox-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); closeMenu(); }
});

/* ---------------- mobile menu ---------------- */
const menuBtn = $('#menu-btn');
function openMenu() { document.body.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); }
function closeMenu() { document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => {
  document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
});
$$('.menu-nav a').forEach(a => a.addEventListener('click', closeMenu));

/* ---------------- header state + back to top ---------------- */
const header = $('#header');
const onScroll = () => header.classList.toggle('solid', window.scrollY > window.innerHeight * 1.2);
window.addEventListener('scroll', onScroll, { passive: true });
$('#to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ============================================================
   FLY-THROUGH ENGINE
   Native (momentum) scrolling is kept — a lerped scroll value
   drives the 3D dolly, so the camera glides through the
   counter of the O in the wordmark, then the page arrives.
   ============================================================ */
const PERSPECTIVE = 900;    // must match #fly-stage CSS
const DOLLY_MAX = 872;      // stop just before the word plane crosses the camera

function initFlyThrough() {
  const stage = $('#fly-stage');
  const world = $('#fly-world');
  const wordEl = $('#fly-word');
  const oEl = $('#fly-o');
  const overlay = $('#hero-fixed');
  const runway = $('#runway');
  const lead = $('#studio-intro');
  const words = $$('.w', lead);

  if (REDUCED) { words.forEach(w => w.classList.add('on')); return; }

  // Offset from the O's centre to the viewport centre — translating the
  // world by this keeps the O dead-centre, so the dolly flies through it.
  let oOffX = 0, oOffY = 0;
  const measure = () => {
    world.style.transform = 'none';
    const r = oEl.getBoundingClientRect();
    oOffX = (innerWidth / 2) - (r.left + r.width / 2);
    oOffY = (innerHeight / 2) - (r.top + r.height / 2);
  };
  measure();
  addEventListener('resize', measure);

  let smooth = window.scrollY;
  let wordCount = -1;

  const tick = () => {
    smooth += (window.scrollY - smooth) * 0.085;

    const H = Math.max(runway.offsetHeight - innerHeight, 1);
    const p = clamp(smooth / H, 0, 1);

    // camera dolly: ease in, drift the O to centre over the first half
    const dz = DOLLY_MAX * (0.25 * p + 0.75 * p * p);
    const align = Math.min(p / 0.5, 1);
    const alignE = align * align * (3 - 2 * align); // smoothstep
    world.style.transform =
      `translate3d(${oOffX * alignE}px, ${oOffY * alignE}px, ${dz}px)`;

    // wordmark fades right at the end of the pass-through
    wordEl.style.opacity = String(clamp(1 - (p - 0.86) / 0.12, 0, 1));

    // overlay text drifts up + fades over the first third
    const op = clamp(1 - p / 0.32, 0, 1);
    overlay.style.opacity = String(op);
    overlay.style.transform = `translateY(${(1 - op) * -40}px)`;
    overlay.style.visibility = op <= 0.001 ? 'hidden' : 'visible';

    // hide the stage once the fly-through is done
    stage.style.visibility = p >= 0.995 ? 'hidden' : 'visible';

    // statement word scrub — words light up as the block crosses the view
    const lr = lead.getBoundingClientRect();
    const lp = clamp((innerHeight * 0.9 - lr.top) / (innerHeight * 0.65), 0, 1);
    const n = Math.round(lp * words.length);
    if (n !== wordCount) {
      wordCount = n;
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }

    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------------- preloader ---------------- */
function runLoader(done) {
  const pct = $('#loader-pct');
  if (REDUCED) { pct.textContent = '100%'; document.body.classList.remove('loading'); done(); return; }
  const t0 = performance.now();
  const DUR = 1100;
  const step = (now) => {
    const p = clamp((now - t0) / DUR, 0, 1);
    pct.textContent = Math.round(p * 100) + '%';
    if (p < 1) { requestAnimationFrame(step); }
    else {
      document.body.classList.remove('loading');
      done();
    }
  };
  requestAnimationFrame(step);
}

/* ---------------- scroll reveals ---------------- */
function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(n => io.observe(n));

  // tiles stagger in
  const tio = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('in'), (i % 3) * 80);
        tio.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  $$('.tile').forEach(n => tio.observe(n));
}

/* ---------------- boot ---------------- */
async function main() {
  let data;
  try {
    const res = await fetch('content/data.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (err) {
    console.error('Could not load content/data.json', err);
    document.body.classList.remove('loading');
    return;
  }

  // shape the loaded JSON into what the render code expects
  SITE = {
    ...data.site,
    contact: { heading: data.site.contactHeading, channels: data.site.channels || [] },
  };
  DISCIPLINES = data.disciplines || [];
  CLIENTS = data.clients || [];
  WORK = data.work || [];

  fillText();
  fillDisciplines();
  fillFilters();
  fillWork();
  observeReveals();
  onScroll();

  await document.fonts.ready;
  runLoader(() => initFlyThrough());
}

main();
