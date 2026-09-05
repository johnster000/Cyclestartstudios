/* Small helpers shared by every module. Attached to window.U */
(function () {
  const U = {};
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by)); // Chebyshev: 5e grid (diagonals cost 1)
  U.manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  U.key = (x, y) => x + ',' + y;
  U.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  U.fmtMod = (m) => (m >= 0 ? '+' + m : '' + m);
  U.pick = (arr, rng) => arr[Math.floor((rng ? rng() : Math.random()) * arr.length)];
  U.shuffle = (arr, rng) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rng ? rng() : Math.random()) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.uid = (() => { let n = 0; return (p) => (p || 'id') + '_' + (++n) + '_' + Math.floor(Math.random() * 1e6).toString(36); })();
  U.deepClone = (o) => JSON.parse(JSON.stringify(o));
  U.sum = (arr) => arr.reduce((a, b) => a + b, 0);
  U.el = (tag, attrs, children) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style') e.style.cssText = attrs[k];
      // boolean attributes: `disabled: false` must mean enabled — setAttribute('disabled', 'false') would still disable it
      else if (attrs[k] === false || attrs[k] === null || attrs[k] === undefined) { /* absent */ }
      else if (attrs[k] === true) e.setAttribute(k, '');
      else e.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach((c) => { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  U.ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  U.listJoin = (arr) => arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  // Bresenham line of points between two grid cells (inclusive)
  U.line = (x0, y0, x1, y1) => {
    const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    return pts;
  };
  // Generic A* on a grid; passable(x,y) returns bool; 8-directional, no corner cutting through blocked cells.
  U.astar = (sx, sy, tx, ty, passable, maxLen) => {
    maxLen = maxLen || 400;
    if (sx === tx && sy === ty) return [];
    const open = new Map(), closed = new Set(), came = new Map();
    const h = (x, y) => U.dist(x, y, tx, ty);
    const k0 = U.key(sx, sy);
    open.set(k0, { x: sx, y: sy, g: 0, f: h(sx, sy) });
    let iter = 0;
    while (open.size && iter++ < 20000) {
      let cur = null; for (const n of open.values()) if (!cur || n.f < cur.f || (n.f === cur.f && n.g > cur.g)) cur = n;
      const ck = U.key(cur.x, cur.y);
      if (cur.x === tx && cur.y === ty) {
        const path = []; let k = ck; while (came.has(k)) { const [x, y] = k.split(',').map(Number); path.unshift([x, y]); k = came.get(k); } return path;
      }
      open.delete(ck); closed.add(ck);
      if (cur.g >= maxLen) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const nx = cur.x + dx, ny = cur.y + dy, nk = U.key(nx, ny);
        if (closed.has(nk)) continue;
        const isTarget = nx === tx && ny === ty;
        if (!isTarget && !passable(nx, ny)) continue;
        if (dx && dy && (!passable(cur.x + dx, cur.y) || !passable(cur.x, cur.y + dy))) continue; // no corner cutting
        const g = cur.g + 1;
        const ex = open.get(nk);
        if (!ex || g < ex.g) { open.set(nk, { x: nx, y: ny, g, f: g + h(nx, ny) }); came.set(nk, ck); }
      }
    }
    return null;
  };
  // Flood fill reachable cells within N steps (for movement highlight)
  U.reachable = (sx, sy, steps, passable) => {
    const out = new Map(); const q = [[sx, sy, 0]]; out.set(U.key(sx, sy), 0);
    while (q.length) {
      const [x, y, d] = q.shift(); if (d >= steps) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy, k = U.key(nx, ny);
        if (out.has(k) || !passable(nx, ny)) continue;
        if (dx && dy && (!passable(x + dx, y) || !passable(x, y + dy))) continue;
        out.set(k, d + 1); q.push([nx, ny, d + 1]);
      }
    }
    return out;
  };
  window.U = U;
})();
