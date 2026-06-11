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
    "This desert is where it all lives. Walk around. Open doors.",
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
    // muted dusty rose / magenta dusk
    palette: { sky: 0x3a1f2e, fog: 0x6e3a4d, glow: 0xd98a9c, floor: 0x2a1722 },
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
    // deep purple / indigo night
    palette: { sky: 0x1d1733, fog: 0x3c3060, glow: 0x9b86d9, floor: 0x161126 },
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
    // teal / cyan dusk
    palette: { sky: 0x102a2e, fog: 0x2a5a5e, glow: 0x7fd4cf, floor: 0x0c2023 },
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
    // burnt red / crimson
    palette: { sky: 0x331414, fog: 0x6e2e26, glow: 0xe08a5e, floor: 0x260f0f },
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
    // ochre / sand gold
    palette: { sky: 0x33260f, fog: 0x6e5526, glow: 0xd9b86a, floor: 0x261c0c },
    blurb: 'pieces, drops, one-offs.',
    works: [
      { title: 'TEE — DUST RUN', year: '2025', desc: 'Placeholder — heavyweight tee, single print, front only.', link: '', img: '' },
      { title: 'HOODIE — STATIC', year: '2025', desc: 'Placeholder — over-dyed, screen printed by hand.', link: '', img: '' },
      { title: 'CAP — SIGNAL', year: '2024', desc: 'Placeholder — embroidered, unstructured.', link: '', img: '' },
      { title: 'WORK JACKET 01', year: '2024', desc: 'Placeholder — one-off, painted back panel.', link: '', img: '' },
    ],
  },
};
