// ============================================================
//  DEON — Polymathic Studio
//  Static, dependency-free. Content lives in content/data.json.
//  Routes: "/" = archive, "/project/<id>" = project detail.
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

let SITE, FILTERS, PROJECTS;
let activeFilter = 'All';

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
  SITE.disciplines.forEach(d => list.append(el('li', null, d)));

  $('#contact-label').textContent = SITE.contactLabel;
  const mail = $('#email-link');
  mail.textContent = SITE.email;
  mail.href = `mailto:${SITE.email}`;

  $('#to-top').textContent = SITE.backToTop;
  $('#copyright').textContent = SITE.copyright;
  $('#system-tag').textContent = SITE.systemTag;
}

/* ---------------- project previews: two looping, image-only rows ---------------- */
function buildTile(p, eager) {
  const tile = el('button', 'tile');
  tile.setAttribute('aria-label', p.title);
  tile.style.aspectRatio = p.aspect.replace('/', ' / ');
  if (p.cover) {
    const img = el('img');
    img.src = p.cover;
    img.alt = '';
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    tile.append(img);
  }
  tile.addEventListener('click', () => navigate(`/project/${p.id}`));
  return tile;
}

function renderPreviews() {
  const shown = PROJECTS.filter(p => activeFilter === 'All' || p.category === activeFilter);
  const rows = [[], []];
  shown.forEach((p, i) => rows[i % 2].push(p));

  ['#track-1', '#track-2'].forEach((sel, rowIdx) => {
    const track = $(sel);
    const row = track.closest('.marquee-row');
    const items = rows[rowIdx];
    track.innerHTML = '';
    row.hidden = items.length === 0;
    if (!items.length) return;
    // duplicate once for a seamless loop; reduced-motion never scrolls,
    // so it only needs the single static pass
    const list = REDUCED ? items : [...items, ...items];
    list.forEach((p, i) => track.append(buildTile(p, rowIdx === 0 && i < 3)));
  });
}

/* ---------------- filters ---------------- */
function renderFilters() {
  const wrap = $('#filters');
  FILTERS.forEach(f => {
    const b = el('button', 'pill mono' + (f === activeFilter ? ' active' : ''), f);
    b.addEventListener('click', () => {
      activeFilter = f;
      $$('.pill', wrap).forEach(p => p.classList.toggle('active', p.textContent === f));
      renderPreviews();
    });
    wrap.append(b);
  });
}

/* ---------------- project detail ---------------- */
function renderDetail(p) {
  $('#d-meta').textContent = `${p.category.toUpperCase()} · ${p.year}`;
  $('#d-title').textContent = p.title;

  const cover = $('#d-cover');
  if (p.cover) { cover.src = p.cover; cover.alt = p.title; cover.hidden = false; }
  else { cover.hidden = true; }

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
  const extra = (p.gallery || []).filter(src => src !== p.cover);
  if (extra.length) {
    extra.forEach(src => {
      const img = el('img');
      img.src = src; img.alt = p.title; img.loading = 'lazy';
      gal.append(img);
    });
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
  const p = m && PROJECTS.find(x => x.id === m[1]);
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
  FILTERS = data.filters;
  PROJECTS = data.projects;

  fillStatic();
  renderFilters();
  renderPreviews();
  route();

  $('#to-top').addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

  $('#back-archive').addEventListener('click', () => navigate('/'));
  $('#back-archive-top').addEventListener('click', () => navigate('/'));
  $('#logo-home').addEventListener('click', () => navigate('/'));
}

main();
