// ============================================================
//  WORLD — a vast surreal plain at dusk. Hodas × Dalí:
//  monumental half-buried objects, melting forms, long shadows,
//  a long-legged elephant on the horizon.
// ============================================================

import * as THREE from 'three';
import { CATEGORIES, SITE } from './data.js';
import { signTexture, skyTexture, vinylTexture, clockTexture, makeSunSprite } from './textures.js';

const DUSK = {
  skyTop: 0x1d2a44,   // deep dusk blue
  skyMid: 0x8a4a5e,   // dusty rose
  skySun: 0xe8a868,   // glowing amber horizon
  fog: 0xb07a62,
  sand: 0xc29270,
  sun: 0xffd9a0,
};

function smoothMat(color, { rough = 0.85, metal = 0.0, emissive = 0x000000, ei = 0 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal,
    emissive, emissiveIntensity: ei,
  });
}

function shadowify(root) {
  root.traverse((m) => {
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  return root;
}

// fold everything past `edge` (local +x) around a cylinder of
// radius r — the universal "melt over an edge" move
function drape(geo, edge, r, maxAngle = Math.PI * 0.92) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x <= edge) continue;
    const s = x - edge;
    const a = Math.min(s / r, maxAngle);
    const extra = Math.max(0, s - r * maxAngle);
    const nx = edge + Math.sin(a) * r + Math.cos(a) * extra;
    const ny = y - (1 - Math.cos(a)) * r - Math.sin(a) * extra;
    pos.setXYZ(i, nx, ny, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// drooping melt-drips along the bottom of something
function addDrips(group, { y, xSpread, z, color, count = 6, scale = 1 }) {
  for (let i = 0; i < count; i++) {
    const len = (0.5 + Math.random() * 1.6) * scale;
    const drip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02 * scale, (0.1 + Math.random() * 0.12) * scale, len, 10, 1),
      smoothMat(color, { rough: 0.6 })
    );
    const x = (Math.random() - 0.5) * xSpread;
    drip.position.set(x, y - len / 2, z + (Math.random() - 0.5) * 0.2);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 10, 10), drip.material);
    tip.position.set(x, y - len, drip.position.z);
    group.add(drip, tip);
  }
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(DUSK.fog, 60, 230);

  const interactables = [];
  const animated = [];

  // ---------- light: low sun, very long shadows ----------
  scene.add(new THREE.HemisphereLight(0x9a7a9e, 0x6e4a3a, 0.55));
  const sunLight = new THREE.DirectionalLight(0xffc890, 1.9);
  sunLight.position.set(-55, 16, -38);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -45;
  sunLight.shadow.camera.right = 45;
  sunLight.shadow.camera.top = 45;
  sunLight.shadow.camera.bottom = -45;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0xffd9b0, 0.18));

  // ---------- sky + sun ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 48, 32),
    new THREE.MeshBasicMaterial({
      map: skyTexture(DUSK.skyTop, DUSK.skyMid, DUSK.skySun),
      side: THREE.BackSide,
      fog: false,
    })
  );
  scene.add(sky);

  const sun = makeSunSprite();
  sun.position.set(-48, 16, -340);
  scene.add(sun);

  // ---------- the plain: vast, nearly flat, Dalí-empty ----------
  const ground = new THREE.Mesh(
    (() => {
      const g = new THREE.PlaneGeometry(800, 800, 128, 128);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const d = Math.sqrt(x * x + z * z);
        // gentle dunes only far away; near field stays a clean stage
        let y = (Math.sin(x * 0.02) * Math.cos(z * 0.017) * 3 + Math.sin(x * 0.006 + 2) * 4);
        y *= THREE.MathUtils.smoothstep(d, 70, 220);
        pos.setY(i, y);
      }
      g.computeVertexNormals();
      return g;
    })(),
    smoothMat(DUSK.sand, { rough: 0.95 })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- floating dust motes ----------
  {
    const n = 260;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 130;
      pts[i * 3 + 1] = Math.random() * 16;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 130;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffd9a8, size: 0.1, transparent: true, opacity: 0.4 })
    );
    scene.add(dust);
    animated.push((t) => { dust.rotation.y = t * 0.006; });
  }

  // ---------- DEON gate: two monoliths + a floating slab ----------
  {
    const g = new THREE.Group();
    const stone = smoothMat(0x6e5a52, { rough: 0.9 });
    const mono1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.8, 2, 8, 2), stone);
    mono1.position.set(-6.5, 4.5, 0);
    mono1.rotation.z = 0.02;
    const mono2 = mono1.clone();
    mono2.position.x = 6.5;
    mono2.rotation.z = -0.03;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 2.6, 0.5),
      [stone, stone, stone, stone,
        new THREE.MeshStandardMaterial({ map: signTexture(SITE.name, { sub: SITE.tagline, bg: '#4a3c35', fg: '#f2e6c8' }), roughness: 0.85 }),
        stone]
    );
    slab.position.y = 10.6; // floats clear of the monoliths
    shadowify(g.add(mono1, mono2, slab));
    g.position.set(0, 0, 31);
    scene.add(g);
    animated.push((t) => {
      slab.position.y = 10.6 + Math.sin(t * 0.5) * 0.25;
      slab.rotation.z = Math.sin(t * 0.3) * 0.012;
    });
  }

  // ---------- monuments (one per category) ----------
  const layout = [
    { key: 'design', x: -20, z: -7, ry: 0.45 },
    { key: 'music', x: -10, z: -14, ry: 0.2 },
    { key: 'web', x: 0.5, z: -17, ry: 0 },
    { key: 'video', x: 11, z: -14, ry: -0.2 },
    { key: 'clothing', x: 20.5, z: -7, ry: -0.45 },
  ];
  const builders = {
    design: buildMeltingFrame,
    music: buildDrapedVinyl,
    web: buildBuriedCRT,
    video: buildVHSMonolith,
    clothing: buildFloatingGarment,
  };
  const structures = {};
  for (const { key, x, z, ry } of layout) {
    const cat = CATEGORIES[key];
    const g = builders[key](cat, animated);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.userData = { type: 'category', key, label: cat.label };
    shadowify(g);
    scene.add(g);
    interactables.push(g);
    structures[key] = g;
  }

  // ---------- campfire (ABOUT) ----------
  {
    const g = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + Math.random() * 0.12, 12, 10),
        smoothMat(0x5e544c)
      );
      s.scale.y = 0.7;
      s.position.set(Math.cos(a) * 0.85, 0.1, Math.sin(a) * 0.85);
      g.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 9), smoothMat(0x4a3526));
      log.rotation.set(Math.PI / 2.4, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.22;
      g.add(log);
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.92 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.95, 12), flameMat);
    flame.position.y = 0.7;
    const flameIn = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.6, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe09a, transparent: true, opacity: 0.95 })
    );
    flameIn.position.y = 0.62;
    g.add(flame, flameIn);
    const fireLight = new THREE.PointLight(0xff8c3a, 2.2, 16, 1.6);
    fireLight.position.y = 1;
    g.add(fireLight);
    animated.push((t) => {
      const f = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23 + 1) * 0.08;
      flame.scale.set(f, 1 + Math.sin(t * 17) * 0.18, f);
      flameIn.scale.copy(flame.scale);
      fireLight.intensity = 2 + Math.sin(t * 13) * 0.5 + Math.sin(t * 29) * 0.25;
    });
    shadowify(g);
    g.position.set(-7.5, 0, 6.5);
    g.userData = { type: 'about', label: 'ABOUT — SIT DOWN' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- payphone (CONTACT), decayed and slightly melting ----------
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 0.7, 2, 4, 2), smoothMat(0x3a5a56, { rough: 0.55 }));
    body.position.y = 1.9;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 12), smoothMat(0x33302c, { rough: 0.5, metal: 0.6 }));
    post.position.y = 0.7;
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.1, 24, 1, false, 0, Math.PI), smoothMat(0x2e4543, { rough: 0.5 }));
    hood.rotation.z = Math.PI / 2;
    hood.position.y = 3.15;
    const receiver = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.5, 6, 12), smoothMat(0x16161a, { rough: 0.4 }));
    receiver.position.set(-0.42, 1.6, 0.3);
    // the cord hangs all the way to the sand, unhooked
    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.3, 2.2, 0.32),
      new THREE.Vector3(-0.55, 1.6, 0.42),
      new THREE.Vector3(-0.42, 1.0, 0.3),
      new THREE.Vector3(-0.5, 0.2, 0.35),
    ]);
    const cord = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 32, 0.025, 8), smoothMat(0x16161a));
    const signP = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.4),
      new THREE.MeshBasicMaterial({ map: signTexture('CONTACT', { bg: '#13201f', fg: '#bfe8d9' }), transparent: true })
    );
    signP.position.set(0, 2.6, 0.36);
    g.add(post, body, hood, receiver, cord, signP);
    addDrips(g, { y: 0.85, xSpread: 0.7, z: 0.3, color: 0x3a5a56, count: 4, scale: 0.8 });
    shadowify(g);
    g.rotation.y = -0.4;
    g.position.set(9, 0, 7);
    g.userData = { type: 'contact', label: 'CONTACT — PICK UP' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- signpost (SOCIALS) ----------
  {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 12), smoothMat(0x4a3526));
    post.position.y = 2.1;
    g.add(post);
    SITE.socials.forEach((s, i) => {
      const arrow = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.5, 0.1),
        [smoothMat(0x3a2c20), smoothMat(0x3a2c20), smoothMat(0x3a2c20), smoothMat(0x3a2c20),
          new THREE.MeshStandardMaterial({ map: signTexture(s.label, { bg: '#241a12', fg: '#e0cfa8' }), roughness: 0.9 }),
          smoothMat(0x3a2c20)]
      );
      arrow.position.set(i % 2 ? 0.85 : -0.85, 3.7 - i * 0.75, 0);
      arrow.rotation.y = (i % 2 ? -1 : 1) * (0.3 + Math.random() * 0.4);
      arrow.rotation.z = (Math.random() - 0.5) * 0.1;
      g.add(arrow);
    });
    shadowify(g);
    g.rotation.z = 0.05;
    g.position.set(13.5, 0, 1.5);
    g.userData = { type: 'socials', label: 'SIGNS — ELSEWHERE' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- Dalí furniture: elephants, melting clock, floaters ----------
  scene.add(longLeggedElephant(-70, -120, 1.3));
  scene.add(longLeggedElephant(55, -150, 1.7));

  // dead tree with a clock melting over its branch
  {
    const g = new THREE.Group();
    const bark = smoothMat(0x4a3a2c, { rough: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 4.2, 10), bark);
    trunk.position.y = 2;
    trunk.rotation.z = 0.08;
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3, 9), bark);
    branch.rotation.z = Math.PI / 2.25;
    branch.position.set(1.2, 3.4, 0);
    const branch2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.8, 8), bark);
    branch2.rotation.z = Math.PI / 3.2;
    branch2.position.set(-0.8, 3.9, 0.2);
    g.add(trunk, branch, branch2);

    const clock = new THREE.Mesh(
      drape(new THREE.PlaneGeometry(2.6, 2.6, 48, 48).rotateX(-Math.PI / 2), 0.25, 0.42),
      new THREE.MeshStandardMaterial({
        map: clockTexture(), side: THREE.DoubleSide,
        transparent: true, alphaTest: 0.4, roughness: 0.6,
      })
    );
    clock.position.set(1.4, 3.62, 0);
    clock.rotation.y = 0.3;
    g.add(clock);
    addDrips(g, { y: 2.6, xSpread: 0.5, z: 0.4, color: 0xe8ddc2, count: 3, scale: 0.6 });
    shadowify(g);
    g.position.set(-13.5, 0, 3);
    g.rotation.y = 0.4;
    scene.add(g);
  }

  // floating stones, slowly breathing up and down
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4 + Math.random() * 0.9, 1),
      smoothMat(0x7a665c, { rough: 0.9 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 45;
    const baseY = 1.5 + Math.random() * 4;
    rock.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r - 12);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    rock.castShadow = true;
    scene.add(rock);
    const phase = Math.random() * 10, speed = 0.3 + Math.random() * 0.4;
    animated.push((t) => {
      rock.position.y = baseY + Math.sin(t * speed + phase) * 0.5;
      rock.rotation.y = t * 0.05 + phase;
    });
  }

  // a couple of giant half-buried spheres far off — quiet landmarks
  for (const [x, z, s] of [[-45, -60, 6], [38, -75, 9]]) {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(s, 32, 24), smoothMat(0x8a6e62, { rough: 0.7 }));
    orb.position.set(x, s * 0.35, z);
    orb.castShadow = true;
    scene.add(orb);
  }

  return { scene, interactables, animated, structures, dusk: DUSK };
}

// ============================================================
//  MONUMENTS
// ============================================================

function labelSign(text, glow, w = 4.6) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.24),
    new THREE.MeshBasicMaterial({
      map: signTexture(text, { bg: '#16100c', fg: '#' + new THREE.Color(glow).getHexString() }),
      transparent: true,
    })
  );
}

// DESIGN — a giant ornate frame standing in the sand, holding a
// dream, its gilding melting off the bottom edge
function buildMeltingFrame(cat, animated) {
  const g = new THREE.Group();
  const gold = smoothMat(0xb8924e, { rough: 0.35, metal: 0.7 });
  const W = 5.4, H = 6.6, T = 0.42;

  const top = new THREE.Mesh(new THREE.BoxGeometry(W + T * 2, T, T, 4, 2, 2), gold);
  top.position.y = H;
  const bottom = top.clone();
  bottom.position.y = H - H + 1.2; // bottom rail floats above the sand
  bottom.position.y = 1.2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(T, H - 1.2 + T, T, 2, 6, 2), gold);
  left.position.set(-W / 2 - T / 2, (H + 1.2) / 2, 0);
  const right = left.clone();
  right.position.x = W / 2 + T / 2;

  // inside the frame: another sky — a hole in the world
  const dream = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H - 1.2),
    new THREE.MeshBasicMaterial({ map: skyTexture(0x2a3c5e, cat.palette.fog, cat.palette.glow), side: THREE.DoubleSide })
  );
  dream.position.y = (H + 1.2) / 2;

  // ornament knobs along the frame
  for (let i = 0; i < 8; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), gold);
    knob.position.set(-W / 2 + (i / 7) * W, H + T / 2, T / 2);
    g.add(knob);
  }

  addDrips(g, { y: 1.2, xSpread: W, z: 0, color: 0xb8924e, count: 7, scale: 1.1 });

  const sign = labelSign(cat.short, cat.palette.glow);
  sign.position.set(0, H + 1.6, 0.3);
  g.add(top, bottom, left, right, dream, sign);
  g.rotation.y = 0.05;
  animated.push((t) => { dream.material.map.offset.x = t * 0.0035; });
  return g;
}

// MUSIC — a colossal vinyl record gone soft, draped over a stone cube
function buildDrapedVinyl(cat, animated) {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4, 3, 3, 3), smoothMat(0x6e5a52, { rough: 0.9 }));
  cube.position.y = 1.7;
  cube.rotation.y = 0.3;

  const record = new THREE.Mesh(
    drape(new THREE.PlaneGeometry(7.4, 7.4, 64, 64).rotateX(-Math.PI / 2), 1.7, 0.9),
    new THREE.MeshStandardMaterial({
      map: vinylTexture(cat.short, cat.palette.glow),
      side: THREE.DoubleSide, transparent: true, alphaTest: 0.4,
      roughness: 0.35, metalness: 0.1,
    })
  );
  record.position.y = 3.48;
  record.rotation.y = -Math.PI / 2 + 0.45; // melt fold hangs toward the viewer

  // a floating tonearm hovering over the groove, slowly circling
  const armG = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), smoothMat(0xd8cdb6, { rough: 0.3, metal: 0.8 }));
  arm.rotation.z = Math.PI / 2;
  arm.position.x = 1.3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.18), smoothMat(0x222226, { rough: 0.4 }));
  head.position.x = 2.6;
  armG.add(arm, head);
  armG.position.y = 4.4;
  g.add(cube, record, armG);

  addDrips(g, { y: 1.1, xSpread: 3, z: 1.6, color: 0x111014, count: 5, scale: 0.9 });

  const sign = labelSign(cat.short, cat.palette.glow);
  sign.position.set(0, 6.4, 0);
  g.add(sign);

  animated.push((t) => {
    armG.rotation.y = t * 0.25;
    armG.position.y = 4.4 + Math.sin(t * 0.7) * 0.12;
  });
  return g;
}

// WEB — a giant CRT monitor half-swallowed by the desert, still on
function buildBuriedCRT(cat, animated) {
  const g = new THREE.Group();
  const shellMat = smoothMat(0xc9bca4, { rough: 0.6 });
  const crt = new THREE.Group();

  const shell = new THREE.Mesh(new THREE.BoxGeometry(6.2, 4.8, 4.6, 4, 4, 4), shellMat);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 1.4, 24), shellMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -2.8;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.2, 0.3, 2, 2, 1), smoothMat(0xb0a48c, { rough: 0.7 }));
  bezel.position.z = 2.35;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 3.5),
    new THREE.MeshBasicMaterial({ color: cat.palette.glow })
  );
  screen.position.z = 2.52;
  const screenGlow = new THREE.PointLight(cat.palette.glow, 1.6, 12, 1.6);
  screenGlow.position.set(0, 0, 4);
  crt.add(shell, tube, bezel, screen, screenGlow);

  // half-buried, tilted back like it crashed long ago
  crt.position.y = 1.5;
  crt.rotation.set(-0.18, 0.12, 0.07);
  g.add(crt);

  // sand piled against it
  const pile = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), smoothMat(0xc29270, { rough: 0.95 }));
  pile.scale.set(1.6, 0.4, 1);
  pile.position.set(-2, 0.1, 1.8);
  g.add(pile);

  // a cable snaking away into the sand
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(3, 0.6, 1),
      new THREE.Vector3(4.4, 0.2, 2.4),
      new THREE.Vector3(5.6, 0.05, 1.6),
      new THREE.Vector3(6.8, 0.0, 2.8),
    ]), 48, 0.09, 10),
    smoothMat(0x222226, { rough: 0.5 })
  );
  g.add(cable);

  const sign = labelSign(cat.short, cat.palette.glow, 3.4);
  sign.position.set(0, 5.4, 1.5);
  g.add(sign);

  animated.push((t) => {
    // the screen breathes and occasionally drops a frame
    const flick = 0.78 + Math.sin(t * 2.2) * 0.1 + (Math.random() > 0.99 ? -0.4 : 0);
    screen.material.color.setHex(cat.palette.glow);
    screen.material.color.multiplyScalar(flick);
    screenGlow.intensity = 1.3 + flick * 0.6;
  });
  return g;
}

// VIDEO — a monumental VHS tape, corner sunk in the sand,
// film ribbon spilling out and floating off
function buildVHSMonolith(cat, animated) {
  const g = new THREE.Group();
  const bodyMat = smoothMat(0x1c1a1e, { rough: 0.45 });

  const tape = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 4.2, 1.5, 4, 3, 2), bodyMat);
  // label stripe
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.5),
    new THREE.MeshStandardMaterial({
      map: signTexture(cat.short, { bg: '#ddd2b8', fg: '#1c1a1e' }), roughness: 0.8,
    })
  );
  label.position.set(0, 0.9, 0.78);
  // reel windows
  for (const x of [-1.8, 1.8]) {
    const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 32), smoothMat(0x0c0b0d, { rough: 0.3 }));
    reel.rotation.x = Math.PI / 2;
    reel.position.set(x, -0.7, 0.72);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.24, 16), smoothMat(0xd8cdb6, { rough: 0.4 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, -0.7, 0.74);
    tape.add(reel, hub);
  }
  tape.add(body, label);
  tape.position.y = 2.6;
  tape.rotation.set(0.04, -0.15, -0.38); // one corner driven into the sand
  g.add(tape);

  // unspooled film, drifting up like it's weightless
  const ribbonMat = smoothMat(0x141217, { rough: 0.3, metal: 0.4 });
  const curves = [
    [[-2.6, 1.2, 0.6], [-4, 0.4, 1.6], [-5.2, 1.8, 0.8], [-6, 4, 1.6], [-5.4, 6.5, 0.4]],
    [[-2.2, 1.0, 0.9], [-3.4, 0.2, 2.2], [-2.8, 1.4, 3.2], [-3.6, 3.4, 3.8]],
  ];
  const ribbons = curves.map((pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const r = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.085, 10), ribbonMat);
    r.scale.y = 1;
    g.add(r);
    return r;
  });

  const sign = labelSign(cat.short, cat.palette.glow, 3.6);
  sign.position.set(0, 6.2, 0.5);
  g.add(sign);

  animated.push((t) => {
    ribbons.forEach((r, i) => {
      r.position.y = Math.sin(t * 0.5 + i * 2) * 0.18;
      r.rotation.y = Math.sin(t * 0.22 + i) * 0.05;
    });
  });
  return g;
}

// CLOTHING — a giant hanger floating mid-air, the garment on it
// draping all the way down and melting into the sand
function buildFloatingGarment(cat, animated) {
  const g = new THREE.Group();

  // hanger: bar + hook
  const metal = smoothMat(0xd8cdb6, { rough: 0.25, metal: 0.85 });
  const hangerG = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 12), metal);
  bar.rotation.z = Math.PI / 2;
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.7, 0),
    new THREE.Vector3(0.05, 1.1, 0),
    new THREE.Vector3(0.4, 1.3, 0),
    new THREE.Vector3(0.7, 1.05, 0),
  ]);
  const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 24, 0.06, 10), metal);
  hangerG.add(bar, hook);
  hangerG.position.y = 7.2;

  // the cloth: a long plane with soft folds, tapered at the top
  const clothGeo = new THREE.PlaneGeometry(4.4, 6.8, 48, 64);
  {
    const pos = clothGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const v = (y + 3.4) / 6.8; // 0 bottom → 1 top
      const taper = THREE.MathUtils.lerp(1, 0.45, v * v);
      const folds =
        Math.sin(x * 2.6 + v * 3) * 0.22 * (1 - v) +
        Math.sin(x * 5.2 + 1.7) * 0.1 * (1 - v);
      pos.setXYZ(i, x * taper, y, folds);
    }
    clothGeo.computeVertexNormals();
  }
  const cloth = new THREE.Mesh(
    clothGeo,
    smoothMat(0x8a4a3a, { rough: 0.85 })
  );
  cloth.material.side = THREE.DoubleSide;
  cloth.position.y = 3.75;

  // the hem melts into pools on the sand
  for (let i = 0; i < 4; i++) {
    const pool = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 18, 12), smoothMat(0x8a4a3a, { rough: 0.7 }));
    pool.scale.y = 0.12;
    pool.position.set((Math.random() - 0.5) * 3.4, 0.05, (Math.random() - 0.5) * 1);
    g.add(pool);
  }
  addDrips(g, { y: 0.7, xSpread: 3.6, z: 0.2, color: 0x8a4a3a, count: 5, scale: 0.8 });

  g.add(hangerG, cloth);

  const sign = labelSign(cat.short, cat.palette.glow);
  sign.position.set(0, 9.2, 0);
  g.add(sign);

  animated.push((t) => {
    const bob = Math.sin(t * 0.55) * 0.18;
    hangerG.position.y = 7.2 + bob;
    cloth.position.y = 3.75 + bob;
    hangerG.rotation.y = Math.sin(t * 0.3) * 0.06;
    cloth.rotation.y = Math.sin(t * 0.3) * 0.06;
  });
  return g;
}

// the Dalí elephant: tiny body, impossibly long spindle legs,
// an obelisk on its back — far away, half-dissolved in haze
function longLeggedElephant(x, z, scale = 1.5) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2024, roughness: 0.95 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), dark);
  body.scale.set(1.5, 1, 0.9);
  body.position.y = 16;

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), dark);
  head.position.set(3.4, 16.6, 0);
  const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), dark);
  ear.scale.set(0.25, 1.1, 0.9);
  ear.position.set(2.9, 16.8, 0);

  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.3, 16.4, 0),
    new THREE.Vector3(5.2, 15.2, 0.2),
    new THREE.Vector3(5.0, 13.6, 0),
    new THREE.Vector3(5.6, 12.4, -0.2),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 24, 0.32, 8), dark);

  // four spindly, knee-bent legs
  for (const [lx, lz] of [[-1.6, 0.6], [1.6, 0.6], [-1.6, -0.6], [1.6, -0.6]]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 8.4, 8), dark);
    upper.position.set(lx, 11, lz);
    upper.rotation.z = (Math.random() - 0.5) * 0.06;
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 7, 8), dark);
    lower.position.set(lx + (Math.random() - 0.5) * 0.6, 3.4, lz);
    lower.rotation.z = (Math.random() - 0.5) * 0.1;
    g.add(upper, lower);
  }

  const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.6, 4), dark);
  obelisk.position.y = 19.6;
  obelisk.rotation.y = Math.PI / 4;

  g.add(body, head, ear, trunk, obelisk);
  g.scale.setScalar(scale);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}
