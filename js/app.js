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

let SITE, SECTIONS, PROJECTS, MUSIC, STORE;
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
// Loop range that repeats on the project's own page.
function coverLoop(p) {
  return { start: p.loopStart, end: p.loopEnd };
}
// Independent trim for the home grid tile only — lets a cover show a
// different slice on the home page than it does on its own project page.
function previewLoop(p) {
  const s = p.previewStart, e = p.previewEnd;
  if (!s && !e) return coverLoop(p); // no explicit trim set — fall back to the page loop
  return { start: s, end: e };
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

// An image left to itself paints as it arrives, wiping down the tile like a
// curtain. Keep it invisible behind the loader until the whole frame is
// decoded, then fade it in as one piece.
function holdUntilDecoded(tile, img) {
  tile.classList.add('is-loading');
  const reveal = () => {
    tile.classList.remove('is-loading', 'is-buffering');
    tile.classList.add('is-loaded');
  };

  // Only show the loader if it's actually slow — a cached image is instant and
  // shouldn't flash one.
  setTimeout(() => {
    if (tile.classList.contains('is-loading')) tile.classList.add('is-buffering');
  }, 250);

  if (img.complete && img.naturalWidth) { reveal(); return; }
  // decode() resolves once the frame is ready to paint, not merely downloaded
  (img.decode ? img.decode().then(reveal, reveal) : Promise.resolve())
    .catch(() => {});
  img.addEventListener('load', reveal, { once: true });
  img.addEventListener('error', reveal, { once: true });
  setTimeout(reveal, 12000); // never strand a tile behind the loader
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
    const media = buildMedia(p.cover, p.coverType, '', eager, previewLoop(p));
    // Which part of the cover survives the crop. The tile is the chosen ratio
    // and object-fit fills it; this decides what's kept rather than always
    // taking the middle.
    const x = p.coverX == null ? 50 : p.coverX;
    const y = p.coverY == null ? 50 : p.coverY;
    if (x !== 50 || y !== 50) media.style.objectPosition = `${x}% ${y}%`;
    tile.append(media);
    if (resolveType(p.cover, p.coverType) === 'video') showSpinnerWhileBuffering(tile, media);
    else holdUntilDecoded(tile, media);
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

/* ---------------- music: playable tracks, self-hosted audio ----------------
   The songs play straight from files in this repo through an <audio> element
   routed into a Web Audio analyser, so the waveform is drawn from the actual
   signal — frequency bands of whatever is coming out of the speakers at that
   instant. The platform icons above the cover still link out to Spotify /
   Apple Music / YouTube for anyone who wants the album there. */

const ICON_PATHS = {
  spotify: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3c-.22.36-.68.47-1.04.25-2.85-1.74-6.44-2.13-10.66-1.17-.41.1-.82-.16-.91-.57-.1-.41.16-.82.57-.91 4.62-1.06 8.59-.6 11.79 1.35.36.22.47.69.25 1.05zm1.47-3.27c-.28.45-.86.59-1.31.32-3.26-2-8.24-2.58-12.1-1.41-.51.15-1.04-.13-1.2-.63-.15-.51.13-1.04.64-1.2 4.41-1.34 9.9-.69 13.65 1.62.44.27.58.86.31 1.3zm.13-3.4C15.24 8.3 8.82 8.09 5.09 9.22c-.6.18-1.23-.16-1.41-.75-.18-.6.16-1.23.75-1.41 4.29-1.3 11.4-1.05 15.9 1.62.54.32.71 1.01.4 1.55-.32.53-1.02.71-1.55.39z',
  youtube: 'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z',
};

const PLAY_ICON_SVG =
  '<svg class="play-icon" viewBox="0 0 56 56" aria-hidden="true">' +
  '<circle cx="28" cy="28" r="25" fill="none" stroke="currentColor" stroke-width="3.5"/>' +
  '<path d="M23 18.5 39 28l-16 9.5z" fill="currentColor"/></svg>';

const player = {
  ctx: null,       // shared AudioContext, created on the first tap (a gesture,
                   // which is what unlocks audio on iOS)
  analyser: null,
  bins: null,
  current: null,   // the entry whose audio owns the speakers right now
  entries: [],     // { track, item, wave, audio, source }
};

function ensureAudioGraph() {
  if (!player.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no Web Audio — tracks still play, waves just idle
    player.ctx = new AC();
    player.analyser = player.ctx.createAnalyser();
    player.analyser.fftSize = 256;
    player.analyser.smoothingTimeConstant = 0.7;
    player.bins = new Uint8Array(player.analyser.frequencyBinCount);
    player.analyser.connect(player.ctx.destination);
  }
  // suspended until a user gesture — every call here happens inside one
  if (player.ctx.state === 'suspended') player.ctx.resume().catch(() => {});
}

// Four frequency bands of whatever is playing right now, each 0..1.
// Bin width is sampleRate/fftSize ≈ 172Hz at 44.1k.
const BANDS = [[0, 3], [3, 9], [9, 26], [26, 88]]; // bass, low-mid, high-mid, treble
const levelsOut = [0, 0, 0, 0];
function audioLevels() {
  if (!player.analyser) return null;
  player.analyser.getByteFrequencyData(player.bins);
  BANDS.forEach(([a, b], i) => {
    // the loudest bin in the band, not the average — averages smear a kick or
    // a hat across empty bins and flatten the swing
    let mx = 0;
    for (let j = a; j < b; j++) if (player.bins[j] > mx) mx = player.bins[j];
    // byte values are dB-mapped and sit compressed near the top; expanding
    // them restores the contrast between a hit and the space after it
    levelsOut[i] = Math.pow(mx / 255, 1.7);
  });
  return levelsOut;
}

// Organic scribble waveform on a canvas, laid out like a spectrum: the four
// frequency bands are spread across the width — bass moves the left edge,
// low-mids and high-mids the middle, treble the right — with the local
// height at every point interpolated between them. The texture follows suit:
// slow rolling movement on the bass side, tightening into faster jitter
// toward the treble side. So a kick swells the left of the wave while a hat
// flickers its right, live from the analyser.
function buildWave(levelsFn) {
  const canvas = el('canvas', 'track-wave');
  const W = 260, H = 96;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const seed = Math.random() * 100;
  let raf = 0, t = 0;
  const band = [0.5, 0.42, 0.34, 0.26]; // eased copies of the live bands

  // three texture layers, weights summing to 1 so the peak deflection is
  // exactly AMP — which is chosen to clear the canvas edge including the
  // stroke, so nothing ever clips
  const AMP = H / 2 - 6;

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    const mid = H / 2;
    for (let x = 0; x <= W; x += 3) {
      const p = x / W;
      // local level: bass at the left edge through treble at the right
      const fi = p * 3;
      const i0 = Math.min(2, Math.floor(fi));
      const local = band[i0] + (band[i0 + 1] - band[i0]) * (fi - i0);
      const env = Math.pow(Math.sin(Math.PI * p), 0.65); // quiet at the ends
      const y = mid + env * local * AMP * (
        Math.sin(x * 0.05 + t * 2.0 + seed) * 0.45 +
        Math.sin(x * (0.09 + p * 0.45) - t * 3.2 + seed * 2) * 0.33 +
        Math.sin(x * (0.18 + p * 0.85) + t * (4.5 + p * 3) + seed * 3) * 0.22
      );
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#FDF9F3';
    ctx.lineWidth = 4.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const tick = () => {
    t += 0.016;
    const L = levelsFn ? levelsFn() : null;
    if (L) {
      for (let i = 0; i < 4; i++) {
        // quick to jump on a hit, slower to fall away
        band[i] += (L[i] - band[i]) * (L[i] > band[i] ? 0.5 : 0.15);
      }
    }
    draw();
    raf = requestAnimationFrame(tick);
  };
  draw();
  return {
    canvas,
    start() { if (!raf && !REDUCED) raf = requestAnimationFrame(tick); },
    stop()  { cancelAnimationFrame(raf); raf = 0; },
  };
}

function updateMusicUI() {
  player.entries.forEach((entry) => {
    const active = entry === player.current && entry.audio && !entry.audio.paused;
    entry.item.classList.toggle('is-playing', active);
    active ? entry.wave.start() : entry.wave.stop();
  });
}

function onTrackClick(entry) {
  ensureAudioGraph();

  // one voice at a time
  if (player.current && player.current !== entry) player.current.audio?.pause();

  if (!entry.audio) {
    const a = new Audio();
    a.src = entry.track.file;
    a.preload = 'auto';
    entry.audio = a;
    ['play', 'pause', 'ended'].forEach(ev => a.addEventListener(ev, updateMusicUI));
    a.addEventListener('ended', () => { a.currentTime = 0; });
    // Route through the analyser so the waveform sees the real signal. Once
    // connected, the element's sound flows only through the graph — if Web
    // Audio isn't available the element just plays directly and the wave
    // falls back to its idle motion.
    if (player.ctx) {
      try {
        entry.source = player.ctx.createMediaElementSource(a);
        entry.source.connect(player.analyser);
      } catch {}
    }
  }

  player.current = entry;
  if (entry.audio.paused) entry.audio.play().catch(() => {});
  else entry.audio.pause();
  updateMusicUI();
}

function fillMusic(block) {
  block.classList.add('music-section');
  block.append(el('h3', 'section-title', 'Music'));

  const wrap = el('div', 'music-block');

  const albumCol = el('div', 'music-album');
  const icons = el('div', 'music-links');
  [
    [MUSIC.spotifyUrl, 'spotify', 'Listen on Spotify'],
    [MUSIC.appleMusicUrl, 'apple', 'Listen on Apple Music'],
    [MUSIC.youtubeUrl, 'youtube', 'Watch on YouTube'],
  ].forEach(([url, key, label]) => {
    if (!url) return;
    const a = el('a', 'music-link');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', label);
    // Apple Music's mark is a bare paired-note glyph, not a badge — no
    // enclosing chip, filling the icon box directly the way Spotify's and
    // YouTube's own logos do. Built from plain rectangles and ellipses
    // rather than one hand-authored path, since simple additive shapes
    // can't misrender the way a boolean cutout with the wrong winding
    // direction can.
    a.innerHTML = key === 'apple'
      ? `<svg viewBox="0 0 24 24" aria-hidden="true">
           <g fill="currentColor">
             <ellipse cx="7.0" cy="18.2" rx="3.1" ry="2.5"/>
             <ellipse cx="16.3" cy="15.9" rx="2.7" ry="2.2"/>
             <rect x="8.5" y="4.3" width="1.9" height="14"/>
             <rect x="17.4" y="4.9" width="1.9" height="11"/>
             <path d="M8.5 4.3 19.3 1.6v3.3L8.5 7.6z"/>
             <path d="M8.5 8.6 19.3 5.9v3.1L8.5 11.6z"/>
           </g>
         </svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[key]}"/></svg>`;
    icons.append(a);
  });
  if (icons.children.length) albumCol.append(icons);
  if (MUSIC.cover) {
    const cover = el('img', 'music-cover');
    cover.src = MUSIC.cover;
    cover.alt = MUSIC.title || 'Album cover';
    cover.loading = 'lazy';
    albumCol.append(cover);
  }
  if (MUSIC.title) albumCol.append(el('p', 'music-title', MUSIC.title));
  wrap.append(albumCol);

  const trackRow = el('div', 'music-tracks');
  (MUSIC.tracks || []).forEach((track) => {
    if (!track.file) return; // a track with no audio has nothing to play
    const item = el('div', 'music-track');
    const btn = el('button', 'track-slot');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Play ${track.title || 'track'}`);
    btn.innerHTML = PLAY_ICON_SVG;
    const wave = buildWave(audioLevels);
    btn.append(wave.canvas);
    item.append(btn, el('p', 'track-name', track.title || ''));
    trackRow.append(item);

    const entry = { track, item, wave, audio: null, source: null };
    player.entries.push(entry);
    btn.addEventListener('click', () => onTrackClick(entry));
  });
  wrap.append(trackRow);
  block.append(wrap);
}

/* ---------------- store: the Maps listing, rebuilt in the site's own skin ----
   Not an iframe of Google's card — Google's chrome can't be restyled, and the
   listing's own colours would fight the rest of the page. This is the same
   information (rating, category, photo strip, address, map) laid out the same
   way, drawn in this site's palette and type, with the actions that only make
   sense inside the Maps app left out. */
// Five stars, filled to the rating — halves included, so 4.5 reads correctly.
function buildStars(rating) {
  const row = el('div', 'store-stars');
  row.setAttribute('aria-label', `${rating} out of 5`);
  for (let i = 1; i <= 5; i++) {
    const pct = Math.max(0, Math.min(1, rating - (i - 1))) * 100;
    const star = el('span', 'store-star');
    star.textContent = '★';
    const fill = el('span', 'store-star-fill');
    fill.textContent = '★';
    fill.style.width = `${pct}%`;
    star.append(fill);
    row.append(star);
  }
  return row;
}

function buildAddressRow() {
  const row = el('div', 'store-address');
  const pin = el('span', 'store-pin');
  pin.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';
  row.append(pin, el('span', 'store-address-text', STORE.address || ''));
  return row;
}

// A photo is either a bare path (centred, the original shape of the data) or
// { url, x, y } once it's been given a focal point in the dashboard. Tiles are
// square and the images aren't, so x/y decide what survives the crop.
function storePhoto(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return { url: entry, x: 50, y: 50 };
  if (!entry.url) return null;
  return {
    url: entry.url,
    x: entry.x == null ? 50 : Number(entry.x),
    y: entry.y == null ? 50 : Number(entry.y),
  };
}

function fillStore(block) {
  const photos = (STORE.photos || []).map(storePhoto).filter(Boolean);

  block.classList.add('store-section');
  block.append(el('h3', 'section-title', 'Store'));

  const card = el('div', 'store-card');

  /* ---- header: name, rating, category, the years in place of "Open" ---- */
  const head = el('div', 'store-head');
  head.append(el('h4', 'store-name', STORE.title || ''));

  const line = el('div', 'store-line');
  const rating = Number(STORE.rating) || 0;
  if (rating > 0) {
    line.append(el('span', 'store-rating', rating.toFixed(1)));
    line.append(buildStars(rating));
    if (STORE.reviews) line.append(el('span', 'store-reviews', `(${STORE.reviews})`));
    line.append(el('span', 'store-dot', '·'));
  }
  if (STORE.category) {
    line.append(el('span', 'store-category', STORE.category));
    line.append(el('span', 'store-dot', '·'));
  }
  // where Maps prints "Open" — this shop is closed, so it carries its run instead
  if (STORE.years) line.append(el('span', 'store-years', STORE.years));
  head.append(line);
  card.append(head);

  /* ---- tabs ---- */
  const tabsRow = el('div', 'store-tabs');
  const panels = el('div', 'store-panels');

  const makePanel = (name) => {
    const p = el('div', 'store-panel');
    p.dataset.panel = name;
    panels.append(p);
    return p;
  };

  const overview = makePanel('overview');
  const photosPanel = makePanel('photos');
  const about = makePanel('about');
  const contact = makePanel('contact');

  /* Overview — the scrollable strip, then address and map */
  if (photos.length) {
    const strip = el('div', 'store-strip');
    photos.forEach((shot, i) => {
      const cell = el('div', 'store-shot');
      const img = el('img');
      img.src = shot.url;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.objectPosition = `${shot.x}% ${shot.y}%`;
      cell.append(img);
      // tapping a shot opens the full grid, as it does on Maps
      cell.addEventListener('click', () => selectTab('photos'));
      strip.append(cell);
      if (i === photos.length - 1) {
        const all = el('button', 'store-viewall');
        all.type = 'button';
        all.innerHTML = '<span class="store-viewall-chev">›</span><span>View all</span>';
        all.addEventListener('click', () => selectTab('photos'));
        strip.append(all);
      }
    });
    overview.append(strip);
  }
  if (STORE.address) overview.append(buildAddressRow());

  /* Photos — every shot, as a grid */
  if (photos.length) {
    const grid = el('div', 'store-grid');
    photos.forEach((shot) => {
      const cell = el('div', 'store-shot');
      const img = el('img');
      img.src = shot.url;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.objectPosition = `${shot.x}% ${shot.y}%`;
      cell.append(img);
      grid.append(cell);
    });
    photosPanel.append(grid);
  } else {
    photosPanel.append(el('p', 'store-empty', 'No photos yet.'));
  }

  /* About */
  if (STORE.about) about.append(el('p', 'store-about', STORE.about));
  const facts = el('dl', 'store-facts');
  [
    ['Category', STORE.category],
    ['Open', STORE.years],
    ['Address', STORE.address],
  ].forEach(([k, v]) => {
    if (!v) return;
    const b = el('div', 'store-fact');
    b.append(el('dt', null, k), el('dd', null, v));
    facts.append(b);
  });
  if (facts.children.length) about.append(facts);

  /* Contact — the site's own details, plus the listing itself */
  const list = el('div', 'store-contact');
  const link = (label, value, href) => {
    if (!value) return;
    const rowEl = el('div', 'store-contact-row');
    rowEl.append(el('span', 'store-contact-label', label));
    if (href) {
      const a = el('a', 'store-contact-value', value);
      a.href = href;
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
      rowEl.append(a);
    } else {
      rowEl.append(el('span', 'store-contact-value', value));
    }
    list.append(rowEl);
  };
  // The store's own contact details, not the studio's — Knots is a
  // separate account from the portfolio's Instagram/email.
  const storeHandle = STORE.instagramUrl
    ? '@' + STORE.instagramUrl.replace(/\/+$/, '').split('/').pop()
    : '';
  link('Address', STORE.address, STORE.mapsUrl);
  link('Email', STORE.email, STORE.email ? `mailto:${STORE.email}` : null);
  link('Phone', SITE.phone, SITE.phone ? `tel:${String(SITE.phone).replace(/[^\d+]/g, '')}` : null);
  link('Instagram', storeHandle, STORE.instagramUrl);
  link('Listing', 'View on Google Maps', STORE.mapsUrl);
  contact.append(list);

  /* ---- tab wiring ---- */
  const tabNames = [
    ['overview', 'Overview'],
    ['photos', 'Photos'],
    ['about', 'About'],
    ['contact', 'Contact'],
  ];
  const buttons = {};
  function selectTab(name) {
    tabNames.forEach(([key]) => {
      const on = key === name;
      buttons[key].classList.toggle('is-on', on);
      buttons[key].setAttribute('aria-selected', on ? 'true' : 'false');
      panels.querySelector(`[data-panel="${key}"]`).hidden = !on;
    });
  }
  tabNames.forEach(([key, label]) => {
    const b = el('button', 'store-tab', label);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => selectTab(key));
    buttons[key] = b;
    tabsRow.append(b);
  });
  card.append(tabsRow, panels);
  selectTab('overview');

  block.append(card);
}

function renderSections() {
  const archive = $('#archive');
  archive.innerHTML = '';

  const pending = [];
  let firstDone = false;
  let musicSeated = false;
  let storeSeated = false;
  const hasStore = () => !!(STORE && (STORE.title || (STORE.photos || []).length));

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

      // Music sits directly after the first section, ahead of every project
      // category, and joins the same reveal chain as the rest.
      if (MUSIC && (MUSIC.tracks || []).length) {
        const musicBlock = el('section', 'section-block');
        musicBlock.hidden = true;
        archive.append(musicBlock);
        pending.push({ block: musicBlock, music: true });
        musicSeated = true;
      }

      // The store rides with the album rather than trailing the project
      // categories: it's a place, not a piece of work, and buried at the
      // very end of the chain nobody tapped far enough to reach it.
      if (hasStore()) {
        const storeBlock = el('section', 'section-block');
        storeBlock.hidden = true;
        archive.append(storeBlock);
        pending.push({ block: storeBlock, store: true });
        storeSeated = true;
      }
    } else {
      block.hidden = true;
      pending.push({ block, section, items });
    }
  });

  // No project sections at all but music exists — show it anyway.
  if (!musicSeated && MUSIC && (MUSIC.tracks || []).length) {
    const musicBlock = el('section', 'section-block');
    archive.append(musicBlock);
    fillMusic(musicBlock);
  }

  // No project sections at all — nothing to reveal behind, so show it.
  if (!storeSeated && hasStore()) {
    const storeBlock = el('section', 'section-block');
    archive.append(storeBlock);
    fillStore(storeBlock);
  }

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
    const entry = pending[next++];
    if (entry.music) fillMusic(entry.block);
    else if (entry.store) fillStore(entry.block);
    else fillSection(entry.block, entry.section, entry.items, false);
    entry.block.hidden = false;
    if (!REDUCED) entry.block.classList.add('reveal');
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

  // gallery beyond the cover — nothing shown at all if there isn't any
  const gal = $('#d-gallery');
  gal.innerHTML = '';
  const extra = (p.gallery || []).filter(g => g.url !== p.cover);
  extra.forEach(g => gal.append(buildMedia(g.url, g.type, p.title)));
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
  MUSIC = data.music || null;
  STORE = data.store || null;
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
