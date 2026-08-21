// ============================================================
//  DEON — Dashboard (/dash)
//  The site is hosted on GitHub Pages, which serves static files and
//  runs no code of its own, so there is no server here to talk to.
//  Saving instead commits straight to the repository from this
//  browser using the GitHub API, with a token the owner pastes into
//  the Connection tab (kept in this browser's localStorage only).
//  Everything edited is in-memory until "Save changes" is pressed,
//  and lands as a single commit.
//
//  Note the password gate below is a convenience, not a security
//  boundary: on a static host there is nothing to verify it against,
//  and anyone can read this file. The GitHub token is the real
//  credential — without it nothing can be written.
// ============================================================

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const DASH_PASSWORD = 'v';
const DEFAULTS = { repo: 'ddeonmadeit/portfolio-', branch: 'claude/tender-bohr-u27stq' };

let DATA = null;
// blob sha of content/data.json as it was when loaded — lets Save detect that
// something else wrote to the file in the meantime instead of overwriting it
let baseDataSha = null;
// key -> { file, apply(path, type) } — resolved into real asset paths on Save
let pendingUploads = {};
let uploadSeq = 0;

// GitHub Pages serves files straight from the repo, so an upload is
// really a git commit. Individual files must stay under GitHub's 100MB
// limit, and a Pages site must stay under 1GB total — but note every
// version of every file lives in git history forever, so re-uploading
// a big video repeatedly grows the repo permanently.
const MAX_RECOMMENDED_BYTES = 25 * 1024 * 1024;

const CFG = {
  get token()  { return localStorage.getItem('dash_gh_token') || ''; },
  set token(v) { v ? localStorage.setItem('dash_gh_token', v) : localStorage.removeItem('dash_gh_token'); },
  get repo()   { return localStorage.getItem('dash_gh_repo') || DEFAULTS.repo; },
  set repo(v)  { localStorage.setItem('dash_gh_repo', v || DEFAULTS.repo); },
  get branch() { return localStorage.getItem('dash_gh_branch') || DEFAULTS.branch; },
  set branch(v){ localStorage.setItem('dash_gh_branch', v || DEFAULTS.branch); },
};

/* ---------------- helpers ---------------- */
function slugify(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}
function uniqueId(base, existingIds) {
  let id = slugify(base);
  let n = 2;
  while (existingIds.includes(id)) id = `${slugify(base)}-${n++}`;
  return id;
}
function typeFromMime(mime) {
  return mime && mime.startsWith('video/') ? 'video' : 'image';
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function makeFilename(name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  return `${Date.now()}-${uploadSeq++}-${slugify(base)}${ext.toLowerCase()}`;
}
// Phone and camera stills run to several megabytes at dimensions far beyond
// anything the site displays, which is dead weight on every visit. Redraw them
// through a canvas at a sensible size before upload. 2000px on the long edge
// still covers the widest tile on a retina screen, and the original stays on
// the device untouched — only the web copy is reduced.
const MAX_IMAGE_EDGE = 2000;
const IMAGE_QUALITY = 0.85;

function shrinkImage(file) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(file);

    const url = URL.createObjectURL(file);
    const img = new Image();
    const bail = () => { URL.revokeObjectURL(url); resolve(file); };
    const timer = setTimeout(bail, 10000);

    img.onerror = () => { clearTimeout(timer); bail(); };
    img.onload = () => {
      clearTimeout(timer);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        // keep whichever is smaller — re-encoding an already-lean file can
        // easily make it bigger
        if (!blob || blob.size >= file.size) return resolve(file);
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        resolve(new File([blob], name, { type: 'image/jpeg' }));
      }, 'image/jpeg', IMAGE_QUALITY);
    };
    img.src = url;
  });
}

// Ratios the site lays out against. A cover is snapped to whichever of these
// its own dimensions sit closest to.
const ASPECTS = ['9/16', '2/3', '3/4', '4/5', '1/1', '4/3', '3/2', '16/9'];

// Compared on a log scale, because closeness here is proportional, not
// additive: 16/9 vs 3/2 differ by 0.28 and 3/4 vs 4/5 by only 0.05, yet both
// are one step apart to the eye. Linear distance would bias every borderline
// case towards the wide end.
function closestAspect(width, height) {
  if (!width || !height) return null;
  const target = Math.log(width / height);
  let best = ASPECTS[0];
  let bestGap = Infinity;
  ASPECTS.forEach(a => {
    const [w, h] = a.split('/').map(Number);
    const gap = Math.abs(Math.log(w / h) - target);
    if (gap < bestGap) { bestGap = gap; best = a; }
  });
  return best;
}

// Intrinsic pixel dimensions of a chosen file, read from the file itself
// rather than trusted from its name.
function naturalSize(file, type) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const done = (w, h) => { URL.revokeObjectURL(url); resolve({ w, h }); };
    const timer = setTimeout(() => done(0, 0), 8000);

    if (type === 'video') {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.addEventListener('loadedmetadata', () => {
        clearTimeout(timer); done(v.videoWidth, v.videoHeight);
      }, { once: true });
      v.addEventListener('error', () => { clearTimeout(timer); done(0, 0); }, { once: true });
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => { clearTimeout(timer); done(img.naturalWidth, img.naturalHeight); };
      img.onerror = () => { clearTimeout(timer); done(0, 0); };
      img.src = url;
    }
  });
}

// Grab a still from a video the moment it's chosen, so every clip ships with a
// poster. That frame is what the site shows before playback starts — and what
// stays on screen on a device that refuses to autoplay at all, instead of a
// black rectangle with a play button over it.
function videoPosterBase64(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;

    const done = (result) => { URL.revokeObjectURL(url); resolve(result); };
    const bail = () => done(null);

    // don't hold up a save if the browser can't decode this format
    const timer = setTimeout(bail, 8000);
    v.addEventListener('error', () => { clearTimeout(timer); bail(); }, { once: true });

    v.addEventListener('loadeddata', () => {
      // a hair into the clip — frame zero is often black on a fade-in
      v.currentTime = Math.min(0.3, (v.duration || 1) / 10);
    }, { once: true });

    v.addEventListener('seeked', () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        canvas.getContext('2d').drawImage(v, 0, 0);
        done(canvas.toDataURL('image/jpeg', 0.82).split(',')[1] || null);
      } catch { bail(); }
    }, { once: true });
  });
}

// Thumbnails show a video's poster rather than the video itself: a <video>
// paints black until it has decoded a frame, which for a list of them is both
// slow and ugly. Blob URLs from a just-picked file have no poster, so those
// still use the element. If a poster is missing the element takes over.
function buildPreviewMedia(url, type) {
  if (type === 'video') {
    const live = () => {
      const v = el('video');
      v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
      return v;
    };
    if (url.startsWith('blob:') || url.startsWith('data:')) return live();

    const wrap = el('div', 'preview-holder');
    const img = el('img');
    img.src = url.replace(/\.[^./]+$/, '') + '-poster.jpg';
    img.alt = '';
    img.addEventListener('error', () => { wrap.innerHTML = ''; wrap.append(live()); }, { once: true });
    wrap.append(img);
    return wrap;
  }
  const img = el('img');
  img.src = url;
  img.alt = '';
  return img;
}
function setStatus(msg, kind) {
  const s = $('#dash-status');
  s.textContent = msg;
  s.className = 'dash-status' + (kind ? ' ' + kind : '');
}

/* ---------------- GitHub API ---------------- */
async function gh(path, options = {}) {
  if (!CFG.token) throw new Error('No GitHub token set — open the Connection tab.');
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CFG.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch {}
    if (res.status === 401) {
      throw new Error('GitHub rejected the token (401) — it\'s expired, revoked, or was pasted incompletely. Generate a new one.');
    }
    if (res.status === 403) {
      // A fine-grained token that doesn't list this repo returns 403 even
      // though the repo is public, so "no access" and "read-only access"
      // look identical from here. Spell out both.
      throw new Error(
        'GitHub denied the request (403). With a fine-grained token this usually means the repo wasn\'t selected: ' +
        'under "Repository access" choose "Only select repositories" and pick this repo, AND under "Permissions" set ' +
        'Contents to "Read and write". A classic token with the "repo" scope avoids both steps.'
      );
    }
    if (res.status === 404) throw new Error(`Not found (404) — check the repository and branch names. ${detail}`);
    throw new Error(`GitHub error ${res.status}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

// Commit every changed file in one go via the git data API. Branch names
// contain slashes here, so they're interpolated raw rather than encoded.
async function commitFiles(files, message) {
  const repo = CFG.repo;
  const branch = CFG.branch;

  const ref = await gh(`/repos/${repo}/git/ref/heads/${branch}`);
  const baseSha = ref.object.sha;
  const baseCommit = await gh(`/repos/${repo}/git/commits/${baseSha}`);

  const tree = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setStatus(`Uploading ${i + 1} of ${files.length}…`);
    const blob = await gh(`/repos/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: f.base64, encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  setStatus('Committing…');
  const newTree = await gh(`/repos/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });
  const commit = await gh(`/repos/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
  });
  await gh(`/repos/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });
  return commit.sha;
}

/* ---------------- gate (local convenience only — see header note) ---------------- */
function boot() {
  if (sessionStorage.getItem('dash_unlocked') === '1') return enterDashboard();
  $('#gate').hidden = false;
}

$('#gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const errEl = $('#gate-error');
  errEl.hidden = true;
  if ($('#gate-pw').value !== DASH_PASSWORD) {
    errEl.textContent = 'Wrong password.';
    errEl.hidden = false;
    return;
  }
  sessionStorage.setItem('dash_unlocked', '1');
  enterDashboard();
});

// Load the content the *repository* currently holds, not what the published
// site is serving. Pages takes about a minute to redeploy after a commit, so
// reading the live file means a dashboard opened during that window loads
// pre-save content — and the next Save would write that stale copy back,
// silently undoing whatever the previous save added. Read through the API
// (which is immediately consistent) whenever a token is available, and keep
// the blob sha so Save can tell whether the file moved underneath us.
async function loadData() {
  if (CFG.token) {
    try {
      const file = await gh(`/repos/${CFG.repo}/contents/content/data.json?ref=${CFG.branch}`);
      baseDataSha = file.sha;
      const json = new TextDecoder().decode(
        Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0))
      );
      return JSON.parse(json);
    } catch (err) {
      setStatus(`Couldn't read the repo (${err.message}) — falling back to the published copy.`, 'err');
    }
  }
  baseDataSha = null;
  const res = await fetch('/content/data.json', { cache: 'no-cache' });
  return res.json();
}

async function enterDashboard() {
  $('#gate').hidden = true;
  $('#dash').hidden = false;
  if (!DATA) DATA = await loadData();
  renderAll();
  if (!CFG.token) {
    setStatus('No GitHub token yet — open Connection to enable saving.', 'err');
  }
}

/* ---------------- tabs ---------------- */
$$('.dash-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.dash-tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.dash-panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
  });
});

function renderAll() {
  renderTextPanel();
  renderSectionsPanel();
  renderMusicPanel();
  renderStorePanel();
  renderProjectsPanel();
  renderSettingsPanel();
}

/* ============================================================
   MUSIC — the playable album on the home page
   ============================================================ */
/* ============================================================
   STORE — the Google Maps listing on the home page
   ============================================================ */
function renderStorePanel() {
  const panel = $('#panel-store');
  panel.innerHTML = '';
  DATA.store = DATA.store || {
    title: '', years: '', address: '', blurb: '', embedUrl: '', mapsUrl: '',
  };
  const st = DATA.store;

  panel.append(el('h2', null, 'Store'));
  const intro = el('p', 'field-hint');
  intro.style.marginBottom = '16px';
  intro.textContent =
    'Shown as the last section on the home page, after every project section. ' +
    'The map is only loaded once a visitor reveals that far. Clear the map ' +
    'embed to hide the whole section.';
  panel.append(intro);

  const field = (label, key, hint, kind) => {
    const wrap = el('div', 'field');
    wrap.append(el('label', null, label));
    const input = el(kind === 'textarea' ? 'textarea' : 'input');
    if (kind !== 'textarea') input.type = 'text';
    input.value = st[key] || '';
    input.addEventListener('input', () => { st[key] = input.value.trim(); });
    wrap.append(input);
    if (hint) wrap.append(el('div', 'field-hint', hint));
    panel.append(wrap);
    return input;
  };

  field('Store name', 'title');
  field('Years open', 'years', 'Shown under the name, e.g. "2025 — 2026".');
  field('Address', 'address');
  field('Blurb (optional)', 'blurb', null, 'textarea');

  const embed = field(
    'Map embed', 'embedUrl',
    'Paste either a Google Maps URL or the whole <iframe> code from Google Maps → ' +
    'Share → Embed a map. Only google.com/maps addresses are accepted.'
  );
  const status = el('div', 'field-hint');
  status.style.marginTop = '4px';
  const checkEmbed = () => {
    const raw = (st.embedUrl || '').trim();
    if (!raw) {
      status.textContent = 'Empty — the Store section is hidden.';
      status.style.color = '';
      return;
    }
    const m = raw.match(/src\s*=\s*["']([^"']+)["']/i);
    const url = m ? m[1] : raw;
    if (/^https:\/\/(www\.)?(google\.[a-z.]+|maps\.google\.[a-z.]+)\//i.test(url)) {
      status.textContent = m ? '✓ iframe code recognised — its src will be used.' : '✓ Recognised.';
      status.style.color = '#4ade80';
    } else {
      status.textContent = 'Not a google.com/maps address — nothing will be shown.';
      status.style.color = 'var(--danger)';
    }
  };
  checkEmbed();
  embed.addEventListener('input', checkEmbed);
  embed.parentNode.append(status);

  field('"View on Google Maps" link', 'mapsUrl', 'Where the link under the name points. Empty hides it.');
}

function renderMusicPanel() {
  const panel = $('#panel-music');
  panel.innerHTML = '';
  DATA.music = DATA.music || {
    title: '', cover: '', spotifyUrl: '', youtubeUrl: '', appleMusicUrl: '', tracks: [],
  };
  const m = DATA.music;
  m.tracks = m.tracks || [];

  panel.append(el('h2', null, 'Music'));
  const intro = el('p', 'field-hint');
  intro.style.marginBottom = '16px';
  intro.textContent =
    'Shown as its own section right after the first one on the home page. ' +
    'Songs play right on the page from the audio files uploaded below, and ' +
    'the waveform reacts to the actual sound. The platform links only feed ' +
    'the icons above the album cover.';
  panel.append(intro);

  const textField = (label, key, hint) => {
    const field = el('div', 'field');
    field.append(el('label', null, label));
    const input = el('input');
    input.type = 'text';
    input.value = m[key] || '';
    input.addEventListener('input', () => { m[key] = input.value.trim(); });
    field.append(input);
    if (hint) field.append(el('div', 'field-hint', hint));
    panel.append(field);
  };

  textField('Album title', 'title');
  textField('Spotify album link', 'spotifyUrl', 'Also where the Spotify icon points.');
  textField('YouTube link (empty hides the icon)', 'youtubeUrl');
  textField('Apple Music link (empty hides the icon)', 'appleMusicUrl');

  panel.append(mediaSlot('Album cover', m.cover, 'image', (file) => {
    pendingUploads['music:cover'] = { file, apply: (path) => { m.cover = path; } };
  }));

  // tracks — title + audio file, reorderable
  const trackField = el('div', 'field');
  trackField.append(el('label', null, 'Tracks'));
  const list = el('div', 'gallery-list');
  let trackKey = 0;
  const renderTracks = () => {
    list.innerHTML = '';
    m.tracks.forEach((t, i) => {
      const row = el('div', 'music-track-row');
      const title = el('input');
      title.type = 'text'; title.placeholder = 'Song name'; title.value = t.title || '';
      title.addEventListener('input', () => { t.title = title.value; });

      const fileWrap = el('div', 'music-track-file');
      const file = el('input');
      file.type = 'file';
      file.accept = 'audio/*';
      const fileHint = el('div', 'field-hint',
        t.file ? `Current: ${t.file.split('/').pop()}` : 'No audio yet — the song won\'t show until one is uploaded.');
      file.addEventListener('change', () => {
        const f = file.files[0];
        if (!f) return;
        // key survives reordering because apply closes over this track object
        if (!t._key) t._key = `music:track:${++trackKey}:${Date.now()}`;
        pendingUploads[t._key] = { file: f, apply: (path) => { t.file = path; delete t._key; } };
        fileHint.textContent = `Will upload: ${f.name} (${(f.size / 1e6).toFixed(1)}MB)`;
      });
      fileWrap.append(file, fileHint);

      const up = el('button', 'icon-btn', '↑');
      up.type = 'button'; up.disabled = i === 0;
      up.addEventListener('click', () => { m.tracks.splice(i - 1, 0, m.tracks.splice(i, 1)[0]); renderTracks(); });
      const down = el('button', 'icon-btn', '↓');
      down.type = 'button'; down.disabled = i === m.tracks.length - 1;
      down.addEventListener('click', () => { m.tracks.splice(i + 1, 0, m.tracks.splice(i, 1)[0]); renderTracks(); });
      const rm = el('button', 'icon-btn icon-btn-danger', '✕');
      rm.type = 'button';
      rm.addEventListener('click', () => {
        if (t._key) delete pendingUploads[t._key];
        m.tracks.splice(i, 1);
        renderTracks();
      });
      row.append(title, fileWrap, up, down, rm);
      list.append(row);
    });
  };
  renderTracks();
  trackField.append(list);
  const addTrack = el('button', 'btn btn-sm btn-ghost', '+ Add track');
  addTrack.type = 'button';
  addTrack.style.marginTop = '8px';
  addTrack.addEventListener('click', () => { m.tracks.push({ title: '', file: '' }); renderTracks(); });
  trackField.append(addTrack);
  trackField.append(el('div', 'field-hint',
    'MP3 or M4A/AAC, ideally under 10MB a song. A track without an audio file is hidden from the site.'));
  panel.append(trackField);
}

/* ============================================================
   SITE TEXT
   ============================================================ */
function renderTextPanel() {
  const panel = $('#panel-text');
  panel.innerHTML = '';
  const site = DATA.site;

  const simpleFields = [
    ['name', 'Studio name'],
    ['title', 'Browser tab title'],
    ['description', 'Meta description', 'textarea'],
    ['heroLead', 'Hero — first line'],
    ['heroAccent', 'Hero — highlighted words'],
    ['heroSub', 'Hero — subtitle', 'textarea'],
    ['studioLabel', 'Studio section label (leave empty to hide it)'],
    ['studioBlurb', 'Studio blurb', 'textarea'],
    ['contactLabel', 'Contact label'],
    ['email', 'Email'],
    ['phone', 'Phone (leave empty to hide it)'],
    ['instagramUrl', 'Instagram URL (leave empty to hide the icon)'],
    ['knotsssUrl', 'knotsss URL (leave empty to hide the icon)'],
  ];

  simpleFields.forEach(([key, label, kind]) => {
    const field = el('div', 'field');
    field.append(el('label', null, label));
    const input = el(kind === 'textarea' ? 'textarea' : 'input');
    if (kind !== 'textarea') input.type = 'text';
    input.value = site[key] || '';
    input.addEventListener('input', () => { site[key] = input.value; });
    field.append(input);
    panel.append(field);
  });

  // disciplines — reorderable text list
  const discField = el('div', 'field list-field');
  discField.append(el('label', null, 'Disciplines'));
  const ul = el('ul');
  discField.append(ul);
  const renderDisciplines = () => {
    ul.innerHTML = '';
    site.disciplines.forEach((d, i) => {
      const li = el('li');
      const input = el('input');
      input.type = 'text'; input.value = d;
      input.addEventListener('input', () => { site.disciplines[i] = input.value; });
      const rm = el('button', 'icon-btn icon-btn-danger', '✕');
      rm.type = 'button';
      rm.addEventListener('click', () => { site.disciplines.splice(i, 1); renderDisciplines(); });
      li.append(input, rm);
      ul.append(li);
    });
  };
  renderDisciplines();
  const addDisc = el('button', 'btn btn-sm btn-ghost', '+ Add discipline');
  addDisc.type = 'button';
  addDisc.addEventListener('click', () => { site.disciplines.push(''); renderDisciplines(); });
  discField.append(addDisc);
  panel.append(discField);

  // softwares — reorderable text list
  site.softwares = site.softwares || [];
  const softField = el('div', 'field list-field');
  softField.append(el('label', null, 'Softwares'));
  const softUl = el('ul');
  softField.append(softUl);
  const renderSoftwares = () => {
    softUl.innerHTML = '';
    site.softwares.forEach((s, i) => {
      const li = el('li');
      const input = el('input');
      input.type = 'text'; input.value = s;
      input.addEventListener('input', () => { site.softwares[i] = input.value; });
      const rm = el('button', 'icon-btn icon-btn-danger', '✕');
      rm.type = 'button';
      rm.addEventListener('click', () => { site.softwares.splice(i, 1); renderSoftwares(); });
      li.append(input, rm);
      softUl.append(li);
    });
  };
  renderSoftwares();
  const addSoft = el('button', 'btn btn-sm btn-ghost', '+ Add software');
  addSoft.type = 'button';
  addSoft.addEventListener('click', () => { site.softwares.push(''); renderSoftwares(); });
  softField.append(addSoft);
  panel.append(softField);
}

/* ============================================================
   SECTIONS
   ============================================================ */
function projectThumb(p) {
  const wrap = el('div', 'row-thumb');
  if (p?.cover) wrap.append(buildPreviewMedia(p.cover, p.coverType));
  return wrap;
}

function renderSectionsPanel() {
  const panel = $('#panel-sections');
  panel.innerHTML = '';

  DATA.sections.forEach((section, sIdx) => {
    const card = el('div', 'card open');

    const head = el('div', 'field');
    head.style.padding = '16px 16px 0';

    // section-level controls sit at the top of the card, right above its
    // title, so reordering/deleting never needs scrolling past the
    // project list to find
    const ctrl = el('div', 'add-row');
    ctrl.style.marginBottom = '12px';
    const upSec = el('button', 'icon-btn', '↑');
    upSec.type = 'button'; upSec.title = 'Move section up'; upSec.disabled = sIdx === 0;
    upSec.addEventListener('click', () => {
      [DATA.sections[sIdx - 1], DATA.sections[sIdx]] = [DATA.sections[sIdx], DATA.sections[sIdx - 1]];
      renderSectionsPanel();
    });
    const downSec = el('button', 'icon-btn', '↓');
    downSec.type = 'button'; downSec.title = 'Move section down'; downSec.disabled = sIdx === DATA.sections.length - 1;
    downSec.addEventListener('click', () => {
      [DATA.sections[sIdx + 1], DATA.sections[sIdx]] = [DATA.sections[sIdx], DATA.sections[sIdx + 1]];
      renderSectionsPanel();
    });
    const spacer = el('span', 'row-spacer');
    const delSec = el('button', 'btn btn-sm', 'Delete section');
    delSec.type = 'button';
    delSec.style.color = 'var(--danger)';
    delSec.addEventListener('click', () => {
      if (confirm(`Delete the "${section.title || '(untitled)'}" section? Projects stay, only this grouping goes.`)) {
        DATA.sections.splice(sIdx, 1);
        renderSectionsPanel();
      }
    });
    ctrl.append(upSec, downSec, spacer, delSec);
    head.append(ctrl);

    const titleField = el('div', 'field');
    titleField.append(el('label', null, sIdx === 0
      ? 'Title (leave empty — first section is untitled)'
      : 'Section title'));
    const titleInput = el('input');
    titleInput.type = 'text';
    titleInput.value = section.title || '';
    titleInput.placeholder = sIdx === 0 ? '(untitled)' : 'e.g. Fashion';
    titleInput.addEventListener('input', () => { section.title = titleInput.value; });
    titleField.append(titleInput);
    head.append(titleField);
    card.append(head);

    const body = el('div', 'card-body');
    body.style.display = 'block';

    const ul = el('ul', 'row-list');
    body.append(ul);

    const renderRows = () => {
      ul.innerHTML = '';
      section.projectIds.forEach((pid, i) => {
        const p = DATA.projects.find(x => x.id === pid);
        const tpl = $('#tpl-section-project-row').content.cloneNode(true);
        const li = tpl.querySelector('.row-item');
        li.querySelector('.row-thumb').replaceWith(projectThumb(p));
        li.querySelector('.row-title').textContent = p ? p.title : `(missing: ${pid})`;
        const upBtn = li.querySelector('[data-act="up"]');
        const downBtn = li.querySelector('[data-act="down"]');
        upBtn.disabled = i === 0;
        downBtn.disabled = i === section.projectIds.length - 1;
        upBtn.addEventListener('click', () => {
          [section.projectIds[i - 1], section.projectIds[i]] = [section.projectIds[i], section.projectIds[i - 1]];
          renderRows();
        });
        downBtn.addEventListener('click', () => {
          [section.projectIds[i + 1], section.projectIds[i]] = [section.projectIds[i], section.projectIds[i + 1]];
          renderRows();
        });
        li.querySelector('[data-act="remove"]').addEventListener('click', () => {
          section.projectIds.splice(i, 1);
          renderRows();
        });
        ul.append(li);
      });
    };
    renderRows();

    const addRow = el('div', 'add-row');
    const select = el('select');
    const addBtn = el('button', 'btn btn-sm btn-ghost', 'Add');
    addBtn.type = 'button';
    const refreshSelect = () => {
      select.innerHTML = '';
      const available = DATA.projects.filter(p => !section.projectIds.includes(p.id));
      if (!available.length) {
        select.append(el('option', null, 'All projects already in this section'));
        select.disabled = true; addBtn.disabled = true;
        return;
      }
      select.disabled = false; addBtn.disabled = false;
      available.forEach(p => {
        const opt = el('option', null, p.title);
        opt.value = p.id;
        select.append(opt);
      });
    };
    refreshSelect();
    addBtn.addEventListener('click', () => {
      if (select.value) {
        section.projectIds.push(select.value);
        renderRows();
        refreshSelect();
      }
    });
    addRow.append(select, addBtn);
    body.append(addRow);

    card.append(body);
    panel.append(card);
  });

  const addSection = el('button', 'btn btn-sm btn-ghost', '+ Add section');
  addSection.type = 'button';
  addSection.style.marginTop = '4px';
  addSection.addEventListener('click', () => {
    DATA.sections.push({ id: `section-${Date.now()}`, title: 'New section', projectIds: [] });
    renderSectionsPanel();
  });
  panel.append(addSection);
}

/* ============================================================
   PROJECTS
   ============================================================ */
// mirrors embedSrc() in js/app.js — just the yes/no, for inline feedback
function embedRecognised(url) {
  return /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)[\w-]{6,}/.test(url)
      || /vimeo\.com\/(?:video\/)?\d+/.test(url);
}

// Scrub a video cover and mark which slice should loop on the home grid.
// Returns { node, load(url, type) } so a freshly picked file can replace
// the preview without rebuilding the whole card.
// Crop a cover to a ratio by choosing the ratio and then which part of the
// picture survives it. Nothing is re-encoded — the file is left alone and the
// site fills the tile with it, so this stays lossless and reversible, and the
// same control works for video and stills alike.
function buildCropper(p) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, 'Crop — the shape of the tile, and what stays in it'));

  const frame = el('div', 'crop-frame');
  const empty = el('div', 'media-preview empty', 'No cover yet');
  let media = null;
  let onAspectChange = null;

  const chips = el('div', 'chip-row');
  const hint = el('div', 'field-hint');

  const apply = () => {
    const aspect = p.aspect || '1/1';
    frame.style.aspectRatio = aspect.replace('/', ' / ');
    const x = p.coverX == null ? 50 : p.coverX;
    const y = p.coverY == null ? 50 : p.coverY;
    if (media) media.style.objectPosition = `${x}% ${y}%`;
    [...chips.children].forEach(c => {
      c.classList.toggle('chip-on', c.dataset.aspect === aspect);
    });
    hint.textContent = media
      ? 'Drag the sliders to choose what stays in frame. The file itself is untouched.'
      : 'Upload a cover above to crop it.';
  };

  ASPECTS.forEach(a => {
    const chip = el('button', 'chip', a);
    chip.type = 'button';
    chip.dataset.aspect = a;
    chip.addEventListener('click', () => {
      p.aspect = a;
      onAspectChange?.(a);
      apply();
    });
    chips.append(chip);
  });

  const slider = (labelText, key) => {
    const row = el('div', 'crop-row');
    row.append(el('span', 'crop-label', labelText));
    const input = el('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '1';
    input.value = String(p[key] == null ? 50 : p[key]);
    input.addEventListener('input', () => { p[key] = Number(input.value); apply(); });
    row.append(input);
    return { row, input };
  };
  const across = slider('Across', 'coverX');
  const down = slider('Down', 'coverY');

  const reset = el('button', 'btn btn-sm btn-ghost', 'Centre it');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    p.coverX = 50; p.coverY = 50;
    across.input.value = '50'; down.input.value = '50';
    apply();
  });

  wrap.append(chips, frame, empty, across.row, down.row, reset, hint);

  const load = (url, type) => {
    frame.innerHTML = '';
    if (!url) { frame.hidden = true; empty.hidden = false; media = null; apply(); return; }
    frame.hidden = false;
    empty.hidden = true;
    media = buildPreviewMedia(url, type);
    frame.append(media);
    apply();
  };

  load(p.cover, p.coverType);

  return {
    node: wrap,
    load,
    refresh: apply,
    set onAspect(fn) { onAspectChange = fn; },
  };
}

// Shared by two independent controls: the loop range that repeats on the
// project's own page (loopStart/loopEnd), and the trim that decides what
// shows in the home grid tile (previewStart/previewEnd). Same UI pattern,
// different fields and each with its own <video> so scrubbing one never
// disturbs the other.
function buildTrimPicker(p, { startKey, endKey, label, emptyHint, playLabel, resetLabel, helpHint }) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, label));

  const video = el('video', 'loop-preview');
  video.controls = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  const empty = el('div', 'field-hint', emptyHint);

  const mk = (labelText, key) => {
    const box = el('div', 'loop-field');
    box.append(el('span', 'loop-label', labelText));
    const input = el('input');
    input.type = 'number'; input.min = '0'; input.step = '0.1';
    input.value = Number(p[key]) || 0;
    input.addEventListener('input', () => { p[key] = Number(input.value) || 0; });
    const grab = el('button', 'btn btn-sm', 'Use current');
    grab.type = 'button';
    grab.addEventListener('click', () => {
      const t = Math.round(video.currentTime * 10) / 10;
      input.value = t;
      p[key] = t;
    });
    box.append(input, grab);
    return box;
  };

  const row = el('div', 'loop-row');
  row.append(mk('Start', startKey), mk('End', endKey));

  const controls = el('div', 'add-row');
  const play = el('button', 'btn btn-sm btn-primary', playLabel);
  play.type = 'button';
  const reset = el('button', 'btn btn-sm', resetLabel);
  reset.type = 'button';
  controls.append(play, reset);

  const hint = el('div', 'field-hint', helpHint);

  // preview the chosen slice, wrapping the same way the site does
  let watcher = null;
  const stopWatch = () => { if (watcher) { video.removeEventListener('timeupdate', watcher); watcher = null; } };
  play.addEventListener('click', () => {
    stopWatch();
    const s = Number(p[startKey]) || 0;
    const e = Number(p[endKey]) || 0;
    try { video.currentTime = s; } catch {}
    video.play().catch(() => {});
    watcher = () => {
      const stop = e > s ? e : (video.duration || Infinity);
      if (video.currentTime >= stop - 0.05) {
        try { video.currentTime = s; } catch {}
        video.play().catch(() => {});
      }
    };
    video.addEventListener('timeupdate', watcher);
  });
  reset.addEventListener('click', () => {
    stopWatch();
    p[startKey] = 0; p[endKey] = 0;
    $$('input[type="number"]', row).forEach(i => { i.value = 0; });
    video.pause();
  });

  const show = (isVideo) => {
    video.hidden = !isVideo;
    row.hidden = !isVideo;
    controls.hidden = !isVideo;
    hint.hidden = !isVideo;
    empty.hidden = isVideo;
  };

  const load = (url, type) => {
    stopWatch();
    const isVideo = type === 'video';
    if (isVideo && url) video.src = url;
    show(isVideo);
  };

  wrap.append(video, empty, row, controls, hint);
  load(p.cover, p.coverType);

  return { node: wrap, load };
}

function buildLoopPicker(p) {
  return buildTrimPicker(p, {
    startKey: 'loopStart', endKey: 'loopEnd',
    label: 'Loop section — the part that repeats on this project\'s own page',
    emptyHint: 'This project\'s cover is an image — loop points only apply to video covers.',
    playLabel: '▶ Preview loop',
    resetLabel: 'Whole clip',
    helpHint: 'Scrub to a moment, then "Use current". Leave both at 0 to loop the whole clip.',
  });
}

function buildPreviewTrimPicker(p) {
  return buildTrimPicker(p, {
    startKey: 'previewStart', endKey: 'previewEnd',
    label: 'Home page preview — trims what shows in the home grid only',
    emptyHint: 'This project\'s cover is an image — trimming only applies to video covers.',
    playLabel: '▶ Preview trim',
    resetLabel: 'Whole clip',
    helpHint: 'Scrub to a moment, then "Use current". This only affects the home grid tile — the project\'s own page always plays the loop section above (or the whole clip). Leave both at 0 to show the whole clip on the home grid too.',
  });
}

function mediaSlot(label, currentUrl, currentType, onFile) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, label));
  const slot = el('div', 'media-slot');

  const preview = el('div', 'media-preview' + (currentUrl ? '' : ' empty'));
  if (currentUrl) preview.append(buildPreviewMedia(currentUrl, currentType));
  else preview.textContent = 'No file';

  const controls = el('div', 'media-controls');
  const input = el('input');
  input.type = 'file';
  input.accept = 'image/*,video/mp4,video/webm,video/quicktime';
  const hint = el('div', 'field-hint', 'Photo, video or GIF (keep under 25MB). Videos/GIFs loop automatically wherever they appear.');
  const warn = el('div', 'field-hint');
  warn.style.color = 'var(--danger)';
  warn.hidden = true;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    warn.hidden = file.size <= MAX_RECOMMENDED_BYTES;
    if (!warn.hidden) warn.textContent = `${(file.size / 1024 / 1024).toFixed(1)}MB — too large to commit reliably from the browser. Compress it below 25MB first.`;
    const objectUrl = URL.createObjectURL(file);
    const type = typeFromMime(file.type);
    preview.classList.remove('empty');
    preview.innerHTML = '';
    preview.append(buildPreviewMedia(objectUrl, type));
    onFile(file, type, objectUrl);
  });

  controls.append(input, hint, warn);
  slot.append(preview, controls);
  wrap.append(slot);
  return wrap;
}

function renderProjectsPanel() {
  const panel = $('#panel-projects');
  panel.innerHTML = '';

  DATA.projects.forEach((p) => {
    const card = el('div', 'card');
    const head = el('button', 'card-head');
    head.type = 'button';
    const headTitle = el('div', 'card-head-title');
    const thumb = el('div', 'card-head-thumb');
    if (p.cover) thumb.append(buildPreviewMedia(p.cover, p.coverType));
    const nameWrap = el('div');
    const nameEl = el('div', 'card-head-name', p.title || '(untitled)');
    const subEl = el('div', 'card-head-sub', `${p.category || '—'} · ${p.year || '—'}`);
    nameWrap.append(nameEl, subEl);
    headTitle.append(thumb, nameWrap);
    const chevron = el('span', 'card-chevron', '⌄');
    head.append(headTitle, chevron);
    head.addEventListener('click', () => card.classList.toggle('open'));
    card.append(head);

    const body = el('div', 'card-body');

    const textFields = [
      ['title', 'Title'],
      ['category', 'Category / discipline (for your own reference)'],
      ['year', 'Year'],
      ['role', 'Role'],
      ['aspect', 'Cover aspect ratio (16/9 and 9/16 each take a whole row)'],
      ['summary', 'Summary', 'textarea'],
      ['narrative', 'Narrative', 'textarea'],
    ];
    const inputs = {};
    const hints = {};
    textFields.forEach(([key, label, kind]) => {
      const field = el('div', 'field');
      field.append(el('label', null, label));
      const input = el(kind === 'textarea' ? 'textarea' : 'input');
      if (kind !== 'textarea') input.type = 'text';
      input.value = p[key] || '';
      input.addEventListener('input', () => {
        p[key] = input.value;
        if (key === 'title') { nameEl.textContent = input.value || '(untitled)'; }
        if (key === 'category' || key === 'year') { subEl.textContent = `${p.category || '—'} · ${p.year || '—'}`; }
      });
      field.append(input);
      inputs[key] = input;
      if (key === 'aspect') {
        hints.aspect = el('div', 'field-hint', 'Set automatically from the cover you upload. Change it here to override.');
        field.append(hints.aspect);
      }
      body.append(field);
    });

    // which home page sections this project appears in — the same
    // section.projectIds the Sections tab edits, just reachable from the
    // project you're already looking at
    const secField = el('div', 'field');
    secField.append(el('label', null, 'Show in these home page sections'));
    const chipRow = el('div', 'chip-row');
    const renderChips = () => {
      chipRow.innerHTML = '';
      DATA.sections.forEach(s => {
        s.projectIds = s.projectIds || [];
        const on = s.projectIds.includes(p.id);
        const chip = el('button', on ? 'chip chip-on' : 'chip', s.title || 'Featured (untitled)');
        chip.type = 'button';
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        chip.addEventListener('click', () => {
          const i = s.projectIds.indexOf(p.id);
          if (i === -1) s.projectIds.push(p.id); else s.projectIds.splice(i, 1);
          renderChips();
          renderSectionsPanel();
        });
        chipRow.append(chip);
      });
      if (!DATA.sections.length) {
        chipRow.append(el('div', 'field-hint', 'No sections yet — add one in the Sections tab.'));
      }
    };
    renderChips();
    secField.append(chipRow);
    secField.append(el('div', 'field-hint', 'Tap to add or remove. Position within a section is set in the Sections tab.'));
    body.append(secField);

    // full-piece embed
    const embedField = el('div', 'field');
    embedField.append(el('label', null, 'Full video link (YouTube or Vimeo)'));
    const embedInput = el('input');
    embedInput.type = 'text';
    embedInput.value = p.embedUrl || '';
    embedInput.placeholder = 'https://vimeo.com/… or https://youtube.com/watch?v=…';
    const embedHint = el('div', 'field-hint');
    const refreshEmbedHint = () => {
      const v = embedInput.value.trim();
      if (!v) { embedHint.textContent = 'Optional. Adds a player to the project page — best for anything too long to self-host.'; embedHint.style.color = ''; }
      else if (embedRecognised(v)) { embedHint.textContent = '✓ Recognised — a player will show on the project page.'; embedHint.style.color = '#4ade80'; }
      else { embedHint.textContent = 'Not a YouTube or Vimeo link — nothing will be shown.'; embedHint.style.color = 'var(--danger)'; }
    };
    refreshEmbedHint();
    embedInput.addEventListener('input', () => { p.embedUrl = embedInput.value.trim(); refreshEmbedHint(); });
    embedField.append(embedInput, embedHint);
    body.append(embedField);

    // cover
    let loopPicker;
    let previewTrimPicker;
    let cropper;
    body.append(mediaSlot('Cover', p.cover, p.coverType, (file, type, objectUrl) => {
      const key = `cover:${p.id}`;
      pendingUploads[key] = { file, apply: (path, t) => { p.cover = path; p.coverType = t; thumb.innerHTML = ''; thumb.append(buildPreviewMedia(path, t)); } };
      loopPicker?.load(objectUrl, type);
      previewTrimPicker?.load(objectUrl, type);
      cropper?.load(objectUrl, type);

      // snap the ratio to whichever the file's own dimensions sit closest to,
      // so the tile matches the artwork without anyone having to work it out
      naturalSize(file, type).then(({ w, h }) => {
        const match = closestAspect(w, h);
        if (!match) return;
        p.aspect = match;
        inputs.aspect.value = match;
        if (hints.aspect) {
          hints.aspect.textContent =
            `Set to ${match} from this file (${w}×${h}). Change it here to override.`;
        }
        cropper?.refresh();
      });
    }));

    // crop / framing
    cropper = buildCropper(p);
    cropper.onAspect = (a) => {
      inputs.aspect.value = a;
      if (hints.aspect) hints.aspect.textContent = `Set to ${a}. Upload a cover to have this chosen automatically.`;
    };
    body.append(cropper.node);
    // typing a ratio by hand should move the crop preview too
    inputs.aspect.addEventListener('input', () => cropper.refresh());

    // loop section — repeats on the project's own page (only meaningful for video covers)
    loopPicker = buildLoopPicker(p);
    body.append(loopPicker.node);

    // home page preview trim — independent of the loop above, home grid only
    previewTrimPicker = buildPreviewTrimPicker(p);
    body.append(previewTrimPicker.node);

    // gallery
    const galField = el('div', 'field');
    galField.append(el('label', null, 'Gallery (extra photos/videos shown on the project page)'));
    const galList = el('div', 'gallery-list');
    const renderGallery = () => {
      galList.innerHTML = '';
      p.gallery.forEach((g, gi) => {
        const row = el('div', 'gallery-item');
        row.append(mediaSlot(`Item ${gi + 1}`, g.url, g.type, (file) => {
          const key = `gallery:${p.id}:${gi}`;
          pendingUploads[key] = { file, apply: (path, type) => { p.gallery[gi] = { url: path, type }; } };
        }));
        const rm = el('button', 'icon-btn icon-btn-danger', '✕');
        rm.type = 'button';
        rm.title = 'Remove this item';
        rm.addEventListener('click', () => { p.gallery.splice(gi, 1); renderGallery(); });
        row.append(rm);
        galList.append(row);
      });
    };
    renderGallery();
    galField.append(galList);
    const addGal = el('button', 'btn btn-sm btn-ghost', '+ Add gallery item');
    addGal.type = 'button';
    addGal.style.marginTop = '8px';
    addGal.addEventListener('click', () => { p.gallery.push({ url: '', type: 'image' }); renderGallery(); });
    galField.append(addGal);
    body.append(galField);

    body.append(el('div', 'divider'));
    const delBtn = el('button', 'btn btn-sm', 'Delete project');
    delBtn.type = 'button';
    delBtn.style.color = 'var(--danger)';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${p.title}"? This also removes it from every section.`)) return;
      DATA.projects = DATA.projects.filter(x => x.id !== p.id);
      DATA.sections.forEach(s => { s.projectIds = s.projectIds.filter(id => id !== p.id); });
      renderProjectsPanel();
      renderSectionsPanel();
    });
    body.append(delBtn);

    card.append(body);
    panel.append(card);
  });

  const addProject = el('button', 'btn btn-sm btn-ghost', '+ Add new project');
  addProject.type = 'button';
  addProject.style.marginTop = '4px';
  addProject.addEventListener('click', () => {
    const title = prompt('Project title?');
    if (!title) return;
    const id = uniqueId(title, DATA.projects.map(p => p.id));
    DATA.projects.push({
      id, title, category: '', year: String(new Date().getFullYear()), role: '',
      cover: '', coverType: 'image', aspect: '1/1', coverX: 50, coverY: 50,
      loopStart: 0, loopEnd: 0, previewStart: 0, previewEnd: 0,
      summary: '', narrative: '', gallery: [],
    });
    renderProjectsPanel();
    renderSectionsPanel(); // new project becomes selectable in "add to section"
  });
  panel.append(addProject);
}

/* ============================================================
   CONNECTION
   ============================================================ */
function renderSettingsPanel() {
  $('#cfg-token').value = CFG.token;
  $('#cfg-branch').value = CFG.branch;
  $('#cfg-repo').value = CFG.repo;

  const status = $('#cfg-status');
  const setCfgStatus = (msg, kind) => {
    status.textContent = msg;
    status.style.color = kind === 'ok' ? '#4ade80' : kind === 'err' ? 'var(--danger)' : 'var(--muted)';
  };
  setCfgStatus(CFG.token ? 'Token saved in this browser.' : 'No token set — saving is disabled.');

  $('#cfg-save').onclick = () => {
    CFG.token = $('#cfg-token').value.trim();
    CFG.branch = $('#cfg-branch').value.trim();
    CFG.repo = $('#cfg-repo').value.trim();
    setCfgStatus('Saved. Try "Test connection".', 'ok');
    setStatus('');
  };

  $('#cfg-test').onclick = async () => {
    setCfgStatus('Testing…');
    try {
      CFG.token = $('#cfg-token').value.trim();
      CFG.branch = $('#cfg-branch').value.trim();
      CFG.repo = $('#cfg-repo').value.trim();
      const ref = await gh(`/repos/${CFG.repo}/git/ref/heads/${CFG.branch}`);
      setCfgStatus(`Connected. Branch "${CFG.branch}" is at ${ref.object.sha.slice(0, 7)}.`, 'ok');
    } catch (err) {
      setCfgStatus(err.message, 'err');
    }
  };

  $('#cfg-forget').onclick = () => {
    CFG.token = '';
    $('#cfg-token').value = '';
    setCfgStatus('Token removed from this browser.', 'ok');
  };
}

/* ============================================================
   SAVE — one commit containing any new media plus data.json
   ============================================================ */
$('#save-btn').addEventListener('click', async () => {
  const btn = $('#save-btn');

  if (!CFG.token) {
    setStatus('No GitHub token set — open the Connection tab.', 'err');
    return;
  }

  btn.disabled = true;
  setStatus('Preparing…');
  try {
    // Bail out rather than clobber if content/data.json changed since it was
    // loaded here — another tab, another device, or a push. Overwriting would
    // wipe whatever that change added, which is exactly the failure this
    // guard exists to prevent.
    if (baseDataSha) {
      const current = await gh(`/repos/${CFG.repo}/contents/content/data.json?ref=${CFG.branch}`);
      if (current.sha !== baseDataSha) {
        throw new Error(
          'The site content changed somewhere else since this page was opened. ' +
          'Saving now would overwrite it. Reload the dashboard to pick up the ' +
          'newer version, then redo this edit.'
        );
      }
    }

    const files = [];
    const applies = [];

    for (const key of Object.keys(pendingUploads)) {
      const { file, apply } = pendingUploads[key];

      // Shrink before the size check, not after — a big photo that compresses
      // to well under the limit shouldn't be turned away for its original size.
      setStatus(`Preparing ${file.name}…`);
      const slim = await shrinkImage(file);
      if (slim !== file) {
        setStatus(`Compressed ${file.name}: ${(file.size / 1e6).toFixed(1)}MB → ${(slim.size / 1e6).toFixed(1)}MB`);
      }
      if (slim.size > MAX_RECOMMENDED_BYTES) {
        throw new Error(`${file.name} is ${(slim.size / 1024 / 1024).toFixed(1)}MB — too large to commit reliably from the browser. Compress it first.`);
      }
      const base64 = await fileToBase64(slim);
      const path = `assets/${makeFilename(slim.name)}`;
      files.push({ path, base64 });

      if (typeFromMime(file.type) === 'video') {
        setStatus('Making a poster frame…');
        const poster = await videoPosterBase64(file);
        // named after the clip — that convention is how the site finds it
        if (poster) files.push({ path: path.replace(/\.[^./]+$/, '') + '-poster.jpg', base64: poster });
      }

      applies.push(() => apply(path, typeFromMime(file.type)));
    }

    // point the data at its new asset paths before serialising it
    applies.forEach(fn => fn());

    // An "+ Add gallery item" slot that never got a file is an empty row; left
    // in, it renders as a broken image on the project page.
    DATA.projects.forEach(pr => {
      if (Array.isArray(pr.gallery)) pr.gallery = pr.gallery.filter(g => g && g.url);
    });

    files.push({
      path: 'content/data.json',
      base64: bytesToBase64(new TextEncoder().encode(JSON.stringify(DATA, null, 2) + '\n')),
    });

    await commitFiles(files, 'dash: update site content');
    pendingUploads = {};
    // Re-read the sha we just wrote so a second save in the same session
    // isn't rejected by the guard above as a phantom conflict.
    if (baseDataSha) {
      try {
        const written = await gh(`/repos/${CFG.repo}/contents/content/data.json?ref=${CFG.branch}`);
        baseDataSha = written.sha;
      } catch { baseDataSha = null; }
    }
    setStatus('Saved — the site rebuilds in about a minute.', 'ok');
  } catch (err) {
    setStatus(err.message || 'Something went wrong.', 'err');
  } finally {
    btn.disabled = false;
  }
});

// btoa() only handles latin-1, so UTF-8 content (em dashes, accents) has
// to be converted from raw bytes instead
function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

boot();
