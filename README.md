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

`.github/workflows/pages.yml` publishes the site. It reads the Pages configuration and adapts: with the
Pages source set to **GitHub Actions** it deploys the repo as a Pages artifact; with the source set to a
**branch** it force-pushes `main` into that branch for Pages to build.

Already done: the repo is public (GitHub Pages on a private repo needs a paid plan; everything here is
served to every visitor's browser anyway, so public exposes nothing extra), `main` is the default branch,
Pages is on with the source set to GitHub Actions, and the custom domain `cyclestartstudios.com` is set.

### Why deploys currently run from `claude/cyclestart-free-hosting-wwn877`

Pages was enabled while that branch was still the repo's default, so GitHub's `github-pages` deployment
environment only accepts deploys from it. Pushes to `main` are rejected before any step runs. The workflow
therefore deploys from that branch, and it is kept identical to `main`. To publish straight from `main`,
do **one** of these once, in a desktop browser or a phone browser with "desktop site" on:

- **Settings → Pages → Build and deployment → Source → Deploy from a branch**, branch `main`, folder
  `/ (root)`, Save. Simplest. The workflow then does nothing on push and Pages builds `main` directly.
- Or **Settings → Environments → github-pages → Deployment branches and tags**: change the rule to
  `main` (or "No restriction"). The workflow then deploys from `main` in GitHub Actions mode.

Still to do, once:

1. **DNS.** At your domain registrar add these records:

   | Type  | Host | Value |
   |-------|------|-------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | CNAME | www  | johnster000.github.io |

2. **HTTPS.** Once DNS has propagated and **Settings → Pages** shows a green check next to the domain,
   tick **Enforce HTTPS** (the certificate can take up to an hour to issue).

Until DNS is in place the site is live at https://johnster000.github.io/Cyclestartstudios/.

## Troubleshooting

- **GitHub 404 at the custom domain or at johnster000.github.io/Cyclestartstudios.** Nothing has been
  deployed yet, or the last deploy failed. Open the **Actions** tab: the *Publish to GitHub Pages* run
  prints the Pages configuration in its *detect* job and must end green. In branch mode there should also
  be a run named *pages build and deployment*.
- **Custom domain shows the registrar's parking page.** DNS is still pointing at the registrar. Add the
  records above and wait for propagation (minutes to a few hours).
- **Games load but a game is stale.** Run `./sync-games.sh`, commit, push to `main`.

## Local preview

```sh
python3 -m http.server 8000
```
Then open http://localhost:8000. A server is needed because the landing page fetches `games.json`.
