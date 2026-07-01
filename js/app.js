// ============================================================
//  DEON — app logic
//  Renders content from data.js, handles nav, filtering,
//  scroll reveals and the lightbox. No dependencies.
// ============================================================
import { SITE, DISCIPLINES, CLIENTS, FILTERS, WORK } from './data.js';

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
fillText();
fillDisciplines();
fillClients();
fillFilters();
fillWork();
observeReveals();
onScroll();
