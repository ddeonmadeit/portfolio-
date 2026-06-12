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
