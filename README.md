# DEON — Polymathic Studio

A static portfolio: full-bleed hero with an outlined wordmark, static
section-by-section collages of project covers (photos, looping videos or
GIFs), a studio block, and a detail page per project at `/project/<slug>`.
Content is edited at **`/dash`**, a small password-gated dashboard that
commits changes straight to this repo.

Plain HTML, CSS and ES modules — no framework, no build step, save for two
tiny Vercel serverless functions that back the dashboard's Save button.

## Edit the content

Two ways:

- **`/dash`** (recommended) — password-gated editor for every text field,
  section, and project, with drag-free reordering and file upload for
  photos/videos/GIFs. See "Dashboard setup" below to wire it up.
- **By hand** — everything lives in **`content/data.json`**:
  - `site` — name, hero lines, studio blurb, disciplines, email, footer.
  - `sections` — the groups shown on the home page, top to bottom. Each
    is `{ id, title, projectIds }`; `projectIds` is ordered and controls
    both which projects appear in that section and in what order. Leave
    `title` empty for an untitled section (the first one, by default) —
    every other section's title is what used to be the filter chips,
    now a permanent heading instead.
  - `projects` — one entry per project: `id` (its URL slug), `title`,
    `category`, `year`, `role`, `cover`, `coverType` (`"image"` or
    `"video"`), `aspect`, `summary`, `narrative`, and a `gallery` list of
    `{ url, type }`.

A project's page is `/project/<id>`, so `"id": "atelier-noir"` →
`/project/atelier-noir`.

## Photos, videos and GIFs

Any `cover` or `gallery` entry can be an image, a GIF, or a video. GIFs
loop natively as `<img>`; videos are rendered as
`<video autoplay loop muted playsinline>`, so both loop automatically
everywhere they're shown — preview tiles, the project cover, the gallery.
Set `coverType` / a gallery item's `type` to `"video"` for an mp4/webm
file, otherwise leave it (or set it) to `"image"`. The dashboard sets this
automatically from the uploaded file.

The images currently in `assets/` are generated placeholders in the site's
palette — replace them as real work comes in. If a project has no extra
gallery items beyond its cover, the detail page shows the
"additional media — to be added" placeholder automatically.

## Dashboard setup (`/dash`)

The dashboard's Save button writes by committing directly to this GitHub
repo (to `content/data.json` and new files under `assets/`) through two
serverless functions in `api/`. That write needs credentials that live
**only** in Vercel's project settings, never in this repo:

1. **Create a GitHub token** — a fine-grained personal access token
   scoped to just this repository, with **Contents: Read and write**
   permission. (Settings → Developer settings → Fine-grained tokens on
   GitHub.)
2. **In the Vercel project → Settings → Environment Variables, add:**
   | Name | Value |
   |---|---|
   | `GH_TOKEN` | the token from step 1 |
   | `GH_BRANCH` | the exact branch your Vercel **Production Branch** is set to (Settings → Git) |
   | `DASH_PASSWORD` | *(optional)* overrides the default password `v` — strongly recommended, see below |
3. Redeploy (or just wait for the next deploy) so the functions pick up
   the new variables.

`GH_OWNER`/`GH_REPO` default to `ddeonmadeit`/`portfolio-`; only set them
if this repo is ever moved or forked elsewhere.

**About the password.** You asked for it to be `v`, and that's the
default if `DASH_PASSWORD` is unset — but a single character is trivial
for anyone (or any bot) to guess, and this endpoint can write files to
your live repo. There's no lockout or rate limiting. Since `/dash` isn't
linked from the site, it's obscure rather than public, but obscurity
alone isn't real protection. Setting `DASH_PASSWORD` to something longer
costs nothing and closes that gap — worth doing before you rely on this
for real content.

**Upload size.** Files go up as base64 in a single request, which
Vercel's default body-size limit (~4.5MB) caps in practice — keep videos
short/compressed. A failed large upload shows an error rather than
silently corrupting anything already saved.

## Typography

Set in **FT Overpass** (`fonts/`, owner-supplied). It ships as a single
400 weight, so synthetic bolding is switched off and headings are
thickened with a text stroke instead — see `.display` in `css/app.css`.
Its free release also has no working numerals (every digit draws the same
placeholder glyph), so digits fall through to a self-hosted copy of
**Overpass** — the open-license typeface FT Overpass's letterforms are
built on — via a `unicode-range` split; see the comment in `css/app.css`.
The small monospace labels use JetBrains Mono.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Project URLs need the rewrite that `vercel.json` provides, so on the
plain Python server open a project from the archive rather than typing
`/project/<slug>` directly. The dashboard's Save button needs the real
serverless functions and GitHub credentials, so it won't persist changes
when run this way — only Vercel has those.

## Deploy to Vercel

Static, no build step:

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**.
2. Import this repo. Framework preset: **Other**; leave build command and
   output directory empty.
3. **Deploy.**
4. See "Dashboard setup" above to make `/dash` able to save.

`vercel.json` rewrites `/project/*` to `index.html` for client-side
routing, long-caches fonts and images, and keeps `content/data.json`
uncached so edits show up immediately.

## Structure

```
index.html         app shell (home + detail views)
dash.html           dashboard shell
css/app.css         site styles, design tokens at the top
css/dash.css         dashboard styles
js/app.js           site rendering + routing
js/dash.js          dashboard logic (auth, editing, upload, save)
api/dash-login.js    POST password -> ok/401
api/dash-save.js     POST password + data -> commits content/data.json
api/dash-upload.js   POST password + file -> commits into assets/
api/_lib/github.js   shared GitHub Contents API helper
content/data.json   ← ALL SITE CONTENT LIVES HERE
assets/             images, video, icons
fonts/              FT Overpass + Overpass (digit fallback)
vercel.json         static hosting + route rewrites
.pages.yml          optional alternate CMS config (pagescms.org)
```
