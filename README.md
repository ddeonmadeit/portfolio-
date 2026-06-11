# DEON — desert portfolio

An interactive portfolio set in a sea of rolling dunes at golden hour.
Five ancient ruins lie far apart across the sand, one per category:
a collapsed fresco wall (**graphic design**), a half-buried amphitheatre
(**music**), an eroded ziggurat (**websites**), a theatre wall whose empty
windows frame the sky (**videos**), and a weavers' colonnade with one
ancient cloth still hanging (**clothing**). Click a ruin — or its name on
the trail menu — and the camera glides low over the dunes to it, then
steps through the doorway into that category's dream-plain where the work
floats. A small camp on the starting ridge holds about (campfire),
contact (payphone) and socials (signpost). Ambient wind and fire crackle
are synthesized live in the browser; nothing is streamed.

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
- **Travel** — click a ruin in the distance, or use the trail menu at the
  bottom (CAMP / DESIGN / MUSIC / WEB / VIDEO / CLOTHING). The camera
  glides over the dunes and enters automatically.
- **Open a work** — click a floating piece inside.
- **Leave** — click the doorway, the `← OUT` button, or press `Esc`.
- **Sound** — toggle top right.

Mobile gets a wider field of view, lower shadow resolution and a capped
pixel ratio automatically (see `js/quality.js`).

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
