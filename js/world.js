// ============================================================
//  WORLD — a sea of rolling dunes at golden hour. Five ancient
//  ruins, far apart, half-swallowed by the sand. A small camp
//  on the starting ridge. Nothing else.
// ============================================================

import * as THREE from 'three';
import { CATEGORIES, SITE } from './data.js';
import {
  signTexture, skyTexture, makeSunSprite,
  rippleBump, frescoTexture, glyphTexture, wovenClothTexture,
} from './textures.js';
import { TERRAIN_SEGS, SHADOW_SIZE } from './quality.js';

const GOLD = {
  skyTop: 0x6e7ba8,   // cool lavender blue overhead
  skyMid: 0xd9919a,   // soft pink
  skySun: 0xffd9a0,   // warm gold at the horizon
  fog: 0xe8b88e,      // golden haze
  sandLit: 0xd9aa7c,
  sandShade: 0x9a6e54,
};

// ------------------------------------------------------------
//  TERRAIN — analytic dune height, shared by everything that
//  needs to sit on (or fly over) the sand
// ------------------------------------------------------------

function hash2(ix, iz) {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(x * f + i * 13.7, z * f - i * 7.3);
    amp *= 0.5;
    f *= 2;
  }
  return v;
}

// raw dune field: long wind-aligned crests riding on broad swells
function duneBase(x, z) {
  const ca = Math.cos(0.55), sa = Math.sin(0.55);
  const u = x * ca - z * sa;
  const v = x * sa + z * ca;
  const r = fbm(u * 0.011, v * 0.03, 4);
  const crest = 1 - Math.abs(2 * r - 1);          // sharp dune ridges
  const swell = fbm(x * 0.0048 + 7.3, z * 0.0048 - 2.1, 3); // rolling heights
  const detail = fbm(x * 0.05, z * 0.05, 2) * 0.9;
  return crest * crest * 10 * (0.35 + swell) + swell * 16 + detail - 10;
}

// flat pads where ruins / the camp sit, blended into the dunes
const PADS = [
  { key: 'camp', x: 0, z: 8, r: 16 },
  { key: 'gate', x: 0, z: 30, r: 8 },
  { key: 'design', x: -78, z: -48, r: 15 },
  { key: 'music', x: -30, z: -102, r: 16 },
  { key: 'web', x: 42, z: -116, r: 15 },
  { key: 'video', x: 92, z: -52, r: 15 },
  { key: 'clothing', x: 64, z: 22, r: 14 },
];
for (const p of PADS) p.y = duneBase(p.x, p.z);

export function duneHeight(x, z) {
  let h = duneBase(x, z);
  for (const p of PADS) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r * 2.4) {
      const k = THREE.MathUtils.smoothstep(d, p.r * 0.55, p.r * 2.4);
      h = p.y * (1 - k) + h * k;
    }
  }
  return h;
}

// ------------------------------------------------------------
//  STONE KIT — every ruin is many blocks merged into one mesh
// ------------------------------------------------------------

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STONE = new THREE.Color(0xb29b80);

class StoneKit {
  constructor(seed = 1) {
    this.parts = [];
    this.rand = mulberry32(seed);
  }
  // add a jittered box (or any geometry) at pos/rot, with a shade offset
  block(geo, pos, rot = [0, 0, 0], shade = 0) {
    const g = geo.toNonIndexed();
    const posAttr = g.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(
        i,
        posAttr.getX(i) + (this.rand() - 0.5) * 0.12,
        posAttr.getY(i) + (this.rand() - 0.5) * 0.12,
        posAttr.getZ(i) + (this.rand() - 0.5) * 0.12
      );
    }
    g.computeVertexNormals();
    const m = new THREE.Matrix4()
      .makeRotationFromEuler(new THREE.Euler(...rot))
      .setPosition(...pos);
    g.applyMatrix4(m);
    const col = STONE.clone().offsetHSL(0, (this.rand() - 0.5) * 0.015, shade + (this.rand() - 0.5) * 0.025);
    this.parts.push({ g, col });
  }
  box(w, h, d, pos, rot, shade) {
    this.block(new THREE.BoxGeometry(w, h, d), pos, rot, shade);
  }
  // a column built from drums, optionally broken at a fraction of height
  column(x, z, height, radius = 0.55, brokenAt = 1) {
    const drums = Math.max(2, Math.round(height / 1.1));
    let y = 0;
    for (let i = 0; i < drums; i++) {
      if (i / drums > brokenAt) break;
      const h = height / drums;
      this.block(
        new THREE.CylinderGeometry(radius * (0.96 + this.rand() * 0.05), radius, h, 14),
        [x + (this.rand() - 0.5) * 0.05, y + h / 2, z + (this.rand() - 0.5) * 0.05],
        [0, this.rand() * 1, 0],
        -0.02 * i / drums
      );
      y += h;
    }
    return y; // actual top
  }
  // a wall of stacked blocks; the top course crumbles away
  wall(cx, cz, width, height, ry = 0, opening = null) {
    const bw = 1.6, bh = 0.85;
    const cols = Math.round(width / bw);
    const rows = Math.round(height / bh);
    const cosr = Math.cos(ry), sinr = Math.sin(ry);
    for (let r = 0; r < rows; r++) {
      const decay = (r / rows) ** 2;          // higher rows lose more blocks
      for (let c = 0; c < cols; c++) {
        const lx = (c - (cols - 1) / 2) * bw + (r % 2 ? bw * 0.25 : 0);
        if (opening) {
          const within = Math.abs(lx - opening.x) < opening.w / 2 && r * bh < opening.h;
          if (within) continue;
        }
        if (this.rand() < decay * 0.85) continue;
        const x = cx + lx * cosr;
        const z = cz - lx * sinr;
        // courses overlap slightly so seams melt together
        this.box(
          bw * (1.02 + this.rand() * 0.08), bh * 1.05, 0.95 + this.rand() * 0.3,
          [x, r * bh + bh / 2, z + (this.rand() - 0.5) * 0.1],
          [0, ry + (this.rand() - 0.5) * 0.03, (this.rand() - 0.5) * 0.02],
          -decay * 0.06
        );
      }
    }
  }
  // half-buried fallen blocks scattered around
  rubble(cx, cz, radius, count) {
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const d = radius * (0.4 + this.rand() * 0.6);
      this.box(
        0.9 + this.rand() * 1.2, 0.7 + this.rand() * 0.6, 0.8 + this.rand(),
        [cx + Math.cos(a) * d, 0.1 + this.rand() * 0.15, cz + Math.sin(a) * d],
        [this.rand() * 0.3, this.rand() * 3, this.rand() * 0.35],
        -0.04
      );
    }
  }
  build() {
    let total = 0;
    for (const p of this.parts) total += p.g.attributes.position.count;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    let off = 0;
    for (const p of this.parts) {
      pos.set(p.g.attributes.position.array, off * 3);
      nor.set(p.g.attributes.normal.array, off * 3);
      for (let i = 0; i < p.g.attributes.position.count; i++) {
        col[(off + i) * 3] = p.col.r;
        col[(off + i) * 3 + 1] = p.col.g;
        col[(off + i) * 3 + 2] = p.col.b;
      }
      off += p.g.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

// dark doorway + carved tablet, the standard "enter here";
// ry turns both to face the door's outward direction
function doorwayProps(group, doorPos, label, tabletY, ry = 0) {
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 3),
    new THREE.MeshBasicMaterial({ color: 0x120c08 })
  );
  portal.position.copy(doorPos);
  portal.rotation.y = ry;
  group.add(portal);
  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.8, 0.18),
    [null, null, null, null,
      new THREE.MeshStandardMaterial({ map: signTexture(label, { bg: '#8a7458', fg: '#2e2418' }), roughness: 0.9 }),
      null].map((m) => m || new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.9 }))
  );
  tablet.position.set(doorPos.x, tabletY, doorPos.z);
  tablet.translateOnAxis(new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), 0.1);
  tablet.rotation.y = ry;
  tablet.rotation.z = 0.02;
  tablet.castShadow = true;
  group.add(tablet);
}

// drifted sand piled against ruins
function sandDrift(group, x, z, s, sx = 1.6) {
  const drift = new THREE.Mesh(
    new THREE.SphereGeometry(s, 20, 12),
    new THREE.MeshStandardMaterial({ color: GOLD.sandLit, roughness: 0.95 })
  );
  drift.scale.set(sx, 0.32, 1);
  drift.rotation.y = Math.random() * 3;
  drift.position.set(x, 0, z);
  drift.receiveShadow = true;
  group.add(drift);
}

// ------------------------------------------------------------
//  RUINS — one unique ruin per category. Door faces +z (local).
// ------------------------------------------------------------

// DESIGN — the fresco wall: a tall broken gallery wall, a faded
// mural still clinging to it, arched doorway through the middle
function ruinDesign(cat) {
  const g = new THREE.Group();
  const kit = new StoneKit(11);
  kit.wall(0, 0, 16, 7.5, 0, { x: 0, w: 2.6, h: 3.4 });
  // lintel over the opening
  kit.box(4.2, 0.9, 1.1, [0, 3.85, 0], [0, 0, 0.015], -0.03);
  // a stub of a side wall, mostly gone
  kit.wall(-8.8, -3, 6, 3.4, Math.PI / 2);
  kit.rubble(0, 5, 7, 8);
  g.add(kit.build());

  // two mural panels flanking the doorway
  for (const fx of [-4.6, 4.6]) {
    const fresco = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 4.6),
      new THREE.MeshStandardMaterial({
        map: frescoTexture(cat.palette.glow),
        roughness: 0.95, transparent: true, opacity: 0.96,
      })
    );
    fresco.position.set(fx, 3.1, 0.62);
    fresco.receiveShadow = true;
    g.add(fresco);
  }

  sandDrift(g, -5, 1.5, 3.2);
  sandDrift(g, 6.5, -0.8, 2.6);
  doorwayProps(g, new THREE.Vector3(0, 1.5, 0.55), cat.short, 4.9);
  return { group: g, door: new THREE.Vector3(0, 1.5, 0.6), outward: new THREE.Vector3(0, 0, 1) };
}

// MUSIC — the amphitheatre: half-buried tiers curving around a
// cracked stage, two columns still standing into the sky
function ruinMusic(cat) {
  const g = new THREE.Group();
  const kit = new StoneKit(23);
  // tiers: arcs of seat blocks, rear ones taller and more broken
  for (let tier = 0; tier < 4; tier++) {
    const R = 6.5 + tier * 2.1;
    const y = 0.45 + tier * 0.95;
    const n = 10 + tier * 3;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.16 + 0.68 * (i / (n - 1))); // arc behind the stage
      if (kit.rand() < tier * 0.13) continue;
      kit.box(
        2, 0.9, 1.7,
        [Math.cos(a) * R, y, -Math.sin(a) * R],
        [0, a + Math.PI / 2, 0],
        -tier * 0.03
      );
    }
  }
  g.add(kit.build());

  const kit2 = new StoneKit(29);
  // the stage: a low round dais, cracked
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    kit2.block(
      new THREE.CylinderGeometry(2.6, 2.7, 0.5, 8, 1, false, a, Math.PI * 2 / 9 - 0.04),
      [0, 0.25, -1], [0, 0, 0], -0.02
    );
  }
  // standing + broken columns flanking the rear doorway
  kit2.column(-4.6, -6.5, 7.4, 0.55, 1);
  kit2.column(4.4, -6.8, 7.4, 0.55, 0.45);
  // door jambs + lintel at the back of the stage
  kit2.box(1, 3.6, 1, [-1.55, 1.8, -6.2]);
  kit2.box(1, 3.6, 1, [1.55, 1.8, -6.2]);
  kit2.box(4.4, 0.9, 1.2, [0, 3.95, -6.2], [0, 0, -0.02]);
  kit2.rubble(5.5, -2, 4, 5);
  g.add(kit2.build());

  sandDrift(g, -7, -2, 3.4);
  sandDrift(g, 3, 3.5, 2.8);
  doorwayProps(g, new THREE.Vector3(0, 1.5, -5.65), cat.short, 5);
  return { group: g, door: new THREE.Vector3(0, 1.5, -5.6), outward: new THREE.Vector3(0, 0, 1) };
}

// WEB — the ziggurat: a stepped temple losing its corners to the
// wind, carved glyph stones around a dark doorway
function ruinWeb(cat) {
  const g = new THREE.Group();
  const kit = new StoneKit(37);
  const levels = [
    { w: 15, h: 2.1, y: 0 },
    { w: 10.5, h: 1.9, y: 2.1 },
    { w: 6.4, h: 1.7, y: 4.0 },
  ];
  for (const [li, L] of levels.entries()) {
    const bw = 1.7;
    const n = Math.round(L.w / bw);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // hollow: only the outer ring of blocks
        if (i > 0 && i < n - 1 && j > 0 && j < n - 1) continue;
        const x = (i - (n - 1) / 2) * bw;
        const z = (j - (n - 1) / 2) * bw;
        // erosion eats the corners, worse higher up
        const corner = (Math.abs(x) + Math.abs(z)) / L.w;
        if (kit.rand() < (corner - 0.45) * 1.4 + li * 0.12) continue;
        kit.box(
          bw * 1.04, L.h * 1.03, bw * 1.04,
          [x, L.y + L.h / 2, z],
          [0, (kit.rand() - 0.5) * 0.04, 0],
          -li * 0.04 - corner * 0.05
        );
      }
    }
  }
  // doorway punched into the base level, facing +z
  kit.box(1.1, 3.2, 1, [-1.7, 1.6, 7.2]);
  kit.box(1.1, 3.2, 1, [1.7, 1.6, 7.2]);
  kit.box(4.6, 0.8, 1.1, [0, 3.6, 7.2], [0, 0, 0.02]);
  kit.rubble(0, 11, 5, 6);
  g.add(kit.build());

  // glyph tablets set into the walls
  for (const [x, z, ry] of [[-4.2, 7.6, 0], [4.2, 7.6, 0], [-7.6, 2, Math.PI / 2]]) {
    const glyphs = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.6),
      new THREE.MeshStandardMaterial({ map: glyphTexture(), roughness: 0.95 })
    );
    glyphs.position.set(x, 1.4, z);
    glyphs.rotation.y = ry;
    g.add(glyphs);
  }

  sandDrift(g, -7.5, 5, 3.6);
  sandDrift(g, 8, -3, 4.2);
  doorwayProps(g, new THREE.Vector3(0, 1.5, 7.55), cat.short, 4.5);
  return { group: g, door: new THREE.Vector3(0, 1.5, 7.6), outward: new THREE.Vector3(0, 0, 1) };
}

// VIDEO — the theatre wall: a tall ruined facade with empty
// window openings where the sky plays — frames with no pictures
function ruinVideo(cat) {
  const g = new THREE.Group();
  const kit = new StoneKit(41);
  const bw = 1.6, bh = 0.85;
  const cols = 12, rows = 11;
  const windows = [
    { c0: 1.5, c1: 4, r0: 4, r1: 7 },
    { c0: 7, c1: 9.5, r0: 4, r1: 7 },
    { c0: 4.5, c1: 6.5, r0: 8, r1: 10 },
  ];
  for (let r = 0; r < rows; r++) {
    const decay = (r / rows) ** 2.4;
    for (let c = 0; c < cols; c++) {
      const lx = (c - (cols - 1) / 2) * bw + (r % 2 ? bw * 0.25 : 0);
      // door at the base
      if (Math.abs(lx) < 1.3 && r * bh < 3.2) continue;
      // window openings
      const cc = c + (r % 2 ? 0.25 : 0);
      if (windows.some((w) => cc >= w.c0 && cc <= w.c1 && r >= w.r0 && r <= w.r1)) continue;
      if (kit.rand() < decay * 0.9) continue;
      kit.box(
        bw * (1.02 + kit.rand() * 0.06), bh * 1.05, 1.05 + kit.rand() * 0.25,
        [lx, r * bh + bh / 2, (kit.rand() - 0.5) * 0.08],
        [0, (kit.rand() - 0.5) * 0.03, (kit.rand() - 0.5) * 0.02],
        -decay * 0.07
      );
    }
  }
  // door lintel
  kit.box(3.6, 0.9, 1.2, [0, 3.6, 0], [0, 0, -0.015]);
  // a leaning buttress
  kit.box(1.4, 6, 1.4, [-9.2, 2.8, 1.6], [0, 0.3, 0.2], -0.04);
  kit.rubble(3, 4.5, 6, 9);
  g.add(kit.build());

  sandDrift(g, 6, 1.8, 3.4);
  sandDrift(g, -4.5, 2.2, 2.7);
  doorwayProps(g, new THREE.Vector3(0, 1.4, 0.6), cat.short, 4.6);
  return { group: g, door: new THREE.Vector3(0, 1.4, 0.65), outward: new THREE.Vector3(0, 0, 1) };
}

// CLOTHING — the weavers' colonnade: two rows of columns, most
// broken, one ancient cloth still strung up and catching light
function ruinClothing(cat) {
  const g = new THREE.Group();
  const kit = new StoneKit(53);
  for (let i = 0; i < 4; i++) {
    for (const zRow of [-2.6, 2.6]) {
      const x = -6 + i * 4;
      // the entrance pair (x = 2) still stands full height to carry the cloth
      const broken = x === 2 ? 1 : kit.rand();
      kit.column(x, zRow, 6.8, 0.6, broken < 0.4 ? 0.3 + kit.rand() * 0.4 : 1);
    }
  }
  // architrave fragments still bridging pairs
  kit.box(4.6, 0.8, 1, [-4, 7.1, -2.6], [0, 0, 0.01], -0.03);
  kit.box(1.2, 0.8, 6.2, [2, 7.1, 0], [0, 0, -0.012], -0.03);
  kit.rubble(0, 0, 6.5, 7);
  // fallen column lying across
  for (let i = 0; i < 4; i++) {
    kit.block(
      new THREE.CylinderGeometry(0.55, 0.58, 1.5, 12),
      [-1 + i * 1.62, 0.5, 5.2 + i * 0.22],
      [0.12, 0, Math.PI / 2 + 0.06 * i],
      -0.03
    );
  }
  g.add(kit.build());

  // the surviving cloth: hung over the entrance between the
  // standing pair, sagging and folded by centuries of wind
  const clothGeo = new THREE.PlaneGeometry(5.4, 3.4, 36, 22);
  {
    const pos = clothGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const u = (x + 2.7) / 5.4;
      const down = 1 - (y + 1.7) / 3.4; // 0 at the hung top edge
      const sag = Math.sin(u * Math.PI) * 0.85 * down;
      const fold = (Math.sin(x * 2.4) * 0.2 + Math.sin(x * 5.1 + 1) * 0.09) * (0.25 + down);
      pos.setXYZ(i, x, y - sag, fold);
    }
    clothGeo.computeVertexNormals();
  }
  const cloth = new THREE.Mesh(
    clothGeo,
    new THREE.MeshStandardMaterial({
      map: wovenClothTexture(), side: THREE.DoubleSide,
      roughness: 0.95, transparent: true, alphaTest: 0.35,
    })
  );
  cloth.position.set(2.2, 4.9, 0);
  cloth.rotation.y = Math.PI / 2;
  cloth.castShadow = true;
  g.add(cloth);

  sandDrift(g, 4, -4, 3);
  sandDrift(g, -6, 3, 2.5);
  // entrance: at the end of the colonnade aisle, tablet above the lintel
  const out = new THREE.Vector3(1, 0, 0.25).normalize();
  doorwayProps(g, new THREE.Vector3(2, 1.5, 0), cat.short, 7.9, Math.atan2(out.x, out.z));
  return { group: g, door: new THREE.Vector3(2, 1.5, 0.1), outward: out };
}

// ------------------------------------------------------------
//  WORLD ASSEMBLY
// ------------------------------------------------------------

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(GOLD.fog, 55, 270);

  const interactables = [];
  const animated = [];

  // ---------- light: low golden sun raking the ripples ----------
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x8a5e48, 0.5));
  scene.add(new THREE.AmbientLight(0xffe2c0, 0.16));
  const sunLight = new THREE.DirectionalLight(0xffc685, 2.3);
  sunLight.position.set(-90, 26, -45);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
  const SB = 150;
  sunLight.shadow.camera.left = -SB;
  sunLight.shadow.camera.right = SB;
  sunLight.shadow.camera.top = SB;
  sunLight.shadow.camera.bottom = -SB;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 420;
  sunLight.shadow.bias = -0.001;
  sunLight.target.position.set(0, 0, -40);
  scene.add(sunLight, sunLight.target);

  // ---------- sky + sun ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 40, 24),
    new THREE.MeshBasicMaterial({
      map: skyTexture(GOLD.skyTop, GOLD.skyMid, GOLD.skySun),
      side: THREE.BackSide, fog: false,
    })
  );
  scene.add(sky);

  const sun = makeSunSprite('#fff4dc', '#f8b870', 190);
  sun.position.set(-330, 64, -165);
  scene.add(sun);

  // ---------- the dune sea ----------
  {
    const size = 560; // ends just inside the first backdrop ring
    const geo = new THREE.PlaneGeometry(size, size, TERRAIN_SEGS, TERRAIN_SEGS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, duneHeight(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();

    // vertex color: warm on sun-facing slopes, cool violet in the lee
    const sunDir = new THREE.Vector3(-90, 26, -45).normalize();
    const nor = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const lit = new THREE.Color(GOLD.sandLit);
    const shade = new THREE.Color(GOLD.sandShade);
    const tmpN = new THREE.Vector3();
    const tmpC = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      tmpN.set(nor.getX(i), nor.getY(i), nor.getZ(i));
      const facing = THREE.MathUtils.clamp(tmpN.dot(sunDir) * 1.4 + 0.45, 0, 1);
      tmpC.lerpColors(shade, lit, facing);
      const tint = (hash2(Math.round(pos.getX(i) * 3.1), Math.round(pos.getZ(i) * 3.1)) - 0.5) * 0.05;
      colors[i * 3] = tmpC.r + tint;
      colors[i * 3 + 1] = tmpC.g + tint;
      colors[i * 3 + 2] = tmpC.b + tint;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const bump = rippleBump();
    bump.repeat.set(140, 140);
    const ground = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.96,
        bumpMap: bump, bumpScale: 0.55,
      })
    );
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ---------- far dune silhouettes dissolving into the haze ----------
  {
    const layers = [
      { r: 290, hMin: 8, hMax: 26, color: 0xd9a07c },
      { r: 360, hMin: 12, hMax: 34, color: 0xe9bc92 },
      { r: 440, hMin: 16, hMax: 44, color: 0xf4d2a8 },
    ];
    for (const [li, L] of layers.entries()) {
      const n = 140;
      const pts = [];
      const idx = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * L.r, z = Math.sin(a) * L.r;
        const h = L.hMin + fbm(Math.cos(a) * 7 + li * 31, Math.sin(a) * 7, 3) * (L.hMax - L.hMin);
        pts.push(x, -6, z, x, h, z);
      }
      for (let i = 0; i < n; i++) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      g.setIndex(idx);
      const mesh = new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ color: L.color, side: THREE.DoubleSide, fog: false })
      );
      mesh.renderOrder = -2 - li;
      scene.add(mesh);
    }
  }

  // ---------- drifting dust, sparse ----------
  {
    const n = 180;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 200;
      pts[i * 3 + 1] = duneBase(pts[i * 3], (Math.random() - 0.5) * 200) + 2 + Math.random() * 12;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 200 - 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffe0b0, size: 0.12, transparent: true, opacity: 0.45 })
    );
    scene.add(dust);
    animated.push((t) => { dust.rotation.y = t * 0.004; });
  }

  // ---------- the DEON gate on the starting ridge ----------
  {
    const kit = new StoneKit(7);
    kit.column(-5.4, 0, 8.2, 0.8, 1);
    kit.column(5.4, 0, 8.2, 0.8, 1);
    const g = new THREE.Group();
    g.add(kit.build());
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(13, 2.4, 0.9),
      [...Array(6)].map((_, i) => i === 4
        ? new THREE.MeshStandardMaterial({ map: signTexture(SITE.name, { sub: SITE.tagline, bg: '#8a7458', fg: '#2e2418' }), roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ color: 0x9a8160, roughness: 0.9 }))
    );
    slab.position.y = 9.1;
    slab.rotation.z = -0.012;
    slab.castShadow = true;
    g.add(slab);
    const gp = PADS.find((p) => p.key === 'gate');
    g.position.set(gp.x, gp.y, gp.z);
    scene.add(g);
  }

  // ---------- the camp: fire, payphone, signpost ----------
  const campPad = PADS.find((p) => p.key === 'camp');
  const campY = campPad.y;

  {
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + Math.random() * 0.12, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x6e6056, roughness: 0.9 })
      );
      s.scale.y = 0.7;
      s.position.set(Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85);
      s.castShadow = true;
      g.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 1.1, 9),
        new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 })
      );
      log.rotation.set(Math.PI / 2.4, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.22;
      log.castShadow = true;
      g.add(log);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.95, 12),
      new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.92 })
    );
    flame.position.y = 0.7;
    const flameIn = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.6, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe09a, transparent: true, opacity: 0.95 })
    );
    flameIn.position.y = 0.62;
    const fireLight = new THREE.PointLight(0xff8c3a, 1.8, 14, 1.6);
    fireLight.position.y = 1;
    g.add(flame, flameIn, fireLight);
    animated.push((t) => {
      const f = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23 + 1) * 0.08;
      flame.scale.set(f, 1 + Math.sin(t * 17) * 0.18, f);
      flameIn.scale.copy(flame.scale);
      fireLight.intensity = 1.7 + Math.sin(t * 13) * 0.4;
    });
    g.position.set(-4, campY, 3);
    g.userData = { type: 'about', label: 'ABOUT — SIT DOWN' };
    scene.add(g);
    interactables.push(g);
  }

  {
    const g = new THREE.Group();
    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.6, metalness: o.m ?? 0 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.7), mat(0x3a5a56));
    body.position.y = 1.9;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 12), mat(0x33302c, { m: 0.6, r: 0.5 }));
    post.position.y = 0.7;
    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 1.1, 24, 1, false, 0, Math.PI),
      mat(0x2e4543)
    );
    hood.rotation.z = Math.PI / 2;
    hood.position.y = 3.15;
    const receiver = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 6, 12), mat(0x16161a, { r: 0.4 }));
    receiver.position.set(-0.42, 1.6, 0.3);
    const cord = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.3, 2.2, 0.32),
        new THREE.Vector3(-0.55, 1.6, 0.42),
        new THREE.Vector3(-0.42, 1.0, 0.3),
        new THREE.Vector3(-0.5, 0.2, 0.35),
      ]), 32, 0.025, 8),
      mat(0x16161a)
    );
    const signP = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.4),
      new THREE.MeshBasicMaterial({ map: signTexture('CONTACT', { bg: '#13201f', fg: '#bfe8d9' }), transparent: true })
    );
    signP.position.set(0, 2.6, 0.36);
    g.add(post, body, hood, receiver, cord, signP);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    g.rotation.y = -0.5;
    g.position.set(4.6, campY, 1.5);
    g.userData = { type: 'contact', label: 'CONTACT — PICK UP' };
    scene.add(g);
    interactables.push(g);
  }

  {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 4.6, 12),
      new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 })
    );
    post.position.y = 2.1;
    post.castShadow = true;
    g.add(post);
    SITE.socials.forEach((s, i) => {
      const arrow = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.5, 0.1),
        [...Array(6)].map((_, fi) => fi === 4
          ? new THREE.MeshStandardMaterial({ map: signTexture(s.label, { bg: '#241a12', fg: '#e0cfa8' }), roughness: 0.9 })
          : new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.9 }))
      );
      arrow.position.set(i % 2 ? 0.85 : -0.85, 3.7 - i * 0.75, 0);
      arrow.rotation.y = (i % 2 ? -1 : 1) * (0.3 + Math.random() * 0.4);
      arrow.castShadow = true;
      g.add(arrow);
    });
    g.rotation.z = 0.05;
    g.rotation.y = 0.7;
    g.position.set(7.5, campY, 6.5);
    g.userData = { type: 'socials', label: 'SIGNS — ELSEWHERE' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- the five ruins ----------
  const builders = {
    design: ruinDesign, music: ruinMusic, web: ruinWeb,
    video: ruinVideo, clothing: ruinClothing,
  };
  const structures = {};
  const approach = {};
  for (const pad of PADS) {
    if (!builders[pad.key]) continue;
    const cat = CATEGORIES[pad.key];
    const { group, door, outward } = builders[pad.key](cat);

    // each ruin faces back toward the camp
    const faceAngle = Math.atan2(0 - pad.x, 8 - pad.z);
    group.rotation.y = faceAngle - Math.atan2(outward.x, outward.z);
    group.position.set(pad.x, pad.y, pad.z);
    group.userData = { type: 'category', key: pad.key, label: cat.label };
    scene.add(group);
    interactables.push(group);
    structures[pad.key] = group;

    group.updateMatrixWorld(true);
    const dw = door.clone().applyMatrix4(group.matrixWorld);
    const outWorld = outward.clone().applyEuler(group.rotation).normalize();
    const ap = dw.clone().add(outWorld.clone().multiplyScalar(17));
    ap.y = duneHeight(ap.x, ap.z) + 3.1;
    approach[pad.key] = { pos: ap, look: new THREE.Vector3(dw.x, dw.y + 2.2, dw.z) };
  }

  // camp viewpoint: stand at the camp, look out over the dune sea
  const campView = {
    pos: new THREE.Vector3(0, campY + 2.6, 16),
    look: new THREE.Vector3(-6, campY + 1, -60),
  };

  return { scene, interactables, animated, structures, approach, campView, campY, duneHeight };
}
