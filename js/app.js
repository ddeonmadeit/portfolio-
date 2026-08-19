// ============================================================
//  DEON — Polymathic Studio
//  Static, dependency-free. Content lives in content/data.json,
//  edited at /dash. Routes: "/" = archive, "/project/<id>" = detail.
// ============================================================

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

let SITE, SECTIONS, PROJECTS;
let PROJECT_BY_ID = {};

/* ---------------- media: images, gifs (native loop) and video (looped) ---------------- */
function buildMedia(url, type, alt, eager) {
  if (type === 'video') {
    const v = el('video');
    v.src = url;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = eager ? 'auto' : 'metadata';
    v.setAttribute('aria-label', alt || '');
    return v;
  }
  const img = el('img');
  img.src = url;
  img.alt = alt || '';
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  return img; // covers both photos and GIFs — GIFs loop natively as <img>
}

/* ---------------- hero + studio ---------------- */
function fillStatic() {
  document.title = SITE.title;
  $('#sr-name').textContent = SITE.name;
  $('#ghost-word').textContent = SITE.name;
  $('#hero-lead').textContent = SITE.heroLead;
  $('#hero-accent').textContent = SITE.heroAccent;
  $('#hero-sub').textContent = SITE.heroSub;

  $('.hero-copy').classList.add('rise', 'rise-1');

  $('#studio-label').textContent = SITE.studioLabel;
  $('#studio-name').textContent = SITE.name;
  $('#studio-blurb').textContent = SITE.studioBlurb;

  const list = $('#disciplines');
  list.innerHTML = '';
  SITE.disciplines.forEach(d => list.append(el('li', null, d)));

  $('#contact-label').textContent = SITE.contactLabel;
  const mail = $('#email-link');
  mail.textContent = SITE.email;
  mail.href = `mailto:${SITE.email}`;

  $('#to-top').textContent = SITE.backToTop;
  $('#copyright').textContent = SITE.copyright;
  $('#system-tag').textContent = SITE.systemTag;
}

/* ---------------- project previews: one static collage per section ---------------- */
function buildTile(p, eager) {
  const tile = el('button', 'tile');
  tile.setAttribute('aria-label', p.title);
  tile.style.aspectRatio = (p.aspect || '1/1').replace('/', ' / ');
  if (p.cover) tile.append(buildMedia(p.cover, p.coverType, '', eager));
  tile.addEventListener('click', () => navigate(`/project/${p.id}`));
  return tile;
}

function renderSections() {
  const archive = $('#archive');
  archive.innerHTML = '';

  SECTIONS.forEach((section, sIdx) => {
    const items = (section.projectIds || [])
      .map(id => PROJECT_BY_ID[id])
      .filter(Boolean);
    if (!items.length) return;

    const block = el('section', 'section-block');
    if (section.title) block.append(el('h3', 'section-title', section.title));

    const collage = el('div', 'collage');
    items.forEach((p, i) => collage.append(buildTile(p, sIdx === 0 && i < 3)));
    block.append(collage);
    archive.append(block);
  });
}

/* ---------------- project detail ---------------- */
function renderDetail(p) {
  $('#d-meta').textContent = `${p.category.toUpperCase()} · ${p.year}`;
  $('#d-title').textContent = p.title;

  const cover = $('#d-cover');
  cover.innerHTML = '';
  if (p.cover) cover.append(buildMedia(p.cover, p.coverType, p.title, true));

  const specs = $('#d-specs');
  specs.innerHTML = '';
  [
    ['ROLE', p.role],
    ['YEAR', p.year],
    ['DISCIPLINE', p.category],
  ].forEach(([k, v]) => {
    const box = el('div', 'spec');
    box.append(el('dt', null, k), el('dd', null, v));
    specs.append(box);
  });

  $('#d-summary').textContent = p.summary;
  $('#d-narrative').textContent = p.narrative;

  // gallery beyond the cover; otherwise the "to be added" placeholder
  const gal = $('#d-gallery');
  gal.innerHTML = '';
  const extra = (p.gallery || []).filter(g => g.url !== p.cover);
  if (extra.length) {
    extra.forEach(g => gal.append(buildMedia(g.url, g.type, p.title)));
  } else {
    gal.append(el('p', 'gallery-note', 'ADDITIONAL MEDIA — TO BE ADDED'));
  }
}

/* ---------------- routing ---------------- */
function showView(name) {
  $('#home').hidden = name !== 'home';
  $('#detail').hidden = name !== 'detail';
}

function route() {
  const m = location.pathname.match(/^\/project\/([\w-]+)\/?$/);
  const p = m && PROJECT_BY_ID[m[1]];
  if (p) {
    renderDetail(p);
    showView('detail');
    document.title = `${p.title} — ${SITE.name}`;
  } else {
    showView('home');
    document.title = SITE.title;
  }
  window.scrollTo(0, 0);
}

function navigate(path) {
  history.pushState({}, '', path);
  route();
}
window.addEventListener('popstate', route);

/* ---------------- boot ---------------- */
async function main() {
  let data;
  try {
    const res = await fetch('/content/data.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (err) {
    console.error('Could not load content/data.json', err);
    return;
  }

  SITE = data.site;
  SECTIONS = data.sections || [];
  PROJECTS = data.projects || [];
  PROJECT_BY_ID = Object.fromEntries(PROJECTS.map(p => [p.id, p]));

  fillStatic();
  renderSections();
  route();

  $('#to-top').addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

  $('#back-archive').addEventListener('click', () => navigate('/'));
  $('#back-archive-top').addEventListener('click', () => navigate('/'));
  $('#logo-home').addEventListener('click', () => navigate('/'));
}

main();
