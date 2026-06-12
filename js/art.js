// ============================================================
//  ART — seeded 2D dunescapes in the crimson palette.
//  Every cover and placeholder is generated here at runtime;
//  drop real images into data.js and these step aside.
// ============================================================

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (i) => '#' + i.toString(16).padStart(6, '0');

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amount * 2;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// palette ints from data.js → dunescape colors
export function scenePalette(p) {
  return {
    top: hex(p.glow),                    // burning light above
    mid: hex(p.fog),                     // smoky crimson
    low: hex(p.sky),                     // deep wine at the horizon
    dune: hex(p.floor),                  // dark dunes
    duneLit: mix(hex(p.fog), hex(p.glow), 0.35),
    glow: hex(p.glow),
    dark: mix(hex(p.floor), '#000000', 0.45),
  };
}

// The signature image: light burning above, smoke, red dune
// ridges stacking darker toward the viewer, birds in the haze.
export function dunescape({ seed = 1, w = 900, h = 1500, pal }) {
  const rand = mulberry(seed);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, pal.top);
  sky.addColorStop(0.42, pal.mid);
  sky.addColorStop(0.72, pal.low);
  sky.addColorStop(1, pal.dark);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // the burning core of light
  const gx = w * (0.35 + rand() * 0.3), gy = h * (0.1 + rand() * 0.1);
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.85);
  glow.addColorStop(0, pal.glow + 'cc');
  glow.addColorStop(0.35, pal.glow + '44');
  glow.addColorStop(1, pal.glow + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // smoke
  for (let i = 0; i < 16; i++) {
    ctx.save();
    ctx.filter = `blur(${18 + rand() * 30}px)`;
    ctx.globalAlpha = 0.1 + rand() * 0.22;
    ctx.fillStyle = rand() > 0.45 ? mix(pal.low, '#000', 0.25) : pal.glow;
    ctx.beginPath();
    ctx.ellipse(rand() * w, h * (0.04 + rand() * 0.45), w * (0.15 + rand() * 0.3), 14 + rand() * 60, (rand() - 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // dune ridges, darker as they come forward
  const layers = 4;
  for (let L = 0; L < layers; L++) {
    const t = L / (layers - 1);
    const base = h * (0.52 + 0.42 * t * t);
    const amp = h * (0.025 + 0.05 * t);
    const f1 = 1.2 + rand() * 1.6, f2 = 3 + rand() * 3.5;
    const ph1 = rand() * 9, ph2 = rand() * 9;
    const yAt = (x) => {
      const u = x / w;
      return base
        + Math.sin(u * Math.PI * f1 + ph1) * amp
        + Math.sin(u * Math.PI * f2 + ph2) * amp * 0.35;
    };
    const col = mix(mix(pal.dune, pal.low, 0.5 * (1 - t)), '#000', t * 0.42);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    // lit crest line where the ridge faces the light
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = yAt(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = pal.duneLit;
    ctx.globalAlpha = 0.5 - t * 0.32;
    ctx.lineWidth = 2.4 - t;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // wind ripples on the front dunes
    if (L >= layers - 2) {
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = pal.duneLit;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 26; i++) {
        const rx = rand() * w, ry = base + rand() * (h - base) * 0.8;
        ctx.beginPath();
        ctx.moveTo(rx - 20 - rand() * 50, ry);
        ctx.quadraticCurveTo(rx, ry - 4 - rand() * 6, rx + 20 + rand() * 50, ry);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // birds
  const nBirds = 6 + Math.floor(rand() * 8);
  ctx.strokeStyle = mix(pal.dark, '#000', 0.3);
  ctx.lineWidth = Math.max(1.6, w * 0.0022);
  ctx.lineCap = 'round';
  for (let i = 0; i < nBirds; i++) {
    const bx = rand() * w, by = h * (0.12 + rand() * 0.42);
    const s = w * (0.006 + rand() * 0.012);
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.8, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.8, bx + s, by);
    ctx.stroke();
  }

  grain(ctx, w, h, 0.085);
  return c;
}

// The home backdrop: a one-point-perspective room in muted
// crimson, sand drifted across the floor, an arched window
// pouring pale light over it. Darker and quieter than the sky.
export function roomscape({ seed = 1, w = 800, h = 1400, pal }) {
  const rand = mulberry(seed);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // mute toward a dark warm grey, not pure black — kills the neon
  const mute = (col, t) => mix(col, '#191112', t);
  const wall = mute(mix(pal.low, pal.mid, 0.3), 0.42);
  const wallLit = mute(mix(pal.mid, pal.top, 0.16), 0.36);
  const wallDark = mute(pal.low, 0.62);
  const ceilCol = mute(pal.low, 0.72);
  const sandCol = mute(mix(pal.dune, pal.mid, 0.42), 0.26);
  const sandLit = mute(pal.duneLit, 0.16);
  const lightCol = mix(pal.top, '#fff3e0', 0.55);

  // room geometry (ratios, so any canvas aspect works)
  const bx0 = w * 0.16, bx1 = w * 0.84;   // back wall left/right
  const by0 = h * 0.16, by1 = h * 0.60;   // back wall top/bottom
  const fy = h * 0.80;                     // side walls meet floor at screen edge

  // ceiling
  let g = ctx.createLinearGradient(0, 0, 0, by0);
  g.addColorStop(0, mix(ceilCol, '#000000', 0.4));
  g.addColorStop(1, ceilCol);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(bx1, by0); ctx.lineTo(bx0, by0);
  ctx.closePath(); ctx.fill();

  // left wall (window side — falls into shadow toward the viewer)
  g = ctx.createLinearGradient(0, 0, bx0, 0);
  g.addColorStop(0, mix(wallDark, '#000000', 0.25));
  g.addColorStop(1, wall);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(bx0, by0); ctx.lineTo(bx0, by1); ctx.lineTo(0, fy);
  ctx.closePath(); ctx.fill();

  // right wall (catches the window light)
  g = ctx.createLinearGradient(w, 0, bx1, 0);
  g.addColorStop(0, mute(wallDark, 0.15));
  g.addColorStop(1, wallLit);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w, 0); ctx.lineTo(bx1, by0); ctx.lineTo(bx1, by1); ctx.lineTo(w, fy);
  ctx.closePath(); ctx.fill();

  // back wall
  g = ctx.createLinearGradient(0, by0, 0, by1);
  g.addColorStop(0, wall);
  g.addColorStop(1, mix(wall, '#000000', 0.28));
  ctx.fillStyle = g;
  ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);

  // floor base, darker toward the viewer
  g = ctx.createLinearGradient(0, by1, 0, h);
  g.addColorStop(0, mute(mix(pal.dune, pal.low, 0.35), 0.2));
  g.addColorStop(1, mix(pal.dune, '#000000', 0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, fy); ctx.lineTo(bx0, by1); ctx.lineTo(bx1, by1);
  ctx.lineTo(w, fy); ctx.lineTo(w, h); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();

  // junction lines — the room's bones
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1.5, w * 0.0022);
  ctx.beginPath();
  ctx.moveTo(0, fy); ctx.lineTo(bx0, by1); ctx.lineTo(bx1, by1); ctx.lineTo(w, fy);
  ctx.moveTo(bx0, by0); ctx.lineTo(bx0, by1);
  ctx.moveTo(bx1, by0); ctx.lineTo(bx1, by1);
  ctx.stroke();

  // ---- arched window set into the LEFT wall, in perspective,
  //      so it stays visible beside the tablets ----
  const lwPt = (u, v) => {
    // u: 0 at screen edge → 1 at back corner; v: 0 top of wall → 1 floor line
    const x = bx0 * u;
    const yt = by0 * u;
    const yb = fy + (by1 - fy) * u;
    return [x, yt + (yb - yt) * v];
  };
  const u0 = 0.2, u1 = 0.82, vTop = 0.17, vBot = 0.6;
  const [wnx, wnyT] = lwPt(u0, vTop);          // near top corner
  const [wfx, wfyT] = lwPt(u1, vTop);          // far top corner
  const [wfx2, wfyB] = lwPt(u1, vBot);         // far bottom
  const [wnx2, wnyB] = lwPt(u0, vBot + 0.03);  // near bottom
  const wcx = (wnx + wfx2) / 2, wcy = (wnyT + wfyB) / 2;
  const windowPath = () => {
    ctx.beginPath();
    ctx.moveTo(wnx2, wnyB);
    ctx.lineTo(wnx, wnyT);
    ctx.quadraticCurveTo((wnx + wfx) / 2, (wnyT + wfyT) / 2 - h * 0.05, wfx, wfyT);
    ctx.lineTo(wfx2, wfyB);
    ctx.closePath();
  };
  // recessed frame
  windowPath();
  ctx.strokeStyle = mix(wall, '#000000', 0.48);
  ctx.lineWidth = w * 0.022;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // sky in the opening
  windowPath();
  g = ctx.createLinearGradient(0, Math.min(wnyT, wfyT) - h * 0.05, 0, Math.max(wnyB, wfyB));
  g.addColorStop(0, lightCol);
  g.addColorStop(0.65, mix(lightCol, pal.glow, 0.5));
  g.addColorStop(1, mute(pal.mid, 0.08));
  ctx.fillStyle = g;
  ctx.fill();
  // a far dune visible through the glass
  ctx.save();
  windowPath();
  ctx.clip();
  ctx.fillStyle = mute(pal.mid, 0.22);
  ctx.beginPath();
  ctx.moveTo(wnx2 - 4, wnyB + 4);
  ctx.lineTo(wnx - 4, wnyT + (wnyB - wnyT) * (0.66 + rand() * 0.1));
  ctx.lineTo(wfx2 + 4, wfyT + (wfyB - wfyT) * (0.72 + rand() * 0.1));
  ctx.lineTo(wfx2 + 4, wfyB + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // mullions
  ctx.strokeStyle = mix(wall, '#000000', 0.5);
  ctx.lineWidth = w * 0.007;
  const [mTx, mTy] = lwPt((u0 + u1) / 2, vTop - 0.02);
  const [mBx, mBy] = lwPt((u0 + u1) / 2, vBot + 0.015);
  const [h0x, h0y] = lwPt(u0, (vTop + vBot) / 2);
  const [h1x, h1y] = lwPt(u1, (vTop + vBot) / 2);
  ctx.beginPath();
  ctx.moveTo(mTx, mTy); ctx.lineTo(mBx, mBy);
  ctx.moveTo(h0x, h0y); ctx.lineTo(h1x, h1y);
  ctx.stroke();

  // ---- a door set into the right wall ----
  const wallPt = (u, v) => {
    const x = bx1 + (w - bx1) * u;
    const yt = by0 * (1 - u);
    const yb = by1 + (fy - by1) * u;
    return [x, yt + (yb - yt) * v];
  };
  ctx.beginPath();
  ctx.moveTo(...wallPt(0.18, 0.14));
  ctx.lineTo(...wallPt(0.56, 0.10));
  ctx.lineTo(...wallPt(0.56, 0.97));
  ctx.lineTo(...wallPt(0.18, 0.98));
  ctx.closePath();
  ctx.fillStyle = mute(mix(pal.mid, '#000000', 0.3), 0.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(1.5, w * 0.003);
  ctx.stroke();
  const [knx, kny] = wallPt(0.24, 0.55);
  ctx.fillStyle = mix(pal.glow, '#000000', 0.35);
  ctx.beginPath();
  ctx.arc(knx, kny, w * 0.006, 0, Math.PI * 2);
  ctx.fill();

  // glow spilling from the window onto the walls
  g = ctx.createRadialGradient(wcx, wcy, 0, wcx, wcy, w * 0.6);
  g.addColorStop(0, lightCol + '50');
  g.addColorStop(0.5, lightCol + '16');
  g.addColorStop(1, lightCol + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ---- sand drifted across the floor ----
  const nLayers = 3;
  for (let L = 0; L < nLayers; L++) {
    const t = L / (nLayers - 1);
    const base = (by1 - h * 0.012) + (h * 0.93 - by1) * t * t;
    const amp = h * (0.016 + 0.034 * t);
    const f1 = 1.4 + rand() * 1.4, f2 = 3 + rand() * 3;
    const ph1 = rand() * 9, ph2 = rand() * 9;
    const yAt = (x) => {
      const u = x / w;
      return base
        + Math.sin(u * Math.PI * f1 + ph1) * amp
        + Math.sin(u * Math.PI * f2 + ph2) * amp * 0.4;
    };
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = mix(sandCol, '#000000', 0.04 + t * 0.26);
    ctx.fill();

    // lit crests — brighter on the window side
    g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, sandLit + 'a8');
    g.addColorStop(0.55, sandLit + '4a');
    g.addColorStop(1, sandLit + '14');
    ctx.strokeStyle = g;
    ctx.globalAlpha = 0.55 - t * 0.3;
    ctx.lineWidth = 2.2 - t * 0.8;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const y = yAt(x);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (L === nLayers - 1) {
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = sandLit;
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 20; i++) {
        const rx = rand() * w, ry = base + rand() * (h - base) * 0.8;
        ctx.beginPath();
        ctx.moveTo(rx - 20 - rand() * 50, ry);
        ctx.quadraticCurveTo(rx, ry - 4 - rand() * 6, rx + 20 + rand() * 50, ry);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- the shaft of light falling across the sand ----
  ctx.beginPath();
  ctx.moveTo(wnx2, wnyB);
  ctx.lineTo(wfx2, wfyB);
  ctx.lineTo(w * 0.82, h * 0.83);
  ctx.lineTo(w * 0.34, h * 0.96);
  ctx.closePath();
  g = ctx.createLinearGradient(wcx, (wnyB + wfyB) / 2, w * 0.6, h * 0.9);
  g.addColorStop(0, lightCol + '44');
  g.addColorStop(1, lightCol + '00');
  ctx.fillStyle = g;
  ctx.fill();
  // bright pool where it lands
  g = ctx.createRadialGradient(w * 0.5, h * 0.8, 0, w * 0.5, h * 0.8, w * 0.36);
  g.addColorStop(0, lightCol + '38');
  g.addColorStop(1, lightCol + '00');
  ctx.save();
  ctx.translate(w * 0.5, h * 0.8);
  ctx.scale(1, 0.3);
  ctx.translate(-w * 0.5, -h * 0.8);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 4);
  ctx.restore();
  // dust hanging in the shaft
  ctx.fillStyle = lightCol;
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.06 + rand() * 0.16;
    const dx = wcx + rand() * (w * 0.5);
    const dy = wcy + (rand() - 0.1) * (h * 0.32);
    ctx.fillRect(dx, dy, 1 + rand(), 1 + rand());
  }
  ctx.globalAlpha = 1;

  // corner vignette to settle it
  g = ctx.createRadialGradient(w * 0.5, h * 0.52, Math.min(w, h) * 0.3, w * 0.5, h * 0.52, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  grain(ctx, w, h, 0.07);
  return c;
}

// dark stone slab texture for the home tablets — mottled,
// striated, flecked. One per category, applied as background.
export function slateTexture(seed, w = 460, h = 620) {
  const rand = mulberry(seed);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1515';
  ctx.fillRect(0, 0, w, h);

  // broad mineral mottling
  for (let i = 0; i < 30; i++) {
    ctx.save();
    ctx.filter = `blur(${10 + rand() * 26}px)`;
    ctx.globalAlpha = 0.05 + rand() * 0.09;
    ctx.fillStyle = rand() > 0.5 ? '#272019' : '#0e0a0b';
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, w * (0.08 + rand() * 0.22), h * (0.05 + rand() * 0.16), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // cleaving striations, slightly off-horizontal
  const tilt = (rand() - 0.5) * 0.16;
  ctx.lineWidth = 1;
  for (let y = -30; y < h + 30; y += 5 + rand() * 9) {
    ctx.strokeStyle = rand() > 0.62 ? 'rgba(214,178,148,0.05)' : 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(-10, y);
    for (let x = 0; x <= w + 20; x += 26) {
      ctx.lineTo(x, y + x * tilt + (rand() - 0.5) * 3);
    }
    ctx.stroke();
  }

  // hairline cracks
  for (let i = 0; i < 3; i++) {
    let x = rand() * w, y = rand() * h * 0.7;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4 + Math.floor(rand() * 5);
    for (let s = 0; s < steps; s++) {
      x += (rand() - 0.5) * 60;
      y += 12 + rand() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // mica flecks catching light
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(226,196,168,${0.03 + rand() * 0.07})`;
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }

  grain(ctx, w, h, 0.05);
  return c;
}

// square art for a single work — a dunescape crop with a mark
export function workArt(work, pal, label = true) {
  const seed = hashStr(work.title);
  const rand = mulberry(seed);
  const S = 900;
  const c = dunescape({ seed, w: S, h: S, pal });
  const ctx = c.getContext('2d');

  // one abstract mark per piece so they don't all read the same
  const t = rand();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = pal.glow;
  if (t < 0.33) {
    ctx.beginPath();
    ctx.arc(S * (0.25 + rand() * 0.5), S * (0.2 + rand() * 0.25), S * (0.06 + rand() * 0.09), 0, Math.PI * 2);
    ctx.fill();
  } else if (t < 0.66) {
    ctx.fillRect(S * (0.1 + rand() * 0.5), S * (0.16 + rand() * 0.2), S * (0.18 + rand() * 0.3), S * 0.018);
  } else {
    ctx.save();
    ctx.translate(S * (0.3 + rand() * 0.4), S * (0.25 + rand() * 0.2));
    ctx.rotate(rand() * Math.PI);
    ctx.fillRect(-S * 0.09, -S * 0.005, S * 0.18, S * 0.01);
    ctx.fillRect(-S * 0.005, -S * 0.09, S * 0.01, S * 0.18);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (label) {
    ctx.fillStyle = 'rgba(244,227,208,.92)';
    ctx.font = `700 ${S * 0.075}px Braun, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    let title = work.title.toUpperCase();
    while (ctx.measureText(title).width > S * 0.86 && title.length > 4) {
      title = title.slice(0, -2);
    }
    ctx.fillText(title, S * 0.06, S * 0.9);
    ctx.font = `500 ${S * 0.032}px Braun, sans-serif`;
    ctx.fillStyle = pal.glow;
    ctx.fillText(work.year + '  ·  PLACEHOLDER', S * 0.062, S * 0.95);
  }
  return c;
}

// wide art (16:9-ish) for video thumbnails and web cards
export function wideArt(work, pal) {
  const seed = hashStr(work.title) ^ 0x9e3779b9;
  const c = dunescape({ seed, w: 1200, h: 700, pal });
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(244,227,208,.92)';
  ctx.font = `700 ${64}px Braun, sans-serif`;
  let title = work.title.toUpperCase();
  while (ctx.measureText(title).width > 1020 && title.length > 4) title = title.slice(0, -2);
  ctx.fillText(title, 56, 620);
  return c;
}
