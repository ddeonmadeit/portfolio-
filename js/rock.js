// ============================================================
//  ROCK — a small, self-contained three.js scene: one organic
//  boulder, procedurally textured, with the studio's logo
//  carved into its face. Rotates continuously; the caller
//  (js/app.js) drives render(dt) from its own rAF loop and
//  positions the canvas entirely via CSS — this module never
//  touches layout, only pixels.
// ============================================================
import * as THREE from './vendor/three.module.js';

/* ---------------- deterministic noise (ported from the site's old cave build) ---------------- */
function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
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

// displace a sphere along its normals so it reads as an organic boulder, not a ball
function displace(geo, freq, amp, seed = 0) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * freq + seed, v.y * freq + seed * 2, v.z * freq);
    const len = v.length() || 1;
    v.multiplyScalar(1 + (n * amp) / len);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ---------------- procedural stone surface + carved logo, baked into one canvas ---------------- */
// tints an alpha-masked image (white glyph, transparent elsewhere) to a solid color
function tintedGlyph(img, w, h, color) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function buildRockCanvas(logoImg) {
  const S = 1024;
  const rand = mulberry(11);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#48453e';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 70; i++) {
    const x = rand() * S, y = rand() * S;
    const rx = S * (0.03 + rand() * 0.09), ry = rx * (0.4 + rand() * 0.9);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI);
    ctx.filter = 'blur(7px)';
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.filter = 'none';
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    let x = rand() * S, y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 170;
      y += (rand() - 0.3) * 150;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // carve the logo once, centered near the equator (least UV distortion, and
  // lines up with the camera's initial view) — a dark recessed fill plus an
  // offset highlight stamp read as an engraved mark even before the bump
  // map adds real-time raking-light shading on top.
  if (logoImg) {
    const lw = S * 0.4, lh = lw;
    const lx = S * 0.5 - lw / 2, ly = S * 0.48 - lh / 2;
    ctx.drawImage(tintedGlyph(logoImg, lw, lh, 'rgba(2,1,1,0.97)'), lx, ly);
    ctx.drawImage(tintedGlyph(logoImg, lw, lh, 'rgba(255,244,228,0.95)'), lx - 4, ly - 5);
    ctx.drawImage(tintedGlyph(logoImg, lw, lh, 'rgba(2,1,1,0.97)'), lx + 1, ly + 2);
  }

  return c;
}

/* ---------------- public API ---------------- */
export function initRock(canvas, { logoUrl = 'assets/logo-mark.png' } = {}) {
  const SIZE = 640; // internal render resolution — higher than the ~300px CSS box for headroom under the fly-through's perspective scale-up
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  camera.position.set(0, 0, 2.6);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0x8a8478, 0x131210, 1.35));
  const keyLight = new THREE.DirectionalLight(0xfff2e0, 1.9);
  keyLight.position.set(2, 1.6, 2.2);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x8fa6c9, 0.55);
  rimLight.position.set(-2.2, -0.6, -1.2);
  scene.add(rimLight);

  const geo = new THREE.SphereGeometry(1, 56, 36);
  displace(geo, 2.4, 0.16, 7.3);

  let mesh = null;
  let contextLost = false;

  const setTexture = (logoImg) => {
    const tex = new THREE.CanvasTexture(buildRockCanvas(logoImg));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: -0.075,
      roughness: 0.9,
      metalness: 0.0,
    });
    if (mesh) {
      mesh.material.map?.dispose();
      mesh.material.dispose();
      mesh.material = mat;
    } else {
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
    }
  };

  setTexture(null); // plain stone visible immediately
  if (logoUrl) {
    const img = new Image();
    img.onload = () => setTexture(img);
    img.src = logoUrl;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; }, false);
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; }, false);

  function render(dt) {
    if (contextLost || !mesh) return;
    mesh.rotation.y += dt * 0.16;
    mesh.rotation.x = Math.sin(performance.now() * 0.00007) * 0.09;
    renderer.render(scene, camera);
  }

  function dispose() {
    mesh?.material?.map?.dispose();
    mesh?.material?.dispose();
    geo.dispose();
    renderer.dispose();
  }

  return { render, dispose };
}
