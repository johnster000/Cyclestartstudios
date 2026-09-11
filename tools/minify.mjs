#!/usr/bin/env node
// Minify a game folder in place: strip comments and formatting, mangle names.
//
// This is obfuscation-by-minification, not protection. A browser has to run the
// code, so anyone determined can still read it. It removes the comments, the
// formatting and most local names, which is enough to stop casual copying.
//
// Deliberately conservative, because a broken game is worse than a readable one:
//   - js/vendor/ is skipped entirely. Pocket Dungeons string-matches the exact
//     text `'./three.module.min.js'` inside its vendored RoomEnvironment.js, so
//     rewriting those files breaks the 3D dice.
//   - Files already named *.min.js are skipped.
//   - Separate <script src> files share globals across files, so their top-level
//     names are preserved; only names inside functions are mangled.
//   - A game whose whole program is one inline classic <script> is wrapped in an
//     IIFE first, which makes its top level private and safe to mangle.
//   - An inline <script type="module"> already has a private top level.
//
// Usage: node tools/minify.mjs games/<slug> [...]

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { minify as minifyJS } from 'terser';
import { minify as minifyHTML } from 'html-minifier-terser';

const YEAR = new Date().getFullYear();
const NOTICE = `/*! Cycle Start Studios - https://cyclestartstudios.com - ` +
               `(c) ${YEAR} Cycle Start Studios. All rights reserved. */`;

// Canary: a quiet, stable marker so a rehosted copy can be proved to be ours.
// Derived, not random, so it can always be recomputed - see MAINTENANCE.md.
// Three places, because someone who spots and strips one usually misses the rest.
const canaryFor = (slug) =>
  'csx-' + createHash('sha256').update('cyclestartstudios:' + slug).digest('hex').slice(0, 12);

const JS_OPTS = (toplevel, module) => ({
  module,
  compress: { passes: 2 },
  mangle: { toplevel },
  // Drop every original comment, then stamp ownership on what ships.
  format: { comments: false, preamble: NOTICE },
  sourceMap: false,
});

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const skip = (p) =>
  p.split(sep).includes('vendor') || /\.min\.js$/i.test(p);

async function run(gameDir) {
  const canary = canaryFor(basename(gameDir));
  const files = await walk(gameDir);
  const jsFiles = files.filter((f) => f.endsWith('.js') && !skip(f));
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  // Globals are shared between separate script files, so their top level stays.
  const hasExternalJS = files.some((f) => f.endsWith('.js') && !skip(f));
  let before = 0, after = 0;

  for (const f of jsFiles) {
    const src = await readFile(f, 'utf8');
    const isModule = /^\s*(import|export)\s/m.test(src);
    const res = await minifyJS(src, JS_OPTS(isModule, isModule));
    if (res.error) throw new Error(`${f}: ${res.error}`);
    before += src.length; after += res.code.length;
    await writeFile(f, res.code);
  }

  for (const f of htmlFiles) {
    let html = await readFile(f, 'utf8');
    before += html.length;

    // Minify each inline <script> ourselves so module vs classic is handled right.
    const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    for (const m of blocks.reverse()) {
      const [whole, attrs, body] = m;
      if (/\bsrc=/i.test(attrs) || !body.trim()) continue;
      const isModule = /type\s*=\s*["']module["']/i.test(attrs);
      // One inline classic script and no external js: its top level is the page's
      // only program, so an IIFE makes it private and safe to mangle fully.
      const wrap = !isModule && !hasExternalJS && blocks.length === 1;
      const source = wrap ? `(function(){${body}\n})();` : body;
      const res = await minifyJS(source, JS_OPTS(isModule || wrap, isModule));
      if (res.error) throw new Error(`${f} inline script: ${res.error}`);
      html = html.slice(0, m.index) + `<script${attrs}>${res.code}</script>` +
             html.slice(m.index + whole.length);
    }

    let out = await minifyHTML(html, {
      collapseWhitespace: true,
      conservativeCollapse: false,
      removeComments: true,
      minifyCSS: true,
      minifyJS: false,           // handled above
      removeScriptTypeAttributes: false,
      keepClosingSlash: true,
    });
    out = out.replace(/<head\b[^>]*>/i, (m) =>
      m + `<!-- ${NOTICE.slice(3, -3).trim()} -->` +
      `<style>:root{--csx:"${canary}"}</style>`);
    out = out.replace(/<\/body>/i, () =>
      `<script>document.documentElement.dataset.csx="${canary}"</script></body>`);
    after += out.length;
    await writeFile(f, out);
  }

  const pct = before ? Math.round((1 - after / before) * 100) : 0;
  console.log(
    `  minified ${relative(process.cwd(), gameDir)}: ` +
    `${jsFiles.length} js + ${htmlFiles.length} html, ` +
    `${(before / 1024).toFixed(0)}K -> ${(after / 1024).toFixed(0)}K (-${pct}%)`
  );
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('usage: node tools/minify.mjs games/<slug> [...]');
  process.exit(2);
}
for (const t of targets) {
  if (!(await stat(t).catch(() => null))?.isDirectory()) {
    console.error(`not a directory: ${t}`);
    process.exit(2);
  }
  await run(t);
}
