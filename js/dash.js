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
function buildPreviewMedia(url, type) {
  if (type === 'video') {
    const v = el('video');
    v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    return v;
  }
  const img = el('img');
  img.src = url;
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
  renderProjectsPanel();
  renderSettingsPanel();
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
function buildLoopPicker(p) {
  const wrap = el('div', 'field');
  wrap.append(el('label', null, 'Loop section — the part that plays on the home grid'));

  const video = el('video', 'loop-preview');
  video.controls = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';

  const empty = el('div', 'field-hint', 'This project\'s cover is an image — loop points only apply to video covers.');

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
  row.append(mk('Start', 'loopStart'), mk('End', 'loopEnd'));

  const controls = el('div', 'add-row');
  const play = el('button', 'btn btn-sm btn-primary', '▶ Preview loop');
  play.type = 'button';
  const reset = el('button', 'btn btn-sm', 'Whole clip');
  reset.type = 'button';
  controls.append(play, reset);

  const hint = el('div', 'field-hint', 'Scrub to a moment, then "Use current". Leave both at 0 to loop the whole clip.');

  // preview the chosen slice, wrapping the same way the site does
  let watcher = null;
  const stopWatch = () => { if (watcher) { video.removeEventListener('timeupdate', watcher); watcher = null; } };
  play.addEventListener('click', () => {
    stopWatch();
    const s = Number(p.loopStart) || 0;
    const e = Number(p.loopEnd) || 0;
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
    p.loopStart = 0; p.loopEnd = 0;
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
      ['category', 'Category / discipline (shown on the project page)'],
      ['year', 'Year'],
      ['role', 'Role'],
      ['aspect', 'Cover aspect ratio (e.g. 4/5, 16/9, 1/1 — 9/16 takes a whole row)'],
      ['summary', 'Summary', 'textarea'],
      ['narrative', 'Narrative', 'textarea'],
    ];
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
      body.append(field);
    });

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
    body.append(mediaSlot('Cover', p.cover, p.coverType, (file, type, objectUrl) => {
      const key = `cover:${p.id}`;
      pendingUploads[key] = { file, apply: (path, t) => { p.cover = path; p.coverType = t; thumb.innerHTML = ''; thumb.append(buildPreviewMedia(path, t)); } };
      loopPicker?.load(objectUrl, type);
    }));

    // loop section (only meaningful when the cover is a video)
    loopPicker = buildLoopPicker(p);
    body.append(loopPicker.node);

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
      cover: '', coverType: 'image', aspect: '1/1', summary: '', narrative: '', gallery: [],
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
      if (file.size > MAX_RECOMMENDED_BYTES) {
        throw new Error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — too large to commit reliably from the browser. Compress it first.`);
      }
      const base64 = await fileToBase64(file);
      const path = `assets/${makeFilename(file.name)}`;
      files.push({ path, base64 });
      applies.push(() => apply(path, typeFromMime(file.type)));
    }

    // point the data at its new asset paths before serialising it
    applies.forEach(fn => fn());

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
