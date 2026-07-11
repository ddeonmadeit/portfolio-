# DEON — creative studio portfolio

A light, minimal, mobile-first portfolio site for a multidisciplinary
studio — **graphic design, music, web, video, clothing**. Single page:
sticky header, big statement hero, filterable work grid with a lightbox,
studio note, disciplines index, collaborators marquee, contact and footer.

No framework, no build step — plain HTML, CSS and ES modules. All content
lives in one file so it's easy to edit and add your own photos.

## Edit the content

Everything is in **`js/data.js`**:

- `SITE` — name, hero statement, availability, intro, contact, socials.
- `DISCIPLINES` — the numbered services index.
- `CLIENTS` — collaborators marquee (empty the array to hide the section).
- `FILTERS` / `WORK` — the work grid. Each work has a `title`, `cat`,
  `year`, `ratio`, optional `img` and `link`, and a `desc`.

## Add photos & your logo

See **`assets/README.md`**. Short version: drop image files in `assets/`
and set `img: 'assets/your-file.jpg'` on the matching `WORK` item. For a
logo, add `assets/logo.svg` and swap the wordmark in `index.html`. Until
then, clean placeholder tiles are shown so the site always looks finished.

## Run it locally

ES modules need a server (opening the file directly won't work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to Vercel

This repo is ready for Vercel with no configuration — it's a static site.

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Add New… → Project**, then import this repository.
3. Framework preset: **Other**. Leave build command and output empty.
   (Vercel serves the repo root as static files.)
4. Click **Deploy**. You get a `*.vercel.app` URL immediately.

Every push to the connected branch redeploys automatically. `vercel.json`
adds long-cache headers for fonts and assets plus basic security headers.

To connect a custom domain: Vercel project → **Settings → Domains**.

## Structure

```
index.html        markup + meta tags
css/app.css        all styles (Braun Linear @font-faces at the top)
js/data.js         ← ALL CONTENT LIVES HERE
js/app.js          rendering, nav, filtering, lightbox, scroll reveals
fonts/             Braun Linear woff2 (5 weights)
assets/            your photos + logo + favicon (see assets/README.md)
vercel.json        static hosting config
```
