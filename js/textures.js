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

// Big dusk-gradient sky dome texture.
export function skyTexture(topHex, midHex, sunHex) {
  const W = 1024, H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const top = '#' + topHex.toString(16).padStart(6, '0');
  const mid = '#' + midHex.toString(16).padStart(6, '0');
  const sun = '#' + sunHex.toString(16).padStart(6, '0');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, sun);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // banded posterization for the retro feel
  ctx.globalAlpha = 0.06;
  for (let y = 0; y < H; y += 14) {
    ctx.fillStyle = y % 28 === 0 ? '#000' : '#fff';
    ctx.fillRect(0, y, W, 7);
  }
  ctx.globalAlpha = 1;

  grainOver(ctx, W, H, 0.05);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
