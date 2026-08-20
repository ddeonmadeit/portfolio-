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

// Videos get a poster generated alongside them at upload time, named after the
// clip itself. If one hasn't been made the attribute simply resolves to
// nothing, which is harmless.
function posterFor(url) {
  return url.replace(/\.[^./]+$/, '') + '-poster.jpg';
}

// coverType is what the dashboard recorded, but fall back to the file
// extension so a photo swapped in over a video still renders as a still
// image rather than an empty video element.
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;
function resolveType(url, type) {
  if (type === 'video' || type === 'image') {
    if (type === 'video' && url && !VIDEO_EXT.test(url)) return 'image';
    return type;
  }
  return url && VIDEO_EXT.test(url) ? 'video' : 'image';
}

// Videos the device refused to autoplay, standing in as poster images until a
// gesture lets them run. Hiding WebKit's play button with CSS depends on
// pseudo-element names Apple can rename or drop; taking the video element out
// of the document does not. With no <video> there, there is nothing to paint a
// button on, and the viewer sees a still frame that looks deliberate.
const STILLS = new Map(); // img -> video

function swapToStill(video) {
  if (!video.parentNode || video.dataset.stillSwapped) return;
  const poster = video.poster;
  if (!poster) return; // nothing to show instead — leave the video in place

  // only swap once the poster is known good, so a missing file can't leave a
  // broken image where the cover should be
  const probe = new Image();
  probe.onload = () => {
    if (!video.parentNode) return;
    const img = el('img');
    img.src = poster;
    img.alt = '';
    img.decoding = 'async';
    video.dataset.stillSwapped = '1';
    STILLS.set(img, video);
    video.replaceWith(img);
  };
  probe.src = poster;
}

// A real gesture lifts the autoplay restriction, so put the videos back and
// start them. Covers the swapped-out ones and any that simply never started.
function playAllVideos() {
  STILLS.forEach((video, img) => {
    if (img.parentNode) img.replaceWith(video);
    delete video.dataset.stillSwapped;
    video.play().catch(() => {});
  });
  STILLS.clear();
  $$('video').forEach(v => { if (v.paused) v.play().catch(() => {}); });
}

function buildMedia(url, type, alt, eager, loop) {
  type = resolveType(url, type);
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
    // Covers above the fold shouldn't queue behind lazy images for bandwidth.
    if (eager) v.setAttribute('fetchpriority', 'high');
    // Something static to show the instant the element exists, and what stays
    // on screen if the device refuses to autoplay at all.
    v.poster = posterFor(url);
    v.setAttribute('aria-label', alt || '');
    v.src = url;
    if (loop) applyLoopRange(v, loop.start, loop.end);
    // Belt-and-braces: explicitly kick off playback and retry if the
    // browser's autoplay attempt was rejected, so nothing is ever left
    // sitting on its poster frame with a play affordance.
    // canplay fires as soon as *some* frames are decodable, which is far
    // earlier than canplaythrough — start there rather than waiting for the
    // browser to decide the whole clip can play uninterrupted.
    // A rejected play() means the device is refusing autoplay outright rather
    // than still fetching — the poster is what the viewer will be looking at,
    // so flag it and let the spinner stand down.
    const tryPlay = () => v.play().then(
      () => { delete v.dataset.autoplayBlocked; },
      (err) => {
        v.dataset.autoplayBlocked = '1';
        // NotAllowedError is the device refusing autoplay outright (Low Power
        // Mode, per-site Auto-Play). Anything else — AbortError from a load
        // interrupting playback, say — is transient and worth retrying.
        if (err && err.name === 'NotAllowedError') swapToStill(v);
      }
    );
    tryPlay();
    v.addEventListener('loadedmetadata', tryPlay);
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

// Every cover keeps the exact ratio it was given — nothing is ever cropped to
// match a neighbour. Ratios at either extreme can't share a row and still look
// right, so they take one to themselves: wide (16/9 and wider) runs the full
// width, tall (9/16 and narrower) is centred. Everything in between pairs up.
// Copper spinner while a cover buffers. Only shown if the clip isn't already
// running after a short grace period, so a fast-loading video never flashes it.
function showSpinnerWhileBuffering(tile, video) {
  let settled = false;
  const clear = () => { settled = true; tile.classList.remove('is-buffering'); };
  const mark = () => {
    // Blocked autoplay isn't loading — showing a spinner over a perfectly
    // good poster frame just looks broken.
    if (settled || video.dataset.autoplayBlocked) return;
    if (video.paused) tile.classList.add('is-buffering');
  };

  setTimeout(mark, 250);
  // Give up rather than spin forever if the clip never plays — a codec the
  // browser can't decode fires no 'playing', and on some engines no 'error'
  // either, which would otherwise leave the spinner running indefinitely.
  setTimeout(clear, 12000);
  ['playing', 'error'].forEach(evt => video.addEventListener(evt, clear, { once: true }));
  video.addEventListener('waiting', () => { if (!settled) tile.classList.add('is-buffering'); });
}

function ratioOf(aspect) {
  const [w, h] = (aspect || '1/1').split('/').map(Number);
  const r = w / h;
  return isFinite(r) && r > 0 ? r : 1;
}

function rowSpan(aspect) {
  const r = ratioOf(aspect);
  if (r >= 1.6) return ' tile-wide';
  if (r <= 0.6) return ' tile-tall';
  return '';
}

const isSolo = (aspect) => rowSpan(aspect) !== '';

function buildTile(p, eager) {
  const aspect = p.aspect || '1/1';
  const tile = el('button', 'tile' + rowSpan(aspect));
  tile.setAttribute('aria-label', p.title);
  tile.style.aspectRatio = aspect.replace('/', ' / ');
  if (p.cover) {
    const media = buildMedia(p.cover, p.coverType, '', eager, coverLoop(p));
    // Which part of the cover survives the crop. The tile is the chosen ratio
    // and object-fit fills it; this decides what's kept rather than always
    // taking the middle.
    const x = p.coverX == null ? 50 : p.coverX;
    const y = p.coverY == null ? 50 : p.coverY;
    if (x !== 50 || y !== 50) media.style.objectPosition = `${x}% ${y}%`;
    tile.append(media);
    if (p.coverType === 'video') showSpinnerWhileBuffering(tile, media);
  }
  tile.addEventListener('click', () => navigate(`/project/${p.id}`));
  return tile;
}

// A pair sharing one row, sized so both come out exactly the same height with
// their ratios untouched.
//
// Equal columns were the problem: two tiles of different ratios forced into
// the same width end up different heights, and the shorter one leaves a hole.
// Give each tile a width proportional to its ratio instead and the heights
// match by definition — width ÷ ratio is then the same for both. flex-grow
// does the arithmetic, so it holds at every viewport width without measuring
// anything, and the row's bottom edge is flush.
function buildRow(entries) {
  const row = el('div', entries.length === 1 ? 'row row-single' : 'row');
  entries.forEach(({ project, eager }) => {
    const tile = buildTile(project, eager);
    tile.style.flexGrow = String(ratioOf(project.aspect));
    row.append(tile);
  });
  return row;
}

function fillSection(block, section, items, first) {
  if (section.title) block.append(el('h3', 'section-title', section.title));

  // Full-width covers interrupt the columns and sit on their own, so a run
  // of paired tiles is packed, then the solo one, then the next run —
  // keeping the order set in the dashboard.
  const collage = el('div', 'collage');
  let pair = [];
  const flushPair = () => {
    if (pair.length) collage.append(buildRow(pair));
    pair = [];
  };

  items.forEach((project, i) => {
    const eager = first && i < 3;
    if (isSolo(project.aspect)) {
      flushPair();
      collage.append(buildTile(project, eager));
      return;
    }
    pair.push({ project, eager });
    if (pair.length === 2) flushPair();
  });
  flushPair();

  block.append(collage);
}

function renderSections() {
  const archive = $('#archive');
  archive.innerHTML = '';

  const pending = [];
  let firstDone = false;

  SECTIONS.forEach((section) => {
    const items = (section.projectIds || [])
      .map(id => PROJECT_BY_ID[id])
      .filter(Boolean);
    if (!items.length) return; // empty sections don't count as the first one

    const block = el('section', 'section-block');
    archive.append(block);

    // Only the first section with anything in it is built up front. The rest
    // stay empty shells until revealed, so their covers — videos especially —
    // aren't downloaded for a section nobody has asked to see yet.
    if (!firstDone) {
      fillSection(block, section, items, true);
      firstDone = true;
    } else {
      block.hidden = true;
      pending.push({ block, section, items });
    }
  });

  if (!pending.length) return;

  // One button that walks down the page: it reveals the next section, then
  // re-seats itself underneath it, until there is nothing left to show.
  const more = el('button', 'more-btn');
  more.type = 'button';
  more.append(el('span', 'more-label', 'View more'));

  let next = 0;
  const seat = () => {
    if (next >= pending.length) { more.remove(); return; }
    const above = next === 0 ? archive.firstElementChild : pending[next - 1].block;
    above.after(more);
  };

  more.addEventListener('click', () => {
    const { block, section, items } = pending[next++];
    fillSection(block, section, items, false);
    block.hidden = false;
    if (!REDUCED) block.classList.add('reveal');
    seat();
  });

  seat();
}

/* ---------------- project detail ---------------- */
function renderDetail(p) {
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
  ['touchstart', 'click', 'scroll'].forEach(evt =>
    document.addEventListener(evt, playAllVideos, { passive: true }));
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
