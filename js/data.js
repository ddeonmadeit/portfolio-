// ============================================================
//  DEON — CONTENT
//  This is the ONLY file you need to edit to change what's
//  in the portfolio. Each category has a list of works.
//
//  Each work item:
//    title  — name of the piece
//    year   — string, shows in the mono label
//    desc   — short description shown in the detail panel
//    link   — optional URL ("" = no link). Shows an OPEN button.
//    img    — optional path to an image in /assets (e.g. "assets/cover1.jpg").
//             If "" a gritty generated placeholder is used.
// ============================================================

export const SITE = {
  name: 'DEON',
  tagline: 'design · music · web · video · clothing',
  about: [
    "I'm Deon. I make things.",
    "Graphic design, music, websites, videos, clothing — different mediums, same hands.",
    "Swipe through. Everything here was made from scratch.",
  ],
  contact: {
    email: 'ddeonmadeit@gmail.com',
    note: 'for work, collabs, or anything else — pick up the phone.',
  },
  socials: [
    { label: 'INSTAGRAM', url: 'https://instagram.com/ddeonmadeit' },
    { label: 'YOUTUBE', url: 'https://youtube.com/@ddeonmadeit' },
    { label: 'SOUNDCLOUD', url: 'https://soundcloud.com/ddeonmadeit' },
  ],
};

export const CATEGORIES = {
  design: {
    label: 'GRAPHIC DESIGN',
    short: 'DESIGN',
    // gold burning through smoke
    palette: { sky: 0x6e1d1c, fog: 0xa83a24, glow: 0xf2a84e, floor: 0x2e1014 },
    blurb: 'posters, identities, cover art.',
    works: [
      { title: 'POSTER 001', year: '2025', desc: 'Placeholder — swap me in js/data.js. A gritty gig poster, riso-style, two colors.', link: '', img: '' },
      { title: 'IDENTITY — SMOKE', year: '2025', desc: 'Placeholder — brand identity for a thing that does not exist yet.', link: '', img: '' },
      { title: 'COVER ART — DUST', year: '2024', desc: 'Placeholder — single cover, scanned textures, heavy type.', link: '', img: '' },
      { title: 'ZINE NO.3', year: '2024', desc: 'Placeholder — 24 pages of collage and bad decisions.', link: '', img: '' },
      { title: 'TYPE STUDY', year: '2023', desc: 'Placeholder — distressed display face, work in progress.', link: '', img: '' },
    ],
  },
  music: {
    label: 'MUSIC',
    short: 'MUSIC',
    // deep ember, almost night
    palette: { sky: 0x4a1422, fog: 0x8a2434, glow: 0xe86838, floor: 0x260d12 },
    blurb: 'released songs, beats, sketches.',
    works: [
      { title: 'MIRAGE', year: '2025', desc: 'Placeholder track — drop the real link in js/data.js and the OPEN button takes people there.', link: '', img: '' },
      { title: 'HEAT HAZE', year: '2025', desc: 'Placeholder track — slow burner, tape-saturated.', link: '', img: '' },
      { title: 'PAYPHONE LUV', year: '2024', desc: 'Placeholder track — recorded in one take, kept the mistakes.', link: '', img: '' },
      { title: 'DUNES', year: '2024', desc: 'Placeholder track — instrumental, late drive music.', link: '', img: '' },
    ],
  },
  web: {
    label: 'WEBSITES',
    short: 'WEB',
    // pale gold over wine
    palette: { sky: 0x5e1a18, fog: 0x9a3424, glow: 0xffc878, floor: 0x2a0f0e },
    blurb: 'sites and experiments that live online.',
    works: [
      { title: 'THIS SITE', year: '2026', desc: 'The desert you are standing in. Built from scratch — three.js, no templates.', link: '', img: '' },
      { title: 'SHOP CONCEPT', year: '2025', desc: 'Placeholder — storefront experiment, brutalist checkout.', link: '', img: '' },
      { title: 'ONE-PAGER X', year: '2024', desc: 'Placeholder — single-page site for a single idea.', link: '', img: '' },
    ],
  },
  video: {
    label: 'VIDEOS',
    short: 'VIDEO',
    // the darkest red, blood orange glow
    palette: { sky: 0x3a0f14, fog: 0x7a1f1a, glow: 0xd94f2b, floor: 0x200a0c },
    blurb: 'music videos, edits, experiments on tape.',
    works: [
      { title: 'MUSIC VIDEO — MIRAGE', year: '2025', desc: 'Placeholder — shot on whatever was available. Link your YouTube/Vimeo in js/data.js.', link: '', img: '' },
      { title: 'RECAP TAPE 24', year: '2024', desc: 'Placeholder — a year compressed into three minutes of grain.', link: '', img: '' },
      { title: 'LOOP STUDY', year: '2024', desc: 'Placeholder — seamless loop, CRT-burned.', link: '', img: '' },
      { title: 'BTS REEL', year: '2023', desc: 'Placeholder — behind the scenes of everything else.', link: '', img: '' },
    ],
  },
  clothing: {
    label: 'CLOTHING',
    short: 'CLOTHING',
    // warm amber dusk
    palette: { sky: 0x6a2418, fog: 0xa84a2e, glow: 0xe89a5e, floor: 0x2c1210 },
    blurb: 'pieces, drops, one-offs.',
    works: [
      { title: 'TEE — DUST RUN', year: '2025', desc: 'Placeholder — heavyweight tee, single print, front only.', link: '', img: '' },
      { title: 'HOODIE — STATIC', year: '2025', desc: 'Placeholder — over-dyed, screen printed by hand.', link: '', img: '' },
      { title: 'CAP — SIGNAL', year: '2024', desc: 'Placeholder — embroidered, unstructured.', link: '', img: '' },
      { title: 'WORK JACKET 01', year: '2024', desc: 'Placeholder — one-off, painted back panel.', link: '', img: '' },
    ],
  },
};
