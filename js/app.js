// ============================================================
//  DEON — the app. A 3D cave home (cave.js), medium-native
//  category views, full-screen work takeovers, a menu sheet.
//  Vanilla JS, springy gestures, browser-back aware.
// ============================================================

import { SITE, CATEGORIES } from './data.js';
import { workArt, wideArt, scenePalette, hashStr } from './art.js';
import { initCave } from './cave.js';

const KEYS = Object.keys(CATEGORIES);
const $ = (sel, root = document) => root.querySelector(sel);
const hex = (i) => '#' + i.toString(16).padStart(6, '0');

const app = $('#app');

// per-category derived palettes + art caches
const PAL = {};
const artCache = {};
for (const k of KEYS) PAL[k] = scenePalette(CATEGORIES[k].palette);

// canvas clones must redraw the bitmap — cloneNode gives a blank one.
// maxSize lets thumbnails carry a small copy instead of the full art.
function cloneArt(node, maxSize = 0) {
  if (node instanceof HTMLCanvasElement) {
    const scale = maxSize ? Math.min(1, maxSize / Math.max(node.width, node.height)) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(node.width * scale);
    c.height = Math.round(node.height * scale);
    c.getContext('2d').drawImage(node, 0, 0, c.width, c.height);
    return c;
  }
  return node.cloneNode(true);
}

function getWorkArt(key, i, { wide = false, thumb = false, plain = false } = {}) {
  const work = CATEGORIES[key].works[i];
  const cacheKey = `${key}:${i}:${wide ? 'w' : plain ? 'p' : 's'}`;
  if (!artCache[cacheKey]) {
    if (work.img) {
      const img = new Image();
      img.src = work.img;
      img.alt = work.title;
      artCache[cacheKey] = img;
    } else {
      artCache[cacheKey] = wide ? wideArt(work, PAL[key]) : workArt(work, PAL[key], !plain);
    }
  }
  return cloneArt(artCache[cacheKey], thumb ? 320 : 0);
}

// ============================================================
//  SWIPER — pointer-driven, springy, rubber-banded
// ============================================================

class Swiper {
  constructor(track, { onIndex, onTap, parallax, unit, renderFn, onMove, loop } = {}) {
    this.track = track;
    this.slides = [...track.children];
    this.n = this.slides.length;
    this.loop = !!loop;    // endless — slides wrap around
    this.index = 0;        // logical slide, always 0..n-1
    this.pos = 0;          // continuous slide position, unbounded when looping
    this.x = 0;            // current position (px, negative going left)
    this.onIndex = onIndex;
    this.onTap = onTap;
    this.parallax = parallax;
    this.unit = unit;       // optional fn: px of travel per slide
    this.renderFn = renderFn; // optional custom slide renderer
    this.onMove = onMove;
    this.drag = null;
    this.anim = null;

    track.addEventListener('pointerdown', (e) => this.down(e));
    track.addEventListener('pointermove', (e) => this.move(e));
    track.addEventListener('pointerup', (e) => this.up(e));
    track.addEventListener('pointercancel', (e) => this.up(e, true));
    window.addEventListener('resize', () => this.jump(this.pos));
    this.render();
  }
  get w() { return this.unit ? this.unit() : this.track.parentElement.clientWidth; }

  down(e) {
    if (this.anim) { cancelAnimationFrame(this.anim); this.anim = null; }
    this.drag = { x0: e.clientX, y0: e.clientY, startX: this.x, v: 0, lastX: e.clientX, lastT: performance.now(), locked: null };
    try { this.track.setPointerCapture(e.pointerId); } catch {}
  }
  move(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x0;
    const dy = e.clientY - this.drag.y0;
    if (this.drag.locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      this.drag.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (this.drag.locked !== 'x') return;
    e.preventDefault();
    let nx = this.drag.startX + dx;
    if (!this.loop) {
      // rubber band past the ends
      const min = -(this.n - 1) * this.w, max = 0;
      if (nx > max) nx = max + (nx - max) * 0.3;
      if (nx < min) nx = min + (nx - min) * 0.3;
    }
    this.x = nx;
    const now = performance.now();
    this.drag.v = (e.clientX - this.drag.lastX) / Math.max(1, now - this.drag.lastT);
    this.drag.lastX = e.clientX;
    this.drag.lastT = now;
    this.render();
  }
  up(e, cancelled = false) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!cancelled && Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      if (this.onTap) this.onTap(this.index, e);
      return;
    }
    // velocity-aware snap
    let target = Math.round(-this.x / this.w);
    if (Math.abs(d.v) > 0.45) target = -this.x / this.w + (d.v < 0 ? 0.5 : -0.5), target = Math.round(target);
    if (!this.loop) target = Math.max(0, Math.min(this.n - 1, target));
    this.springTo(target, d.v * -1000);
  }
  springTo(i, v0 = 0) {
    this.pos = i;
    const norm = this.loop ? ((i % this.n) + this.n) % this.n : i;
    const changed = norm !== this.index;
    this.index = norm;
    if (changed && this.onIndex) this.onIndex(norm);
    const targetX = -i * this.w;
    let v = v0, last = performance.now();
    const k = 110, c = 21; // stiffness / damping — buttery, slight settle
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      const f = k * (targetX - this.x) - c * v;
      v += f * dt;
      this.x += v * dt;
      this.render();
      if (Math.abs(targetX - this.x) < 0.4 && Math.abs(v) < 8) {
        this.x = targetX; this.render(); this.anim = null;
        return;
      }
      this.anim = requestAnimationFrame(step);
    };
    if (this.anim) cancelAnimationFrame(this.anim);
    this.anim = requestAnimationFrame(step);
  }
  jump(i) {
    this.pos = i;
    this.index = this.loop ? ((i % this.n) + this.n) % this.n : i;
    this.x = -i * this.w;
    this.render();
  }
  render() {
    if (this.onMove) this.onMove(this.x, this.w);
    if (this.renderFn) {
      this.renderFn(this.x, this.w, this.slides);
      return;
    }
    this.track.style.transform = `translate3d(${this.x}px,0,0)`;
    if (this.parallax) {
      this.slides.forEach((s, i) => {
        const layer = s.querySelector('[data-parallax]');
        if (!layer) return;
        const off = this.x + i * this.w; // 0 when centered
        layer.style.transform = `translate3d(${-off * 0.32}px,0,0) scale(1.12)`;
      });
    }
  }
}

// ============================================================
//  HOME — the cave
// ============================================================

let cave = null;

function buildHome() {
  cave = initCave({
    canvas: $('#scene'),
    onTablet: (key) => openCategory(key),
    onHey: () => openMenu(),
  });
  cave.onFirstDrag(() => $('#hint').classList.add('gone'));

  document.querySelectorAll('#cams .cam').forEach((b) => {
    b.addEventListener('click', () => selectCam(+b.dataset.i));
  });
  $('#about-pill').addEventListener('click', () => openMenu());
}

function selectCam(i) {
  const on = cave.setCamera(i);
  document.querySelectorAll('#cams .cam').forEach((b) => b.classList.toggle('on', +b.dataset.i === on));
}

// ---- the enter gate: ember field + melted wordmark ----
function buildGate() {
  const gate = $('#gate');
  const fx = $('#gate-fx');
  const logo = $('#gate-logo');

  const fctx = fx.getContext('2d');
  const sizeFx = () => { fx.width = Math.ceil(innerWidth / 2); fx.height = Math.ceil(innerHeight / 2); };
  sizeFx();
  window.addEventListener('resize', sizeFx);
  const embers = Array.from({ length: 90 }, () => ({
    x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.4, r: Math.random() * 7,
  }));

  // wordmark drawn once, then re-drawn as warped slices
  const W = 1000, H = 340;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  octx.font = "700 205px 'Braun', sans-serif";
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  octx.fillStyle = '#f4e3d0';
  octx.fillText('DEON', W / 2, H / 2);
  logo.width = W; logo.height = H;
  const lctx = logo.getContext('2d');

  let t = 0, raf = 0;
  const loop = () => {
    t += 0.016;
    fctx.clearRect(0, 0, fx.width, fx.height);
    for (const e of embers) {
      e.y -= 0.0011 * e.s;
      if (e.y < -0.02) e.y = 1.02;
      const x = (e.x + Math.sin(t * 0.3 + e.r) * 0.012) * fx.width;
      fctx.fillStyle = `rgba(255,190,130,${0.1 + 0.28 * Math.abs(Math.sin(t * 0.8 + e.r))})`;
      fctx.fillRect(x, e.y * fx.height, e.s, e.s);
    }
    lctx.clearRect(0, 0, W, H);
    const slice = 8;
    for (let x = 0; x < W; x += slice) {
      const dy = Math.sin(x * 0.012 + t * 1.1) * 15 + Math.sin(x * 0.033 - t * 0.7) * 7;
      const sx = Math.sin(x * 0.02 + t * 0.5) * 3;
      lctx.drawImage(off, x, 0, slice, H, x + sx, dy, slice, H);
    }
    raf = requestAnimationFrame(loop);
  };
  loop();

  gate.addEventListener('pointerup', () => {
    gate.classList.add('gone');
    $('#hint').classList.add('show');
    setTimeout(() => $('#hint').classList.add('gone'), 8000);
    setTimeout(() => { cancelAnimationFrame(raf); gate.remove(); }, 900);
  }, { once: true });
}

function setAccent(key) {
  const p = CATEGORIES[key].palette;
  document.documentElement.style.setProperty('--accent', hex(p.glow));
  document.documentElement.style.setProperty('--cat-deep', hex(p.sky));
  document.documentElement.style.setProperty('--cat-floor', hex(p.floor));
}

// ============================================================
//  NAVIGATION STATE — history-backed so phone back buttons work
// ============================================================

const layers = { cat: null, work: null, menu: false };

function pushNav(state) {
  history.pushState(state, '');
  applyNav(state);
}
window.addEventListener('popstate', (e) => applyNav(e.state || {}));

function applyNav(state = {}) {
  const wantCat = state.cat || null;
  const wantWork = state.work ?? null;
  const wantMenu = !!state.menu;

  if (wantMenu && !layers.menu) showMenu();
  if (!wantMenu && layers.menu) hideMenu();

  if (wantCat && layers.cat !== wantCat) showCategory(wantCat);
  if (!wantCat && layers.cat) hideCategory();

  if (wantWork !== null && layers.work === null) showWork(wantCat, wantWork);
  if (wantWork === null && layers.work !== null) hideWork();
}

function openCategory(key) { pushNav({ cat: key }); }
function openWork(key, i) { pushNav({ cat: key, work: i }); }
function openMenu() { pushNav({ ...history.state, menu: true }); }

// ============================================================
//  CATEGORY VIEW — native to each medium
// ============================================================

const builders = {
  music: buildMusic, video: buildVideo, clothing: buildClothing,
  design: buildDesign, web: buildWeb,
};

function showCategory(key) {
  layers.cat = key;
  document.body.classList.add('layered');
  setAccent(key);
  const cat = CATEGORIES[key];
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'cat-panel';
  panel.style.background = `linear-gradient(180deg, ${hex(cat.palette.sky)} 0%, ${hex(cat.palette.floor)} 60%, #150708 100%)`;
  panel.innerHTML = `
    <header class="panel-head">
      <button class="back" aria-label="back">←</button>
      <div>
        <p class="panel-kicker">${String(KEYS.indexOf(key) + 1).padStart(2, '0')} · ${cat.works.length} PIECES</p>
        <h2 class="panel-title">${cat.label}</h2>
      </div>
    </header>
    <div class="panel-body"></div>
  `;
  $('.back', panel).addEventListener('click', () => history.back());
  builders[key]($('.panel-body', panel), key);
  app.appendChild(panel);
  dragDismiss(panel, $('.panel-head', panel));
  requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('in')));
  $('#home').classList.add('under');
}

function hideCategory() {
  const panel = $('#cat-panel');
  layers.cat = null;
  document.body.classList.remove('layered');
  $('#home').classList.remove('under');
  if (!panel) return;
  panel.classList.remove('in');
  setAccent(KEYS[0]);
  setTimeout(() => panel.remove(), 450);
}

// ---- MUSIC: player-style track list ----
function buildMusic(body, key) {
  const list = document.createElement('div');
  list.className = 'tracks stagger';
  CATEGORIES[key].works.forEach((w, i) => {
    const row = document.createElement('button');
    row.className = 'track';
    row.innerHTML = `
      <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="track-art"></span>
      <span class="track-meta">
        <span class="track-title">${w.title}</span>
        <span class="track-year">${w.year}</span>
      </span>
      <span class="track-play">▸</span>
    `;
    $('.track-art', row).appendChild(getWorkArt(key, i, { thumb: true }));
    row.addEventListener('click', () => openWork(key, i));
    list.appendChild(row);
  });
  body.appendChild(list);
}

// ---- VIDEO: big thumbnails ----
function buildVideo(body, key) {
  const wrap = document.createElement('div');
  wrap.className = 'reels stagger';
  CATEGORIES[key].works.forEach((w, i) => {
    const card = document.createElement('button');
    card.className = 'reel';
    card.innerHTML = `
      <span class="reel-art"></span>
      <span class="reel-meta"><span>${w.title}</span><span class="dim">${w.year}</span></span>
      <span class="reel-badge">▸</span>
    `;
    $('.reel-art', card).appendChild(getWorkArt(key, i, { wide: true }));
    card.addEventListener('click', () => openWork(key, i));
    wrap.appendChild(card);
  });
  body.appendChild(wrap);
}

// ---- CLOTHING: full-screen lookbook swipe ----
function buildClothing(body, key) {
  const works = CATEGORIES[key].works;
  body.classList.add('lookbook-body');
  const viewport = document.createElement('div');
  viewport.className = 'lookbook';
  const track = document.createElement('div');
  track.className = 'lookbook-track';
  works.forEach((w, i) => {
    const slide = document.createElement('div');
    slide.className = 'look';
    slide.innerHTML = `<div class="look-art"></div>
      <div class="look-meta">
        <p class="look-title">${w.title}</p>
        <p class="look-sub dim">${w.year} — tap for details</p>
      </div>`;
    $('.look-art', slide).appendChild(getWorkArt(key, i, { plain: true }));
    track.appendChild(slide);
  });
  viewport.appendChild(track);
  const counter = document.createElement('p');
  counter.className = 'look-counter';
  counter.textContent = `1 / ${works.length}`;
  body.append(viewport, counter);
  new Swiper(track, {
    onIndex: (i) => { counter.textContent = `${i + 1} / ${works.length}`; },
    onTap: (i) => openWork(key, i),
  });
}

// ---- DESIGN: 2-col poster grid ----
function buildDesign(body, key) {
  const grid = document.createElement('div');
  grid.className = 'grid stagger';
  CATEGORIES[key].works.forEach((w, i) => {
    const card = document.createElement('button');
    card.className = 'poster';
    card.innerHTML = `<span class="poster-art"></span><span class="poster-title">${w.title}</span><span class="poster-year dim">${w.year}</span>`;
    $('.poster-art', card).appendChild(getWorkArt(key, i));
    card.addEventListener('click', () => openWork(key, i));
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

// ---- WEB: large site cards with direct visit links ----
function buildWeb(body, key) {
  const wrap = document.createElement('div');
  wrap.className = 'sites stagger';
  CATEGORIES[key].works.forEach((w, i) => {
    const card = document.createElement('button');
    card.className = 'site';
    card.innerHTML = `
      <span class="site-art"></span>
      <span class="site-meta">
        <span class="site-title">${w.title}</span>
        <span class="dim">${w.year}</span>
      </span>
      ${w.link ? '<span class="site-visit">VISIT ↗</span>' : ''}
    `;
    $('.site-art', card).appendChild(getWorkArt(key, i, { wide: true }));
    card.addEventListener('click', (e) => {
      if (e.target.closest('.site-visit') && w.link) {
        window.open(w.link, '_blank', 'noopener');
        return;
      }
      openWork(key, i);
    });
    wrap.appendChild(card);
  });
  body.appendChild(wrap);
}

// ============================================================
//  WORK TAKEOVER — one piece owns the screen
// ============================================================

function showWork(key, i) {
  layers.work = i;
  const w = CATEGORIES[key].works[i];
  const cat = CATEGORIES[key];
  const layer = document.createElement('section');
  layer.className = 'takeover';
  layer.id = 'work-layer';
  layer.style.background = `linear-gradient(180deg, ${hex(cat.palette.fog)} -30%, ${hex(cat.palette.floor)} 45%, #120607 100%)`;
  layer.innerHTML = `
    <button class="close" aria-label="close">✕</button>
    <div class="takeover-scroll">
      <div class="takeover-art"></div>
      <p class="takeover-kicker">${cat.label} · ${w.year}</p>
      <h2 class="takeover-title">${w.title}</h2>
      <p class="takeover-desc">${w.desc}</p>
      ${w.link ? `<a class="takeover-link" href="${w.link}" target="_blank" rel="noopener">OPEN ↗</a>` : ''}
    </div>
  `;
  $('.takeover-art', layer).appendChild(getWorkArt(key, i));
  $('.close', layer).addEventListener('click', () => history.back());
  app.appendChild(layer);
  dragDismiss(layer, layer, () => $('.takeover-scroll', layer).scrollTop <= 0);
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('in')));
}

function hideWork() {
  layers.work = null;
  const layer = $('#work-layer');
  if (!layer) return;
  layer.classList.remove('in');
  setTimeout(() => layer.remove(), 420);
}

// ============================================================
//  MENU SHEET — about, contact, socials
// ============================================================

function showMenu() {
  layers.menu = true;
  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.id = 'menu-sheet';
  sheet.innerHTML = `
    <div class="sheet-card">
      <span class="sheet-grab"></span>
      <h2 class="sheet-name">${SITE.name}</h2>
      ${SITE.about.map((p) => `<p class="sheet-about">${p}</p>`).join('')}
      <a class="sheet-btn" href="mailto:${SITE.contact.email}">${SITE.contact.email}</a>
      <div class="sheet-socials">
        ${SITE.socials.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`).join('')}
      </div>
    </div>
  `;
  sheet.addEventListener('click', (e) => { if (e.target === sheet) history.back(); });
  app.appendChild(sheet);
  dragDismiss($('.sheet-card', sheet), $('.sheet-card', sheet), null, sheet);
  requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('in')));
}

function hideMenu() {
  layers.menu = false;
  const sheet = $('#menu-sheet');
  if (!sheet) return;
  sheet.classList.remove('in');
  setTimeout(() => sheet.remove(), 380);
}

// ============================================================
//  DRAG TO DISMISS — pull down, it follows, release decides
// ============================================================

function dragDismiss(moveEl, handleEl, canStart = null, classEl = null) {
  let d = null;
  handleEl.addEventListener('pointerdown', (e) => {
    if (canStart && !canStart()) return;
    d = { y0: e.clientY, x0: e.clientX, dy: 0, locked: null, t0: performance.now() };
  });
  handleEl.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dy = e.clientY - d.y0, dx = e.clientX - d.x0;
    if (d.locked === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
      d.locked = Math.abs(dy) > Math.abs(dx) && dy > 0 ? 'y' : 'no';
    }
    if (d.locked !== 'y') return;
    if (canStart && !canStart()) { d = null; moveEl.style.transform = ''; return; }
    d.dy = Math.max(0, dy);
    moveEl.style.transition = 'none';
    moveEl.style.transform = `translate3d(0,${d.dy}px,0)`;
  });
  const end = (e) => {
    if (!d) return;
    const dy = d.dy, dt = performance.now() - d.t0;
    const fast = dy / Math.max(1, dt) > 0.55;
    d = null;
    moveEl.style.transition = '';
    if (dy > window.innerHeight * 0.22 || (fast && dy > 40)) {
      moveEl.style.transform = '';
      history.back();
    } else {
      moveEl.style.transform = '';
    }
  };
  handleEl.addEventListener('pointerup', end);
  handleEl.addEventListener('pointercancel', end);
}

// ============================================================
//  BOOT
// ============================================================

$('#wordmark').addEventListener('click', () => {
  if (layers.cat || layers.menu) history.back();
  else selectCam(0);
});
$('#menu-btn').addEventListener('click', openMenu);

window.addEventListener('keydown', (e) => {
  if (layers.cat || layers.menu) {
    if (e.key === 'Escape') history.back();
    return;
  }
  if (e.key === 'ArrowRight') selectCam(cave.camIndex + 1);
  if (e.key === 'ArrowLeft') selectCam(cave.camIndex - 1);
  if (e.key === '1' || e.key === '2' || e.key === '3') selectCam(+e.key - 1);
});

// animated grain
(function grainLoop() {
  const c = $('#grain');
  const ctx = c.getContext('2d');
  const size = () => { c.width = Math.ceil(innerWidth / 3); c.height = Math.ceil(innerHeight / 3); };
  size();
  window.addEventListener('resize', size);
  setInterval(() => {
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = Math.random() * 255;
      d[i + 3] = 22;
    }
    ctx.putImageData(img, 0, 0);
  }, 90);
})();

history.replaceState({}, '');
buildHome();
buildGate();
window.__deon = {
  open: openCategory,
  cam: (i) => selectCam(i),
  state: () => ({ ...layers, cam: cave.camIndex }),
};
