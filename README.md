# Cycle Start Studios

Source for [cyclestartstudios.com](https://cyclestartstudios.com), a static site hosted for free on GitHub Pages.

## Games

| Game | Source repo | Web build lives in | Served at |
|------|-------------|--------------------|-----------|
| Neon Horde | [johnster000/Neon-Horde](https://github.com/johnster000/Neon-Horde) | `www/` | `/games/neon-horde/` |
| Catdoku | [johnster000/Catdoku](https://github.com/johnster000/Catdoku) | `www/` | `/games/catdoku/` |
| Pocket Dungeons | [johnster000/Pocket-dungeons](https://github.com/johnster000/Pocket-dungeons) | repo root (`index.html`, `css/`, `js/`) | `/games/pocket-dungeons/` |

The game source stays in its own repo. This repo holds a copy of each game's playable web build, so the
site keeps working even if a game repo is made private (the launch checklists suggest doing that before
a Play Store release).

## How hosting works

- `index.html` is the landing page. It reads `games.json` and renders one card per game.
- Each game lives in `games/<slug>/` and must have its own `index.html`. Anything a browser can run
  (HTML5/JS, Godot HTML5 export, Unity WebGL, Construct, GDevelop, PICO-8, pygbag, etc.) drops in as-is.
- All games share the one origin `cyclestartstudios.com`, so `localStorage` keys must be namespaced per
  game. The three current games already are (`neonhorde-*`, `catdoku-*`, `pocketDungeons.*` / `pd_*`).
- `CNAME` tells GitHub Pages which custom domain to serve.
- `.nojekyll` makes GitHub Pages serve files exactly as committed (needed for Unity/Godot exports whose
  folders start with an underscore).

## Updating a game

After pushing a change to a game's own repo:

```sh
./sync-games.sh          # clones each game repo and refreshes games/<slug>/
git add games && git commit -m "Sync games" && git push
```

If you already have the game repos cloned next to this one, skip the network round trip with
`GAMES_SRC=.. ./sync-games.sh`. The script wipes and recreates each `games/<slug>/` folder, so
re-capture the thumbnail (below) if the title screen changed.

## Adding a new game

1. Add a line to the `GAMES` table at the top of `sync-games.sh` (slug, repo, subfolder holding the web
   build) and run it. Or, for a game that is not in a repo, copy the exported files into `games/<slug>/`
   by hand so that `games/<slug>/index.html` exists.
2. Add an entry to `games.json`:
   ```json
   {
     "slug": "my-game",
     "title": "My Game",
     "description": "One or two sentences.",
     "thumbnail": "games/my-game/thumb.png",
     "controls": "WASD to move, Space to jump"
   }
   ```
3. Capture a thumbnail. Cards are 16:9, so a 960x540 screenshot of the title screen works well:
   ```sh
   python3 -m http.server 8000 &
   npx playwright screenshot --viewport-size=960,540 http://localhost:8000/games/<slug>/ games/<slug>/thumb.png
   ```
4. Commit and push to `main`. GitHub Pages redeploys in about a minute.

## One-time setup

Deploys run from `.github/workflows/pages.yml` on every push to `main`. The first successful run enables
GitHub Pages and sets the custom domain by itself. Three things still need a human:

1. **Make the repo public.** GitHub Pages on a private repo needs a paid plan; on a free account the
   workflow fails at "Enable Pages" with *Resource not accessible by integration*. Go to
   **Settings → General → Danger Zone → Change repository visibility → Make public**, then re-run the
   workflow from the **Actions** tab (or push any commit to `main`). Everything in this repo is already
   served to every visitor's browser once the site is live, so making it public exposes nothing extra.
2. **Default branch.** On GitHub go to **Settings → Branches**. At the top, under **Default branch**, click the
   swap-arrows icon next to the current name, pick `main`, and confirm.
3. **DNS.** At your domain registrar add these records:

   | Type  | Host | Value |
   |-------|------|-------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | CNAME | www  | johnster000.github.io |

   Then under **Settings → Pages** confirm the custom domain shows a green check and tick **Enforce HTTPS**
   once the certificate is issued (up to an hour after DNS propagates).

Until DNS is in place the site is live at https://johnster000.github.io/Cyclestartstudios/.

## Local preview

```sh
python3 -m http.server 8000
```
Then open http://localhost:8000. A server is needed because the landing page fetches `games.json`.
