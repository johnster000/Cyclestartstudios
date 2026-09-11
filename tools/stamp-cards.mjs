#!/usr/bin/env node
// Cache-bust the card images in games.json.
//
// Every card is called thumb.png and lives at the same path forever, so a
// browser that has one keeps showing it after the image changes. This appends
// ?v=<hash of the file> to each thumbnail URL: it changes only when the image
// actually changes, so cards update immediately and still cache well in between.
//
// Run after syncing. Rewrites games.json in place; prints what changed.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = 'games.json';
const games = JSON.parse(await readFile(manifest, 'utf8'));
let changed = 0;

for (const game of games) {
  if (!game.thumbnail) continue;
  const path = game.thumbnail.split('?')[0];
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    console.warn(`  WARNING: ${game.slug} has no card image at ${path}`);
    continue;
  }
  const v = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const stamped = `${path}?v=${v}`;
  if (game.thumbnail !== stamped) {
    console.log(`  card ${game.slug}: v=${v}`);
    game.thumbnail = stamped;
    changed++;
  }
}

if (changed) {
  await writeFile(manifest, JSON.stringify(games, null, 2) + '\n');
  console.log(`  stamped ${changed} card${changed === 1 ? '' : 's'} in ${manifest}`);
} else {
  console.log('  cards already stamped');
}
