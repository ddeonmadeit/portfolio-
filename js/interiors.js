// ============================================================
//  INTERIORS — step inside a structure. One raw room per
//  category; the works hang on the walls, lit by a bare bulb.
// ============================================================

import * as THREE from 'three';
import { placeholderArt, signTexture } from './textures.js';

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function roughen(geo, amt = 0.05) {
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

// Wall slots: where works can hang, in order of filling.
// Room is 14 wide (x), 10 deep (z), walls ~4.6 high.
const SLOTS = [
  // back wall (z = -4.8), facing +z
  { x: -4.2, z: -4.78, ry: 0 },
  { x: 0, z: -4.78, ry: 0 },
  { x: 4.2, z: -4.78, ry: 0 },
  // left wall (x = -6.8), facing +x
  { x: -6.78, z: -1.6, ry: Math.PI / 2 },
  { x: -6.78, z: 1.8, ry: Math.PI / 2 },
  // right wall (x = 6.8), facing -x
  { x: 6.78, z: -1.6, ry: -Math.PI / 2 },
  { x: 6.78, z: 1.8, ry: -Math.PI / 2 },
];

export function buildInterior(key, cat) {
  const scene = new THREE.Scene();
  const p = cat.palette;
  scene.fog = new THREE.Fog(p.floor, 6, 26);
  scene.background = new THREE.Color(p.floor);

  const interactables = [];
  const animated = [];

  const wallColor = new THREE.Color(p.fog).offsetHSL(0, -0.1, -0.12).getHex();

  // floor + walls — slightly crooked on purpose
  const floor = new THREE.Mesh(roughen(new THREE.BoxGeometry(14, 0.3, 10), 0.04), mat(p.floor));
  floor.position.y = -0.15;
  scene.add(floor);

  const wallGeo = () => roughen(new THREE.BoxGeometry(14, 4.8, 0.3), 0.07);
  const back = new THREE.Mesh(wallGeo(), mat(wallColor));
  back.position.set(0, 2.4, -5);
  const left = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.3, 4.8, 10), 0.07), mat(wallColor));
  left.position.set(-7, 2.4, 0);
  const right = left.clone();
  right.position.x = 7;
  scene.add(back, left, right);

  // roof planks with gaps — dusk light leaks through
  for (let i = 0; i < 9; i++) {
    const plank = new THREE.Mesh(
      roughen(new THREE.BoxGeometry(14.4, 0.12, 0.85), 0.04),
      mat(new THREE.Color(wallColor).offsetHSL(0, 0, -0.05).getHex())
    );
    plank.position.set(0, 4.85 + (Math.random() - 0.5) * 0.1, -4.5 + i * 1.1 + Math.random() * 0.15);
    plank.rotation.x = (Math.random() - 0.5) * 0.04;
    scene.add(plank);
  }

  // light shafts through the gaps
  for (let i = 0; i < 4; i++) {
    const shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 6),
      new THREE.MeshBasicMaterial({
        color: p.glow, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    shaft.position.set(-4 + i * 2.7, 2.6, -3 + i * 1.2);
    shaft.rotation.set(0.4, 0.3, 0.1);
    scene.add(shaft);
  }

  // the doorway out, behind the camera — a slab of dusk
  const doorway = new THREE.Group();
  const doorFrame = new THREE.Mesh(roughen(new THREE.BoxGeometry(2.6, 4, 0.4), 0.06), mat(wallColor));
  const dusk = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xd98a52, fog: false })
  );
  dusk.rotation.y = Math.PI;
  dusk.position.z = -0.21;
  const exitSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: signTexture('OUT →', { bg: '#0d0a08', fg: '#e8d9b8' }), transparent: true })
  );
  exitSign.rotation.y = Math.PI;
  exitSign.position.set(0, 2.3, -0.22);
  doorway.add(doorFrame, dusk, exitSign);
  doorway.position.set(0, 2, 5.2);
  doorway.userData = { type: 'exit', label: 'BACK OUT' };
  scene.add(doorway);
  interactables.push(doorway);

  // bare bulb on a wire
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4), mat(0x111111));
  wire.position.set(0, 4.2, 0);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9c4 })
  );
  bulb.position.set(0, 3.45, 0);
  scene.add(wire, bulb);

  scene.add(new THREE.AmbientLight(p.glow, 0.35));
  const bulbLight = new THREE.PointLight(0xffd9a0, 2.6, 24, 1.2);
  bulbLight.position.set(0, 3.4, 0);
  scene.add(bulbLight);
  const glowLight = new THREE.PointLight(p.glow, 1.2, 20, 1.5);
  glowLight.position.set(0, 1.5, 3);
  scene.add(glowLight);

  animated.push((t) => {
    // bulb sways slightly, light flickers like a dying filament
    const sway = Math.sin(t * 0.9) * 0.08;
    wire.rotation.z = sway;
    bulb.position.x = sway * 1.3;
    bulbLight.position.x = sway * 1.3;
    bulbLight.intensity = 2.5 + Math.sin(t * 31) * 0.12 + (Math.random() > 0.985 ? -0.9 : 0);
  });

  // category title painted on the back wall, above the works
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.6),
    new THREE.MeshBasicMaterial({
      map: signTexture(cat.label, { bg: '#00000000', fg: '#' + new THREE.Color(p.glow).getHexString() }),
      transparent: true,
    })
  );
  title.position.set(0, 3.9, -4.78);
  scene.add(title);

  // hang the works
  cat.works.forEach((work, i) => {
    const slot = SLOTS[i % SLOTS.length];
    const frame = new THREE.Group();

    const backing = new THREE.Mesh(
      roughen(new THREE.BoxGeometry(2.3, 2.3, 0.12), 0.03),
      mat(0x241b14)
    );
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(2.05, 2.05),
      new THREE.MeshBasicMaterial({ map: artTexture(work, p.glow) })
    );
    art.position.z = 0.075;

    // a nail and a bit of twine
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), mat(0x111111));
    nail.position.set(0, 1.45, 0.05);
    const twine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 3), mat(0x6b5a3e));
    twine.position.set(0, 1.3, 0.04);

    frame.add(backing, art, nail, twine);
    frame.position.set(slot.x, 2.1, slot.z);
    frame.rotation.y = slot.ry;
    frame.rotation.z = (Math.random() - 0.5) * 0.06; // nothing hangs straight out here
    frame.userData = { type: 'work', key, index: i, label: work.title };
    scene.add(frame);
    interactables.push(frame);
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
