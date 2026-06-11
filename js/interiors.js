// ============================================================
//  INTERIORS — stepping into a monument drops you onto an
//  infinite dream-plain in that category's palette. The works
//  float mid-air, casting long shadows on empty ground.
// ============================================================

import * as THREE from 'three';
import { placeholderArt, signTexture, skyTexture, makeSunSprite } from './textures.js';
import { SHADOW_SIZE } from './quality.js';

function smoothMat(color, { rough = 0.85, metal = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

export function buildInterior(key, cat) {
  const scene = new THREE.Scene();
  const p = cat.palette;
  scene.fog = new THREE.Fog(p.fog, 40, 160);

  const interactables = [];
  const animated = [];

  // sky in this world's colors
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(300, 48, 32),
    new THREE.MeshBasicMaterial({
      map: skyTexture(p.sky, p.fog, p.glow),
      side: THREE.BackSide, fog: false,
    })
  );
  scene.add(sky);

  // its own low sun, tinted to the room's palette
  const glowCss = '#' + p.glow.toString(16).padStart(6, '0');
  const sun = makeSunSprite('#fff4e0', glowCss, 110);
  sun.position.set(30, 14, -240);
  scene.add(sun);

  // endless ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600, 32, 32).rotateX(-Math.PI / 2),
    smoothMat(p.floor, { rough: 0.95 })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // light: long shadows here too
  scene.add(new THREE.HemisphereLight(p.glow, p.floor, 0.5));
  scene.add(new THREE.AmbientLight(p.glow, 0.25));
  const dir = new THREE.DirectionalLight(0xffe0b8, 1.5);
  dir.position.set(25, 14, -30);
  dir.castShadow = true;
  dir.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE);
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.camera.far = 120;
  dir.shadow.bias = -0.0008;
  scene.add(dir);

  // the way back: a freestanding doorway behind you, dusk pouring through
  {
    const doorway = new THREE.Group();
    const stone = smoothMat(0x6e5a52, { rough: 0.9 });
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), stone);
    l.position.x = -1.3;
    const r = l.clone();
    r.position.x = 1.3;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.6), stone);
    lintel.position.y = 2.4;
    const dusk = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 4.2),
      new THREE.MeshBasicMaterial({ color: 0xe8a868, fog: false })
    );
    dusk.rotation.y = Math.PI;
    dusk.position.y = 0.1;
    const exitSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.4),
      new THREE.MeshBasicMaterial({ map: signTexture('OUT →', { bg: '#0d0a08', fg: '#e8d9b8' }), transparent: true })
    );
    exitSign.rotation.y = Math.PI;
    exitSign.position.set(0, 2.9, -0.1);
    doorway.add(l, r, lintel, dusk, exitSign);
    doorway.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    doorway.position.set(0, 2.1, 9);
    doorway.userData = { type: 'exit', label: 'BACK OUT' };
    scene.add(doorway);
    interactables.push(doorway);
  }

  // category title floating high, like skywriting
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.3),
    new THREE.MeshBasicMaterial({
      map: signTexture(cat.label, { bg: '#00000000', fg: '#' + new THREE.Color(p.glow).getHexString() }),
      transparent: true, fog: false,
    })
  );
  title.position.set(0, 8.5, -22);
  scene.add(title);
  animated.push((t) => { title.position.y = 8.5 + Math.sin(t * 0.4) * 0.3; });

  // a Dalí column and a floating orb for company
  {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 9, 20), smoothMat(p.fog, { rough: 0.8 }));
    col.position.set(-14, 4.5, -16);
    col.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 2.2), smoothMat(p.fog, { rough: 0.8 }));
    cap.position.set(-14, 9.2, -16);
    cap.castShadow = true;
    scene.add(col, cap);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 18), smoothMat(p.glow, { rough: 0.4 }));
    orb.position.set(13, 4, -18);
    orb.castShadow = true;
    scene.add(orb);
    animated.push((t) => { orb.position.y = 4 + Math.sin(t * 0.45) * 0.7; });
  }

  // the works: floating frames in a wide arc facing you
  const n = cat.works.length;
  cat.works.forEach((work, i) => {
    const spread = Math.min(2.1, 4.6 / Math.max(1, n - 1)); // radians of total arc per item
    const a = (i - (n - 1) / 2) * Math.min(0.42, spread);
    const radius = 10.5;
    const x = Math.sin(a) * radius;
    const z = -Math.cos(a) * radius + 2;
    const baseY = 2.4 + (i % 2) * 1.1;

    const frame = new THREE.Group();
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.5, 0.14, 2, 2, 1),
      smoothMat(0x241c16, { rough: 0.6 })
    );
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3),
      new THREE.MeshBasicMaterial({ map: artTexture(work, p.glow) })
    );
    art.position.z = 0.08;

    // a small floating stone beneath each piece, like a pedestal that gave up
    const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), smoothMat(0x4a3e36, { rough: 0.9 }));
    pebble.position.y = -1.9;
    frame.add(backing, art, pebble);
    frame.traverse((m) => { if (m.isMesh) m.castShadow = true; });

    frame.position.set(x, baseY, z);
    frame.lookAt(0, baseY, 4.4);
    frame.userData = { type: 'work', key, index: i, label: work.title };
    scene.add(frame);
    interactables.push(frame);

    const phase = i * 1.7;
    animated.push((t) => {
      frame.position.y = baseY + Math.sin(t * 0.5 + phase) * 0.22;
      frame.rotation.z = Math.sin(t * 0.35 + phase) * 0.025;
    });
  });

  return { scene, interactables, animated };
}

function artTexture(work, glowHex) {
  if (work.img) {
    const tex = new THREE.TextureLoader().load(work.img);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  return placeholderArt(work.title, work.year, glowHex);
}
