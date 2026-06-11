// ============================================================
//  MAIN — renderer, camera, glide travel, input, UI panels.
//  States: intro → desert ⇄ interior, with terrain-following
//  glides between the spread-out ruins.
// ============================================================

import * as THREE from 'three';
import { buildWorld, duneHeight } from './world.js';
import { buildInterior } from './interiors.js';
import { CATEGORIES, SITE } from './data.js';
import { audio } from './audio.js';
import { PIXEL_CAP } from './quality.js';

// ---------- renderer: full-res, soft shadows, filmic color ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_CAP));

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1200);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // widen the view on portrait screens so the scene still frames
  camera.fov = camera.aspect < 0.75 ? 76 : 58;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- scenes ----------
const world = buildWorld();
const interiors = {}; // built lazily per category

let state = 'intro'; // intro | desert | interior | flying
let current = world;
let currentKey = null; // which ruin we're inside / parked at

// ---------- camera rig ----------
const rig = {
  pos: new THREE.Vector3(0, world.campY + 8.5, 60),
  target: new THREE.Vector3(0, world.campY + 3, -40),
  yaw: 0, pitch: 0,
  yawT: 0, pitchT: 0,
  lookRange: { yaw: 0.4, pitch: 0.16 },
};
const INTERIOR_CAM = { pos: new THREE.Vector3(0, 2.2, 4.4), target: new THREE.Vector3(0, 2.1, -5) };

// ---------- DOM ----------
const el = {
  loader: document.getElementById('loader'),
  enter: document.getElementById('enter-btn'),
  timecode: document.getElementById('timecode'),
  section: document.getElementById('section-label'),
  hint: document.getElementById('hint'),
  hover: document.getElementById('hover-label'),
  fade: document.getElementById('fade'),
  mute: document.getElementById('mute-btn'),
  panel: document.getElementById('panel'),
  panelContent: document.getElementById('panel-content'),
  panelClose: document.getElementById('panel-close'),
  back: document.getElementById('back-btn'),
  cursor: document.getElementById('cursor'),
  nav: document.getElementById('nav'),
};

function setAccent(hex) {
  document.documentElement.style.setProperty('--accent', '#' + hex.toString(16).padStart(6, '0'));
}
setAccent(0xd9924a);

const DESERT_HINT = 'click a ruin or use the trail below · drag to look around';

// ---------- intro ----------
el.enter.addEventListener('click', () => {
  audio.start();
  el.loader.classList.add('gone');
  state = 'flying';
  flyCamera(world.campView.pos, world.campView.look, 3600, () => {
    state = 'desert';
    setHint(DESERT_HINT);
  });
});

// ---------- mute ----------
let muted = false;
el.mute.addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
  el.mute.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  el.mute.classList.toggle('off', muted);
});

// ---------- pointer look + raycast ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerOnScreen = false;
let hovered = null;
let downPos = null;
let touchLook = null;

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  pointerOnScreen = true;
  if (e.pointerType === 'touch' && touchLook) {
    rig.yawT = THREE.MathUtils.clamp(
      touchLook.yaw0 + (e.clientX - touchLook.x0) * 0.0035, -1.4, 1.4);
    rig.pitchT = THREE.MathUtils.clamp(
      touchLook.pitch0 + (e.clientY - touchLook.y0) * 0.0022, -0.45, 0.45);
  } else if (e.pointerType !== 'touch') {
    rig.yawT = -pointer.x * rig.lookRange.yaw;
    rig.pitchT = pointer.y * rig.lookRange.pitch;
  }
  el.hover.style.left = e.clientX + 'px';
  el.hover.style.top = e.clientY + 'px';
  el.cursor.style.left = e.clientX + 'px';
  el.cursor.style.top = e.clientY + 'px';
});
canvas.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'touch') {
    touchLook = { x0: e.clientX, y0: e.clientY, yaw0: rig.yawT, pitch0: rig.pitchT };
  }
});
canvas.addEventListener('pointerup', (e) => {
  const wasTap = downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 8;
  downPos = null;
  touchLook = null;
  if (!wasTap) return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  handleClick();
});

function pickInteractable() {
  if (state !== 'desert' && state !== 'interior') return null;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(current.interactables, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !obj.userData.type) obj = obj.parent;
  return obj;
}

function setHovered(obj) {
  if (hovered === obj) return;
  if (hovered) glow(hovered, false);
  hovered = obj;
  if (obj) {
    glow(obj, true);
    el.hover.textContent = obj.userData.label;
    el.hover.classList.add('on');
    document.body.classList.add('pointing');
    audio.blip();
  } else {
    el.hover.classList.remove('on');
    document.body.classList.remove('pointing');
  }
}

function glow(group, on) {
  group.traverse((m) => {
    if (m.isMesh) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) {
        if (mt.emissive) mt.emissive.setHex(on ? 0x4a2e14 : 0x000000);
      }
    }
  });
}

// ---------- clicking things ----------
function handleClick() {
  const obj = pickInteractable();
  if (!obj) return;
  const { type, key, index } = obj.userData;

  if (type === 'category') navTo(key);
  else if (type === 'exit') exitStructure();
  else if (type === 'about') openAbout();
  else if (type === 'contact') openContact();
  else if (type === 'socials') openSocials();
  else if (type === 'work') openWork(key, index);
}

// ---------- travel: terrain-following glide ----------
function glidePath(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const n = Math.max(8, Math.ceil(dist / 7));
  // bow the route sideways a little so it feels flown, not dollied
  const px = -dz / (dist || 1), pz = dx / (dist || 1);
  const bow = Math.min(14, dist * 0.14) * (Math.random() > 0.5 ? 1 : -1);
  const lift = Math.min(13, 4 + dist * 0.07);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(t * Math.PI);
    const x = from.x + dx * t + px * s * bow;
    const z = from.z + dz * t + pz * s * bow;
    const base = THREE.MathUtils.lerp(from.y, to.y, t) + s * lift;
    const y = Math.max(base, duneHeight(x, z) + 2.6);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

let glide = null;
function startGlide(toPos, toLook, done) {
  const curve = glidePath(rig.pos.clone(), toPos);
  const dist = curve.getLength();
  glide = {
    curve, toLook: toLook.clone(),
    fromLook: rig.target.clone(),
    t0: performance.now(),
    ms: THREE.MathUtils.clamp(dist * 70, 2400, 9000),
    done,
  };
  state = 'flying';
  setHovered(null);
}

function navTo(key) {
  if (state === 'flying' || state === 'intro') return;
  closePanel();
  if (key === 'camp') {
    const go = () => startGlide(world.campView.pos, world.campView.look, () => {
      state = 'desert';
      currentKey = null;
      setNavActive(null);
      setHint(DESERT_HINT);
    });
    if (state === 'interior') leaveInterior(go);
    else go();
    return;
  }
  // already parked at this ruin? just step in
  if (state === 'desert' && currentKey === key) {
    enterInterior(key);
    return;
  }
  const go = () => {
    const ap = world.approach[key];
    audio.enter();
    // land in front of the ruin, hold a beat, then step inside
    startGlide(ap.pos, ap.look, () => setTimeout(() => enterInterior(key), 750));
  };
  if (state === 'interior') leaveInterior(go);
  else go();
}

function enterInterior(key) {
  const cat = CATEGORIES[key];
  glitchCut(() => {
    if (!interiors[key]) interiors[key] = buildInterior(key, cat);
    current = interiors[key];
    currentKey = key;
    rig.pos.copy(INTERIOR_CAM.pos);
    rig.target.copy(INTERIOR_CAM.target);
    rig.yawT = rig.pitchT = 0;
    rig.lookRange = { yaw: 0.55, pitch: 0.22 };
    setAccent(cat.palette.glow);
    el.section.textContent = cat.label;
    el.back.classList.add('on');
    setNavActive(key);
    setHint(cat.blurb + ' · click a floating piece');
    state = 'interior';
  });
}

// swap back to the desert at the ruin we entered, then `after()`
function leaveInterior(after) {
  const key = currentKey;
  glitchCut(() => {
    current = world;
    const ap = world.approach[key];
    rig.pos.copy(ap.pos);
    rig.target.copy(ap.look);
    rig.yawT = rig.pitchT = 0;
    rig.lookRange = { yaw: 0.4, pitch: 0.16 };
    setAccent(0xd9924a);
    el.section.textContent = 'THE DUNES';
    el.back.classList.remove('on');
    state = 'desert';
    if (after) after();
  });
}

function exitStructure() {
  if (state !== 'interior') return;
  closePanel();
  audio.exit();
  leaveInterior(() => {
    setNavActive(currentKey);
    setHint('you are back in the open · pick another ruin below');
  });
}

el.back.addEventListener('click', exitStructure);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.panel.classList.contains('hidden')) closePanel();
    else if (state === 'interior') exitStructure();
  }
});

// ---------- nav trail ----------
el.nav.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-nav]');
  if (!btn) return;
  audio.clack();
  navTo(btn.dataset.nav);
});
function setNavActive(key) {
  for (const b of el.nav.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.nav === key);
  }
}

// ---------- panels ----------
function openPanel(html) {
  audio.clack();
  el.panelContent.innerHTML = html;
  el.panel.classList.remove('hidden');
}
function closePanel() {
  el.panel.classList.add('hidden');
}
el.panelClose.addEventListener('click', closePanel);
el.panel.addEventListener('click', (e) => {
  if (e.target === el.panel) closePanel();
});

function openAbout() {
  openPanel(`
    <p class="panel-kicker">CAMPFIRE</p>
    <h2>ABOUT</h2>
    ${SITE.about.map((p) => `<p>${p}</p>`).join('')}
  `);
}
function openContact() {
  openPanel(`
    <p class="panel-kicker">PAYPHONE</p>
    <h2>CONTACT</h2>
    <p>${SITE.contact.note}</p>
    <a class="panel-btn" href="mailto:${SITE.contact.email}">${SITE.contact.email}</a>
  `);
}
function openSocials() {
  openPanel(`
    <p class="panel-kicker">SIGNS POINT ELSEWHERE</p>
    <h2>SOCIALS</h2>
    ${SITE.socials.map((s) =>
      `<a class="panel-btn" href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`
    ).join('')}
  `);
}
function openWork(key, index) {
  const work = CATEGORIES[key].works[index];
  openPanel(`
    <p class="panel-kicker">${CATEGORIES[key].label} · ${work.year}</p>
    <h2>${work.title}</h2>
    <p>${work.desc}</p>
    ${work.link ? `<a class="panel-btn" href="${work.link}" target="_blank" rel="noopener">OPEN ↗</a>` : ''}
  `);
}

// ---------- transitions ----------
let fly = null;
function flyCamera(toPos, toTarget, ms, done) {
  fly = {
    fromPos: rig.pos.clone(), toPos: toPos.clone(),
    fromTarget: rig.target.clone(), toTarget: toTarget.clone(),
    t0: performance.now(), ms, done,
  };
}

function glitchCut(swap) {
  el.fade.classList.add('on');
  setTimeout(() => {
    swap();
    setTimeout(() => el.fade.classList.remove('on'), 60);
  }, 360);
}

function setHint(text) {
  el.hint.textContent = text;
  el.hint.classList.remove('flash');
  void el.hint.offsetWidth;
  el.hint.classList.add('flash');
}

// ---------- HUD timecode ----------
const t0 = Date.now();
setInterval(() => {
  const s = Math.floor((Date.now() - t0) / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  el.timecode.textContent = `${hh}:${mm}:${ss}`;
}, 1000);

// ---------- loop ----------
const clock = new THREE.Clock();
const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();

  // straight camera flight (intro)
  if (fly) {
    const k = Math.min(1, (performance.now() - fly.t0) / fly.ms);
    const e = ease(k);
    rig.pos.lerpVectors(fly.fromPos, fly.toPos, e);
    rig.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
    if (k >= 1) {
      const cb = fly.done;
      fly = null;
      if (cb) cb();
    }
  }

  // terrain-following glide
  if (glide) {
    const k = Math.min(1, (performance.now() - glide.t0) / glide.ms);
    const e = easeInOut(k);
    glide.curve.getPointAt(e, rig.pos);
    // look ahead along the path, easing into the final look target
    const ahead = glide.curve.getPointAt(Math.min(1, e + 0.05));
    const blend = THREE.MathUtils.smoothstep(e, 0.72, 1);
    rig.target.lerpVectors(ahead, glide.toLook, blend);
    if (k >= 1) {
      const cb = glide.done;
      glide = null;
      if (cb) cb();
    }
  }

  // pointer look easing
  rig.yaw += (rig.yawT - rig.yaw) * 0.05;
  rig.pitch += (rig.pitchT - rig.pitch) * 0.05;

  camera.position.copy(rig.pos);
  camera.position.y += Math.sin(t * 0.6) * 0.05;
  camera.position.x += Math.sin(t * 0.4) * 0.03;

  const look = rig.target.clone();
  const dist = Math.max(4, rig.target.distanceTo(rig.pos));
  look.x += Math.sin(rig.yaw) * dist * 0.6;
  look.y += Math.sin(rig.pitch) * dist * 0.5;
  camera.lookAt(look);

  for (const fn of current.animated) fn(t);

  if ((state === 'desert' || state === 'interior') && pointerOnScreen && !touchLook) {
    setHovered(pickInteractable());
  }

  renderer.render(current.scene, camera);
}

el.section.textContent = 'THE DUNES';
loop();

// debug/deep-link hook (also handy in the console)
window.__deon = {
  go: navTo,
  exit: exitStructure,
  state: () => state,
  pos: () => rig.pos.toArray().map((v) => Math.round(v * 10) / 10),
};
