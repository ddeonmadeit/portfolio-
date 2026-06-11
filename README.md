# DEON — desert portfolio

An interactive portfolio that drops visitors onto a vast surreal desert plain
at dusk — Filip Hodas × Salvador Dalí. Five monumental objects hold the work:
a melting gilded frame (**graphic design**), a vinyl record gone soft draped
over a stone cube (**music**), a giant half-buried CRT still glowing
(**websites**), a monolithic VHS bleeding film ribbon (**videos**), and a
floating hanger whose garment melts into the sand (**clothing**). Long-legged
elephants walk the horizon, a clock melts over a dead tree, stones float.
A campfire opens about, a decayed payphone opens contact, a leaning signpost
points to socials. Ambient wind and fire crackle are synthesized live in the
browser; nothing is streamed.

## Run it locally

It's a static site — no build step, no dependencies to install
(three.js is vendored in `/vendor`). Just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works. Opening `index.html` directly from disk will NOT
work because ES modules need to be served over http.)

## Put your real work in

Everything you'd want to change lives in **`js/data.js`**:

- `SITE` — your name, tagline, about text, email, social links.
- `CATEGORIES` — each category has a `works` list. Each work has a
  `title`, `year`, `desc`, optional `link` (adds an OPEN button), and
  optional `img` (path to an image, e.g. `assets/cover.jpg`).

Drop image files into an `assets/` folder and reference them from `img`.
If `img` is empty, a gritty generated placeholder is used so the walls are
never bare.

Each category also has a `palette` (sky / fog / glow / floor colors) that
controls the mood inside its structure — tweak freely.

## Controls

- **Look around** — move the mouse (desktop) or drag (touch).
- **Enter** — click/tap a structure, the campfire, the payphone, or the signpost.
- **Open a work** — click a piece hanging on the wall.
- **Leave** — click the doorway, the `← OUT` button, or press `Esc`.
- **Sound** — toggle top right.

## Deploy

Push to GitHub and enable **GitHub Pages** (Settings → Pages → deploy from
branch, root folder). The site is fully static and works from any static host.

## Structure

```
index.html       entry, HUD/panels markup, film-grain layer
css/style.css    HUD, panels, loader, VHS overlays, cursor
js/data.js       ← ALL CONTENT LIVES HERE
js/main.js       renderer, camera, input, state machine, panels
js/world.js      the desert: terrain, sky, structures, campfire, payphone
js/interiors.js  the rooms inside each structure
js/textures.js   canvas-drawn signs, placeholder art, sky
js/audio.js      synthesized wind, crackle, UI sounds
vendor/          three.js (vendored, no CDN needed)
```
