// ============================================================
//  TEXTURES — everything is drawn on <canvas> at runtime.
//  Weathered signs, gritty placeholder covers, the sky.
// ============================================================

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// scatter erosion holes + scratches over whatever is drawn
function distress(ctx, w, h, amount = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const holes = 220 * amount;
  for (let i = 0; i < holes; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * Math.random() * 7 + 0.5;
    ctx.globalAlpha = 0.2 + Math.random() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // scratches
  for (let i = 0; i < 14 * amount; i++) {
    ctx.globalAlpha = 0.12 + Math.random() * 0.25;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * w * 0.5, y + (Math.random() - 0.5) * 30);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function grainOver(ctx, w, h, alpha = 0.08) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha * 2;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// A weathered painted sign with big distressed lettering.
export function signTexture(text, { bg = '#1c1410', fg = '#e8d9b8', sub = '' } = {}) {
  const W = 1024, H = sub ? 360 : 256;
  const [c, ctx] = makeCanvas(W, H);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faded paint streaks
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * W, 0, 2 + Math.random() * 20, H);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 170;
  ctx.font = `900 ${size}px 'Anton', 'Arial Black', sans-serif`;
  while (ctx.measureText(text).width > W * 0.88 && size > 40) {
    size -= 8;
    ctx.font = `900 ${size}px 'Anton', 'Arial Black', sans-serif`;
  }
  ctx.fillText(text, W / 2, sub ? H * 0.38 : H / 2 + 6);

  if (sub) {
    ctx.font = `400 34px 'VT323', monospace`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(sub, W / 2, H * 0.78);
    ctx.globalAlpha = 1;
  }

  distress(ctx, W, H, 1.4);
  grainOver(ctx, W, H, 0.05);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Gritty generated placeholder artwork for a work item.
// Deterministic-ish per title so reloads look stable enough.
export function placeholderArt(title, year, glowHex) {
  const W = 512, H = 512;
  const [c, ctx] = makeCanvas(W, H);

  let seed = 0;
  for (let i = 0; i < title.length; i++) seed = (seed * 31 + title.charCodeAt(i)) % 99991;
  const rand = () => {
    seed = (seed * 16807) % 2147483647 || 7;
    return (seed % 10000) / 10000;
  };

  const glow = '#' + glowHex.toString(16).padStart(6, '0');

  // base: dark with a dusty gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#191210');
  g.addColorStop(1, '#0c0a09');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // abstract shapes in the section's glow color
  const shapes = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < shapes; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.4;
    ctx.fillStyle = rand() > 0.35 ? glow : '#d8cdb6';
    const t = rand();
    if (t < 0.33) {
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H, 40 + rand() * 140, 0, Math.PI * 2);
      ctx.fill();
    } else if (t < 0.66) {
      ctx.fillRect(rand() * W * 0.7, rand() * H * 0.7, 60 + rand() * 220, 60 + rand() * 220);
    } else {
      ctx.save();
      ctx.translate(rand() * W, rand() * H);
      ctx.rotate(rand() * Math.PI);
      ctx.fillRect(-150, -10, 300, 14 + rand() * 30);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // horizon line — keep the desert language
  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  const hy = H * (0.55 + rand() * 0.25);
  ctx.beginPath();
  ctx.moveTo(0, hy);
  ctx.lineTo(W, hy);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // title block
  ctx.fillStyle = '#efe6d0';
  ctx.textAlign = 'left';
  let size = 64;
  ctx.font = `900 ${size}px 'Anton', 'Arial Black', sans-serif`;
  while (ctx.measureText(title).width > W * 0.86 && size > 22) {
    size -= 4;
    ctx.font = `900 ${size}px 'Anton', 'Arial Black', sans-serif`;
  }
  ctx.fillText(title, 28, H - 64);
  ctx.font = `400 28px 'VT323', monospace`;
  ctx.fillStyle = glow;
  ctx.fillText(`${year} · PLACEHOLDER`, 30, H - 28);

  distress(ctx, W, H, 0.8);
  grainOver(ctx, W, H, 0.1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Big dusk-gradient sky dome — smooth, dreamlike, soft clouds.
export function skyTexture(topHex, midHex, sunHex) {
  const W = 2048, H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  const top = '#' + topHex.toString(16).padStart(6, '0');
  const mid = '#' + midHex.toString(16).padStart(6, '0');
  const sun = '#' + sunHex.toString(16).padStart(6, '0');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.52, mid);
  g.addColorStop(0.78, sun);
  g.addColorStop(1, sun);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // glowing band right at the horizon
  const hg = ctx.createLinearGradient(0, H * 0.62, 0, H * 0.8);
  hg.addColorStop(0, 'rgba(255,235,190,0)');
  hg.addColorStop(1, 'rgba(255,228,170,0.5)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, H * 0.62, W, H * 0.18);

  // long soft clouds, lit from below — Dalí skies
  for (let i = 0; i < 18; i++) {
    const y = H * (0.18 + Math.random() * 0.42);
    const x = Math.random() * W;
    const w = 120 + Math.random() * 420;
    const h = 6 + Math.random() * 22;
    ctx.save();
    ctx.filter = 'blur(' + (6 + Math.random() * 14) + 'px)';
    ctx.globalAlpha = 0.1 + Math.random() * 0.22;
    ctx.fillStyle = Math.random() > 0.45 ? '#ffd9a8' : '#8a6a88';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // dither hard enough to break gradient banding
  grainOver(ctx, W, H, 0.045);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A draped vinyl record / clock face — alpha-masked disc textures
// for surfaces that get melted over things.
export function vinylTexture(label, glowHex) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const glow = '#' + glowHex.toString(16).padStart(6, '0');
  const cx = S / 2, cy = S / 2, R = S / 2 - 8;

  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0b0c';
  ctx.fill();

  // grooves
  for (let r = R * 0.42; r < R * 0.97; r += 5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.025 + Math.random() * 0.05) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // sheen
  const sheen = ctx.createLinearGradient(0, 0, S, S);
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,235,200,0.1)');
  sheen.addColorStop(0.65, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // center label
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.36, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0b0c';
  ctx.fill();
  ctx.fillStyle = '#14100e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${S * 0.09}px 'Anton', 'Arial Black', sans-serif`;
  ctx.fillText(label, cx, cy - R * 0.14);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// tiled bump map of wind ripples for the sand surface
export function rippleBump() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  // wavy directional ridges
  for (let y = -20; y < S + 20; y += 7) {
    ctx.beginPath();
    for (let x = 0; x <= S; x += 8) {
      const yy = y + Math.sin(x * 0.06 + y * 0.5) * 3;
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.4;
    ctx.translate(0, 2.4);
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  grainOver(ctx, S, S, 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// a worn fresco panel — faded pigment shapes on cracked plaster
export function frescoTexture(glowHex) {
  const W = 1024, H = 640;
  const [c, ctx] = makeCanvas(W, H);
  const glow = '#' + glowHex.toString(16).padStart(6, '0');

  ctx.fillStyle = '#c4ad88';
  ctx.fillRect(0, 0, W, H);
  // plaster blotches
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.07;
    ctx.fillStyle = Math.random() > 0.5 ? '#a88f6a' : '#d9c4a0';
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, Math.random() * H, 40 + Math.random() * 130, 30 + Math.random() * 90, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // faded mural: bands, suns, figures — old pigments
  const pig = ['#8a4a38', '#6e6a4a', glow, '#4a5e6a', '#9a7a3a'];
  for (let i = 0; i < 9; i++) {
    ctx.globalAlpha = 0.2 + Math.random() * 0.3;
    ctx.fillStyle = pig[i % pig.length];
    const t = Math.random();
    if (t < 0.4) {
      ctx.fillRect(Math.random() * W * 0.8, Math.random() * H * 0.8, 60 + Math.random() * 240, 14 + Math.random() * 40);
    } else if (t < 0.7) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H * 0.6, 24 + Math.random() * 70, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // a row of little standing figures
      const bx = Math.random() * W * 0.6, by = H * (0.45 + Math.random() * 0.35);
      for (let f = 0; f < 5 + Math.random() * 5; f++) {
        ctx.fillRect(bx + f * 34, by - 38, 12, 38);
        ctx.beginPath();
        ctx.arc(bx + f * 34 + 6, by - 46, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // cracks
  ctx.strokeStyle = 'rgba(60,45,30,0.5)';
  for (let i = 0; i < 7; i++) {
    ctx.lineWidth = 0.8 + Math.random();
    ctx.beginPath();
    let x = Math.random() * W, y = 0;
    ctx.moveTo(x, y);
    while (y < H) {
      x += (Math.random() - 0.5) * 60;
      y += 30 + Math.random() * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  distress(ctx, W, H, 2.2);
  grainOver(ctx, W, H, 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// rows of carved square glyphs, for the ziggurat stones
export function glyphTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#a68a64';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(50,38,26,0.55)';
  for (let y = 30; y < S - 20; y += 56) {
    for (let x = 30; x < S - 20; x += 52) {
      if (Math.random() < 0.18) continue;
      const t = Math.random();
      if (t < 0.33) ctx.fillRect(x, y, 26, 26);
      else if (t < 0.66) {
        ctx.beginPath();
        ctx.arc(x + 13, y + 13, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, 26, 8);
        ctx.fillRect(x, y + 18, 26, 8);
      }
    }
  }
  distress(ctx, S, S, 1.6);
  grainOver(ctx, S, S, 0.07);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ancient woven cloth, sun-bleached, holes worn through
export function wovenClothTexture() {
  const W = 512, H = 512;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#9a5a44';
  ctx.fillRect(0, 0, W, H);
  // weave stripes
  for (let y = 0; y < H; y += 18) {
    ctx.fillStyle = ['#8a4a38', '#a8714e', '#7a5a4a', '#b8854e'][Math.floor(y / 18) % 4];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, y, W, 9);
  }
  ctx.globalAlpha = 0.25;
  for (let x = 0; x < W; x += 10) {
    ctx.fillStyle = x % 20 ? '#00000022' : '#ffffff22';
    ctx.fillRect(x, 0, 4, H);
  }
  ctx.globalAlpha = 1;
  distress(ctx, W, H, 3);
  grainOver(ctx, W, H, 0.07);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the sun as a soft radial glow sprite — a hole of light in the sky
export function makeSunSprite(coreHex = '#fff2d8', glowHex = '#f0a060', size = 150) {
  const [c, ctx] = makeCanvas(512, 512);
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, coreHex);
  g.addColorStop(0.16, coreHex);
  g.addColorStop(0.24, glowHex + 'cc');
  g.addColorStop(0.5, glowHex + '44');
  g.addColorStop(1, glowHex + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, transparent: true,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

export function clockTexture() {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const cx = S / 2, cy = S / 2, R = S / 2 - 10;

  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#e8ddc2';
  ctx.fill();
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#b89a4e';
  ctx.stroke();

  ctx.fillStyle = '#241c12';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${S * 0.11}px Georgia, serif`;
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillText(String(h), cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
  }
  // hands — frozen at a quarter past six, why not
  ctx.strokeStyle = '#241c12';
  ctx.lineCap = 'round';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + R * 0.42, cy + R * 0.12);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - R * 0.12, cy + R * 0.6);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
