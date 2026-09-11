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
pocket-dice     johnster000/Pocket-dice     .
snap-shuffle    johnster000/Photo-puzzle    www
'

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
    # Pure HTML at the repo root (Pocket Dungeons, Pocket Dice).
    # Copy index.html plus every top-level file or folder it references.
    cp "$src/index.html" "$dest/"
    grep -oE '(src|href)="[^"#]+"' "$src/index.html" | sed -E 's/^[a-z]+="//; s/"$//' \
      | grep -vE '^(data:|https?:|//)' | cut -d/ -f1 | sort -u | while read -r top; do
        [ -e "$src/$top" ] && cp -r "$src/$top" "$dest/"
      done
    # Assets the page loads from JS rather than a src/href attribute (Pocket Dice
    # builds its logo URL in code), so scanning the HTML alone would miss them.
    find "$src" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \
      -o -iname '*.gif' -o -iname '*.svg' -o -iname '*.webp' -o -iname '*.ico' \
      -o -iname '*.woff' -o -iname '*.woff2' -o -iname '*.ttf' -o -iname '*.otf' \
      -o -iname '*.mp3' -o -iname '*.ogg' -o -iname '*.wav' -o -iname '*.webmanifest' \) \
      -exec cp {} "$dest/" \;
  else
    cp -r "$src/$sub/." "$dest/"
  fi
  # A game repo may ship its own card thumbnail; it wins over the kept one.
  [ -f "$src/site/thumb.png" ] && cp "$src/site/thumb.png" "$dest/thumb.png"
  echo "synced $slug  <- $repo/$sub  ($(git -C "$src" rev-parse --short HEAD))"
  # Published code is minified. Readable source stays in the game's own repo.
  if [ -d node_modules/terser ]; then
    node tools/minify.mjs "$dest"
  else
    echo "  WARNING: skipped minify for $slug - run 'npm install' first" >&2
  fi
done
