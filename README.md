# DEON — portfolio app

A mobile-first portfolio that feels like an app. You land on a springy
3D carousel of five cards — **graphic design, music, websites, videos,
clothing** — each card a grid of work thumbnails over a crimson
dunescape atmosphere with a giant ghost title drifting behind. Tap a
card and the category slides up, laid out natively for its medium:

- **MUSIC** — player-style track list
- **VIDEOS** — big thumbnails
- **CLOTHING** — full-screen lookbook swipe
- **DESIGN** — two-column poster grid
- **WEBSITES** — large site cards with visit links

Tap any piece for a full-screen takeover with details and a link.
The corner menu opens a bottom sheet with about, contact and socials.
Browser/phone back buttons work everywhere; sheets and panels can be
flicked away. Set in **Braun Linear** (owner-supplied, five weights).

All placeholder art is generated at runtime — seeded crimson dunescapes
with birds in the haze — so the site ships with zero image assets.

## Run it locally

No build step, no dependencies:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(ES modules need a server — opening index.html from disk won't work.)

## Put your real work in

Everything editable lives in **`js/data.js`**:

- `SITE` — name, about text, email, social links.
- `CATEGORIES` — each category's `works` list: `title`, `year`, `desc`,
  optional `link` (adds an OPEN button), optional `img` (path to a file
  in `assets/`, replaces the generated art everywhere, including the
  home card and backdrop).

## Deploy

Pushes to the main branches auto-deploy to GitHub Pages via
`.github/workflows/pages.yml`. Live at
`https://ddeonmadeit.github.io/portfolio-/`.

## Structure

```
index.html       app shell + font preload
css/app.css      all styles (Braun Linear @font-faces at the top)
js/data.js       ← ALL CONTENT LIVES HERE
js/app.js        swiper physics, navigation, views, sheet
js/art.js        seeded dunescape / placeholder art generators
fonts/           Braun Linear woff2 (5 weights)
```
