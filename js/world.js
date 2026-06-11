// ============================================================
//  WORLD — the desert at dusk. Terrain, sky, sun, structures,
//  campfire, payphone, signs. All low-poly, all flat-shaded.
// ============================================================

import * as THREE from 'three';
import { CATEGORIES, SITE } from './data.js';
import { signTexture, skyTexture } from './textures.js';

const DUSK = {
  sky: 0x2b1b33,      // deep violet up top
  mid: 0x84394a,      // dusty rose
  sun: 0xd98a52,      // burnt orange at the horizon
  fog: 0x6e3a44,
  sand: 0x8a5e48,
  sandDark: 0x5e3d34,
};

// small random jitter on vertices = hand-built, "raw" silhouettes
function roughen(geo, amt = 0.06) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * amt,
      pos.getY(i) + (Math.random() - 0.5) * amt,
      pos.getZ(i) + (Math.random() - 0.5) * amt
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function woodMat(shade = 0) {
  const base = new THREE.Color(0x4a3526).offsetHSL(0, 0, shade);
  return new THREE.MeshLambertMaterial({ color: base, flatShading: true });
}

export function buildWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(DUSK.fog, 30, 110);

  const interactables = [];
  const animated = [];

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight(0x6b4a6e, 0x3a2420, 0.9));
  const sunLight = new THREE.DirectionalLight(0xe09a5e, 1.4);
  sunLight.position.set(-6, 8, -40);
  scene.add(sunLight);

  // ---------- sky + sun ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 24, 16),
    new THREE.MeshBasicMaterial({
      map: skyTexture(DUSK.sky, DUSK.mid, DUSK.sun),
      side: THREE.BackSide,
      fog: false,
    })
  );
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(22, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2b066, fog: false })
  );
  sun.position.set(-25, 9, -330);
  scene.add(sun);

  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(48, 32),
    new THREE.MeshBasicMaterial({ color: 0xd9764a, transparent: true, opacity: 0.35, fog: false })
  );
  sunGlow.position.set(-25, 9, -331);
  scene.add(sunGlow);

  // ---------- terrain ----------
  const ground = new THREE.Mesh(
    (() => {
      const g = new THREE.PlaneGeometry(420, 420, 90, 90);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const d = Math.sqrt(x * x + z * z);
        // dunes: gentle waves, flatter near the structures
        let y =
          Math.sin(x * 0.045) * Math.cos(z * 0.05) * 2.2 +
          Math.sin(x * 0.013 + 4) * 3.0 +
          (Math.random() - 0.5) * 0.35;
        y *= THREE.MathUtils.smoothstep(d, 8, 60);
        pos.setY(i, y);
      }
      g.computeVertexNormals();
      return g;
    })(),
    mat(DUSK.sand)
  );
  scene.add(ground);

  // ---------- floating dust ----------
  {
    const n = 320;
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 120;
      pts[i * 3 + 1] = Math.random() * 14;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xd9b08a, size: 0.14, transparent: true, opacity: 0.5 })
    );
    scene.add(dust);
    animated.push((t) => {
      dust.rotation.y = t * 0.008;
      dust.position.y = Math.sin(t * 0.2) * 0.4;
    });
  }

  // ---------- the DEON entrance sign ----------
  {
    const g = new THREE.Group();
    const post1 = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.35, 7.5, 0.35)), woodMat(-0.04));
    post1.position.set(-5.2, 3.4, 0);
    const post2 = post1.clone();
    post2.position.x = 5.2;
    post2.rotation.z = 0.03;
    const board = new THREE.Mesh(
      roughen(new THREE.BoxGeometry(11, 3.2, 0.25), 0.04),
      [woodMat(), woodMat(), woodMat(), woodMat(),
        new THREE.MeshLambertMaterial({ map: signTexture(SITE.name, { sub: SITE.tagline }) }),
        woodMat()]
    );
    board.position.y = 6.1;
    board.rotation.z = -0.015;
    g.add(post1, post2, board);
    // an entrance gate — the intro flight passes underneath it
    g.position.set(0, 0, 31);
    scene.add(g);
  }

  // ---------- structures (one per category) ----------
  const layout = [
    { key: 'design', x: -19, z: -6, ry: 0.5 },
    { key: 'music', x: -9.5, z: -13, ry: 0.22 },
    { key: 'web', x: 0.5, z: -16, ry: 0 },
    { key: 'video', x: 10.5, z: -13, ry: -0.22 },
    { key: 'clothing', x: 19.5, z: -6, ry: -0.5 },
  ];
  const builders = {
    design: buildDesignShack,
    music: buildMusicHut,
    web: buildWebStation,
    video: buildVideoDriveIn,
    clothing: buildClothingStall,
  };
  const structures = {};
  for (const { key, x, z, ry } of layout) {
    const cat = CATEGORIES[key];
    const g = builders[key](cat);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.userData = { type: 'category', key, label: cat.label };
    scene.add(g);
    interactables.push(g);
    structures[key] = g;
  }

  // ---------- campfire (ABOUT) ----------
  {
    const g = new THREE.Group();
    // ring of stones
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(roughen(new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.12, 0), 0.08), mat(0x4f443c));
      s.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
      g.add(s);
    }
    // logs
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5)), woodMat(-0.06));
      log.rotation.set(Math.PI / 2.4, (i / 4) * Math.PI * 2, 0);
      log.position.y = 0.22;
      g.add(log);
    }
    // flame: two overlapping cones that flicker
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.92 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 6), flameMat);
    flame.position.y = 0.7;
    const flameIn = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.6, 6),
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

    g.position.set(-7, 0, 6.5);
    g.userData = { type: 'about', label: 'ABOUT — SIT DOWN' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- payphone (CONTACT) ----------
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.9, 2.4, 0.7), 0.05), mat(0x35514f));
    body.position.y = 1.9;
    const postP = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), mat(0x2b2b2b));
    postP.position.y = 0.7;
    const hood = new THREE.Mesh(roughen(new THREE.BoxGeometry(1.2, 0.5, 1), 0.05), mat(0x2e4543));
    hood.position.y = 3.2;
    const receiver = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.16, 0.7, 0.22), 0.03), mat(0x181818));
    receiver.position.set(-0.38, 2.1, 0.38);
    const signP = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.42),
      new THREE.MeshLambertMaterial({ map: signTexture('CONTACT', { bg: '#13201f', fg: '#bfe8d9' }) })
    );
    signP.position.set(0, 2.55, 0.37);
    g.add(postP, body, hood, receiver, signP);
    g.rotation.y = -0.4;
    g.position.set(8.5, 0, 7);
    g.userData = { type: 'contact', label: 'CONTACT — PICK UP' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- leaning signpost (SOCIALS) ----------
  {
    const g = new THREE.Group();
    const post = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.22, 4.4, 0.22)), woodMat(-0.02));
    post.position.y = 2;
    g.add(post);
    SITE.socials.forEach((s, i) => {
      const arrow = new THREE.Mesh(
        roughen(new THREE.BoxGeometry(2.4, 0.5, 0.12), 0.03),
        [woodMat(), woodMat(), woodMat(), woodMat(),
          new THREE.MeshLambertMaterial({ map: signTexture(s.label, { bg: '#241a12', fg: '#e0cfa8' }) }),
          woodMat()]
      );
      arrow.position.set(i % 2 ? 0.9 : -0.9, 3.6 - i * 0.75, 0);
      arrow.rotation.y = (i % 2 ? -1 : 1) * (0.3 + Math.random() * 0.4);
      arrow.rotation.z = (Math.random() - 0.5) * 0.12;
      g.add(arrow);
    });
    g.rotation.z = 0.06;
    g.position.set(13, 0, 1.5);
    g.userData = { type: 'socials', label: 'SIGNS — ELSEWHERE' };
    scene.add(g);
    interactables.push(g);
  }

  // ---------- props: cacti + rocks ----------
  const cactusMat = mat(0x4a6b3f);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const h = 1 + Math.random() * 2.2;
    const trunk = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.18, 0.24, h, 6), 0.05), cactusMat);
    trunk.position.y = h / 2;
    g.add(trunk);
    if (Math.random() > 0.4) {
      const arm = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.12, 0.14, h * 0.45, 5), 0.04), cactusMat);
      arm.position.set(0.32, h * 0.55, 0);
      arm.rotation.z = -0.8;
      g.add(arm);
    }
    const a = Math.random() * Math.PI * 2;
    const r = 26 + Math.random() * 70;
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 10);
    scene.add(g);
  }
  for (let i = 0; i < 30; i++) {
    const rock = new THREE.Mesh(
      roughen(new THREE.DodecahedronGeometry(0.3 + Math.random() * 1.1, 0), 0.15),
      mat(Math.random() > 0.5 ? 0x6b5347 : 0x57453c)
    );
    const a = Math.random() * Math.PI * 2;
    const r = 12 + Math.random() * 80;
    rock.position.set(Math.cos(a) * r, 0.15, Math.sin(a) * r - 8);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(rock);
  }

  return { scene, interactables, animated, structures, dusk: DUSK };
}

// ============================================================
//  STRUCTURE BUILDERS — each category gets its own silhouette
// ============================================================

function structureSign(text, glow, w = 4.6) {
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.24),
    new THREE.MeshBasicMaterial({
      map: signTexture(text, { bg: '#16100c', fg: '#' + new THREE.Color(glow).getHexString() }),
      transparent: true,
    })
  );
  return s;
}

// DESIGN — slanted plank shack with poster boards out front
function buildDesignShack(cat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roughen(new THREE.BoxGeometry(6, 4.2, 5), 0.12), woodMat());
  body.position.y = 2.1;
  const roof = new THREE.Mesh(roughen(new THREE.BoxGeometry(7, 0.3, 6), 0.1), woodMat(-0.07));
  roof.position.set(0.2, 4.5, 0);
  roof.rotation.z = 0.12;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), new THREE.MeshBasicMaterial({ color: 0x0b0705 }));
  door.position.set(0, 1.3, 2.51);
  // poster boards leaning on the wall
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(
      roughen(new THREE.BoxGeometry(1.5, 2.1, 0.08), 0.03),
      mat([0xa8657a, 0x7a5a8c, 0xb08a5e][i])
    );
    p.position.set(-2.2 + i * 1.1, 1.05, 2.7 + i * 0.12);
    p.rotation.x = -0.12;
    p.rotation.z = (Math.random() - 0.5) * 0.1;
    g.add(p);
  }
  const sign = structureSign(cat.short, cat.palette.glow);
  sign.position.set(0, 5.4, 2.6);
  g.add(body, roof, door, sign);
  return g;
}

// MUSIC — round hut with a crooked antenna and a horn speaker
function buildMusicHut(cat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roughen(new THREE.CylinderGeometry(2.8, 3.1, 3.8, 8), 0.1), mat(0x5c4a63));
  body.position.y = 1.9;
  const roofM = new THREE.Mesh(roughen(new THREE.ConeGeometry(3.6, 2, 8), 0.12), mat(0x3d3147));
  roofM.position.y = 4.8;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshBasicMaterial({ color: 0x0b0705 }));
  door.position.set(0, 1.2, 3.06);
  // antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 4), mat(0x222222));
  ant.position.set(0.8, 7.2, 0);
  ant.rotation.z = -0.18;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff5a4a }));
  tip.position.set(1.1, 8.9, 0);
  // horn speaker
  const horn = new THREE.Mesh(roughen(new THREE.ConeGeometry(0.5, 1, 7), 0.04), mat(0x8a8a82));
  horn.rotation.x = Math.PI / 2.4;
  horn.position.set(-1.8, 4.6, 1.6);
  const sign = structureSign(cat.short, cat.palette.glow);
  sign.position.set(0, 6.2, 2.4);
  g.add(body, roofM, door, ant, tip, horn, sign);
  return g;
}

// WEB — boxy station with a big satellite dish
function buildWebStation(cat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roughen(new THREE.BoxGeometry(5.4, 3.4, 4.6), 0.1), mat(0x4a5e5c));
  body.position.y = 1.7;
  const upper = new THREE.Mesh(roughen(new THREE.BoxGeometry(3.4, 1.8, 3.2), 0.08), mat(0x3c4d4b));
  upper.position.set(-0.6, 4.2, 0);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), new THREE.MeshBasicMaterial({ color: 0x0b0705 }));
  door.position.set(0.4, 1.25, 2.31);
  // dish
  const dish = new THREE.Mesh(
    roughen(new THREE.SphereGeometry(1.6, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), 0.05),
    new THREE.MeshLambertMaterial({ color: 0x9aa8a0, flatShading: true, side: THREE.DoubleSide })
  );
  dish.position.set(1.6, 5.6, -0.4);
  dish.rotation.set(-0.9, 0.4, 0.3);
  const dishPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 5), mat(0x2b2b2b));
  dishPole.position.set(1.6, 4.4, -0.4);
  // small glowing window
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.7), new THREE.MeshBasicMaterial({ color: cat.palette.glow }));
  win.position.set(-1.6, 2.4, 2.31);
  const sign = structureSign(cat.short, cat.palette.glow, 3.4);
  sign.position.set(0, 5.9, 2.3);
  g.add(body, upper, door, dish, dishPole, win, sign);
  return g;
}

// VIDEO — mini drive-in: hut + big tilted screen
function buildVideoDriveIn(cat) {
  const g = new THREE.Group();
  const hut = new THREE.Mesh(roughen(new THREE.BoxGeometry(3.6, 2.8, 3.4), 0.1), mat(0x6e4438));
  hut.position.set(1.4, 1.4, 1);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), new THREE.MeshBasicMaterial({ color: 0x0b0705 }));
  door.position.set(1.4, 1.1, 2.71);
  // screen
  const frame = new THREE.Mesh(roughen(new THREE.BoxGeometry(6.4, 4, 0.3), 0.06), mat(0x2e2622));
  frame.position.set(-1.4, 4.4, -1);
  frame.rotation.y = 0.16;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xcfc3ae })
  );
  screen.position.set(-1.37, 4.4, -0.82);
  screen.rotation.y = 0.16;
  // screen "static" flicker
  const flicker = screen.material;
  screen.onBeforeRender = () => {
    flicker.color.setScalar(0.72 + Math.random() * 0.18);
  };
  const legs = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.25, 2.6, 0.25)), woodMat(-0.05));
  legs.position.set(-3.8, 1.3, -1.3);
  const legs2 = legs.clone();
  legs2.position.x = 1;
  const sign = structureSign(cat.short, cat.palette.glow, 3.6);
  sign.position.set(-1.3, 6.9, -0.7);
  sign.rotation.y = 0.16;
  g.add(hut, door, frame, screen, legs, legs2, sign);
  return g;
}

// CLOTHING — open market stall with awning and hanging pieces
function buildClothingStall(cat) {
  const g = new THREE.Group();
  const back = new THREE.Mesh(roughen(new THREE.BoxGeometry(6, 3.6, 0.3), 0.1), woodMat());
  back.position.set(0, 1.8, -1.6);
  const side1 = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.3, 3.6, 3.4), 0.08), woodMat(-0.03));
  side1.position.set(-2.9, 1.8, 0);
  const side2 = side1.clone();
  side2.position.x = 2.9;
  // striped awning
  const awning = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.08, 3.6),
      mat(i % 2 ? 0xc2a065 : 0x8a4a3a)
    );
    strip.position.x = -2.65 + i * 1.06;
    awning.add(strip);
  }
  awning.position.set(0, 3.9, 0.6);
  awning.rotation.x = 0.18;
  // hanging rail + garments
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.4, 5), mat(0x2b2b2b));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 2.9, 0.3);
  g.add(back, side1, side2, awning, rail);
  const colors = [0xb09a6e, 0x6e5a8a, 0x4a6b5e, 0x8a3f38];
  for (let i = 0; i < 4; i++) {
    const piece = new THREE.Group();
    const torso = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.85, 1.2, 0.12), 0.04), mat(colors[i]));
    torso.position.y = -0.75;
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.05), mat(0x222222));
    hanger.position.y = -0.1;
    piece.add(torso, hanger);
    piece.position.set(-1.8 + i * 1.2, 2.9, 0.3);
    piece.rotation.y = (Math.random() - 0.5) * 0.4;
    g.add(piece);
  }
  const sign = structureSign(cat.short, cat.palette.glow);
  sign.position.set(0, 4.9, 1.4);
  g.add(sign);
  return g;
}
