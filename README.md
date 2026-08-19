# DEON — Polymathic Studio

A static portfolio: full-bleed hero with an outlined wordmark, a masonry
archive of projects, discipline filters, a studio block, and a detail page
per project at `/project/<slug>`.

Plain HTML, CSS and ES modules — no framework, no build step. Ported off
the previous hosted builder so the whole thing is self-contained and
deploys anywhere static.

## Edit the content

Everything lives in **`content/data.json`**:

- `site` — name, hero lines, studio blurb, disciplines, email, footer.
- `filters` — the category chips (keep `All` first).
- `projects` — one entry per project: `id` (URL slug), `title`,
  `category`, `year`, `role`, `cover`, `aspect`, `summary`, `narrative`,
  and a `gallery` list.

A project's page is `/project/<id>`, so `"id": "atelier-noir"` →
`/project/atelier-noir`.

## Swap in your own images

Drop files into **`assets/`** and point `cover` / `gallery` at them, e.g.
`"cover": "assets/my-shoot.jpg"`. Set `aspect` to match the crop
(`4/5`, `16/9`, `1/1`, …) so the masonry grid stays tidy.

The images currently in `assets/` are generated placeholders in the site's
palette — replace them as real work comes in. If a project has no extra
gallery images beyond its cover, the detail page shows the
"additional media — to be added" placeholder automatically.

## Typography

Set in **FT Overpass** (`fonts/`, owner-supplied). It ships as a single
400 weight, so synthetic bolding is switched off and headings are
thickened with a text stroke instead — see `.display` in `css/app.css`.
Adjust the per-title `--stroke` value to taste. The small monospace
labels use JetBrains Mono.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Project URLs need the rewrite that `vercel.json` provides, so on the
plain Python server open a project from the archive rather than typing
`/project/<slug>` directly.

## Deploy to Vercel

Static, no build step:

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project**.
2. Import this repo. Framework preset: **Other**; leave build command and
   output directory empty.
3. **Deploy.**

`vercel.json` rewrites `/project/*` to `index.html` for client-side
routing, long-caches fonts and images, and keeps `content/data.json`
uncached so edits show up immediately.

## Structure

```
index.html         app shell (home + detail views)
css/app.css        all styles, design tokens at the top
js/app.js          rendering, filtering, routing
content/data.json  ← ALL CONTENT LIVES HERE
assets/            images + icons
fonts/             FT Overpass
vercel.json        static hosting + route rewrites
.pages.yml         optional visual CMS config (pagescms.org)
```
