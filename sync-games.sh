#!/usr/bin/env sh
# Pull the latest web build of each game into games/<slug>/.
# Usage: ./sync-games.sh            (clones each game repo into a temp dir)
#        GAMES_SRC=/path/to/parent ./sync-games.sh   (use existing local clones named after the repos)
set -eu
cd "$(dirname "$0")"

# slug | repo | subfolder inside the repo that holds the playable web build
GAMES='
neon-horde      johnster000/Neon-Horde      www
catdoku         johnster000/Catdoku         www
pocket-dungeons johnster000/Pocket-dungeons .
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
    # Pocket Dungeons: pure HTML at the repo root. Copy only what the page loads.
    cp "$src/index.html" "$src/manifest.webmanifest" "$dest/"
    cp -r "$src/css" "$src/js" "$dest/"
  else
    cp -r "$src/$sub/." "$dest/"
  fi
  echo "synced $slug  <- $repo/$sub  ($(git -C "$src" rev-parse --short HEAD))"
done
