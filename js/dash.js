// ============================================================
//  DEON — Dashboard (/dash)
//  Edits content/data.json and uploads media by committing to the
//  GitHub repo through two small serverless functions (api/dash-
//  login.js, api/dash-save.js, api/dash-upload.js). Everything here
//  is in-memory until "Save changes" is pressed.
// ============================================================

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let PW = sessionStorage.getItem('dash_pw') || '';
let DATA = null;
// key -> { file, apply(path, type) } — resolved into real asset paths on Save
let pendingUploads = {};
let uploadSeq = 0;

const MAX_RECOMMENDED_BYTES = 4 * 1024 * 1024;

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

/* ---------------- login ---------------- */
async function tryLogin(password) {
  const res = await fetch('/api/dash-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

async function boot() {
  if (PW) {
    const ok = await tryLogin(PW).catch(() => false);
    if (ok) return enterDashboard();
    sessionStorage.removeItem('dash_pw');
    PW = '';
  }
  $('#gate').hidden = false;
}

$('#gate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = $('#gate-pw').value;
  const errEl = $('#gate-error');
  errEl.hidden = true;
  const submitBtn = $('#gate-form button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const ok = await tryLogin(pw);
    if (!ok) throw new Error('Wrong password.');
    PW = pw;
    sessionStorage.setItem('dash_pw', pw);
    await enterDashboard();
  } catch (err) {
    errEl.textContent = err.message || 'Could not log in.';
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

async function enterDashboard() {
  $('#gate').hidden = true;
  $('#dash').hidden = false;
  if (!DATA) {
    const res = await fetch('/content/data.json', { cache: 'no-cache' });
    DATA = await res.json();
  }
  renderAll();
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
    ['studioLabel', 'Studio section label'],
    ['studioBlurb', 'Studio blurb', 'textarea'],
    ['contactLabel', 'Contact label'],
    ['email', 'Email'],
    ['backToTop', 'Back-to-top label'],
    ['copyright', 'Copyright line'],
    ['systemTag', 'Footer system tag'],
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

    // section-level controls: reorder / delete
    const ctrl = el('div', 'add-row');
    ctrl.style.marginTop = '16px';
    const upSec = el('button', 'btn btn-sm btn-ghost', '↑ Move section up');
    upSec.type = 'button'; upSec.disabled = sIdx === 0;
    upSec.addEventListener('click', () => {
      [DATA.sections[sIdx - 1], DATA.sections[sIdx]] = [DATA.sections[sIdx], DATA.sections[sIdx - 1]];
      renderSectionsPanel();
    });
    const downSec = el('button', 'btn btn-sm btn-ghost', '↓ Move down');
    downSec.type = 'button'; downSec.disabled = sIdx === DATA.sections.length - 1;
    downSec.addEventListener('click', () => {
      [DATA.sections[sIdx + 1], DATA.sections[sIdx]] = [DATA.sections[sIdx], DATA.sections[sIdx + 1]];
      renderSectionsPanel();
    });
    const delSec = el('button', 'btn btn-sm btn-ghost', 'Delete section');
    delSec.type = 'button';
    delSec.style.color = 'var(--danger)';
    delSec.addEventListener('click', () => {
      if (confirm(`Delete the "${section.title || '(untitled)'}" section? Projects stay, only this grouping goes.`)) {
        DATA.sections.splice(sIdx, 1);
        renderSectionsPanel();
      }
    });
    ctrl.append(upSec, downSec, delSec);
    body.append(ctrl);

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
  const hint = el('div', 'field-hint', 'Photo, video or GIF. Videos/GIFs loop automatically wherever they appear.');
  const warn = el('div', 'field-hint');
  warn.style.color = 'var(--danger)';
  warn.hidden = true;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    warn.hidden = file.size <= MAX_RECOMMENDED_BYTES;
    if (!warn.hidden) warn.textContent = `${(file.size / 1024 / 1024).toFixed(1)}MB — large uploads may fail (~4MB is a safe ceiling on most Vercel plans).`;
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
      ['aspect', 'Cover aspect ratio (e.g. 4/5, 16/9, 1/1)'],
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

    // cover
    body.append(mediaSlot('Cover', p.cover, p.coverType, (file) => {
      const key = `cover:${p.id}`;
      pendingUploads[key] = { file, apply: (path, type) => { p.cover = path; p.coverType = type; thumb.innerHTML = ''; thumb.append(buildPreviewMedia(path, type)); } };
    }));

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
   SAVE
   ============================================================ */
$('#save-btn').addEventListener('click', async () => {
  const btn = $('#save-btn');
  btn.disabled = true;
  setStatus('Saving…');
  try {
    const keys = Object.keys(pendingUploads);
    for (let i = 0; i < keys.length; i++) {
      const { file, apply } = pendingUploads[keys[i]];
      setStatus(`Uploading ${i + 1} of ${keys.length}…`);
      const base64 = await fileToBase64(file);
      const filename = makeFilename(file.name);
      const res = await fetch('/api/dash-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: PW, filename, base64, contentType: file.type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Upload failed for ${file.name}`);
      apply(json.path, typeFromMime(file.type));
    }
    pendingUploads = {};

    setStatus('Saving content…');
    const res2 = await fetch('/api/dash-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PW, data: DATA }),
    });
    const json2 = await res2.json().catch(() => ({}));
    if (!res2.ok) throw new Error(json2.error || 'Save failed');

    setStatus('Saved — live on the site in about a minute.', 'ok');
  } catch (err) {
    setStatus(err.message || 'Something went wrong.', 'err');
  } finally {
    btn.disabled = false;
  }
});

boot();
