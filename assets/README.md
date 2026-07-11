# assets — your photos & logo go here

Drop your image files into this folder, then point to them from
`js/data.js`. Nothing else needs editing.

## Add work photos

1. Save the image here, e.g. `assets/poster-001.jpg`.
2. In `js/data.js`, find the matching item in the `WORK` array and set:
   ```js
   { title: 'Poster 001', cat: 'design', year: '2025', ratio: 'portrait',
     img: 'assets/poster-001.jpg', link: '', desc: '...' }
   ```
3. `ratio` controls the tile shape: `'portrait'`, `'landscape'`, or `'square'`.

Until an `img` is set, a clean placeholder tile shows automatically, so the
site always looks complete.

## Add your logo

Two options:

- **Text wordmark (current):** leave as-is in `index.html`.
- **Image logo:** save `assets/logo.svg` (or `.png`), then in `index.html`
  replace the `<span class="wordmark-text">DEON</span>` inside the header
  `.wordmark` link with:
  ```html
  <img src="assets/logo.svg" alt="DEON" style="height:22px" />
  ```

## Recommended files (optional but nice)

- `favicon.svg` — browser tab icon (a placeholder is already included).
- `apple-touch-icon.png` — 180×180, home-screen icon on iOS.
- `og.jpg` — 1200×630, the preview image when the link is shared.

## Image tips for fast mobile loading

- Export photos at ~1600px on the long edge, JPG quality ~80, or use WebP.
- Keep each file under ~300 KB where you can.
