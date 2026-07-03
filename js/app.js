// ============================================================
//  DEON — app logic
//  Loads content from /content/data.json (edited via the
//  Pages CMS dashboard), then handles nav, filtering, scroll
//  reveals and the lightbox. No dependencies.
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
const CAT_LABEL = Object.fromEntries(FILTERS.map(f => [f.id, f.label]));

/* ---------------- populate static text ---------------- */
function fillText() {
  $('#hero-statement').textContent = SITE.statement;
  $('#hero-availability').textContent = SITE.availability;
  $('#hero-location').textContent = SITE.location;

  // studio intro — first line strong, rest muted
  const intro = $('#studio-intro');
  intro.innerHTML = SITE.intro
    .map((line, i) => i === 0 ? line : `<span class="mut"> ${line}</span>`)
    .join(' ');

  $('#contact-head').textContent = SITE.contact.heading;

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

/* ---------------- disciplines ---------------- */
function fillDisciplines() {
  const list = $('#discipline-list');
  DISCIPLINES.forEach(d => {
    const li = el('li', 'discipline');
    li.append(
      el('span', 'discipline-n', d.n),
      el('span', 'discipline-title', d.title),
      el('span', 'discipline-desc', d.desc),
    );
    list.append(li);
  });
}

/* ---------------- clients ---------------- */
function fillClients() {
  if (!CLIENTS || !CLIENTS.length) return;
  $('#clients').hidden = false;
  const track = $('#client-track');
  // duplicate list for a seamless loop
  [...CLIENTS, ...CLIENTS].forEach(c => track.append(el('span', null, c)));
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
const onScroll = () => header.classList.toggle('solid', window.scrollY > window.innerHeight * 0.7);
window.addEventListener('scroll', onScroll, { passive: true });
$('#to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ---------------- scroll-linked motion ----------------
   Keeps native (momentum) scrolling — important on mobile — and
   eases the hero centerpiece with a smoothed scroll value so the
   page feels alive as you scroll. Swap #rock for a 3D model later. */
function initScrollFX() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rock = $('#rock');
  if (!rock) return;
  let smooth = window.scrollY;
  const tick = () => {
    const y = window.scrollY;
    smooth += (y - smooth) * 0.09;
    const vh = window.innerHeight || 1;
    const p = Math.min(Math.max(smooth / vh, 0), 1.4);
    rock.style.transform =
      `translate3d(0, ${smooth * 0.16}px, 0) rotate(${smooth * 0.03}deg) scale(${1 + p * 0.12})`;
    rock.style.opacity = String(Math.max(1 - p * 0.7, 0));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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
  fillClients();
  fillFilters();
  fillWork();
  observeReveals();
  initScrollFX();
  onScroll();
}

main();
