# DEON — Polymathic Studio

A static portfolio: full-bleed hero with an outlined wordmark, static
section-by-section collages of project covers (photos, looping videos or
GIFs), a studio block, and a detail page per project at `/project/<slug>`.
Content is edited at **`/dash`**, a password-gated dashboard that commits
changes straight to this repo.

Plain HTML, CSS and ES modules — no framework, no build step, no server.
Hosted free on **GitHub Pages** at **deonmade.com**.

## Edit the content

Two ways:

- **`/dash`** (recommended) — dashboard for every text field, section, and
  project, with reordering and file upload for photos/videos/GIFs. Needs a
  GitHub token; see "Dashboard setup" below.
- **By hand** — everything lives in **`content/data.json`**:
  - `site` — name, hero lines, studio blurb, disciplines, email, phone,
    social URLs.
  - `sections` — the groups shown on the home page, top to bottom. Each is
    `{ id, title, projectIds }`; `projectIds` is ordered and controls both
    which projects appear in that section and in what order. Leave `title`
    empty for an untitled section (the first one, by default).
  - `projects` — one entry per project: `id` (its URL slug), `title`,
    `category`, `year`, `role`, `cover`, `coverType` (`"image"` or
    `"video"`), `aspect`, `summary`, `narrative`, `embedUrl`,
    `loopStart`/`loopEnd`, and a `gallery` list of `{ url, type }`.

A project's page is `/project/<id>`, so `"id": "atelier-noir"` →
`/project/atelier-noir`.

## Photos, videos and GIFs

Any `cover` or `gallery` entry can be an image, a GIF, or a video. GIFs
loop natively as `<img>`; videos render as
`<video autoplay loop muted playsinline>`, so both loop automatically
everywhere they appear — preview tiles, the project cover, the gallery.
The dashboard sets the type automatically from the uploaded file.

### Looping only part of a video

`loopStart` and `loopEnd` (seconds) restrict a video cover to one slice
of itself, so the home grid can show the best few seconds rather than
starting from frame one. Both `0` means loop the whole clip.

Native `loop` can only replay a whole file, so when a range is set the
site turns it off and wraps manually on `timeupdate`. Seeking needs HTTP
range requests — GitHub Pages supports them, so this works in production.

In the dashboard, each project with a video cover gets a scrubber: move
the playhead, press **Use current** next to Start or End, and **Preview
loop** to check it. **Whole clip** clears both back to 0.

### Full-length pieces — `embedUrl`

Self-hosting a full film is the wrong tool: it costs repo size forever
and makes visitors download the whole thing. Put a YouTube or Vimeo link
in `embedUrl` instead and the project page renders a player under
**/ WATCH**, while a short compressed loop still does the work on the
home grid.

Recognised link shapes: `youtube.com/watch?v=…`, `youtu.be/…`,
`youtube.com/shorts/…`, `vimeo.com/123456789`, and unlisted
`vimeo.com/123456789/hash`. YouTube is embedded through
`youtube-nocookie.com`. Anything unrecognised renders nothing, and the
dashboard says so as you type.

**Size limits.** These are git limits now, not host limits: any single
file must stay under 100MB, and the published site under 1GB. The
dashboard caps uploads at 25MB because the browser has to base64-encode
the whole file into one API request. Worth knowing: every version of
every file stays in git history permanently, so repeatedly replacing a
large video grows the repo forever even after the old one is "deleted".
Compress video before uploading — a web-ready loop is usually 1–5MB.

## Hosting — GitHub Pages

The site deploys via `.github/workflows/pages.yml` on every push to the
default branch. **Settings → Pages → Source must be set to "GitHub
Actions"** (not "Deploy from a branch") for that workflow to publish.

Two details worth knowing:

- **`CNAME`** holds the custom domain. It must stay in the repo — the
  workflow deploys an artifact, so a domain set only in the web UI would
  be dropped on the next deploy.
- **`404.html`** is generated at deploy time as a copy of `index.html`.
  GitHub Pages has no rewrite rules but serves `404.html` for unknown
  paths, which is what makes `/project/<slug>` deep links render the app.
  Side effect: those URLs return an HTTP 404 status even though the page
  displays correctly. Browsers and users never notice; some strict
  crawlers might. It's the standard trade-off for SPA routing on Pages.

## Dashboard setup (`/dash`)

GitHub Pages serves files but runs no code, so there's no server to save
through. The dashboard instead commits directly to this repository from
your browser using the GitHub API.

1. **Create a token** — a fine-grained personal access token at
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens/new),
   scoped to **only this repository**, with **Contents: Read and write**.
   Give it an expiry you're happy to renew.
2. Open **`/dash`**, enter the password, go to the **Connection** tab,
   paste the token, press **Save connection**, then **Test connection**.
3. Edit anything and press **Save changes**. It lands as one commit; the
   site rebuilds in about a minute.

**Two honest caveats about security:**

- **The password is not a security boundary.** On a static host there's
  nothing to verify it against — the check happens in JavaScript that
  anyone can read. It only keeps casual visitors out of the UI. The
  GitHub token is the real credential: without it, nothing can be
  written, no matter who opens the page.
- **The token is stored in your browser's localStorage.** That's the only
  option without a server. Keep it scoped to this one repo, don't use the
  dashboard on a shared or public computer, and use **Forget token** when
  you're done on a device that isn't yours. If a token ever leaks, revoke
  it on GitHub and the risk ends there — it can't touch anything but this
  repository.

## Typography

Set in **FT Overpass** (`fonts/`, owner-supplied). It ships as a single
400 weight, so synthetic bolding is switched off and headings are
thickened with a text stroke instead — see `.display` in `css/app.css`.
Its free release also has no working numerals (every digit draws the same
placeholder glyph), so digits fall through to a self-hosted copy of
**Overpass** — the open-license typeface FT Overpass's letterforms are
built on — via a `unicode-range` split. The small monospace labels use
JetBrains Mono.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Two differences from production: `/dash` lives at `/dash/` (with the
trailing slash), and `/project/<slug>` typed directly will 404 because
there's no `404.html` fallback locally — open a project from the home
page instead. Saving from the dashboard works locally too, since it talks
to GitHub directly rather than to the local server.

## Structure

```
index.html          app shell (home + detail views)
dash/index.html     dashboard shell
css/app.css         site styles, design tokens at the top
css/dash.css        dashboard styles
js/app.js           site rendering + routing
js/dash.js          dashboard: editing, upload, GitHub commit
content/data.json   ← ALL SITE CONTENT LIVES HERE
assets/             images, video, icons
fonts/              FT Overpass + Overpass (digit fallback)
CNAME               custom domain for GitHub Pages
.nojekyll           serve files as-is, no Jekyll processing
.github/workflows/pages.yml   builds + deploys to Pages
.pages.yml          optional alternate CMS config (pagescms.org)
```
