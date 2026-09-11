#!/usr/bin/env sh
# Pull the latest web build of each game into games/<slug>/.
# Usage: ./sync-games.sh   (or GAMES_SRC=/path/to/parent to use existing local clones)
set -eu
cd "$(dirname "$0")"

# slug | repo | subfolder inside the repo that holds the playable web build
GAMES='
neon-horde      johnster000/Neon-Horde      www
catdoku         johnster000/Catdoku         www
pocket-dungeons johnster000/Pocket-dungeons .
anvil-acre      johnster000/Dawn-of-empires .
pocket-dice     johnster000/Pocket-dice     .
snap-shuffle    johnster000/Photo-puzzle    www
traffic-jam     johnster000/Traffic-jam     www
way-out         johnster000/Arrow-game     www
neon-serpent    johnster000/Snake-game     www
bloom           johnster000/Flow           .
buy-stove       johnster000/Buy-stove      .
'

# Games published as installable, offline-capable apps. Adding one here is the
# only switch: tools/make-icons.mjs has already drawn icons for every game.
PWA_GAMES='neon-serpent neon-horde catdoku snap-shuffle traffic-jam way-out pocket-dungeons pocket-dice anvil-acre bloom buy-stove'

tmp=""
tmpthumb="$(mktemp)"
if [ -z "${GAMES_SRC:-}" ]; then
  tmp="$(mktemp -d)"
fi
trap 'rm -rf "$tmp" "$tmpthumb"' EXIT

echo "$GAMES" | while read -r slug repo sub; do
  [ -n "$slug" ] || continue
  name="$(echo "$repo" | cut -d/ -f2 | tr 'A-Z' 'a-z')"
  if [ -n "$tmp" ]; then
    src="$tmp/$name"
    git clone -q --depth 1 "https://github.com/$repo" "$src"
  else
    src="$GAMES_SRC/$name"
  fi
  dest="games/$slug"
  # Keep the site's thumbnail; everything else is replaced.
  thumb="$(ls "$dest"/thumb.* 2>/dev/null | head -n1 || true)"
  [ -n "$thumb" ] && cp "$thumb" "$tmpthumb"
  rm -rf "$dest"; mkdir -p "$dest"
  [ -n "$thumb" ] && cp "$tmpthumb" "$thumb"
  if [ "$sub" = "." ]; then
    # Pure HTML at the repo root (Pocket Dungeons, Pocket Dice, Bloom).
    # Copy everything at the top level except development scaffolding. Scanning the
    # HTML for references is not enough: Bloom's fonts/ is reached only from CSS, and
    # Pocket Dice builds its logo URL in JavaScript.
    for entry in "$src"/* "$src"/.[!.]*; do
      [ -e "$entry" ] || continue
      name="$(basename "$entry")"
      case "$name" in
        .git|.github|.gitignore|.vscode|node_modules|tools|tests|test|docs|doc|store|site|\
        android|ios|dist|build|build.py|package.json|package-lock.json|\
        capacitor.config.json|thumb.png|*.md) continue ;;
      esac
      cp -r "$entry" "$dest/"
    done
  else
    cp -r "$src/$sub/." "$dest/"
  fi
  # Card image. A repo that ships one maintains it, so it wins over the kept copy,
  # whether it sits at the repo root (Bloom) or under site/ (Snap Shuffle, Traffic Jam).
  [ -f "$src/thumb.png" ] && cp "$src/thumb.png" "$dest/thumb.png"
  [ -f "$src/site/thumb.png" ] && cp "$src/site/thumb.png" "$dest/thumb.png"
  echo "synced $slug  <- $repo/$sub  ($(git -C "$src" rev-parse --short HEAD))"
  # Published code is minified. Readable source stays in the game's own repo.
  if [ -d node_modules/terser ]; then
    node tools/minify.mjs "$dest"
  else
    echo "  WARNING: skipped minify for $slug - run 'npm install' first" >&2
  fi
  # Offline/installable support. Opt-in per game via PWA_GAMES above: every game
  # has icons in pwa/<slug>/, but an icon is not a promise that the game works
  # offline (Pocket Dice and Snap Shuffle fetch from third parties at runtime).
  # Must run after minify - the worker precaches files as they ship and is
  # versioned by their contents. Regenerated every sync; this dir is wiped above.
  case " $(echo $PWA_GAMES) " in
    *" $slug "*) node tools/make-pwa.mjs "$dest" ;;
  esac
done

# Card images keep the same filename forever, so stamp each one with a content
# hash in games.json. Without this a browser keeps showing the card it cached.
node tools/stamp-cards.mjs
