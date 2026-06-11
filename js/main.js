// ============================================================
//  MAIN — renderer, camera, state machine, input, UI panels.
//  States: intro → desert ⇄ interior. Panels float above.
// ============================================================

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildInterior } from './interiors.js';
import { CATEGORIES, SITE } from './data.js';
import { audio } from './audio.js';

// ---------- renderer: full-res, soft shadows, filmic color ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- scenes ----------
const world = buildWorld();
const interiors = {}; // built lazily per category

let state = 'intro'; // intro | desert | interior | flying
let current = world; // { scene, interactables, animated }
let currentKey = null;

// ---------- camera rig: position + pointer-look ----------
const rig = {
  pos: new THREE.Vector3(0, 3.8, 52),
  target: new THREE.Vector3(0, 4.5, -10),
  yaw: 0, pitch: 0,        // look offset from pointer
  yawT: 0, pitchT: 0,
  lookRange: { yaw: 0.35, pitch: 0.14 },
};
const DESERT_CAM = { pos: new THREE.Vector3(0, 3.4, 24), target: new THREE.Vector3(0, 2.5, -12) };
const INTERIOR_CAM = { pos: new THREE.Vector3(0, 2.2, 4.4), target: new THREE.Vector3(0, 2.1, -5) };

// ---------- DOM ----------
const el = {
  loader: document.getElementById('loader'),
  enter: document.getElementById('enter-btn'),
  hud: document.getElementById('hud'),
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
};

function setAccent(hex) {
  document.documentElement.style.setProperty('--accent', '#' + hex.toString(16).padStart(6, '0'));
}
setAccent(0xd98a52);

// ---------- intro ----------
el.enter.addEventListener('click', () => {
  audio.start();
  el.loader.classList.add('gone');
  state = 'flying';
  flyCamera(DESERT_CAM.pos, DESERT_CAM.target, 3400, () => {
    state = 'desert';
    setHint('drag / move to look · click a structure to enter');
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
      touchLook.yaw0 + (e.clientX - touchLook.x0) * 0.0035, -1.2, 1.2);
    rig.pitchT = THREE.MathUtils.clamp(
      touchLook.pitch0 + (e.clientY - touchLook.y0) * 0.0022, -0.4, 0.4);
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
        if (mt.emissive) mt.emissive.setHex(on ? 0x553311 : 0x000000);
      }
    }
  });
}

// ---------- clicking things ----------
function handleClick() {
  const obj = pickInteractable();
  if (!obj) return;
  const { type, key, index } = obj.userData;

  if (type === 'category') enterStructure(key);
  else if (type === 'exit') exitStructure();
  else if (type === 'about') openAbout();
  else if (type === 'contact') openContact();
  else if (type === 'socials') openSocials();
  else if (type === 'work') openWork(key, index);
}

function enterStructure(key) {
  if (state !== 'desert') return;
  state = 'flying';
  setHovered(null);
  audio.enter();
  const cat = CATEGORIES[key];

  // fly toward the structure's door, then cut to the interior
  const s = world.structures[key];
  const doorPos = s.position.clone().add(new THREE.Vector3(0, 2, 4));
  flyCamera(doorPos, s.position.clone().setY(2), 1400, () => {
    glitchCut(() => {
      if (!interiors[key]) interiors[key] = buildInterior(key, cat);
      current = interiors[key];
      currentKey = key;
      rig.pos.copy(INTERIOR_CAM.pos);
      rig.target.copy(INTERIOR_CAM.target);
      rig.lookRange = { yaw: 0.55, pitch: 0.22 };
      setAccent(cat.palette.glow);
      el.section.textContent = cat.label;
      el.back.classList.add('on');
      setHint(cat.blurb + ' · click a piece on the wall');
      state = 'interior';
    });
  });
}

function exitStructure() {
  if (state !== 'interior') return;
  state = 'flying';
  setHovered(null);
  closePanel();
  audio.exit();
  glitchCut(() => {
    current = world;
    currentKey = null;
    rig.pos.copy(DESERT_CAM.pos);
    rig.target.copy(DESERT_CAM.target);
    rig.lookRange = { yaw: 0.35, pitch: 0.14 };
    setAccent(0xd98a52);
    el.section.textContent = 'THE DESERT';
    el.back.classList.remove('on');
    setHint('drag / move to look · click a structure to enter');
    state = 'desert';
  });
}

el.back.addEventListener('click', exitStructure);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!el.panel.classList.contains('hidden')) closePanel();
    else if (state === 'interior') exitStructure();
  }
});

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
  void el.hint.offsetWidth; // restart the css animation
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

function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();

  // camera flight
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

  // pointer look easing
  rig.yaw += (rig.yawT - rig.yaw) * 0.05;
  rig.pitch += (rig.pitchT - rig.pitch) * 0.05;

  camera.position.copy(rig.pos);
  // idle breathing — the camera is held, not locked off
  camera.position.y += Math.sin(t * 0.6) * 0.06;
  camera.position.x += Math.sin(t * 0.4) * 0.04;

  const look = rig.target.clone();
  const dist = rig.target.distanceTo(rig.pos);
  look.x += Math.sin(rig.yaw) * dist * 0.6;
  look.y += Math.sin(rig.pitch) * dist * 0.5;
  camera.lookAt(look);

  for (const fn of current.animated) fn(t);

  // hover detection (only when idle in a scene, pointer present)
  if ((state === 'desert' || state === 'interior') && pointerOnScreen && !touchLook) {
    setHovered(pickInteractable());
  }

  renderer.render(current.scene, camera);
}

el.section.textContent = 'THE DESERT';
loop();

// debug/deep-link hook (also handy in the console)
window.__deon = {
  enter: enterStructure,
  exit: exitStructure,
  state: () => state,
};
