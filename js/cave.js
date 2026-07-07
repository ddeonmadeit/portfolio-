// ============================================================
//  CAVE — the 3D home. A crimson cavern with organic rock
//  walls, stone ledges carrying the five category tablets,
//  LED ticker bands, a neon DEON sign, a mouth of light.
//  Fixed camera presets + drag-to-look + tap-to-open.
// ============================================================

import * as THREE from './vendor/three.module.js';
import { CATEGORIES } from './data.js';
import { scenePalette, slateTexture, hashStr, mulberry } from './art.js';

const KEYS = Object.keys(CATEGORIES);
const hex = (i) => '#' + i.toString(16).padStart(6, '0');

// ---------- deterministic 3D value noise ----------
const nrand = mulberry(1337);
const PERM = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(nrand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const lat = (ix, iy, iz) => PERM[(PERM[(PERM[ix & 255] + iy) & 255] + iz) & 255] / 255;
const sm = (t) => t * t * (3 - 2 * t);
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const L = (dx, dy, dz) => lat(ix + dx, iy + dy, iz + dz);
  const nx0 = L(0, 0, 0) + (L(1, 0, 0) - L(0, 0, 0)) * fx;
  const nx1 = L(0, 1, 0) + (L(1, 1, 0) - L(0, 1, 0)) * fx;
  const nx2 = L(0, 0, 1) + (L(1, 0, 1) - L(0, 0, 1)) * fx;
  const nx3 = L(0, 1, 1) + (L(1, 1, 1) - L(0, 1, 1)) * fx;
  const ny0 = nx0 + (nx1 - nx0) * fy;
  const ny1 = nx2 + (nx3 - nx2) * fy;
  return ny0 + (ny1 - ny0) * fz; // 0..1
}
function fbm(x, y, z) {
  return (noise3(x, y, z) * 0.55 + noise3(x * 2.3, y * 2.3, z * 2.3) * 0.3 + noise3(x * 5.1, y * 5.1, z * 5.1) * 0.15) - 0.5;
}

// ---------- canvas texture helpers ----------
function canvasTex(c, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

// seamless-tiling rock surface, drawn dark so lights carve it out
function rockCanvas(base, seed) {
  const S = 512;
  const rand = mulberry(seed);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // wrapped blotches for seamless tiling
  for (let i = 0; i < 60; i++) {
    const x = rand() * S, y = rand() * S;
    const rx = S * (0.04 + rand() * 0.14), ry = rx * (0.4 + rand() * 0.9);
    const rot = rand() * Math.PI;
    const col = rand() > 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(236,190,160,0.05)';
    ctx.fillStyle = col;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      ctx.save();
      ctx.translate(x + ox, y + oy);
      ctx.rotate(rot);
      ctx.filter = 'blur(6px)';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 7; i++) {
    let x = rand() * S, y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 90;
      y += (rand() - 0.3) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // speckle
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const nse = (rand() - 0.5) * 26;
    d[i] += nse; d[i + 1] += nse; d[i + 2] += nse;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// dot-matrix LED ticker strip; canvas width fits the text exactly so it tiles
function ledCanvas(text, glow = '#f2dfc8') {
  const small = document.createElement('canvas');
  const sc = small.getContext('2d');
  sc.font = "700 11px 'Braun', monospace";
  const tw = Math.max(64, Math.ceil(sc.measureText(text).width));
  small.width = tw; small.height = 16;
  const sc2 = small.getContext('2d');
  sc2.fillStyle = '#040202';
  sc2.fillRect(0, 0, tw, 16);
  sc2.font = "700 11px 'Braun', monospace";
  sc2.textBaseline = 'middle';
  sc2.fillStyle = glow;
  sc2.fillText(text, 0, 9);
  const c = document.createElement('canvas');
  c.width = tw * 4; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, c.width, c.height);
  // dot-matrix grid
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let y = 0; y < c.height; y += 4) ctx.fillRect(0, y, c.width, 1);
  for (let x = 0; x < c.width; x += 4) ctx.fillRect(x, 0, 1, c.height);
  return c;
}

// soft radial glow for sprites
function glowCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
}

// neon wordmark with baked halo
function neonCanvas(text) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 300;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "700 168px 'Braun', sans-serif";
  const passes = [
    [70, 'rgba(255,214,180,0.5)'],
    [34, 'rgba(255,226,196,0.7)'],
    [12, 'rgba(255,240,220,0.9)'],
  ];
  for (const [blur, col] of passes) {
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.fillStyle = 'rgba(255,246,236,0.55)';
    ctx.fillText(text, 512, 158);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff8f0';
  ctx.fillText(text, 512, 158);
  return c;
}

// speech bubble like the guide's
function bubbleCanvas(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0505';
  ctx.beginPath();
  ctx.roundRect(28, 22, 200, 74, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,227,208,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#f4e3d0';
  ctx.font = "700 34px 'Braun', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 60);
  return c;
}

// slate tablet face: stone texture + carved label
function tabletCanvas(key) {
  const c = slateTexture(hashStr(key) ^ 0x51a7e);
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  // warm the stone faintly so it reads under cave light
  ctx.fillStyle = 'rgba(150,102,84,0.07)';
  ctx.fillRect(0, 0, w, h);
  // hewn edge vignette
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // carved glyph mark (echo of the category)
  const label = CATEGORIES[key].short;
  ctx.textAlign = 'center';
  ctx.font = "700 64px 'Braun', sans-serif";
  ctx.fillStyle = 'rgba(255,224,186,0.5)';
  ctx.fillText(label, w / 2, h - 52 + 4);
  ctx.fillStyle = 'rgba(5,2,2,0.92)';
  ctx.fillText(label, w / 2, h - 52);
  // faint index number carved high
  const idx = String(KEYS.indexOf(key) + 1).padStart(2, '0');
  ctx.font = "200 90px 'Braun', sans-serif";
  ctx.fillStyle = 'rgba(255,215,175,0.16)';
  ctx.fillText(idx, w / 2, 120);
  return c;
}

// displace a geometry along its normals with fbm; returns amplitude per-vertex
function displace(geo, freq, amp, seed = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const bumps = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * freq + seed, v.y * freq + seed * 2, v.z * freq);
    bumps[i] = n;
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amp) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return bumps;
}

// ============================================================
//  INIT
// ============================================================

export function initCave({ canvas, onTablet, onHey }) {
  const PAL = {};
  for (const k of KEYS) PAL[k] = scenePalette(CATEGORIES[k].palette);
  const basePal = PAL.design;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#120708');
  scene.fog = new THREE.FogExp2('#150809', 0.03);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 80);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight('#6a3336', '#160709', 2.1));
  const mouthLight = new THREE.DirectionalLight('#ffd9ae', 2.6);
  mouthLight.position.set(-10, 6.5, -1);
  mouthLight.target.position.set(2, 0.4, -5);
  scene.add(mouthLight, mouthLight.target);
  const shelfLight = new THREE.PointLight('#ffab6a', 18, 30, 2);
  shelfLight.position.set(0.4, 4.2, -6.2);
  scene.add(shelfLight);
  const sideLight = new THREE.PointLight('#ff8a4a', 12, 18, 2);
  sideLight.position.set(4.8, 3, -4.6);
  scene.add(sideLight);

  // ---------- cave shell ----------
  const caveGeo = new THREE.SphereGeometry(1, 110, 72);
  const caveBumps = displace(caveGeo, 2.1, 0.34, 3.7);
  {
    // crevice shading via vertex colors
    const colors = new Float32Array(caveGeo.attributes.position.count * 3);
    for (let i = 0; i < caveBumps.length; i++) {
      const b = THREE.MathUtils.clamp(0.85 + caveBumps[i] * 1.5, 0.35, 1.25);
      colors[i * 3] = b;
      colors[i * 3 + 1] = b * 0.94;
      colors[i * 3 + 2] = b * 0.9;
    }
    caveGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const rockTex = canvasTex(rockCanvas(mixHex(hex(CATEGORIES.design.palette.sky), '#241a18', 0.22), 11), { repeat: [5, 3] });
  const caveMat = new THREE.MeshStandardMaterial({
    map: rockTex,
    vertexColors: true,
    roughness: 0.96,
    side: THREE.BackSide,
  });
  const cave = new THREE.Mesh(caveGeo, caveMat);
  cave.scale.set(15, 10, 17);
  cave.position.set(0, 3.4, 0);
  scene.add(cave);

  // ---------- sandy floor ----------
  const floorGeo = new THREE.CircleGeometry(17, 110, 0, Math.PI * 2);
  floorGeo.rotateX(-Math.PI / 2);
  {
    const pos = floorGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z) / 17;
      const dune = fbm(x * 0.16, 0, z * 0.16) * 1.1 + Math.max(0, r - 0.55) * 2.6;
      pos.setY(i, dune);
      const b = THREE.MathUtils.clamp(0.78 + dune * 0.22 - r * 0.28, 0.32, 1.1);
      colors[i * 3] = b;
      colors[i * 3 + 1] = b * 0.9;
      colors[i * 3 + 2] = b * 0.82;
    }
    floorGeo.computeVertexNormals();
    floorGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const sandTex = canvasTex(rockCanvas(mixHex(hex(CATEGORIES.design.palette.floor), hex(CATEGORIES.design.palette.fog), 0.3), 29), { repeat: [7, 7] });
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 0.9, metalness: 0.05 }));
  floor.position.y = -0.4;
  scene.add(floor);

  // ---------- ledges ----------
  const ledgeMat = new THREE.MeshStandardMaterial({ map: rockTex.clone(), roughness: 0.92, color: '#9c8a86' });
  ledgeMat.map.repeat.set(2.5, 0.8);
  function ledge(x, y, z, sx) {
    const g = new THREE.SphereGeometry(1, 56, 26);
    displace(g, 2.6, 0.22, x * 3.1);
    const m = new THREE.Mesh(g, ledgeMat);
    m.scale.set(sx, 0.8, 1.85);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  const ledgeA = ledge(-1.6, 3.1, -11.4, 4.4);    // upper — 2 tablets
  const ledgeB = ledge(0.9, 1.0, -10.7, 5.2);     // lower — 3 tablets

  // ---------- LED ticker bands on the ledge lips ----------
  const tickers = [];
  // a band that wraps the front rim of an elliptical ledge
  function rimTicker(text, ledgeMesh, speed) {
    const rx = ledgeMesh.scale.x * 0.99;
    const rz = ledgeMesh.scale.z * 1.04;
    const cnv = ledCanvas(text);
    const tex = canvasTex(cnv, { repeat: [rx / 1.8, 1] });
    const geo = new THREE.PlaneGeometry(rx * 1.9, 0.3, 64, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, rz * Math.sqrt(Math.max(0.001, 1 - (x / rx) ** 2)));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(ledgeMesh.position.x, ledgeMesh.position.y + 0.16, ledgeMesh.position.z);
    scene.add(m);
    tickers.push({ tex, speed });
    return m;
  }
  rimTicker(' WORKS · WORKS · WORKS ·', ledgeA, 0.045);
  rimTicker(' WORKS · WORKS · WORKS ·', ledgeB, -0.038);
  // long wall band, like the client ticker
  {
    const cnv = ledCanvas(' DEON MADE IT — DESIGN — MUSIC — WEB — VIDEO — CLOTHING —');
    const tex = canvasTex(cnv, { repeat: [7, 1] });
    const geo = new THREE.PlaneGeometry(26, 0.34, 64, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / 26;
      p.setZ(i, -Math.pow(u * 2, 2) * 2.2);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(2, 5.9, -10.9);
    m.rotation.y = -0.1;
    scene.add(m);
    tickers.push({ tex, speed: -0.06 });
  }

  // ---------- neon sign ----------
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 2.1),
    new THREE.MeshBasicMaterial({ map: canvasTex(neonCanvas('DEON')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  neon.position.set(-1.3, 6.9, -11.6);
  neon.rotation.x = 0.06;
  scene.add(neon);

  // ---------- tablets + crystals ----------
  const glowTex = canvasTex(glowCanvas());
  const sideMat = new THREE.MeshStandardMaterial({ color: '#161010', roughness: 0.9 });
  const tablets = [];
  const tapTargets = [];
  const slots = [
    { key: KEYS[0], x: -3.7, y: 5.0, z: -10.2, ry: 0.24 },
    { key: KEYS[1], x: -0.2, y: 5.1, z: -10.4, ry: -0.06 },
    { key: KEYS[2], x: -2.4, y: 2.75, z: -9.55, ry: 0.16 },
    { key: KEYS[3], x: 1.3, y: 2.85, z: -9.7, ry: -0.04 },
    { key: KEYS[4], x: 4.3, y: 2.75, z: -10.1, ry: -0.34 },
  ];
  for (const s of slots) {
    const faceTex = canvasTex(tabletCanvas(s.key));
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex, roughness: 0.8,
      emissive: '#8a6a58', emissiveIntensity: 0.3, emissiveMap: faceTex,
    });
    const tb = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.14, 0.18), [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat]);
    tb.position.set(s.x, s.y, s.z);
    tb.rotation.y = s.ry;
    tb.userData = { key: s.key, baseY: s.y, baseRY: s.ry, phase: hashStr(s.key) % 7 };
    scene.add(tb);
    tablets.push(tb);
    tapTargets.push(tb);

    // crystal glowing in the category colour, seated on the ledge
    const glow = hex(CATEGORIES[s.key].palette.glow);
    const cry = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.21, 0),
      new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.6, roughness: 0.25 })
    );
    cry.scale.y = 1.7;
    cry.position.set(s.x, s.y - 1.5, s.z + 0.2);
    cry.rotation.y = s.ry * 2;
    scene.add(cry);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: glow, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    spr.scale.set(2.1, 2.1, 1);
    spr.position.copy(cry.position);
    scene.add(spr);
  }

  // ---------- cave mouth + light shaft ----------
  const mouthCnv = document.createElement('canvas');
  mouthCnv.width = mouthCnv.height = 256;
  {
    const ctx = mouthCnv.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,238,214,1)');
    g.addColorStop(0.5, 'rgba(255,210,160,0.55)');
    g.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 40),
    new THREE.MeshBasicMaterial({ map: canvasTex(mouthCnv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  mouth.position.set(-13.2, 6, -2);
  mouth.rotation.y = Math.PI / 2 - 0.25;
  mouth.scale.set(1.25, 1.7, 1); // organic, taller than wide
  scene.add(mouth);

  // volumetric-ish shaft: nested cones aligned mouth → pool,
  // with an alpha gradient so the ends dissolve
  const shaftAlpha = document.createElement('canvas');
  shaftAlpha.width = 8; shaftAlpha.height = 128;
  {
    const ctx = shaftAlpha.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 128);
  }
  const shaftTex = new THREE.CanvasTexture(shaftAlpha);
  const mouthPos = new THREE.Vector3(-12.6, 5.8, -2);
  const poolPos = new THREE.Vector3(-2.4, 0.6, -2.9);
  const beamDir = poolPos.clone().sub(mouthPos);
  function shaft(r1, r2, op) {
    const g = new THREE.CylinderGeometry(r1, r2, beamDir.length(), 20, 1, true);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: '#ffdcae', transparent: true, opacity: op, alphaMap: shaftTex,
      blending: THREE.AdditiveBlending, side: THREE.FrontSide, depthWrite: false, toneMapped: false,
    }));
    m.position.copy(mouthPos.clone().add(poolPos).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().normalize().negate());
    scene.add(m);
    return m;
  }
  shaft(0.8, 1.7, 0.045);
  shaft(0.45, 0.95, 0.065);
  // pool of light on the sand
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 40),
    new THREE.MeshBasicMaterial({ map: canvasTex(mouthCnv), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-2.2, 0.66, -2.9);
  pool.scale.set(1.5, 1, 1);
  scene.add(pool);

  // dust motes drifting in the shaft
  const MOTES = 140;
  const moteGeo = new THREE.BufferGeometry();
  const mote0 = new Float32Array(MOTES * 3);
  const rndm = mulberry(99);
  for (let i = 0; i < MOTES; i++) {
    const t = rndm();
    const r = (0.4 + t * 1.6) * rndm();
    const a = rndm() * Math.PI * 2;
    mote0[i * 3] = mouthPos.x + beamDir.x * t + Math.cos(a) * r;
    mote0[i * 3 + 1] = mouthPos.y + beamDir.y * t + Math.sin(a) * r * 0.6;
    mote0[i * 3 + 2] = mouthPos.z + beamDir.z * t + Math.sin(a) * r;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mote0.slice(), 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: glowTex, color: '#ffe2bc', size: 0.09, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(motes);

  // ---------- stalagmites + stalactites ----------
  const stalMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.95, color: '#a08c86' });
  const rnds = mulberry(7);
  function spike(x, z, hgt, up = true) {
    const g = new THREE.ConeGeometry(hgt * 0.32, hgt, 18, 10);
    displace(g, 1.6, 0.35, x);
    const m = new THREE.Mesh(g, stalMat);
    m.position.set(x, up ? hgt / 2 + fbm(x * 0.16, 0, z * 0.16) * 1.1 : 9.4 - hgt / 2 + fbm(x * 0.2, 1, z * 0.2), z);
    if (!up) m.rotation.z = Math.PI;
    m.rotation.y = rnds() * 6;
    scene.add(m);
    return m;
  }
  spike(-6.8, -6.5, 2.6); spike(-8.2, -4.2, 1.5); spike(6.6, -5.2, 3.2);
  spike(8.4, -2.2, 1.8); spike(-7.6, 2.8, 2.1); spike(7.9, 3.4, 1.4);
  spike(-3.5, -7.8, 4.4, false); spike(2.2, -6.6, 3.1, false);
  spike(5.8, -7.9, 5, false); spike(-6.9, -5.4, 2.6, false); spike(0.4, 6.2, 3.6, false);

  // ---------- the guide: a menhir with a HEY bubble ----------
  const menhirGeo = new THREE.CylinderGeometry(0.5, 0.82, 3, 22, 14);
  displace(menhirGeo, 1.4, 0.3, 42);
  const menhir = new THREE.Mesh(menhirGeo, new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.9, color: '#8a7570' }));
  menhir.position.set(4.6, 1.25, -6.2);
  menhir.rotation.y = 0.6;
  scene.add(menhir);
  // carved eyes that catch the light
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffd9a8', toneMapped: false });
  for (const dx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), eyeMat);
    eye.position.set(4.6 + dx - 0.1, 2.25, -5.55);
    eye.rotation.y = -0.25;
    scene.add(eye);
  }
  const hey = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(bubbleCanvas('HEY')), transparent: true, depthWrite: false }));
  hey.scale.set(1.7, 0.85, 1);
  hey.position.set(4.6, 3.35, -6.2);
  hey.userData = { isHey: true };
  scene.add(hey);
  tapTargets.push(hey, menhir);
  menhir.userData = { isHey: true };

  // ---------- cameras ----------
  const PRESETS = [
    { pos: new THREE.Vector3(2.9, 2.6, 0.6), tgt: new THREE.Vector3(-1.4, 3.4, -10.4) },   // facing the shelves
    { pos: new THREE.Vector3(-4.4, 1.9, 1.9), tgt: new THREE.Vector3(2.2, 2.8, -9.2) }, // from the light, past the guide
    { pos: new THREE.Vector3(1.2, 4, 11.5), tgt: new THREE.Vector3(-1.2, 3.4, -9) },     // wide, whole cavern
  ];
  let camIndex = 0;
  const cur = { pos: PRESETS[0].pos.clone(), tgt: PRESETS[0].tgt.clone() };
  const look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };

  function setCamera(i) {
    camIndex = ((i % PRESETS.length) + PRESETS.length) % PRESETS.length;
    look.tyaw = 0; look.tpitch = 0;
    return camIndex;
  }

  // ---------- input: drag to look, tap to open ----------
  let down = null;
  let moved = false;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, yaw0: look.tyaw, pitch0: look.tpitch, t: performance.now() };
    moved = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
    look.tyaw = THREE.MathUtils.clamp(down.yaw0 + dx * 0.003, -0.65, 0.65);
    look.tpitch = THREE.MathUtils.clamp(down.pitch0 + dy * 0.002, -0.42, 0.42);
    if (onFirstDrag && moved) { onFirstDrag(); onFirstDrag = null; }
  });
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const wasTap = !moved && performance.now() - down.t < 420;
    down = null;
    if (!wasTap) return;
    const ndc = new THREE.Vector2(
      (e.clientX / canvas.clientWidth) * 2 - 1,
      -(e.clientY / canvas.clientHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(tapTargets, false)[0];
    if (!hit) return;
    if (hit.object.userData.isHey) { onHey && onHey(); return; }
    if (hit.object.userData.key) onTablet && onTablet(hit.object.userData.key);
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  let onFirstDrag = null;

  // ---------- resize ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.75 ? 74 : camera.aspect < 1.1 ? 64 : 56;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- loop ----------
  const clock = new THREE.Clock();
  const dir = new THREE.Vector3();
  const flick = mulberry(5);
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // camera drifts to preset + look offset
    const k = 1 - Math.exp(-3.2 * dt);
    cur.pos.lerp(PRESETS[camIndex].pos, k);
    cur.tgt.lerp(PRESETS[camIndex].tgt, k);
    look.yaw += (look.tyaw - look.yaw) * (1 - Math.exp(-8 * dt));
    look.pitch += (look.tpitch - look.pitch) * (1 - Math.exp(-8 * dt));
    camera.position.copy(cur.pos);
    // idle breath
    camera.position.y += Math.sin(t * 0.5) * 0.05;
    dir.subVectors(cur.tgt, cur.pos);
    const sph = new THREE.Spherical().setFromVector3(dir);
    sph.theta -= look.yaw;
    sph.phi = THREE.MathUtils.clamp(sph.phi + look.pitch, 0.3, Math.PI - 0.3);
    dir.setFromSpherical(sph);
    camera.lookAt(camera.position.clone().add(dir));

    // tablets bob
    for (const tb of tablets) {
      tb.position.y = tb.userData.baseY + Math.sin(t * 0.9 + tb.userData.phase) * 0.07;
      tb.rotation.y = tb.userData.baseRY + Math.sin(t * 0.55 + tb.userData.phase) * 0.07;
    }
    // tickers scroll
    for (const tk of tickers) tk.tex.offset.x += tk.speed * dt * 10;
    // neon flicker
    neon.material.opacity = 0.9 + Math.sin(t * 9) * 0.04 + (flick() > 0.992 ? -0.35 : 0);
    // hey bubble bobs
    hey.position.y = 3.35 + Math.sin(t * 1.4) * 0.08;
    // motes drift
    const mp = moteGeo.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      let y = mp.getY(i) - dt * 0.1;
      let x = mp.getX(i) + dt * 0.22 + Math.sin(t * 0.4 + i) * dt * 0.05;
      if (y < 0.5 || x > 0.5) { y = mote0[i * 3 + 1]; x = mote0[i * 3]; }
      mp.setY(i, y);
      mp.setX(i, x);
    }
    mp.needsUpdate = true;

    renderer.render(scene, camera);
  });

  return {
    setCamera,
    get camIndex() { return camIndex; },
    onFirstDrag(fn) { onFirstDrag = fn; },
  };
}
