# Cycle Start Studios

Source for [cyclestartstudios.com](https://cyclestartstudios.com), a static site hosted for free on GitHub Pages.

## How hosting works

- `index.html` is the landing page. It reads `games.json` and renders one card per game.
- Each game lives in `games/<slug>/` and must have its own `index.html`. Anything a browser can run
  (HTML5/JS, Godot HTML5 export, Unity WebGL, Construct, GDevelop, PICO-8, pygbag, etc.) drops in as-is.
- `CNAME` tells GitHub Pages which custom domain to serve.
- `.nojekyll` makes GitHub Pages serve files exactly as committed (needed for Unity/Godot exports whose
  folders start with an underscore).

## Adding a game

1. Export your game for the web and copy the output into `games/<slug>/` so that `games/<slug>/index.html` exists.
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
3. Commit and push to `main`. GitHub Pages redeploys in about a minute.

## One-time setup

1. In this repo on GitHub: **Settings → Pages**, set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. Under **Custom domain** enter `cyclestartstudios.com` and save. Tick **Enforce HTTPS** once the certificate is issued
   (can take up to an hour).
3. At your domain registrar add these DNS records:

   | Type  | Host | Value |
   |-------|------|-------|
   | A     | @    | 185.199.108.153 |
   | A     | @    | 185.199.109.153 |
   | A     | @    | 185.199.110.153 |
   | A     | @    | 185.199.111.153 |
   | CNAME | www  | johnster000.github.io |

4. Also add `www.cyclestartstudios.com` as an alternate in the GitHub Pages settings if you want `www` to redirect.

## Local preview

```sh
python3 -m http.server 8000
```
Then open http://localhost:8000. A server is needed because the landing page fetches `games.json`.
