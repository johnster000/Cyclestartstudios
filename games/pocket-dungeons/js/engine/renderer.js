/* Straight-on 3/4 renderer with a rotatable camera.
   The world is a tile grid (x right, y south, z up). The camera looks down at the ground at a fixed tilt and can spin in
   90° steps (animated). Projection: rotate (x,y) by the camera yaw, then sx = rx*TW, sy = ry*TD - z*ZH. Floors are textured
   quads, walls are brick boxes with camera-facing sides, props and buildings are small assemblies of 3D primitives
   (Props3D), characters are 2D billboard sprites. Everything is drawn at 1x into a buffer and upscaled for crisp pixels. */
(function () {
  const TW = 32, TD = 24, ZH = 24, WALL_H = 1.4, LOW_H = 0.26, TEX = 32;
  const T = window.TILE = { VOID: 0, FLOOR: 1, WALL: 2, GRASS: 3, ROAD: 4, WATER: 5, SAND: 6, HILL: 7, MOUNTAIN: 8, SWAMP: 9, DOORWAY: 10, RUBBLE: 11, SHALLOW: 12, BRIDGE: 13, COBBLE: 14, WOOD: 15, RUG: 16, DIRT: 17, GRAVE: 18, PIT: 19, RUNE: 20, TRAP: 21, BUILDING: 22, TALLGRASS: 23, FOREST: 24, BAR: 25 };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const texCache = new Map();
  const shade = (c, f) => Sprites.shade(c, f);

  // ---- Square top-down tile textures (32x32) ----
  function tileTex(kind, base, variant) {
    const key = kind + '|' + base + '|' + variant; if (texCache.has(key)) return texCache.get(key);
    const [c, g] = mk(TEX, TEX); const img = g.createImageData(TEX, TEX); const d = img.data; const [br, bg, bb] = hex(base); const seed = variant * 7919;
    const n = (x, y, s) => hash(x + seed + (s || 0) * 131, y + seed * 3);
    const crackA = n(1, 1) < 0.35 ? { x0: Math.floor(n(2, 2) * 20) + 6, y0: Math.floor(n(3, 3) * 16) + 8, len: 5 + Math.floor(n(4, 4) * 8), dir: n(5, 5) < 0.5 ? 1 : -1 } : null;
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const u = (x + 0.5) / TEX, v = (y + 0.5) / TEX; let r = br, gg = bg, b = bb; let m = 1 + (n(x, y) - 0.5) * 0.14;
      switch (kind) {
        case 'stone': { const gu = (u * 2) % 1, gv = (v * 2) % 1; const mortar = gu < 0.08 || gv < 0.08; const stoneId = Math.floor(u * 2) + Math.floor(v * 2) * 2; m *= 1 + (n(stoneId, 99) - 0.5) * 0.18; if (mortar) m *= 0.62; else if (gu > 0.9 || gv > 0.9) m *= 0.9; if (n(x, y, 7) > 0.93) m *= 0.8; if (n(x, y, 8) > 0.96) m *= 1.15; if (crackA && Math.abs((x - crackA.x0) * crackA.dir - (y - crackA.y0)) < 1.5 && x >= Math.min(crackA.x0, crackA.x0 + crackA.len * crackA.dir) && x <= Math.max(crackA.x0, crackA.x0 + crackA.len * crackA.dir)) m *= 0.55; break; }
        case 'wood': { const plank = Math.floor(v * 4), gv = (v * 4) % 1; m *= 1 + (n(plank, 5) - 0.5) * 0.2; if (gv < 0.1) m *= 0.6; if (n(Math.floor(u * 16), plank, 3) > 0.7) m *= 0.9; if (n(x, y, 9) > 0.97) m *= 0.75; if (Math.abs(u - (0.2 + plank * 0.25 % 1)) < 0.03) m *= 0.75; break; }
        case 'grass': { m *= 1 + (n(Math.floor(x / 2), Math.floor(y / 2), 2) - 0.5) * 0.22; if (n(x, y, 4) > 0.9) { m *= 1.25; gg += 10; } if (n(x, y, 6) > 0.94) m *= 0.7; if (n(Math.floor(u * 3), Math.floor(v * 3), 11) > 0.75) m *= 0.9; break; }
        case 'dirt': { m *= 1 + (n(Math.floor(x / 2), y, 2) - 0.5) * 0.2; if (n(x, y, 4) > 0.94) m *= 1.2; if (n(x, y, 5) > 0.94) m *= 0.72; break; }
        case 'cobble': { const cu = (u * 3) % 1, cv = (v * 3) % 1; const cid = Math.floor(u * 3) + 3 * Math.floor(v * 3); const cx = cu - 0.5, cy = cv - 0.5; const rr = cx * cx + cy * cy; m *= 1 + (n(cid, 77) - 0.5) * 0.25; if (rr > 0.17) m *= 0.55; else if (rr > 0.12) m *= 0.8; else if (cx < -0.15 && cy < -0.15) m *= 1.12; break; }
        case 'water': { const w = Math.sin((u + v) * 12 + variant * 0.9) * 0.5 + Math.sin(u * 20 - variant * 1.3) * 0.3; m *= 1 + w * 0.12; if (w > 0.6 && n(x, y, 3) > 0.7) { m *= 1.4; r += 30; gg += 30; b += 20; } break; }
        case 'sand': { m *= 1 + (n(x, y, 2) - 0.5) * 0.12; if (n(x, y, 4) > 0.95) m *= 0.85; if (Math.floor((u + v) * 6) % 2 === 0) m *= 1.03; break; }
        case 'swamp': { m *= 1 + (n(Math.floor(x / 2), y, 2) - 0.5) * 0.2; const puddle = n(Math.floor(u * 2), Math.floor(v * 2), 12) > 0.55 && ((u * 2) % 1 > 0.2 && (u * 2) % 1 < 0.8 && (v * 2) % 1 > 0.25 && (v * 2) % 1 < 0.75); if (puddle) { r = 40; gg = 58; b = 62; m *= 1 + (n(x, y, 13) - 0.5) * 0.1; } if (n(x, y, 4) > 0.95) m *= 1.3; break; }
        case 'rug': { const border = u < 0.12 || v < 0.12 || u > 0.88 || v > 0.88; if (border) { r = 160; gg = 130; b = 50; m *= 0.9 + (n(x, y, 2) - 0.5) * 0.1; } else if (Math.abs(u - 0.5) < 0.12 && Math.abs(v - 0.5) < 0.12) { m *= 1.25; } else { m *= 1 + (n(Math.floor(u * 6), Math.floor(v * 6), 2) - 0.5) * 0.12; if ((Math.floor(u * 6) + Math.floor(v * 6)) % 2) m *= 0.9; } break; }
        case 'grave': { m *= 1 + (n(Math.floor(x / 2), Math.floor(y / 2), 2) - 0.5) * 0.2; if (n(x, y, 6) > 0.92) m *= 0.65; break; }
        case 'rubble': { const gu = (u * 2) % 1, gv = (v * 2) % 1; if (gu < 0.08 || gv < 0.08) m *= 0.65; if (n(x, y, 3) > 0.8) m *= 1.35; if (n(x, y, 5) > 0.9) m *= 0.6; break; }
        case 'pit': { m *= 0.35 + (1 - Math.min(1, Math.abs(u - 0.5) * 2 + Math.abs(v - 0.5) * 2)) * 0.1; break; }
        default: break;
      }
      if (u < 0.04 || v < 0.04) m *= 1.08; if (u > 0.96 || v > 0.96) m *= 0.88;
      m *= ((x + y) % 2 === 0) ? 1.02 : 0.98;
      const i = (y * TEX + x) * 4; d[i] = Math.max(0, Math.min(255, r * m)); d[i + 1] = Math.max(0, Math.min(255, gg * m)); d[i + 2] = Math.max(0, Math.min(255, b * m)); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); texCache.set(key, c); return c;
  }
  // ---- Wall face texture (bricks or planks), 32 wide x WH tall ----
  function wallTex(face, variant, style, WH) {
    const key = 'wall|' + face + '|' + variant + '|' + style + '|' + WH; if (texCache.has(key)) return texCache.get(key);
    const [c, g] = mk(TEX, WH); const img = g.createImageData(TEX, WH); const d = img.data; const [fr, fg, fb] = hex(face); const seed = variant * 4099;
    const n = (x, y, s) => hash(x + seed + (s || 0) * 97, y + seed * 5);
    for (let y = 0; y < WH; y++) for (let x = 0; x < TEX; x++) {
      let m = 1;
      if (style === 'wood') { const px = Math.floor(x / 4); m *= 1 + (n(px, 1, 3) - 0.5) * 0.18; if (x % 4 === 0) m *= 0.6; if (n(x, Math.floor(y / 3), 4) > 0.85) m *= 0.9; if (y > 3 && y < 6) m *= 0.75; }
      else { const row = Math.floor(y / 6); const off = (row % 2) * 4; const col = Math.floor((x + off) / 8); const mortar = (y % 6 === 0) || ((x + off) % 8 === 0); m *= 1 + (n(col, row, 3) - 0.5) * 0.22; if (mortar) m *= 0.55; else if (y % 6 === 1) m *= 1.08; if (n(x, y, 6) > 0.95) m *= 0.75; }
      if (y <= 1) m *= 1.15; if (y >= WH - 2) m *= 0.65; m *= (1 - y / WH * 0.2);
      const i = (y * TEX + x) * 4; d[i] = Math.max(0, Math.min(255, fr * m)); d[i + 1] = Math.max(0, Math.min(255, fg * m)); d[i + 2] = Math.max(0, Math.min(255, fb * m)); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); texCache.set(key, c); return c;
  }

  let cosY = 1, sinY = 0; // current camera yaw
  const R = {
    canvas: null, ctx: null, buf: null, bg: null, scale: 3, W: 0, H: 0, cam: { x: 10, y: 10 }, camTarget: null, time: 0, shake: 0,
    yaw: 0, yawTarget: 0, fx: [], floats: [], TW, TD, ZH, dark: null, darkG: null,
    init(canvas) { R.canvas = canvas; R.ctx = canvas.getContext('2d'); R.resize(); window.addEventListener('resize', R.resize); },
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3); const cw = window.innerWidth, ch = window.innerHeight;
      R.canvas.width = Math.floor(cw * dpr); R.canvas.height = Math.floor(ch * dpr);
      // base zoom: ~14 tiles across on a desktop window, ~8.5 on a phone; the player's zoom factor multiplies it
      if (R.zoom === undefined) { let z = 1; try { z = (window.Save && Save.settings().zoom) || 1; } catch (e) {} R.zoom = z; }
      const targetTiles = cw < 600 ? 8.5 : 14.4; R.cy = cw < 600 ? 0.4 : 0.5; // phones: the HUD covers the bottom third, so the party sits above centre
      R.scale = U.clamp(Math.round(R.canvas.width / (TW * targetTiles) * R.zoom), 2, 8); if (R.canvas.height / R.scale < 200) R.scale = Math.max(2, Math.floor(R.canvas.height / 200));
      R.W = Math.ceil(R.canvas.width / R.scale); R.H = Math.ceil(R.canvas.height / R.scale);
      const [c, g] = mk(R.W, R.H); R.dark = c; R.darkG = g; const [b, bg] = mk(R.W, R.H); R.buf = b; R.bg = bg; texCache.clear();
    },
    rotate(dir) { R.yawTarget += dir * Math.PI / 2; },
    setZoom(z) { const nz = U.clamp(z, 0.6, 2.2); if (Math.abs(nz - R.zoom) < 0.001) return; R.zoom = nz; try { Save.setSetting('zoom', nz); } catch (e) {} R.resize(); },
    // ---- projection ----
    proj(x, y, z) { const dx = x - R.cam.x, dy = y - R.cam.y; const rx = dx * cosY - dy * sinY, ry = dx * sinY + dy * cosY; return [Math.round(R.W / 2 + rx * TW), Math.round(R.H * R.cy + ry * TD - (z || 0) * ZH)]; },
    depth(x, y) { const dx = x - R.cam.x, dy = y - R.cam.y; return dx * sinY + dy * cosY; },
    toScreen(x, y) { return R.proj(x, y, 0); },
    toTile(px, py) {
      const dpr = R.canvas.width / window.innerWidth; const lx = px * dpr / R.scale, ly = py * dpr / R.scale;
      const rx = (lx - R.W / 2) / TW, ry = (ly - R.H * R.cy) / TD;
      return { x: R.cam.x + rx * cosY + ry * sinY, y: R.cam.y - rx * sinY + ry * cosY };
    },
    pickTile(px, py) { const t = R.toTile(px, py); return { x: Math.floor(t.x + 0.5), y: Math.floor(t.y + 0.5) }; },
    pickEntity(px, py, entities) {
      const dpr = R.canvas.width / window.innerWidth; const lx = px * dpr / R.scale, ly = py * dpr / R.scale;
      const list = entities.filter((e) => !e.dead && !e.hidden).sort((a, b) => R.depth(b.ax, b.ay) - R.depth(a.ax, a.ay));
      for (const e of list) { const s = Sprites.actor(e, 0); const [sx, sy] = R.proj(e.ax, e.ay, 0); const x0 = sx - s.ox, y0 = sy - s.oy + 2; if (lx >= x0 && lx <= x0 + s.w && ly >= y0 && ly <= y0 + s.h) return e; }
      return null;
    },
    // screen-relative direction (dx,dy in screen space: up = (0,-1)) → world step
    screenToWorldDir(dx, dy) {
      const c = Math.cos(R.yawTarget), s = Math.sin(R.yawTarget);
      const wx = dx * c + dy * s, wy = -dx * s + dy * c; return [Math.round(wx), Math.round(wy)];
    },
    update(dt, entities) {
      R.time += dt;
      let dyaw = R.yawTarget - R.yaw; if (Math.abs(dyaw) < 0.002) R.yaw = R.yawTarget; else R.yaw += dyaw * Math.min(1, dt * 8);
      if (Math.abs(R.yaw) > Math.PI * 4) { R.yaw -= Math.sign(R.yaw) * Math.PI * 4; R.yawTarget -= Math.sign(R.yawTarget) * Math.PI * 4; }
      cosY = Math.cos(R.yaw); sinY = Math.sin(R.yaw);
      if (R.camTarget) { const tx = R.camTarget.ax, ty = R.camTarget.ay; R.cam.x += (tx - R.cam.x) * Math.min(1, dt * 6); R.cam.y += (ty - R.cam.y) * Math.min(1, dt * 6); }
      // keep the view inside the map so zooming never parks the camera over empty space
      if (R.map) { const ac = Math.abs(cosY), as = Math.abs(sinY); const hw = (R.W / 2) / TW, hv = Math.max(R.H * R.cy, R.H * (1 - R.cy)) / TD;
        const fit = (v, n, ext) => (n <= ext * 2 ? (n - 1) / 2 : U.clamp(v, ext - 0.5, n - 0.5 - ext));
        R.cam.x = fit(R.cam.x, R.map.w, hw * ac + hv * as); R.cam.y = fit(R.cam.y, R.map.h, hw * as + hv * ac); }
      for (const e of entities) {
        if (e.ax === undefined) { e.ax = e.x; e.ay = e.y; }
        const dx = e.x - e.ax, dy = e.y - e.ay, d = Math.hypot(dx, dy);
        if (d > 0.001) { const sp = (e.moveSpeed || 7) * dt; if (d <= sp) { e.ax = e.x; e.ay = e.y; } else { e.ax += dx / d * sp; e.ay += dy / d * sp; const sdx = dx * cosY - dy * sinY; if (Math.abs(sdx) > 0.01) e.facing = sdx > 0 ? 'r' : 'l'; e.walking = true; } } else e.walking = false;
        if (e.bump) { e.bump.t -= dt; if (e.bump.t <= 0) e.bump = null; }
        if (e.flash) { e.flash -= dt; if (e.flash <= 0) e.flash = 0; }
      }
      R.fx = R.fx.filter((f) => { f.t += dt; return f.t < f.dur; });
      R.floats = R.floats.filter((f) => { f.t += dt; return f.t < f.dur; });
      if (R.shake > 0) R.shake = Math.max(0, R.shake - dt * 30);
    },
    floatText(x, y, text, color, big) { const hold = (window.UI && UI.logHoldUntil ? UI.logHoldUntil : 0) - performance.now(); const push = () => R.floats.push({ x, y, text, color: color || '#fff', t: 0, dur: 1.2, big }); if (hold > 0) setTimeout(push, hold); else push(); },
    burst(x, y, color, radius) { R.fx.push({ kind: 'burst', x, y, color, radius: radius || 1, t: 0, dur: 0.5 }); },
    projectile(x0, y0, x1, y1, color, dur) { R.fx.push({ kind: 'proj', x0, y0, x1, y1, color, t: 0, dur: dur || 0.3 }); },
    ring(x, y, color) { R.fx.push({ kind: 'ring', x, y, color, t: 0, dur: 0.6 }); },
    slash(x, y, color) { R.fx.push({ kind: 'slash', x, y, color: color || '#fff', t: 0, dur: 0.25 }); },

    // ---- primitive drawing (all in buffer pixels) ----
    poly(g, pts, fill, stroke, alpha) { if (alpha !== undefined) g.globalAlpha = alpha; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } if (alpha !== undefined) g.globalAlpha = 1; },
    // textured parallelogram: p0 origin, p1 = end of the texture's x axis, p3 = end of the y axis
    quadTex(g, p0, p1, p3, tex, alpha) {
      const ax = p1[0] - p0[0], ay = p1[1] - p0[1], bx = p3[0] - p0[0], by = p3[1] - p0[1]; if (Math.abs(ax * by - ay * bx) < 0.5) return;
      g.save(); if (alpha !== undefined) g.globalAlpha = alpha; g.transform(ax / tex.width, ay / tex.width, bx / tex.height, by / tex.height, p0[0], p0[1]); g.drawImage(tex, 0, 0); g.restore();
    },
    tileQuad(x, y, z) { return [R.proj(x - 0.5, y - 0.5, z), R.proj(x + 0.5, y - 0.5, z), R.proj(x + 0.5, y + 0.5, z), R.proj(x - 0.5, y + 0.5, z)]; },
    floorTex(g, x, y, z, tex, alpha) { R.quadTex(g, R.proj(x - 0.5, y - 0.5, z), R.proj(x + 0.5, y - 0.5, z), R.proj(x - 0.5, y + 0.5, z), tex, alpha); },
    // Axis-aligned box. cx,cy tile-space centre. o: {col, top, texTop, texSide, hide:{n,s,e,w}, alpha}
    box(g, cx, cy, z0, w, d, h, o) {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z0 + h; const P = R.proj; const hide = o.hide || {};
      const faces = [
        { k: 's', n: [0, 1], a: [x0, y1], b: [x1, y1] }, { k: 'n', n: [0, -1], a: [x1, y0], b: [x0, y0] },
        { k: 'e', n: [1, 0], a: [x1, y1], b: [x1, y0] }, { k: 'w', n: [-1, 0], a: [x0, y0], b: [x0, y1] },
      ];
      for (const f of faces) {
        if (hide[f.k]) continue; const ryn = f.n[0] * sinY + f.n[1] * cosY; if (ryn <= 0.02) continue; const rxn = f.n[0] * cosY - f.n[1] * sinY;
        const m = -0.32 + 0.24 * ryn - 0.16 * rxn;
        if (o.texSide && h > 0.5) { R.quadTex(g, P(f.a[0], f.a[1], z1), P(f.b[0], f.b[1], z1), P(f.a[0], f.a[1], z0), o.texSide, o.alpha); if (rxn > 0.3) R.poly(g, [P(f.a[0], f.a[1], z1), P(f.b[0], f.b[1], z1), P(f.b[0], f.b[1], z0), P(f.a[0], f.a[1], z0)], 'rgba(0,0,0,' + (0.25 * rxn) + ')'); }
        else R.poly(g, [P(f.a[0], f.a[1], z1), P(f.b[0], f.b[1], z1), P(f.b[0], f.b[1], z0), P(f.a[0], f.a[1], z0)], shade(o.col, m), null, o.alpha);
      }
      if (o.texTop) R.quadTex(g, P(x0, y0, z1), P(x1, y0, z1), P(x0, y1, z1), o.texTop, o.alpha);
      else R.poly(g, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], o.top || shade(o.col, 0.18), null, o.alpha);
    },
    cyl(g, cx, cy, z0, r, h, col, top) {
      const N = 8, P = R.proj, z1 = z0 + h; const pts = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); }
      for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; const nx = (a[2] + b[2]) / 2, ny = (a[3] + b[3]) / 2; const ryn = nx * sinY + ny * cosY; if (ryn <= 0) continue; const rxn = nx * cosY - ny * sinY; const m = -0.3 + 0.22 * ryn - 0.18 * rxn; R.poly(g, [P(a[0], a[1], z1), P(b[0], b[1], z1), P(b[0], b[1], z0), P(a[0], a[1], z0)], shade(col, m)); }
      R.poly(g, pts.map((p) => P(p[0], p[1], z1)), top || shade(col, 0.18));
    },
    // Blocky ball: quantised rows, three flat shade steps, hard pixel edges (no gradients anywhere).
    sphere(g, cx, cy, z, r, col) {
      const [sx, sy] = R.proj(cx, cy, z); const rr = Math.max(1, Math.round(r * TW));
      const step = Math.max(1, Math.round(rr / 2.5)); const lit = shade(col, 0.25), dk = shade(col, -0.32);
      for (let y = -rr; y < rr; y += step) {
        const t = (y + step / 2) / rr; const hw = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * rr / step) * step; if (hw <= 0) continue;
        g.fillStyle = dk; g.fillRect(sx - hw, sy + y, hw * 2, step);
        g.fillStyle = col; g.fillRect(sx - hw, sy + y, Math.max(step, hw * 2 - step), step);
        if (y < 0) { g.fillStyle = lit; g.fillRect(sx - hw, sy + y, Math.max(step, hw), step); }
      }
    },
    vflat(g, cx, cy, z, axis, w, h, col) {
      const P = R.proj; const a = axis === 'x' ? [cx - w / 2, cy] : [cx, cy - w / 2], b = axis === 'x' ? [cx + w / 2, cy] : [cx, cy + w / 2];
      R.poly(g, [P(a[0], a[1], z + h), P(b[0], b[1], z + h), P(b[0], b[1], z), P(a[0], a[1], z)], col);
    },
    flame(g, cx, cy, z, s, seed) {
      const [sx, sy] = R.proj(cx, cy, z); const t = R.time * 9 + seed; const f = Math.sin(t) * 0.5 + 0.5, f2 = Math.sin(t * 1.7 + 1) * 0.5 + 0.5;
      const hgt = Math.max(3, Math.round((8 + f * 4) * s)), w = Math.max(2, Math.round((5 + f2 * 2) * s));
      // pixel fire: a stack of narrowing rows, three flat colours, plus a drifting ember
      const rows = Math.max(3, Math.round(hgt / 2));
      for (let i = 0; i < rows; i++) {
        const k = i / rows; const hw = Math.max(1, Math.round(w * (1 - k * k * 0.9)));
        const wob = Math.round(Math.sin(t * 1.3 + i * 0.9) * (k * w * 0.35));
        g.fillStyle = k < 0.3 ? '#ff6e14' : k < 0.68 ? '#ffb040' : '#fff0a0';
        g.fillRect(sx - hw + wob, sy - 2 - i * 2, hw * 2, 2);
      }
      g.fillStyle = '#ffc850'; g.fillRect(sx - 1 + Math.round((f2 - 0.5) * 6 * s), sy - hgt - 3 - Math.round(f * 4), 1, 1);
    },
    roof(g, cx, cy, pr) {
      const P = R.proj, w = pr.w, d = pr.d, z = pr.z, zt = z + pr.rh; const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2; const faces = [];
      if (pr.along === 'x') { faces.push({ n: [0, -1], pts: [[x0, y0, z], [x1, y0, z], [x1, cy, zt], [x0, cy, zt]], c: [cx, (y0 + cy) / 2] }); faces.push({ n: [0, 1], pts: [[x0, y1, z], [x1, y1, z], [x1, cy, zt], [x0, cy, zt]], c: [cx, (y1 + cy) / 2] }); faces.push({ n: [-1, 0], pts: [[x0, y0, z], [x0, y1, z], [x0, cy, zt]], c: [x0, cy], gable: true }); faces.push({ n: [1, 0], pts: [[x1, y0, z], [x1, y1, z], [x1, cy, zt]], c: [x1, cy], gable: true }); }
      else { faces.push({ n: [-1, 0], pts: [[x0, y0, z], [x0, y1, z], [cx, y1, zt], [cx, y0, zt]], c: [(x0 + cx) / 2, cy] }); faces.push({ n: [1, 0], pts: [[x1, y0, z], [x1, y1, z], [cx, y1, zt], [cx, y0, zt]], c: [(x1 + cx) / 2, cy] }); faces.push({ n: [0, -1], pts: [[x0, y0, z], [x1, y0, z], [cx, y0, zt]], c: [cx, y0], gable: true }); faces.push({ n: [0, 1], pts: [[x0, y1, z], [x1, y1, z], [cx, y1, zt]], c: [cx, y1], gable: true }); }
      faces.sort((a, b) => R.depth(a.c[0], a.c[1]) - R.depth(b.c[0], b.c[1]));
      for (const f of faces) { const ryn = f.n[0] * sinY + f.n[1] * cosY, rxn = f.n[0] * cosY - f.n[1] * sinY; if (f.gable) { if (ryn <= 0) continue; R.poly(g, f.pts.map((p) => P(p[0], p[1], p[2])), shade('#8a7a5a', -0.2 + 0.2 * ryn - 0.15 * rxn)); continue; } const m = -0.18 + 0.2 * ryn - 0.1 * rxn; R.poly(g, f.pts.map((p) => P(p[0], p[1], p[2])), shade(pr.col, m)); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; for (let k = 1; k < 4; k++) { const t = k / 4; const a = f.pts[0], b = f.pts[1], c = f.pts[2], dd = f.pts[3]; const p = P(a[0] + (dd[0] - a[0]) * t, a[1] + (dd[1] - a[1]) * t, a[2] + (dd[2] - a[2]) * t), q = P(b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t, b[2] + (c[2] - b[2]) * t); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); } }
      const ra = pr.along === 'x' ? P(x0, cy, zt) : P(cx, y0, zt), rb = pr.along === 'x' ? P(x1, cy, zt) : P(cx, y1, zt); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ra[0], ra[1]); g.lineTo(rb[0], rb[1]); g.stroke();
    },
    spire(g, cx, cy, pr) { const P = R.proj; const apex = P(cx, cy, pr.z + pr.h); const r = pr.r; const corners = [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]]; const ns = [[0, -1], [1, 0], [0, 1], [-1, 0]]; for (let i = 0; i < 4; i++) { const n = ns[i]; const ryn = n[0] * sinY + n[1] * cosY; if (ryn <= 0) continue; const a = corners[i], b = corners[(i + 1) % 4]; R.poly(g, [P(a[0], a[1], pr.z), P(b[0], b[1], pr.z), apex], shade(pr.col, -0.1 + 0.3 * ryn)); } g.fillStyle = '#e0c040'; g.fillRect(apex[0] - 1, apex[1] - 7, 2, 7); g.fillRect(apex[0] - 3, apex[1] - 5, 6, 2); },
    drawPrims(g, cx, cy, prims, seed) {
      const list = prims.map((p) => ({ p, k: R.depth(cx + p.x, cy + p.y) + (p.z || 0) * 0.02 + (p.t === 'flat' ? -0.5 : 0) })).sort((a, b) => a.k - b.k);
      for (const { p } of list) {
        const x = cx + p.x, y = cy + p.y;
        if (p.t === 'box') R.box(g, x, y, p.z, p.w, p.d, p.h, { col: p.col, top: p.top });
        else if (p.t === 'cyl') R.cyl(g, x, y, p.z, p.r, p.h, p.col, p.top);
        else if (p.t === 'sph') R.sphere(g, x, y, p.z, p.r, p.col);
        else if (p.t === 'flat') { const P = R.proj; R.poly(g, [P(x - p.w / 2, y - p.d / 2, p.z), P(x + p.w / 2, y - p.d / 2, p.z), P(x + p.w / 2, y + p.d / 2, p.z), P(x - p.w / 2, y + p.d / 2, p.z)], p.col, null, p.alpha); }
        else if (p.t === 'vflat') R.vflat(g, x, y, p.z, p.axis, p.w, p.h, p.col);
        else if (p.t === 'flame') R.flame(g, x, y, p.z, p.s, seed || 0);
        else if (p.t === 'bill') { let s = billCache.get(p.key); if (!s) { s = p.make(); billCache.set(p.key, s); } const [sx, sy] = R.proj(x, y, p.z); g.drawImage(s.c, sx - s.ox, sy - s.oy); }
        else if (p.t === 'roof') R.roof(g, x, y, p);
        else if (p.t === 'spire') R.spire(g, x, y, p);
      }
    },
    tileFor(map, x, y, t) {
      const th = THEMES[map.theme] || THEMES.cave; const v = Math.floor(hash(x, y) * 4);
      switch (t) {
        case T.FLOOR: case T.DOORWAY: case T.TRAP: return tileTex('stone', th.floor[v % th.floor.length], v);
        case T.RUNE: return tileTex('stone', '#3a3a62', v);
        case T.RUBBLE: return tileTex('rubble', th.floor[0], v);
        case T.GRASS: case T.HILL: return tileTex('grass', ['#3f6a34', '#436e38', '#3b6430', '#476f3a'][v], v);
        case T.TALLGRASS: return tileTex('grass', ['#4a7638', '#4e7a3c'][v % 2], v + 4);
        case T.FOREST: return tileTex('grass', ['#33552c', '#375a30'][v % 2], v + 8);
        case T.ROAD: return tileTex('dirt', ['#8c6e4a', '#866846', '#90724e'][v % 3], v);
        case T.DIRT: return tileTex('dirt', '#74583c', v);
        case T.COBBLE: return tileTex('cobble', ['#6e6a70', '#6a666c', '#727076'][v % 3], v);
        case T.SAND: return tileTex('sand', ['#c4b07a', '#bca872'][v % 2], v);
        case T.WATER: return tileTex('water', '#2c5a8c', Math.floor(R.time * 3 + v) % 6);
        case T.SHALLOW: return tileTex('water', '#2e5060', Math.floor(R.time * 2 + v) % 6);
        case T.SWAMP: return tileTex('swamp', ['#3a4c30', '#3e5034', '#36482e'][v % 3], v);
        case T.GRAVE: return tileTex('grave', ['#405a36', '#445e3a'][v % 2], v);
        case T.BRIDGE: return tileTex('wood', '#6e5030', v);
        case T.WOOD: return tileTex('wood', ['#6a4a2e', '#704e32', '#644428'][v % 3], v);
        case T.RUG: return tileTex('rug', '#7a2028', v);
        case T.BAR: return tileTex('wood', '#3e2a18', v);
        case T.PIT: return tileTex('pit', '#0a0a10', v);
        case T.MOUNTAIN: case T.WALL: case T.BUILDING: return tileTex('stone', '#5a5a62', v);
        default: return null;
      }
    },

    render(state) {
      R.texts = [];
      const map = state.map; if (!map) return; R.map = map; const g = R.bg; const W = R.W, H = R.H;
      const th = THEMES[map.theme] || THEMES.cave; const dungeon = map.kind === 'dungeon', interior = map.kind === 'interior';
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = map.kind === 'overworld' ? '#1c2a3c' : (th.ambient || '#0d0a12'); g.fillRect(0, 0, W, H);
      const solidT = (x, y) => { if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true; const t = map.t[y * map.w + x]; return t === T.WALL || t === T.VOID || t === T.BUILDING || t === T.MOUNTAIN; };
      const isFloorish = (x, y) => !solidT(x, y);
      const ctx3 = { theme: map.theme, interior, wallDir: (x, y) => { const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]; for (const d of dirs) if (isFloorish(x + d[0], y + d[1])) return d; return [0, 1]; }, doorAxis: (x, y) => (solidT(x - 1, y) && solidT(x + 1, y)) ? 'x' : 'y' };
      // visible world range
      const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([px, py]) => { const rx = (px - W / 2) / TW, ry = (py - H / 2) / TD; return [R.cam.x + rx * cosY + ry * sinY, R.cam.y - rx * sinY + ry * cosY]; });
      const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) - 3)), maxX = Math.min(map.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0])) + 3));
      const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) - 3)), maxY = Math.min(map.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1])) + 4));
      const inView = (sx, sy) => sx > -TW * 3 && sx < W + TW * 3 && sy > -100 && sy < H + 60;
      const snapCos = Math.round(Math.cos(R.yawTarget)), snapSin = Math.round(Math.sin(R.yawTarget));
      const awayDir = (dx, dy) => (dx * snapSin + dy * snapCos) < -0.5; // world direction pointing away from the camera
      const drawables = [];
      // ---- floors ----
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const i = y * map.w + x, t = map.t[i]; if (t === T.VOID) continue; if (dungeon && !map.seen[i]) continue;
        const [sx, sy] = R.proj(x, y, 0); if (!inView(sx, sy)) continue;
        if (t === T.WALL || t === T.MOUNTAIN) { drawables.push({ k: R.depth(x, y), kind: 'wall', x, y, t }); if (t === T.WALL) continue; }
        if (t === T.BUILDING) continue;
        const tex = R.tileFor(map, x, y, t); if (!tex) continue;
        if (t === T.HILL) { R.box(g, x, y, 0, 1, 1, 0.22, { col: '#5a4a34', texTop: tex }); continue; }
        if (t === T.MOUNTAIN) continue;
        R.floorTex(g, x, y, 0, tex);
        if ((dungeon || interior)) { // ambient occlusion at wall bases: shade the floor strip next to far walls
          for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) if (solidT(x + dx, y + dy) && awayDir(dx, dy)) { const ax0 = x + dx * 0.5, ay0 = y + dy * 0.5; const px = dy !== 0 ? 0.5 : 0, py = dx !== 0 ? 0.5 : 0; const inx = -dx * 0.22, iny = -dy * 0.22; R.poly(g, [R.proj(ax0 - px, ay0 - py, 0), R.proj(ax0 + px, ay0 + py, 0), R.proj(ax0 + px + inx, ay0 + py + iny, 0), R.proj(ax0 - px + inx, ay0 - py + iny, 0)], 'rgba(0,0,0,.35)'); }
        }
        if (t === T.RUNE) { const rune = map.runes && map.runes[U.key(x, y)]; const col = rune && rune.lit ? '#9ad4ff' : '#6a6aa8'; const P = R.proj; R.poly(g, [P(x - 0.05, y - 0.3, 0.001), P(x + 0.05, y - 0.3, 0.001), P(x + 0.05, y + 0.3, 0.001), P(x - 0.05, y + 0.3, 0.001)], col); R.poly(g, [P(x - 0.3, y - 0.05, 0.001), P(x + 0.3, y - 0.05, 0.001), P(x + 0.3, y + 0.05, 0.001), P(x - 0.3, y + 0.05, 0.001)], col); if (rune && rune.lit) R.poly(g, R.tileQuad(x, y, 0.002), 'rgba(120,190,255,.28)'); }
        if (t === T.TRAP && map.trapsRevealed && map.trapsRevealed[U.key(x, y)]) { const P = R.proj; R.poly(g, [P(x - 0.05, y - 0.25, 0.001), P(x + 0.05, y - 0.25, 0.001), P(x + 0.05, y + 0.25, 0.001), P(x - 0.05, y + 0.25, 0.001)], 'rgba(255,70,70,.75)'); R.poly(g, [P(x - 0.25, y - 0.05, 0.001), P(x + 0.25, y - 0.05, 0.001), P(x + 0.25, y + 0.05, 0.001), P(x - 0.25, y + 0.05, 0.001)], 'rgba(255,70,70,.75)'); }
        if (t === T.WATER && hash(x, y + Math.floor(R.time * 2)) > 0.9) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(sx - 6 + Math.floor(hash(x, y) * 12), sy - 1 + Math.floor(hash(x + 3, y) * 3), 3, 1); }
        if (t === T.GRASS && hash(x, y) > 0.9) { g.fillStyle = hash(x + 7, y) > 0.5 ? '#d8c060' : '#e8e8f0'; g.fillRect(sx - 6 + Math.floor(hash(x, y + 3) * 12), sy - 2 + Math.floor(hash(x + 1, y) * 4), 1, 1); }
        if (t === T.TALLGRASS) { g.fillStyle = '#5a8a44'; for (let k = 0; k < 4; k++) g.fillRect(sx - 8 + k * 5 + Math.floor(hash(x + k, y) * 3), sy - 6 + Math.floor(hash(x, y + k) * 6), 1, 3 + Math.floor(hash(x, y + k * 2) * 2)); }
      }
      // ---- decals ----
      for (const p of map.props) { if (!p.decal || p.removed) continue; if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue; if (dungeon && !map.seen[p.y * map.w + p.x]) continue; if (p.kind === 'cobweb') { drawables.push({ k: R.depth(p.x, p.y) - 0.4, kind: 'cobweb', p }); continue; } R.floorTex(g, p.x, p.y, 0.001, Props3D.decalTex(p.kind, p.x * 7 + p.y * 13)); }
      // ---- collect props / entities / buildings ----
      for (const p of map.props) {
        if (p.removed || p.invisible || p.decal) continue; if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) continue;
        if (dungeon && !map.seen[p.y * map.w + p.x]) continue; if (p.kind === 'secretDoor' && !p.revealed) continue;
        drawables.push({ k: R.depth(p.x, p.y) + 0.005, kind: 'prop', p });
      }
      if (map.buildings) for (const b of map.buildings) { if (b.hidden) continue; const bd = Props3D.building(b); if (bd.cx < minX - 6 || bd.cx > maxX + 6 || bd.cy < minY - 6 || bd.cy > maxY + 6) continue; drawables.push({ k: R.depth(bd.cx, bd.cy), kind: 'building', bd }); }
      for (const e of state.entities) {
        if (e.dead && !e.corpse) continue; if (e.hidden) continue;
        const ex = Math.round(e.ax), ey = Math.round(e.ay); if (ex < 0 || ey < 0 || ex >= map.w || ey >= map.h) continue;
        if (dungeon && !map.vis[ey * map.w + ex] && !e.isParty) continue;
        const [sx, sy] = R.proj(e.ax, e.ay, 0); if (!inView(sx, sy)) continue;
        drawables.push({ k: R.depth(e.ax, e.ay) + 0.01, kind: 'ent', e, sx, sy });
      }
      drawables.sort((a, b) => a.k - b.k);
      // ---- depth-sorted pass ----
      const wallFace = interior ? '#4a3220' : th.wall, wallCap = interior ? '#8a6a48' : th.wallTop, wallStyle = interior ? 'wood' : 'stone';
      for (const dr of drawables) {
        if (dr.kind === 'wall') {
          const { x, y } = dr; const v = Math.floor(hash(x, y) * 3);
          if (dr.t === T.MOUNTAIN) { const hgt = 1.2; const snow = hash(x + 3, y) > 0.55; const isM = (xx, yy) => xx >= 0 && yy >= 0 && xx < map.w && yy < map.h && map.t[yy * map.w + xx] === T.MOUNTAIN; R.box(g, x, y, 0, 1, 1, hgt, { col: '#5e6068', top: snow ? '#c8ccd6' : (hash(x, y) > 0.5 ? '#7a7c86' : '#70727c'), hide: { n: isM(x, y - 1), s: isM(x, y + 1), e: isM(x + 1, y), w: isM(x - 1, y) } }); continue; }
          // walls standing in front of floor (between camera and floor) collapse to a low slab so they never hide the party
          let low = false; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (isFloorish(x + dx, y + dy) && awayDir(dx, dy)) low = true;
          const hide = { n: solidT(x, y - 1), s: solidT(x, y + 1), e: solidT(x + 1, y), w: solidT(x - 1, y) };
          // Walls between the camera and the floor collapse to a low kerb, shaded darker than any floor so the
          // room outline still reads at a glance instead of blending into the ground.
          if (low) { R.box(g, x, y, 0, 1, 1, LOW_H, { col: shade(wallFace, -0.2), top: shade(wallCap, -0.42), hide }); R.poly(g, R.tileQuad(x, y, LOW_H), null, 'rgba(0,0,0,.5)'); continue; }
          R.box(g, x, y, 0, 1, 1, WALL_H, { col: wallFace, texTop: tileTex(wallStyle === 'wood' ? 'wood' : 'stone', shade(wallCap, -0.3), v), texSide: wallTex(wallFace, v, wallStyle, Math.round(WALL_H * ZH)), hide });
          R.poly(g, R.tileQuad(x, y, WALL_H), null, 'rgba(0,0,0,.35)');
          if (dungeon && hash(x + 11, y) > 0.86) { const [sx, sy] = R.proj(x, y, WALL_H); g.fillStyle = 'rgba(40,90,40,.45)'; g.fillRect(sx - 8 + Math.floor(hash(x, y + 5) * 12), sy + 2, 2, 5 + Math.floor(hash(x, y + 9) * 6)); }
          continue;
        }
        if (dr.kind === 'building') { R.drawPrims(g, dr.bd.cx, dr.bd.cy, dr.bd.prims, 0); continue; }
        if (dr.kind === 'cobweb') { const p = dr.p; const d = ctx3.wallDir(p.x, p.y); const [dx, dy] = [d[0], d[1]]; const P = R.proj; const cx0 = p.x - dx * 0.5, cy0 = p.y - dy * 0.5; g.strokeStyle = 'rgba(230,230,240,.5)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 5; i++) { const a = P(cx0, cy0, WALL_H), b = P(cx0 + (dy !== 0 ? 0.6 : 0) * (i / 4), cy0 + (dx !== 0 ? 0.6 : 0) * (i / 4), WALL_H - 0.5 * (1 - i / 4) - 0.2); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke(); continue; }
        if (dr.kind === 'prop') {
          const p = dr.p; const prims = Props3D.build(p.kind, p, ctx3); if (!prims) continue;
          if (p.solid && !['torch', 'window', 'banner', 'web', 'door', 'secretDoor'].includes(p.kind)) R.poly(g, R.tileQuad(p.x, p.y, 0.002), 'rgba(0,0,0,.22)'); // tile-aligned shadow: no round blobs under pixel props
          R.drawPrims(g, p.x, p.y, prims, p.x * 3 + p.y);
          if (p.highlight) R.poly(g, R.tileQuad(p.x, p.y, 0.003), null, 'rgba(255,220,120,.9)');
          continue;
        }
        if (dr.kind === 'ent') {
          const e = dr.e, sx = dr.sx, sy = dr.sy; const frame = e.walking ? (Math.floor(R.time * 8) % 2) : 0; const s = Sprites.actor(e, frame);
          let bx = 0, by = 0; if (e.bump) { const k = Math.sin((1 - e.bump.t / 0.2) * Math.PI); const bdx = e.bump.dx * cosY - e.bump.dy * sinY, bdy = e.bump.dx * sinY + e.bump.dy * cosY; bx = bdx * k * 6; by = bdy * k * 4; }
          if (e.isParty || e.selected || e.activeTurn) R.poly(g, R.tileQuad(e.ax, e.ay, 0.002), e.activeTurn ? 'rgba(255,215,90,.3)' : (e.isParty ? 'rgba(120,200,255,.14)' : null), e.activeTurn ? '#ffd75a' : (e.selected ? '#ffffff' : null));
          else if (e.hostile && state.inCombat) R.poly(g, R.tileQuad(e.ax, e.ay, 0.002), 'rgba(255,80,80,.14)', 'rgba(255,80,80,.55)');
          g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(sx, sy + 1, Math.min(10, s.w / 2 - 1), 3, 0, 0, Math.PI * 2); g.fill();
          const flip = e.facing === 'l'; const dx = Math.round(sx - s.ox + bx), dy = Math.round(sy - s.oy + 2 + by + (e.hover ? Math.sin(R.time * 4) * 1.5 : 0));
          if (e.dead) { g.globalAlpha = 0.5; g.save(); g.translate(sx, sy + 1); g.rotate(Math.PI / 2); g.drawImage(s.c, -s.ox, -s.oy); g.restore(); g.globalAlpha = 1; continue; }
          if (flip) { g.save(); g.translate(dx + s.w, dy); g.scale(-1, 1); g.drawImage(s.c, 0, 0); g.restore(); } else g.drawImage(s.c, dx, dy);
          if (e.flash) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = Math.min(1, e.flash * 3); g.fillStyle = e.flashColor || '#fff'; g.fillRect(dx, dy, s.w, s.h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
          if (e.conditions && e.conditions.length) { const cols = { poisoned: '#60d060', paralyzed: '#e0e060', prone: '#c0a070', restrained: '#e0e0e0', frightened: '#c060e0', bless: '#ffe080', marked: '#ff8040', raging: '#ff4040', asleep: '#8080ff', dodging: '#80c0ff', hidden: '#a0a0a0', shield: '#60a0ff', haste: '#ffff80', slowed: '#80d0ff', blur: '#c0c0ff', weakened: '#805050', burning: '#ff6020', grappled: '#c0c0a0', invisible: '#e0e0ff', commanded: '#e0a0ff' }; let k = 0; for (const c of e.conditions) { g.fillStyle = cols[c.id] || '#fff'; g.fillRect(dx + s.w / 2 - 6 + k * 3, dy - 4, 2, 2); k++; if (k > 5) break; } }
          if ((e.hostile && (state.inCombat || e.hp < e.maxHp)) || (e.isParty && e.hp < e.maxHp)) { const w = 16, pct = U.clamp(e.hp / e.maxHp, 0, 1); g.fillStyle = '#100c14'; g.fillRect(sx - w / 2 - 1, dy - 3, w + 2, 4); g.fillStyle = pct > 0.5 ? '#5cb85c' : pct > 0.25 ? '#e0c040' : '#e04040'; g.fillRect(sx - w / 2, dy - 2, Math.round(w * pct), 2); }
          // text is not drawn into the pixel buffer (it would be upscaled into a blur): queue it for the crisp pass after the blit
          if (e.nameTag) R.texts.push({ kind: 'tag', text: e.nameTag, x: sx, y: dy - 6, color: e.hostile ? '#ffb0b0' : '#f0e6d0' });
          if (e.speech) R.texts.push({ kind: 'speech', text: e.speech, x: sx, y: dy - 12 });
        }
      }
      // ---- lighting ----
      const dg = R.darkG; dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, W, H);
      const lightAt = (gg, L, r, stops) => { const [lx, ly] = R.proj(L.x, L.y, 0.3); if (!inView(lx, ly)) return; gg.save(); gg.translate(lx, ly); gg.scale(1, TD / TW); const gr = gg.createRadialGradient(0, 0, 0, 0, 0, r); stops(gr); gg.fillStyle = gr; gg.beginPath(); gg.arc(0, 0, r, 0, Math.PI * 2); gg.fill(); gg.restore(); };
      if (dungeon) {
        dg.fillStyle = 'rgba(6,4,14,0.95)'; dg.fillRect(0, 0, W, H);
        const lights = state.lights || []; dg.globalCompositeOperation = 'destination-out';
        for (const L of lights) { const flick = 1 + Math.sin(R.time * 9 + L.x * 3 + L.y * 7) * 0.035 + Math.sin(R.time * 23 + L.y) * 0.02; lightAt(dg, L, L.r * TW * 0.66 * flick, (gr) => { gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.3, 'rgba(0,0,0,1)'); gr.addColorStop(0.3, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(0.78, 'rgba(0,0,0,.55)'); gr.addColorStop(0.78, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }); }
        dg.globalCompositeOperation = 'source-over'; dg.fillStyle = 'rgba(6,4,14,.72)';
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) { const i = y * map.w + x; if (map.t[i] === T.VOID || !map.seen[i] || map.vis[i]) continue; const [sx, sy] = R.proj(x, y, 0); if (!inView(sx, sy)) continue; const h = map.t[i] === T.WALL ? WALL_H : 0.02; const pts = R.tileQuad(x, y, 0).concat(R.tileQuad(x, y, h)); R.poly(dg, hull(pts), 'rgba(6,4,14,.72)'); }
        g.drawImage(R.dark, 0, 0);
        for (const L of lights) lightAt(g, L, L.r * TW * 0.6, (gr) => { gr.addColorStop(0, 'rgba(255,150,60,' + (L.warm === false ? 0 : 0.22) + ')'); gr.addColorStop(0.5, 'rgba(255,120,40,.1)'); gr.addColorStop(1, 'rgba(255,100,40,0)'); });
      } else if (interior) {
        for (const L of (state.lights || [])) lightAt(g, L, L.r * TW / 2, (gr) => { gr.addColorStop(0, 'rgba(255,160,70,.28)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); });
        g.fillStyle = 'rgba(20,10,30,.22)'; g.fillRect(0, 0, W, H);
      } else {
        g.fillStyle = 'rgba(30,20,60,.16)'; g.fillRect(0, 0, W, H);
        for (const L of (state.lights || [])) lightAt(g, L, L.r * TW / 2, (gr) => { gr.addColorStop(0, 'rgba(255,190,90,.3)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); });
      }
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + (dungeon ? 0.75 : 0.5) + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      // ---- highlights / cursor ----
      if (state.highlights) for (const h of state.highlights) { const [sx, sy] = R.proj(h.x, h.y, 0); if (!inView(sx, sy)) continue; R.poly(g, R.tileQuad(h.x, h.y, 0.003), h.color, h.stroke, h.alpha || 0.35); }
      if (state.cursor) R.poly(g, R.tileQuad(state.cursor.x, state.cursor.y, 0.003), null, 'rgba(255,255,255,.7)');
      // things next to the party you can tap: a soft pulsing outline on their tile
      if (state.interact && !state.inCombat) { const a = 0.45 + 0.35 * Math.sin(R.time * 3.5); for (const t of state.interact) { const [sx, sy] = R.proj(t.x, t.y, 0); if (!inView(sx, sy)) continue; R.poly(g, R.tileQuad(t.x, t.y, 0.004), null, 'rgba(255,220,120,' + a.toFixed(2) + ')'); } }
      // ---- FX ----
      for (const f of R.fx) {
        const k = f.t / f.dur;
        if (f.kind === 'burst') { const [sx, sy] = R.proj(f.x, f.y, 0.2); g.globalAlpha = 1 - k; g.fillStyle = f.color; const r = f.radius * TW / 2 * (0.4 + k); g.beginPath(); g.ellipse(sx, sy, r, r * TD / TW, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = (1 - k) * 0.5; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx, sy, r * 0.4, r * 0.3, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
        else if (f.kind === 'proj') { const [x0, y0] = R.proj(f.x0, f.y0, 0.6), [x1, y1] = R.proj(f.x1, f.y1, 0.6); const px = x0 + (x1 - x0) * k, py = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 8; g.fillStyle = f.color; g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3); g.globalAlpha = 0.5; g.fillRect(Math.round(px - (x1 - x0) * 0.04) - 1, Math.round(py) - 1, 2, 2); g.globalAlpha = 1; }
        else if (f.kind === 'ring') { const [sx, sy] = R.proj(f.x, f.y, 0); g.globalAlpha = 1 - k; g.strokeStyle = f.color; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy, TW / 2 * (0.3 + k * 1.5), TD / 2 * (0.3 + k * 1.5), 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
        else if (f.kind === 'slash') { const [sx, sy] = R.proj(f.x, f.y, 0); g.strokeStyle = f.color; g.lineWidth = 2; g.globalAlpha = 1 - k; g.beginPath(); g.moveTo(sx - 8 + k * 6, sy - 22 + k * 4); g.lineTo(sx + 6 - k * 4, sy - 6 - k * 4); g.stroke(); g.globalAlpha = 1; }
      }
      for (const f of R.floats) { const [sx, sy] = R.proj(f.x, f.y, 1.1); const k = f.t / f.dur; R.texts.push({ kind: 'float', text: f.text, x: sx, y: sy - k * 16, color: f.color, alpha: 1 - k * k, big: f.big }); }
      // ---- blit ----
      const c = R.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.fillStyle = '#000'; c.fillRect(0, 0, R.canvas.width, R.canvas.height);
      const shx = R.shake ? (Math.random() - 0.5) * R.shake * R.scale : 0, shy = R.shake ? (Math.random() - 0.5) * R.shake * R.scale : 0;
      c.drawImage(R.buf, Math.round(shx), Math.round(shy), W * R.scale, H * R.scale);
      // ---- crisp text pass: names, speech and floating numbers at native resolution ----
      const S = R.scale, ox = Math.round(shx), oy = Math.round(shy); const px = (n) => Math.max(10, Math.round(n * S));
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (const t of R.texts) {
        const x = ox + t.x * S, y = oy + t.y * S;
        if (t.kind === 'tag') { c.font = 'bold ' + px(5.5) + 'px "Trebuchet MS", Verdana, sans-serif'; c.lineWidth = Math.max(2, S * 0.9); c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,.9)'; c.strokeText(t.text, x, y); c.fillStyle = t.color; c.fillText(t.text, x, y); }
        else if (t.kind === 'speech') { c.font = px(5.5) + 'px "Trebuchet MS", Verdana, sans-serif'; const tw = c.measureText(t.text).width + 6 * S; const h = px(8); c.fillStyle = 'rgba(245,238,220,.94)'; c.fillRect(Math.round(x - tw / 2), Math.round(y - h * 0.78), Math.round(tw), h); c.fillStyle = '#222'; c.fillText(t.text, x, y); }
        else { c.font = 'bold ' + px(t.big ? 9 : 6.5) + 'px "Trebuchet MS", Verdana, sans-serif'; c.globalAlpha = Math.max(0, t.alpha); c.lineWidth = Math.max(2, S * 0.9); c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,.9)'; c.strokeText(t.text, x, y); c.fillStyle = t.color; c.fillText(t.text, x, y); c.globalAlpha = 1; }
      }
      R.texts = [];
    },
  };
  const billCache = new Map();
  // convex hull (monotone chain) for remembered-tile darkening of wall blocks
  function hull(pts) { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lower = []; for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); } const upper = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); } upper.pop(); lower.pop(); return lower.concat(upper); }
  window.Renderer = R;
})();
