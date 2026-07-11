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

## Logo

`logo-mark.png` / `logo-mark-512.png` — the studio mark (transparent
background, white glyph), used to carve the logo into the 3D rock in
`js/rock.js`. `favicon.png` and `apple-touch-icon.png` are generated from
the same mark on a dark rounded tile — regenerate them if you replace the
logo (crop/threshold to a clean transparent PNG, then composite onto a
`#0d0c0a` rounded square at 512px and 180px).

To also swap the text wordmark in the header for the image logo, replace
`<span class="wordmark-text">DEON</span>` in `index.html` with:
```html
<img src="assets/logo-mark.png" alt="DEON" style="height:22px" />
```

## Recommended files (optional but nice)

- `og.jpg` — 1200×630, the preview image when the link is shared.

## Image tips for fast mobile loading

- Export photos at ~1600px on the long edge, JPG quality ~80, or use WebP.
- Keep each file under ~300 KB where you can.
