#!/usr/bin/env node
// Draw the app icons for every game, as one family.
//
// These are NOT screenshots. A cropped 16:9 card makes a muddy tile and none of
// them look related. Instead every icon is built to the same construction and
// only the skin changes:
//
//   - 512 tile, glyph confined to the centre 64% so a maskable icon never clips
//   - one stroke weight, round caps, one glyph per game
//   - the skin follows the game's own world, not one style forced on all eleven
//
// Skins: neon (the synthwave games), cozy (lamplit pixel RPG), abyss (deep sea),
// felt (tabletop), field (late-90s strategy), flat (deadpan comedy).
//
// Rendered through headless Chromium because this container has no image
// libraries - SVG in, PNG out, which is the right pipeline for flat vector art.
//
// Usage: node tools/make-icons.mjs [slug ...]     (default: all)
// Writes pwa/<slug>/icon-192.png and icon-512.png.
//
// Note: writing icons does NOT make a game installable. That is the explicit
// PWA_GAMES list in sync-games.sh - see MAINTENANCE.md.

import { mkdir } from 'node:fs/promises';

// Design-time only, so playwright is not a dependency of the site build. It is
// CommonJS and may sit in a global prefix, so resolve it the require() way -
// an ESM import cannot take a bare directory path.
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const chromium = (() => {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return req(m).chromium; } catch { /* try the next one */ }
  }
  console.error('make-icons needs playwright: npm i -D playwright, or run it where playwright is installed');
  process.exit(2);
})();

const SAFE = 0.64;   // glyph box as a fraction of the tile (maskable safe zone)
const SW = 30;       // one stroke weight across the whole set

const grid = (c) => [128, 256, 384]
  .map((v) => `<line x1="${v}" y1="0" x2="${v}" y2="512"/><line x1="0" y1="${v}" x2="512" y2="${v}"/>`)
  .join('');

const place = (glyph, fill, stroke, extra = '') =>
  `<g fill="${fill}" stroke="${stroke}" stroke-width="${SW}" stroke-linecap="round"` +
  ` stroke-linejoin="round" ${extra}` +
  ` transform="translate(256,256) scale(${SAFE}) translate(-256,-256)">${glyph}</g>`;

// ---- skins -------------------------------------------------------------
const SKINS = {
  // The synthwave games: dark violet ground, receding grid, bloom.
  neon: (glyph, accent) => `
    <defs>
      <radialGradient id="v" cx="50%" cy="42%" r="70%">
        <stop offset="0%" stop-color="${accent}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="#120829" stop-opacity="0"/></radialGradient>
      <filter id="b" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="9" result="g"/>
        <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="512" height="512" fill="#120829"/>
    <g stroke="rgba(140,110,255,.16)" stroke-width="2">${grid()}</g>
    <rect width="512" height="512" fill="url(#v)"/>
    ${place(glyph, accent, accent, 'filter="url(#b)"')}`,

  // Pocket Dungeons: lamplight on stone, warm ink, no glow.
  cozy: (glyph, ink) => `
    <defs><radialGradient id="l" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#4a3524"/><stop offset="100%" stop-color="#241a12"/>
    </radialGradient></defs>
    <rect width="512" height="512" fill="url(#l)"/>
    ${place(glyph, ink, ink)}`,

  // Bloom: deep water, light falling from above, soft.
  abyss: (glyph, ink) => `
    <defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d3550"/><stop offset="100%" stop-color="#03121f"/>
    </linearGradient>
    <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="512" height="512" fill="url(#d)"/>
    ${place(glyph, ink, ink, 'filter="url(#s)"')}`,

  // Pocket Dice: a felt tray under a lamp.
  felt: (glyph, ink) => `
    <defs><radialGradient id="f" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1d5c43"/><stop offset="100%" stop-color="#0d2a1f"/>
    </radialGradient></defs>
    <rect width="512" height="512" fill="url(#f)"/>
    ${place(glyph, ink, ink)}`,

  // Anvil & Acre: meadow and parchment, the late-nineties strategy look.
  field: (glyph, ink) => `
    <defs><radialGradient id="m" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#3f5c33"/><stop offset="100%" stop-color="#1b2a16"/>
    </radialGradient></defs>
    <rect width="512" height="512" fill="url(#m)"/>
    ${place(glyph, ink, ink)}`,

  // Buy Stove: the joke is that it is completely ordinary.
  flat: (glyph, ink, bg) => `
    <rect width="512" height="512" fill="${bg}"/>
    <g fill="${ink}" stroke="${ink}" stroke-width="${SW}" stroke-linecap="butt"
       stroke-linejoin="miter"
       transform="translate(256,256) scale(${SAFE}) translate(-256,-256)">${glyph}</g>`,
};

// ---- glyphs ------------------------------------------------------------
const G = {
  // The path a snake-game snake takes: right, down, left, down, head.
  serpent: `
    <path d="M132 150 H300 Q348 150 348 198 Q348 246 300 246 H212
             Q164 246 164 294 Q164 342 212 342 H320" fill="none" stroke-width="44"/>
    <circle cx="360" cy="342" r="42" stroke="none"/>
    <circle cx="350" cy="330" r="8" fill="#120829" stroke="none"/>
    <circle cx="378" cy="330" r="8" fill="#120829" stroke="none"/>`,

  // A lane runner: the ship, and the horde bearing down on it.
  horde: `
    <path d="M256 424 L196 340 H316 Z" stroke-width="26"/>
    <path d="M150 128 L256 196 L362 128" fill="none" stroke-width="30"/>
    <path d="M150 216 L256 284 L362 216" fill="none" stroke-width="30"/>`,

  // A cat head, nothing else. The skin already supplies the grid; adding a cell
  // around this made it unreadable at tile size.
  cat: `
    <path d="M150 300 V150 L246 222" fill="none" stroke-width="34"/>
    <path d="M362 300 V150 L266 222" fill="none" stroke-width="34"/>
    <circle cx="256" cy="308" r="104" fill="none" stroke-width="34"/>`,

  // Sliding tiles: three placed, one out of line.
  shuffle: `
    <rect x="118" y="118" width="116" height="116" rx="16" fill="none" stroke-width="26"/>
    <rect x="278" y="118" width="116" height="116" rx="16" fill="none" stroke-width="26"/>
    <rect x="118" y="278" width="116" height="116" rx="16" fill="none" stroke-width="26"/>
    <rect x="300" y="300" width="116" height="116" rx="16" fill="none" stroke-width="26"/>`,

  // A car seen from above: wheels proud of the body, or it reads as a capsule.
  car: `
    <rect x="152" y="196" width="52" height="54" rx="14" stroke-width="20"/>
    <rect x="308" y="196" width="52" height="54" rx="14" stroke-width="20"/>
    <rect x="152" y="330" width="52" height="54" rx="14" stroke-width="20"/>
    <rect x="308" y="330" width="52" height="54" rx="14" stroke-width="20"/>
    <rect x="176" y="120" width="160" height="330" rx="46" fill="none" stroke-width="28"/>
    <path d="M206 214 Q256 186 306 214" fill="none" stroke-width="22"/>
    <path d="M206 372 Q256 400 306 372" fill="none" stroke-width="22"/>`,

  // An arrow finding the way out: along, then up and away.
  wayout: `
    <path d="M120 372 H300 V184" fill="none" stroke-width="40"/>
    <path d="M238 246 L300 164 L362 246" fill="none" stroke-width="40"/>`,

  // A d20, read as a hexagon with one facet.
  d20: `
    <path d="M256 120 L392 198 L392 354 L256 432 L120 354 L120 198 Z" fill="none"/>
    <path d="M256 186 L330 330 L182 330 Z" fill="none" stroke-width="26"/>`,

  // A die, square on the felt.
  die: `
    <rect x="128" y="128" width="256" height="256" rx="44" fill="none"/>
    <circle cx="196" cy="196" r="22" stroke="none"/>
    <circle cx="316" cy="196" r="22" stroke="none"/>
    <circle cx="256" cy="256" r="22" stroke="none"/>
    <circle cx="196" cy="316" r="22" stroke="none"/>
    <circle cx="316" cy="316" r="22" stroke="none"/>`,

  // An anvil.
  anvil: `
    <path d="M118 208 H300 Q356 208 394 176 L394 236 Q356 272 300 272 H286
             L316 356 H196 L226 272 H118 Z" stroke-width="24"/>
    <rect x="170" y="356" width="172" height="44" rx="12" stroke-width="24"/>`,

  // Bloom's creature: a bell and its trailing tendrils.
  creature: `
    <path d="M160 268 Q160 156 256 156 Q352 156 352 268 Z" fill="none" stroke-width="28"/>
    <path d="M196 284 Q186 344 212 392" fill="none" stroke-width="22"/>
    <path d="M256 288 Q256 352 256 404" fill="none" stroke-width="22"/>
    <path d="M316 284 Q326 344 300 392" fill="none" stroke-width="22"/>`,

  // A stove: one burner, one oven.
  stove: `
    <rect x="120" y="248" width="272" height="164" fill="none"/>
    <circle cx="256" cy="176" r="70" fill="none"/>
    <circle cx="256" cy="176" r="20" stroke="none"/>
    <line x1="186" y1="336" x2="326" y2="336" stroke-width="24"/>`,
};

// ---- the set -----------------------------------------------------------
export const ICONS = {
  'neon-serpent':    SKINS.neon(G.serpent,  '#ff3ea5'),
  'neon-horde':      SKINS.neon(G.horde,    '#ff5c3a'),
  'catdoku':         SKINS.neon(G.cat,      '#5ef2a0'),
  'snap-shuffle':    SKINS.neon(G.shuffle,  '#b06bff'),
  'traffic-jam':     SKINS.neon(G.car,      '#ffb43a'),
  'way-out':         SKINS.neon(G.wayout,   '#3ae0ff'),
  'pocket-dungeons': SKINS.cozy(G.d20,      '#f2c260'),
  'pocket-dice':     SKINS.felt(G.die,      '#f4f1e8'),
  'anvil-acre':      SKINS.field(G.anvil,   '#f0e6d2'),
  'bloom':           SKINS.abyss(G.creature,'#7fe8d8'),
  'buy-stove':       SKINS.flat(G.stove,    '#1d1d1f', '#e9e4da'),
};

const wrap = (body) => `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const want = process.argv.slice(2);
const targets = want.length ? want : Object.keys(ICONS);
for (const t of targets) if (!ICONS[t]) { console.error(`unknown game: ${t}`); process.exit(2); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const slug of targets) {
  await mkdir(`pwa/${slug}`, { recursive: true });
  for (const size of [512, 192]) {
    const page = await (await browser.newContext({ viewport: { width: size, height: size } })).newPage();
    await page.setContent(
      `<style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}` +
      `svg{width:${size}px;height:${size}px;display:block}</style>${wrap(ICONS[slug])}`);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `pwa/${slug}/icon-${size}.png` });
    await page.context().close();
  }
  console.log(`  icon ${slug}`);
}
await browser.close();
