// ============================================================
//  DEON — SITE CONTENT
//  This is the main file to edit. Change text, add work,
//  swap in your own photos here. No build step required.
//
//  To add a photo: drop the file in /assets, then set
//  `img: 'assets/your-file.jpg'` on the matching work item.
//  Until then a clean placeholder tile is shown automatically.
// ============================================================

export const SITE = {
  name: 'DEON',
  // Big hero statement — one strong line.
  statement: 'Independent creative studio for design, music, web, video & clothing.',
  // Small line under the availability tag.
  availability: 'Available worldwide',
  location: 'Working everywhere · Based online',
  // Short paragraph shown in the intro / studio block.
  intro: [
    'DEON is a one-person, multidisciplinary studio.',
    'Graphic design, music, websites, videos and clothing — different mediums, same hands. Everything here is made from scratch.',
  ],
  contact: {
    heading: "Let's make something.",
    // Grouped contacts (edit or add rows freely).
    channels: [
      { label: 'Work & commissions', email: 'ddeonmadeit@gmail.com' },
      { label: 'General', email: 'ddeonmadeit@gmail.com' },
    ],
  },
  socials: [
    { label: 'Instagram', url: 'https://instagram.com/ddeonmadeit' },
    { label: 'YouTube', url: 'https://youtube.com/@ddeonmadeit' },
    { label: 'SoundCloud', url: 'https://soundcloud.com/ddeonmadeit' },
  ],
  // Footer credit line.
  credit: 'Site by DEON',
};

// Disciplines — the "services" list, shown as a clean index.
export const DISCIPLINES = [
  { n: '01', title: 'Graphic Design', desc: 'Posters, identities, cover art, layout.' },
  { n: '02', title: 'Music', desc: 'Songs, beats, production, sound.' },
  { n: '03', title: 'Web', desc: 'Websites and interactive experiments.' },
  { n: '04', title: 'Video', desc: 'Music videos, edits, motion.' },
  { n: '05', title: 'Clothing', desc: 'Pieces, drops and one-offs.' },
];

// Optional roll of collaborators / clients (edit or empty the array to hide).
export const CLIENTS = [
  'Your Client', 'A Brand', 'An Artist', 'A Label',
  'A Studio', 'A Magazine', 'A Festival', 'A Shop',
];

// ---- WORK ----------------------------------------------------
// Every item shows in the work grid. `cat` matches a filter chip.
// `img` optional (path in /assets). `ratio` controls the tile shape:
// 'portrait', 'landscape', or 'square'. `link` optional (adds a link).
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'design', label: 'Design' },
  { id: 'music', label: 'Music' },
  { id: 'web', label: 'Web' },
  { id: 'video', label: 'Video' },
  { id: 'clothing', label: 'Clothing' },
];

export const WORK = [
  { title: 'Poster 001', cat: 'design', year: '2025', ratio: 'portrait', img: '', link: '', desc: 'Riso-style gig poster, two colours, heavy type.' },
  { title: 'Identity — Smoke', cat: 'design', year: '2025', ratio: 'landscape', img: '', link: '', desc: 'Full brand identity — mark, type system, layout.' },
  { title: 'Mirage', cat: 'music', year: '2025', ratio: 'square', img: '', link: '', desc: 'Single — tape-saturated, slow burn. Add your streaming link.' },
  { title: 'Music Video — Mirage', cat: 'video', year: '2025', ratio: 'landscape', img: '', link: '', desc: 'Shot and edited in-house. Link your YouTube/Vimeo.' },
  { title: 'Tee — Dust Run', cat: 'clothing', year: '2025', ratio: 'portrait', img: '', link: '', desc: 'Heavyweight tee, single front print.' },
  { title: 'This Site', cat: 'web', year: '2026', ratio: 'landscape', img: '', link: '', desc: 'Built from scratch — no templates.' },
  { title: 'Cover Art — Dust', cat: 'design', year: '2024', ratio: 'square', img: '', link: '', desc: 'Single cover, scanned textures, heavy type.' },
  { title: 'Heat Haze', cat: 'music', year: '2024', ratio: 'square', img: '', link: '', desc: 'Instrumental, late-drive music.' },
  { title: 'Recap Tape 24', cat: 'video', year: '2024', ratio: 'portrait', img: '', link: '', desc: 'A year compressed into three minutes of grain.' },
  { title: 'Hoodie — Static', cat: 'clothing', year: '2024', ratio: 'portrait', img: '', link: '', desc: 'Over-dyed, screen printed by hand.' },
  { title: 'Shop Concept', cat: 'web', year: '2025', ratio: 'landscape', img: '', link: '', desc: 'Storefront experiment, brutalist checkout.' },
  { title: 'Zine No.3', cat: 'design', year: '2024', ratio: 'portrait', img: '', link: '', desc: '24 pages of collage.' },
];
