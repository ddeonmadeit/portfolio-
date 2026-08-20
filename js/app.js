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

let SITE, SECTIONS, PROJECTS, MUSIC;
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

/* ---------------- music: playable tracks, streamed through Spotify ----------------
   Playback goes through Spotify's embed controller so plays land on the real
   album — visitors signed into Spotify stream the full songs (and those count
   as streams); signed-out visitors get Spotify's 30-second previews. Spotify
   never hands the page the audio signal itself, so the waveform is an organic
   generated one that runs while a track plays rather than a literal sampling
   of the sound. */

const ICON_PATHS = {
  spotify: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3c-.22.36-.68.47-1.04.25-2.85-1.74-6.44-2.13-10.66-1.17-.41.1-.82-.16-.91-.57-.1-.41.16-.82.57-.91 4.62-1.06 8.59-.6 11.79 1.35.36.22.47.69.25 1.05zm1.47-3.27c-.28.45-.86.59-1.31.32-3.26-2-8.24-2.58-12.1-1.41-.51.15-1.04-.13-1.2-.63-.15-.51.13-1.04.64-1.2 4.41-1.34 9.9-.69 13.65 1.62.44.27.58.86.31 1.3zm.13-3.4C15.24 8.3 8.82 8.09 5.09 9.22c-.6.18-1.23-.16-1.41-.75-.18-.6.16-1.23.75-1.41 4.29-1.3 11.4-1.05 15.9 1.62.54.32.71 1.01.4 1.55-.32.53-1.02.71-1.55.39z',
  youtube: 'M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z',
  apple: 'M9 3v10.55A3.97 3.97 0 0 0 7 13a4 4 0 1 0 4 4V7h6V3H9z',
};

const PLAY_ICON_SVG =
  '<svg class="play-icon" viewBox="0 0 56 56" aria-hidden="true">' +
  '<circle cx="28" cy="28" r="25" fill="none" stroke="currentColor" stroke-width="3.5"/>' +
  '<path d="M23 18.5 39 28l-16 9.5z" fill="currentColor"/></svg>';

function trackUriOf(track) {
  const m = String(track.url || '').match(/track[/:]([A-Za-z0-9]{16,32})/);
  return m ? `spotify:track:${m[1]}` : null;
}

const spotify = {
  controller: null,
  ready: false,
  failed: false,
  currentUri: null,
  playing: false,          // what the UI believes (optimistic on tap)
  confirmedPlaying: false, // what Spotify last reported
  posMs: 0,                // last reported position…
  posAt: 0,                // …and when it was reported, for extrapolation
  kick: 0,
  pendingPlay: null,
  trackEls: [], // { uri, item, wave, track }
};

/* Loudness contours, precomputed offline from the tracks' audio and stored in
   the repo (assets/waveforms.json). Spotify's iframe exposes no audio signal,
   so this is how the waveform follows the actual music: Spotify reports the
   playback position, and the contour says how loud the song is at that
   moment. Contours built from preview audio are looped when full-track
   playback runs past their end. */
let WAVEDATA = null;
function loadWaveData() {
  if (WAVEDATA !== null) return;
  WAVEDATA = {};
  fetch('/assets/waveforms.json')
    .then(r => (r.ok ? r.json() : {}))
    .then(d => { WAVEDATA = d || {}; })
    .catch(() => {});
}

function ampForUri(uri) {
  const id = String(uri).split(':').pop();
  const env = WAVEDATA && WAVEDATA[id];
  if (!env || !env.amp || !env.amp.length) return null;
  let pos = spotify.posMs;
  if (spotify.playing) pos += performance.now() - spotify.posAt;
  let idx = (pos / 1000) * (env.sps || 20);
  const n = env.amp.length;
  idx = ((idx % n) + n) % n; // loop preview-length contours over full songs
  const lo = Math.floor(idx), hi = (lo + 1) % n;
  return env.amp[lo] + (env.amp[hi] - env.amp[lo]) * (idx - lo);
}

// Organic scribble waveform on a canvas — layered sines with per-track
// character, tapered at the ends. While the track plays, its overall size
// follows the song's loudness contour at the current playback position, so
// choruses swell and quiet passages settle.
function buildWave(ampFn) {
  const canvas = el('canvas', 'track-wave');
  const W = 260, H = 96;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const seed = Math.random() * 100;
  let raf = 0, t = 0, level = 0.7;

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    const mid = H / 2;
    const gain = 0.35 + level * 1.05; // never fully flat while playing
    for (let x = 0; x <= W; x += 3) {
      const env = Math.pow(Math.sin(Math.PI * x / W), 0.65); // quiet at the ends
      const y = mid + env * gain * (
        Math.sin(x * 0.055 + t * 2.1 + seed) * 14 +
        Math.sin(x * 0.11 - t * 3.3 + seed * 2) * 9 +
        Math.sin(x * 0.23 + t * 5.2 + seed * 3) * 6 +
        Math.sin(x * 0.47 - t * 1.4 + seed * 5) * 3.5
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
    const target = (ampFn && ampFn()) ?? 0.7;
    // ease towards the contour: quick to rise on a hit, slower to fall away
    level += (target - level) * (target > level ? 0.35 : 0.12);
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

function updateTrackUI() {
  spotify.trackEls.forEach(({ uri, item, wave }) => {
    const active = spotify.playing && uri === spotify.currentUri;
    item.classList.toggle('is-playing', active);
    active ? wave.start() : wave.stop();
  });
}

function playUri(uri) {
  const c = spotify.controller;
  if (!c) return;
  clearInterval(spotify.kick);
  if (spotify.currentUri === uri) {
    c.togglePlay();
    return;
  }
  spotify.currentUri = uri;
  spotify.confirmedPlaying = false;
  spotify.posMs = 0;
  spotify.posAt = performance.now();
  c.loadUri(uri);
  c.play();
  spotify.playing = true; // optimistic; playback_update corrects it
  updateTrackUI();

  // loadUri reloads Spotify's iframe, and a play() sent straight after can be
  // swallowed by that reload — which used to mean the first tap did nothing
  // and only a second tap started playback. Keep nudging until Spotify
  // reports the track actually running.
  let tries = 0;
  spotify.kick = setInterval(() => {
    if (spotify.confirmedPlaying || spotify.currentUri !== uri || ++tries > 12) {
      clearInterval(spotify.kick);
      return;
    }
    c.play();
  }, 500);
}

function onTrackClick(track) {
  const uri = trackUriOf(track);
  // No controller (script blocked, or Spotify down): the play button still
  // does the honest thing and opens the song on Spotify itself.
  if (!uri || spotify.failed) {
    if (track.url) window.open(track.url, '_blank', 'noopener');
    return;
  }
  if (!spotify.ready) { spotify.pendingPlay = uri; return; }
  playUri(uri);
}

function initSpotify(target, wrapEl) {
  if (spotify.controller || spotify.failed || !MUSIC) return;

  const albumMatch = String(MUSIC.spotifyUrl || '').match(/album[/:]([A-Za-z0-9]{16,32})/);
  const startUri = albumMatch
    ? `spotify:album:${albumMatch[1]}`
    : trackUriOf((MUSIC.tracks || [])[0] || {});
  if (!startUri) { spotify.failed = true; wrapEl.hidden = true; return; }

  const fail = () => {
    spotify.failed = true;
    wrapEl.hidden = true;
    updateTrackUI();
  };
  const failTimer = setTimeout(fail, 8000);

  window.onSpotifyIframeApiReady = (IFrameAPI) => {
    clearTimeout(failTimer);
    IFrameAPI.createController(target, { width: '100%', height: '80', uri: startUri }, (controller) => {
      spotify.controller = controller;
      spotify.ready = true;
      controller.addListener('playback_update', (e) => {
        const d = (e && e.data) || {};
        spotify.playing = !d.isPaused;
        spotify.confirmedPlaying = !d.isPaused;
        if (typeof d.position === 'number') {
          spotify.posMs = d.position;
          spotify.posAt = performance.now();
        }
        updateTrackUI();
      });
      if (spotify.pendingPlay) {
        const u = spotify.pendingPlay;
        spotify.pendingPlay = null;
        playUri(u);
      }
    });
  };

  const s = document.createElement('script');
  s.src = 'https://open.spotify.com/embed/iframe-api/v1';
  s.async = true;
  s.onerror = () => { clearTimeout(failTimer); fail(); };
  document.head.append(s);
}

function fillMusic(block) {
  loadWaveData();
  block.classList.add('music-section');
  block.append(el('h3', 'section-title', 'Music'));

  const wrap = el('div', 'music-block');

  const albumCol = el('div', 'music-album');
  const icons = el('div', 'music-links');
  [
    [MUSIC.spotifyUrl, 'spotify', 'Listen on Spotify'],
    [MUSIC.youtubeUrl, 'youtube', 'Watch on YouTube'],
    [MUSIC.appleMusicUrl, 'apple', 'Listen on Apple Music'],
  ].forEach(([url, key, label]) => {
    if (!url) return;
    const a = el('a', 'music-link');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', label);
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[key]}"/></svg>`;
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
    if (!track.title && !track.url) return;
    const item = el('div', 'music-track');
    const btn = el('button', 'track-slot');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Play ${track.title || 'track'}`);
    btn.innerHTML = PLAY_ICON_SVG;
    const uri = trackUriOf(track);
    const wave = buildWave(uri ? () => ampForUri(uri) : null);
    btn.append(wave.canvas);
    btn.addEventListener('click', () => onTrackClick(track));
    item.append(btn, el('p', 'track-name', track.title || ''));
    trackRow.append(item);

    if (uri) spotify.trackEls.push({ uri, item, wave, track });
  });
  wrap.append(trackRow);
  block.append(wrap);

  // The real Spotify player, kept small but visible — it's what actually
  // plays, and it's the visitor's way to like/save/open the album.
  const embedWrap = el('div', 'music-embed');
  const target = el('div');
  embedWrap.append(target);
  block.append(embedWrap);
  initSpotify(target, embedWrap);
}

function renderSections() {
  const archive = $('#archive');
  archive.innerHTML = '';

  const pending = [];
  let firstDone = false;
  let musicSeated = false;

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
  MUSIC = data.music || null;
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
