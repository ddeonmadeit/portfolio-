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
// Restrict a video to a slice of itself. Native loop only ever replays the
// whole clip, so when a range is set we turn it off and wrap manually.
function applyLoopRange(video, start, end) {
  const s = Math.max(0, Number(start) || 0);
  const e = Number(end) || 0;
  if (!s && !e) return; // whole clip — native loop already does this

  video.loop = false;
  const stopAt = () => (e > s ? e : (video.duration || Infinity));
  const toStart = () => {
    try { video.currentTime = s; } catch {}
    video.play?.().catch(() => {});
  };

  if (video.readyState >= 1) toStart();
  else video.addEventListener('loadedmetadata', toStart, { once: true });

  video.addEventListener('timeupdate', () => {
    if (video.currentTime >= stopAt() - 0.05) toStart();
  });
  video.addEventListener('ended', toStart);
}

function buildMedia(url, type, alt, eager, loop) {
  if (type === 'video') {
    const v = el('video');
    // Some engines (notably iOS Safari) decide autoplay eligibility from the
    // "muted" content attribute, not just the IDL property — setting only
    // v.muted can silently fail to autoplay and fall back to a play button.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.setAttribute('autoplay', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.loop = true;
    v.playsInline = true;
    // Always fetch full data, not just metadata — every cover/gallery video
    // here is meant to autoplay immediately, and metadata-only preload just
    // delays the buffering autoplay depends on, widening the window where
    // WebKit shows its "not yet playing" tap-to-play affordance.
    v.preload = 'auto';
    v.setAttribute('aria-label', alt || '');
    v.src = url;
    if (loop) applyLoopRange(v, loop.start, loop.end);
    // Belt-and-braces: explicitly kick off playback and retry if the
    // browser's autoplay attempt was rejected, so nothing is ever left
    // sitting on its poster frame with a play affordance.
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener('loadeddata', tryPlay);
    v.addEventListener('canplay', tryPlay);
    return v;
  }
  const img = el('img');
  img.src = url;
  img.alt = alt || '';
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  return img; // covers both photos and GIFs — GIFs loop natively as <img>
}

/* ---------------- video embeds (full pieces live off-site) ---------------- */
// Returns a player URL for YouTube/Vimeo links, or null if unrecognised.
function embedSrc(url) {
  if (!url) return null;
  const u = String(url).trim();

  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&playsinline=1`;

  // vimeo.com/123456789 and unlisted vimeo.com/123456789/abcdef0123
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?${vm[2] ? `h=${vm[2]}&` : ''}autoplay=1&muted=1`;

  return null;
}

function buildEmbed(url) {
  const src = embedSrc(url);
  if (!src) return null;
  const wrap = el('div', 'embed');
  const frame = el('iframe');
  frame.src = src;
  frame.loading = 'lazy';
  frame.title = 'Video';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  wrap.append(frame);
  return wrap;
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
  buildIconRow($('#hero-icon-row'));

  const label = $('#studio-label');
  label.textContent = SITE.studioLabel || '';
  label.hidden = !SITE.studioLabel;
  $('#studio-name').textContent = SITE.name;
  $('#studio-blurb').textContent = SITE.studioBlurb;

  const list = $('#disciplines');
  list.innerHTML = '';
  SITE.disciplines.forEach(d => list.append(el('li', null, d)));

  const softLabel = $('#soft-label');
  const softList = $('#softwares');
  const softwares = SITE.softwares || [];
  softLabel.hidden = !softwares.length;
  softList.hidden = !softwares.length;
  softList.innerHTML = '';
  softwares.forEach(s => softList.append(el('li', null, s)));

  $('#contact-label').textContent = SITE.contactLabel;
  const mail = $('#email-link');
  mail.textContent = SITE.email;
  mail.href = `mailto:${SITE.email}`;

  const phone = $('#phone-link');
  if (SITE.phone) {
    phone.textContent = SITE.phone;
    phone.href = `tel:${SITE.phone.replace(/[^\d+]/g, '')}`;
    phone.hidden = false;
  } else {
    phone.hidden = true;
  }

  buildIconRow($('#contact-icon-row'));
}

function buildIconRow(container) {
  container.innerHTML = '';
  if (SITE.instagramUrl) {
    const a = el('a', 'icon-link instagram');
    a.href = SITE.instagramUrl; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'Instagram');
    container.append(a);
  }
  if (SITE.knotsssUrl) {
    const a = el('a', 'icon-link knotsss');
    a.href = SITE.knotsssUrl; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', 'knotsss');
    container.append(a);
  }
}

/* ---------------- project previews: one static collage per section ---------------- */
function coverLoop(p) {
  return { start: p.loopStart, end: p.loopEnd };
}

function buildTile(p, eager) {
  const tile = el('button', 'tile');
  tile.setAttribute('aria-label', p.title);
  tile.style.aspectRatio = (p.aspect || '1/1').replace('/', ' / ');
  if (p.cover) tile.append(buildMedia(p.cover, p.coverType, '', eager, coverLoop(p)));
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
  if (p.cover) cover.append(buildMedia(p.cover, p.coverType, p.title, true, coverLoop(p)));

  const specs = $('#d-specs');
  specs.innerHTML = '';
  [
    ['ROLE', p.role],
  ].forEach(([k, v]) => {
    const box = el('div', 'spec');
    box.append(el('dt', null, k), el('dd', null, v));
    specs.append(box);
  });

  $('#d-summary').textContent = p.summary;
  $('#d-narrative').textContent = p.narrative;

  // full piece, embedded from wherever it's hosted
  const embedWrap = $('#d-embed');
  embedWrap.innerHTML = '';
  const embed = buildEmbed(p.embedUrl);
  if (embed) {
    embedWrap.append(el('p', 'label amber', '/ WATCH'), embed);
    embedWrap.hidden = false;
  } else {
    embedWrap.hidden = true;
  }

  // gallery beyond the cover; otherwise the "to be added" placeholder
  const gal = $('#d-gallery');
  gal.innerHTML = '';
  const extra = (p.gallery || []).filter(g => g.url !== p.cover);
  if (extra.length) {
    extra.forEach(g => gal.append(buildMedia(g.url, g.type, p.title)));
  } else if (!embed) {
    // an embed already gives this project something to show
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

// iOS Safari can silently block programmatic autoplay (Low Power Mode, or a
// per-site Auto-Play setting) even when muted, leaving its tap-to-play
// affordance showing — but a genuine user gesture always overrides that.
// Nudge every still-paused video into playing on the first tap/scroll.
function unlockVideosOnFirstGesture() {
  const kick = () => $$('video').forEach(v => { if (v.paused) v.play().catch(() => {}); });
  ['touchstart', 'click', 'scroll'].forEach(evt =>
    document.addEventListener(evt, kick, { passive: true }));
}
unlockVideosOnFirstGesture();

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

  $('#back-archive').addEventListener('click', () => navigate('/'));
  $('#back-archive-top').addEventListener('click', () => navigate('/'));
  $('#logo-home').addEventListener('click', () => navigate('/'));
}

main();
