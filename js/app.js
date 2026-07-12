// ============================================================
//  DEON — app logic
//  Loads content from /content/data.json (edited via the Pages
//  CMS dashboard). Structure mirrors podium.global: pinned fixed
//  hero, a contact modal, horizontal flip-card carousels, a
//  project index with a swapping preview, split-kicker CTA.
// ============================================================

let SITE, SERVICES, BTS, WORK;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- static text ---------------- */
function fillText() {
  $('#hero-statement').textContent = SITE.statement;
  $('#hero-scroll-label').textContent = SITE.scrollHint;

  $('#studio-eyebrow').textContent = SITE.eyebrow;
  const lead = $('#studio-mission');
  lead.innerHTML = SITE.mission.split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');

  $('#modal-heading').textContent = SITE.contact.heading;
  $('#modal-note').textContent = SITE.contact.note;
  const channels = $('#modal-channels');
  SITE.contact.channels.forEach(c => {
    const block = el('div');
    block.append(el('div', 'channel-label', c.label));
    const btn = el('button', 'channel-copy');
    btn.innerHTML = `<span class="label-text">${c.email}</span><span class="copied">Copied</span>`;
    btn.addEventListener('click', () => copyToClipboard(c.email, btn));
    block.append(btn);
    channels.append(block);
  });

  const ms = $('#menu-socials');
  const modalSocials = $('#modal-socials');
  SITE.socials.forEach(s => {
    const mk = () => { const a = el('a', null, s.label); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; return a; };
    ms.append(mk());
    modalSocials.append(mk());
  });

  $('#cta-kicker-left').textContent = SITE.ctaKickerLeft;
  $('#cta-heading').textContent = SITE.ctaHeading;
  $('#cta-link').textContent = SITE.ctaLink;
  $('#cta-kicker-right').textContent = SITE.ctaKickerRight;

  $('#footer-credit').textContent = `© ${new Date().getFullYear()} ${SITE.credit}`;
}

function copyToClipboard(text, btn) {
  const flash = () => {
    btn.classList.add('copied-flash');
    setTimeout(() => btn.classList.remove('copied-flash'), 1400);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(flash).catch(flash);
  } else {
    flash();
  }
}

/* ---------------- flip-card carousels ---------------- */
function buildCarousel(container, items, { kind }) {
  items.forEach(item => {
    const card = el('div', 'flip-card');
    if (kind === 'service') card.dataset.tint = item.tint;
    const inner = el('div', 'flip-card-inner');

    const front = el('div', 'flip-face flip-front');
    front.append(el('span', 'flip-caption', kind === 'service' ? item.title : item.caption));

    const back = el('div', 'flip-face flip-back');
    if (kind === 'service') {
      back.append(el('div', 'flip-back-title', item.title), el('div', 'flip-back-desc', item.desc));
    } else {
      back.append(el('div', 'flip-back-title', item.caption));
    }

    inner.append(front, back);
    card.append(inner);
    card.addEventListener('click', () => card.classList.toggle('flipped'));
    container.append(card);
  });
}

/* ---------------- work: project index + preview ---------------- */
function fillWork() {
  const list = $('#work-index');
  const previewPh = $('.work-preview-ph');
  const CAT_HUE = { Design: '#4a4030', Music: '#30402f', Web: '#2c3340', Video: '#4a4030', Clothing: '#30402f' };

  WORK.forEach((w, i) => {
    const li = el('li');
    const btn = el('button', 'work-item');
    btn.innerHTML = `<span>${w.title}</span><span class="wi-meta">${w.cat} · ${w.year}</span>`;
    const setActive = () => {
      previewPh.style.background = `linear-gradient(135deg, ${CAT_HUE[w.cat] || '#201d16'} 0%, var(--tile) 100%)`;
    };
    btn.addEventListener('mouseenter', setActive);
    btn.addEventListener('focus', setActive);
    btn.addEventListener('click', () => openLightbox(w));
    li.append(btn);
    list.append(li);
    if (i === 0) setActive();
  });
}

/* ---------------- lightbox ---------------- */
const lb = $('#lightbox');
function openLightbox(w) {
  $('#lightbox-cat').textContent = `${w.cat} · ${w.year}`;
  $('#lightbox-title').textContent = w.title;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lb.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { lb.hidden = true; }, 350);
}
$('#lightbox-close').addEventListener('click', closeLightbox);
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

/* ---------------- contact modal ---------------- */
const modal = $('#contact-modal');
function openModal() {
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { modal.hidden = true; }, 350);
}
$('#nav-contact').addEventListener('click', openModal);
$('#menu-contact').addEventListener('click', () => { closeMenu(); openModal(); });
$('#cta-link').addEventListener('click', openModal);
$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', closeModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); closeModal(); closeMenu(); }
});

/* ---------------- mobile menu ---------------- */
const menuBtn = $('#menu-btn');
function openMenu() { document.body.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); }
function closeMenu() { document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => {
  document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
});

/* ---------------- scroll-to buttons ---------------- */
$$('[data-scroll-to]').forEach(btn => {
  btn.addEventListener('click', () => {
    closeMenu();
    const target = $(btn.dataset.scrollTo);
    target?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  });
});

/* ---------------- hero fade (fixed statement fades as you scroll past it) ---------------- */
function initHeroFade() {
  const hero = $('#hero-fixed');
  const runway = $('#hero-runway');
  if (REDUCED) { hero.style.position = 'absolute'; return; }
  const onScroll = () => {
    const h = runway.offsetHeight || 1;
    const p = clamp(window.scrollY / h, 0, 1);
    hero.style.opacity = String(1 - p);
    hero.style.pointerEvents = p > 0.85 ? 'none' : 'auto';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------------- realistic 3D rock (small, in the About section) ---------------- */
function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function initRockLazy() {
  const canvas = $('#rock');
  if (!canvas || REDUCED || !webglSupported()) return;

  let rockCtl = null;
  let raf = null;
  let lastT = performance.now();

  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    rockCtl?.render(dt);
    raf = requestAnimationFrame(loop);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!rockCtl) {
          import('./rock.js').then(mod => {
            rockCtl = mod.initRock(canvas);
            lastT = performance.now();
            if (!raf) raf = requestAnimationFrame(loop);
          }).catch(() => {});
        } else if (!raf) {
          lastT = performance.now();
          raf = requestAnimationFrame(loop);
        }
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    });
  }, { threshold: 0.1 });
  io.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
  });
}

/* ---------------- preloader ---------------- */
function runLoader(done) {
  const pct = $('#loader-pct');
  if (REDUCED) { pct.textContent = '100%'; document.body.classList.remove('loading'); done(); return; }
  const t0 = performance.now();
  const DUR = 900;
  const step = (now) => {
    const p = clamp((now - t0) / DUR, 0, 1);
    pct.textContent = Math.round(p * 100) + '%';
    if (p < 1) requestAnimationFrame(step);
    else { document.body.classList.remove('loading'); done(); }
  };
  requestAnimationFrame(step);
}

/* ---------------- scroll reveals ---------------- */
function observeReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(n => io.observe(n));
}

/* ---------------- boot ---------------- */
async function main() {
  let data;
  try {
    const res = await fetch('content/data.json', { cache: 'no-cache' });
    data = await res.json();
  } catch (err) {
    console.error('Could not load content/data.json', err);
    document.body.classList.remove('loading');
    return;
  }

  SITE = data.site;
  SERVICES = data.services || [];
  BTS = data.behindTheScenes || [];
  WORK = data.work || [];

  fillText();
  buildCarousel($('#bts-carousel'), BTS, { kind: 'bts' });
  buildCarousel($('#services-carousel'), SERVICES, { kind: 'service' });
  fillWork();
  observeReveals();

  await document.fonts.ready;
  runLoader(() => {
    initHeroFade();
    initRockLazy();
  });
}

main();
