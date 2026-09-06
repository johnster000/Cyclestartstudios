/* 3D physics dice you throw by hand. The whole screen is the table.
   Dice wait in your hand near the bottom of the screen; you press one, drag it anywhere, and let go — the release
   velocity of your drag becomes the launch velocity, and the dice tumble under gravity, bounce off the floor and the
   edges of the screen, and come to rest wherever the physics puts them. The simulation is run ahead deterministically from that exact launch state to learn which face
   will land up; the faces are then labelled so the up face shows the number the game actually rolled, and the same
   simulation is replayed live. So the throw is genuinely yours and the physics is real — only the pips are bookkeeping.
   As each die lands its number pops and adds to a running total; then the modifier flies in, and finally the total
   (green) and the number you had to beat (red) collide into a pass / fail / critical verdict. */
(function () {
  const D = { canvas: null, g: null, dice: [], W: 0, H: 0, active: false, last: 0, phase: 'off', bounds: null, speed: 1 };
  const THROW = { scale: 0.55, min: 5, max: 26, lift: 0.22 }; // drag pixels/sec -> table units/sec, and how much a fast throw hops
  const REV = { pop: 0.5, mod: 0.26, modEnd: 0.92, vs: 1.04, hit: 1.34, verdict: 1.48, hold: 1.8, plain: 1.0 }, QUICK = 0.5;
  // ---- math ----
  const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return q.map((v) => v / l); };
  const qrot = (q, v) => { const [w, x, y, z] = q; const [vx, vy, vz] = v; const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx); return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; };
  const qfromAxis = (axis, ang) => { const l = Math.hypot(...axis) || 1; const s = Math.sin(ang / 2); return [Math.cos(ang / 2), axis[0] / l * s, axis[1] / l * s, axis[2] / l * s]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  // ---- polyhedra (unit-ish) ----
  function makePoly(sides) {
    let V = [], F = [];
    if (sides === 4) { V = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => x * 0.8)); F = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]; }
    else if (sides === 6) { V = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x * 0.72, y * 0.72, z * 0.72]); F = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]; }
    else if (sides === 8) { V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((v) => v.map((x) => x * 1.05)); F = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]; }
    else if (sides === 10) { const c36 = Math.cos(Math.PI / 5), h = 0.12, H = h * (1 + c36) / (1 - c36); V = [[0, H, 0], [0, -H, 0]]; for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; V.push([Math.cos(a) * 0.95, (i % 2 ? h : -h), Math.sin(a) * 0.95]); } /* flat kites: apex height fixed by cos 36° */ F = []; for (let i = 0; i < 10; i++) { const a = 2 + i, b = 2 + (i + 1) % 10, c = 2 + (i + 2) % 10; F.push(i % 2 === 1 ? [0, a, b, c] : [1, c, b, a]); } } // top kites use the two raised belt corners (odd), bottom kites the lowered ones
    else if (sides === 12) { const p = (1 + Math.sqrt(5)) / 2, ip = 1 / p; V = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) V.push([x, y, z]); for (const a of [-1, 1]) for (const b of [-1, 1]) { V.push([0, a * ip, b * p]); V.push([a * ip, b * p, 0]); V.push([a * p, 0, b * ip]); } V = V.map((v) => v.map((x) => x * 0.62)); F = facesFromHull(V, 5); }
    else { const p = (1 + Math.sqrt(5)) / 2; V = []; for (const a of [-1, 1]) for (const b of [-1, 1]) { V.push([0, a, b * p]); V.push([a, b * p, 0]); V.push([b * p, 0, a]); } V = V.map((v) => v.map((x) => x * 0.62)); F = facesFromHull(V, 3); }
    // enforce outward winding for every face
    F = F.map((f) => { const a = V[f[0]], b = V[f[1]], c = V[f[2]]; const n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]); const cen = [0, 1, 2].map((k) => f.reduce((sum, vi) => sum + V[vi][k], 0) / f.length); return dot(n, cen) < 0 ? f.slice().reverse() : f; });
    return { V, F, sides };
  }
  // convex hull faces for regular solids: brute force planes through vertex triples where all other vertices lie on one side; merge coplanar
  function facesFromHull(V, n) {
    const faces = []; const seen = new Set();
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) for (let k = j + 1; k < V.length; k++) {
      const nrm = cross([V[j][0] - V[i][0], V[j][1] - V[i][1], V[j][2] - V[i][2]], [V[k][0] - V[i][0], V[k][1] - V[i][1], V[k][2] - V[i][2]]); const nl = Math.hypot(...nrm); if (nl < 1e-6) continue; const nn = nrm.map((x) => x / nl); const d = dot(nn, V[i]);
      let pos = 0, neg = 0; const on = []; V.forEach((v, idx) => { const s = dot(nn, v) - d; if (s > 1e-5) pos++; else if (s < -1e-5) neg++; else on.push(idx); });
      if (pos && neg) continue; if (on.length !== n) continue; const key = on.slice().sort().join(','); if (seen.has(key)) continue; seen.add(key);
      const outward = pos ? nn.map((x) => -x) : nn; const c = [0, 1, 2].map((a) => on.reduce((s, idx) => s + V[idx][a], 0) / on.length);
      const u = norm([V[on[0]][0] - c[0], V[on[0]][1] - c[1], V[on[0]][2] - c[2]]), w = cross(outward, u);
      on.sort((a, b) => Math.atan2(dot([V[a][0] - c[0], V[a][1] - c[1], V[a][2] - c[2]], w), dot([V[a][0] - c[0], V[a][1] - c[1], V[a][2] - c[2]], u)) - Math.atan2(dot([V[b][0] - c[0], V[b][1] - c[1], V[b][2] - c[2]], w), dot([V[b][0] - c[0], V[b][1] - c[1], V[b][2] - c[2]], u)));
      faces.push(on);
    }
    return faces;
  }
  const POLY = {}; const poly = (s) => POLY[s] || (POLY[s] = makePoly(s));
  const faceNormal = (P, f, q) => { const a = qrot(q, P.V[f[0]]), b = qrot(q, P.V[f[1]]), c = qrot(q, P.V[f[2]]); return norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); };
  // ---- physics ----
  const G = 22, DT = 1 / 120;
  function step(die, rnd) {
    const P = poly(die.sides); die.v[1] -= G * DT; die.p = die.p.map((x, i) => x + die.v[i] * DT);
    const wl = Math.hypot(...die.w); if (wl > 1e-6) die.q = qnorm(qmul(qfromAxis(die.w, wl * DT), die.q));
    // floor contact: lowest vertex
    let minY = Infinity, low = null; for (const v of P.V) { const wv = qrot(die.q, v); const y = die.p[1] + wv[1]; if (y < minY) { minY = y; low = wv; } }
    if (minY < 0) { die.p[1] -= minY; if (die.v[1] < 0) { const rest = 0.38; const vn = die.v[1]; die.v[1] = -vn * rest; die.v[0] *= 0.82; die.v[2] *= 0.82; const r = low; const imp = [ -die.v[0] * 0.6 + (rnd() - 0.5) * 1.5, 0, -die.v[2] * 0.6 + (rnd() - 0.5) * 1.5 ]; const t = cross(r, imp); die.w = die.w.map((x, i) => x * 0.72 + t[i] * 1.4); if (Math.abs(vn) < 1.2) { die.v[1] = 0; die.w = die.w.map((x) => x * 0.6); } } }
    // walls: the edges of the screen
    const B = D.bounds || { x0: -4, x1: 4, z0: -3, z1: 3 };
    if (die.p[0] < B.x0) { die.p[0] = B.x0; die.v[0] = Math.abs(die.v[0]) * 0.6; } if (die.p[0] > B.x1) { die.p[0] = B.x1; die.v[0] = -Math.abs(die.v[0]) * 0.6; }
    if (die.p[2] < B.z0) { die.p[2] = B.z0; die.v[2] = Math.abs(die.v[2]) * 0.6; } if (die.p[2] > B.z1) { die.p[2] = B.z1; die.v[2] = -Math.abs(die.v[2]) * 0.6; }
    die.w = die.w.map((x) => x * 0.995);
    if (minY <= 0.02 && Math.hypot(...die.v) < 0.35 && Math.hypot(...die.w) < 0.9) { die.v = [0, 0, 0]; die.w = [0, 0, 0]; return true; }
    return false;
  }
  function upFace(die) { const P = poly(die.sides); let best = -1, bi = 0; P.F.forEach((f, i) => { const n = faceNormal(P, f, die.q); if (n[1] > best) { best = n[1]; bi = i; } }); return bi; }
  // snap so the up face is exactly horizontal
  function snap(die) { const P = poly(die.sides); const fi = upFace(die); const n = faceNormal(P, P.F[fi], die.q); const ang = Math.acos(Math.max(-1, Math.min(1, n[1]))); if (ang > 1e-4) { const axis = cross(n, [0, 1, 0]); die.q = qnorm(qmul(qfromAxis(axis, ang), die.q)); } let minY = Infinity; for (const v of P.V) { const y = qrot(die.q, v)[1]; if (y < minY) minY = y; } die.p[1] = -minY; return fi; }
  function labelFaces(die, fi) { const P = poly(die.sides); const labels = new Array(P.F.length); const nums = []; for (let i = 1; i <= die.sides; i++) if (i !== die.value) nums.push(i); labels[fi] = die.value; let k = 0; for (let i = 0; i < P.F.length; i++) if (i !== fi) labels[i] = nums[k++] || 0; if (die.sides === 10) labels.forEach((v, i) => { labels[i] = v === 10 ? 0 : v; }); die.labels = labels; }
  let seq = 0;
  const HAND_Y = 0.35;
  // A die in your hand, face up, not yet thrown. home = where it sits between throws.
  function makeDie(sides, kind, home) {
    const die = { sides, kind: kind || 'd20', value: 1 + Math.floor(Math.random() * sides), kept: true, counts: true,
      p: home.slice(), home: home.slice(), v: [0, 0, 0], w: [0, 0, 0], q: qnorm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
      st: 'hand', settled: false, thrown: false, alpha: 1, t: 0, simSteps: 0, landAt: null };
    die.faceIdx = snap(die); die.p[1] = HAND_Y; labelFaces(die, die.faceIdx); return die;
  }
  // Throw it from where it is with velocity `vel`, then re-run the world simulation for every die still in the air:
  // dice knock into each other, so the run-ahead has to be a joint one. The faces it finds are the faces the live
  // replay lands on, because both use the same fixed-step world, in the same order, with the same random streams.
  function launch(die, vel) {
    const B = D.bounds; die.p[0] = U.clamp(die.p[0], B.x0, B.x1); die.p[2] = U.clamp(die.p[2], B.z0, B.z1); die.p[1] = Math.max(die.p[1], 0.5);
    const sp = Math.hypot(vel[0], vel[2]);
    die.v = [vel[0], 1.6 + sp * THROW.lift, vel[2]];
    die.w = [(Math.random() - 0.5) * 6 - vel[2] * 1.3, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 6 + vel[0] * 1.3];
    die.st = 'sim'; die.thrown = true; die.settled = false; die.landAt = null; die.alpha = 1;
    resimulate();
  }
  const RAD = 0.58, WORLD_CAP = 120 * 10;
  // Dice bump into each other. Two dice still moving trade momentum; a die that has come to rest is a statue — a
  // moving die bounces off it without shifting it. Deterministic: only the moving die's own random stream is used.
  function collide(moving, statues) {
    const bump = (a, b, both) => {
      const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2]; const d = Math.hypot(dx, dy, dz); if (d >= RAD * 2 || d < 1e-6) return;
      const nx = dx / d, ny = dy / d, nz = dz / d; const pen = RAD * 2 - d;
      if (both) { a.p[0] -= nx * pen / 2; a.p[1] -= ny * pen / 2; a.p[2] -= nz * pen / 2; b.p[0] += nx * pen / 2; b.p[1] += ny * pen / 2; b.p[2] += nz * pen / 2; }
      else { a.p[0] -= nx * pen; a.p[1] -= ny * pen; a.p[2] -= nz * pen; }
      const va = a.v[0] * nx + a.v[1] * ny + a.v[2] * nz, vb = both ? (b.v[0] * nx + b.v[1] * ny + b.v[2] * nz) : 0;
      const rel = va - vb; if (rel <= 0) return; // already moving apart
      const j = rel * 1.55 / (both ? 2 : 1);
      a.v[0] -= j * nx; a.v[1] -= j * ny; a.v[2] -= j * nz; if (both) { b.v[0] += j * nx; b.v[1] += j * ny; b.v[2] += j * nz; }
      const kick = [-nz * j * 1.2 + (a.rnd() - 0.5) * 2, (a.rnd() - 0.5) * 2, nx * j * 1.2 + (a.rnd() - 0.5) * 2];
      a.w = a.w.map((x, i) => x * 0.8 + kick[i]); if (both) b.w = b.w.map((x, i) => x * 0.8 - kick[i] * 0.8);
    };
    for (let i = 0; i < moving.length; i++) { const a = moving[i]; for (let k = i + 1; k < moving.length; k++) bump(a, moving[k], true); for (const st of statues) bump(a, st, false); }
  }
  // One fixed step of the whole table. Returns the dice that came to rest this step (each snapped, faceIdx set).
  function worldStep(list) {
    const done = [];
    for (const d of list) { if (d.st !== 'sim') continue; d.t++; if (step(d, d.rnd) || d.t >= d.simSteps) { d.faceIdx = snap(d); d.st = 'rest'; d.settled = true; done.push(d); } }
    collide(list.filter((d) => d.st === 'sim'), list.filter((d) => d.st === 'rest'));
    return done;
  }
  // Re-run the run-ahead for every die in the air, together, from their exact current states.
  function resimulate() {
    const flying = D.dice.filter((d) => d.st === 'sim'); if (!flying.length) return;
    for (const d of flying) { d.seed = RNG.hash('sim' + (seq++) + Date.now() + Math.round(d.p[0] * 977 + d.p[2] * 131)); d.rnd = RNG(d.seed); d.t = 0; d.simSteps = Infinity; d.settled = false; }
    const copies = D.dice.map((d) => d.st === 'sim' ? { src: d, sides: d.sides, p: d.p.slice(), v: d.v.slice(), w: d.w.slice(), q: d.q.slice(), t: 0, st: 'sim', settled: false, rnd: RNG(d.seed), simSteps: Infinity } : d.st === 'rest' ? { p: d.p.slice(), st: 'rest', settled: true } : null).filter(Boolean);
    let steps = 0;
    while (steps++ < WORLD_CAP && copies.some((c) => c.st === 'sim')) for (const c of worldStep(copies)) { c.src.simSteps = c.t; c.src.faceIdx = c.faceIdx; }
    for (const c of copies) if (c.src && c.st === 'sim') { c.src.simSteps = c.t; c.src.faceIdx = snap(c); } // ran out of patience: force it down
    for (const d of flying) labelFaces(d, d.faceIdx);
  }
  D._worldStep = worldStep; D._collide = collide;
  // The house's throw: up the screen from the hand, a middling pace, a little sideways.
  const houseVel = () => { const sp = 9 + Math.random() * 6; const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1; return [Math.cos(a) * sp, 0, Math.sin(a) * sp]; };

  // ---- API ----
  // The canvas is display:none on the title screen, so re-measure whenever we are about to use it.
  const fit = () => { const r = D.canvas.getBoundingClientRect(); if (Math.abs(r.width - D.W) > 1 || Math.abs(r.height - D.H) > 1 || D.canvas.width < 4) D.resize(); };
  D.init = (canvas) => { D.canvas = canvas; D.g = canvas.getContext('2d'); D.resize(); window.addEventListener('resize', D.resize); D.bindInput(); requestAnimationFrame(D.frame); };
  D.resize = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); const r = D.canvas.getBoundingClientRect(); D.canvas.width = Math.max(1, Math.floor(r.width * dpr)); D.canvas.height = Math.max(1, Math.floor(r.height * dpr)); D.W = r.width; D.H = r.height; D.dpr = dpr; D.phone = D.W < 600; try { D.safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0; } catch (e) { D.safeTop = 0; } if (D.panelTop === undefined) { D.panelTop = null; D.panelTopTarget = null; } layout(); };
  // The result panel's rect on screen (CSS px). The UI seats dialogs beneath it and asks it to slide with setTop().
  D.trayRect = () => { fit(); layout(); return { x: D.rect.x, y: D.rect.y, w: D.rect.w, h: D.rect.h }; };
  D.setTop = (y) => { D.panelTopTarget = y === null || y === undefined ? null : y; };

  function valueList(rec) {
    if (rec.type === 'd20') { let keptTaken = false; return rec.rolls.map((v) => { const kept = !keptTaken && v === rec.kept; if (kept) keptTaken = true; return { sides: 20, value: v, kind: kept && rec.nat20 ? 'crit' : kept && rec.nat1 ? 'fumble' : (rec.kind || 'd20'), kept, counts: kept }; }); }
    return rec.rolls.slice(0, 8).map((r) => ({ sides: [4, 6, 8, 10, 12, 20].includes(r.sides) ? r.sides : 6, value: r.sides === 100 ? (r.v % 10 || 10) : Math.min(r.v, r.sides), kind: rec.kind || 'misc', kept: true, counts: true }));
  }
  function reset(kind) { D.rec = null; D.kind = kind; D.active = true; D.pinned = false; D.t = 0; D.settledAt = null; D.fadeFrom = null; D.running = 0; D.panelTop = null; D.panelTopTarget = null; D.last = performance.now(); D.canvas.style.opacity = '1'; }
  // Hand positions: a row near the bottom of the screen, in table space.
  const handY = () => D.H - (D.phone ? 290 : 150);
  function handSlots(n) { layout(); const y = handY(); const gap = Math.min(66, (D.W - 60) / n); const out = []; for (let i = 0; i < n; i++) { const t = D.unproject(D.cx + (i - (n - 1) / 2) * gap, y); out.push([t[0], 0, t[1]]); } return out; }

  // Put dice in the player's hand. spec: {n, sides, kind, label}
  D.ready = (spec) => {
    fit(); spec = spec || {}; const n = Math.max(1, Math.min(8, spec.n || 1)), sides = spec.sides || 20, kind = spec.kind || 'd20';
    const slots = handSlots(n); D.dice = slots.map((h) => makeDie(sides, kind, h));
    D.spec = { n, sides, kind }; D.caption = spec.label || null; D.lastVel = null; D.phase = 'ready'; reset(kind);
  };
  D.allThrown = () => D.dice.length > 0 && D.dice.every((d) => d.thrown);
  D.unthrown = () => D.dice.filter((d) => !d.thrown).length;
  // Throw whatever is still in your hand, with the force of your last throw (or the house's).
  D.throwRest = () => {
    let any = false; const base = D.lastVel;
    for (const d of D.dice) if (!d.thrown) { launch(d, base ? [base[0] + (Math.random() - 0.5) * 3, 0, base[2] + (Math.random() - 0.5) * 3] : houseVel()); any = true; }
    if (any) { AudioSys.play('dice'); if (D.allThrown()) { D.phase = 'throw'; if (D.onAllThrown) D.onAllThrown(); } }
    return any;
  };
  // The game has rolled: give the dice in the air the numbers they are going to land on.
  D.bind = (rec) => {
    fit(); const list = valueList(rec); if (!list.length) return;
    const slots = handSlots(list.length);
    for (let i = 0; i < list.length; i++) {
      let d = D.dice[i];
      if (!d || d.sides !== list[i].sides) { d = makeDie(list[i].sides, list[i].kind, slots[i]); D.dice[i] = d; }
      d.value = list[i].value; d.kind = list[i].kind; d.kept = list[i].kept; d.counts = list[i].counts;
      if (!d.thrown) { const b = D.lastVel; launch(d, b ? [b[0] + (Math.random() - 0.5) * 3, 0, b[2] + (Math.random() - 0.5) * 3] : houseVel()); } else labelFaces(d, d.faceIdx);
    }
    D.dice.length = list.length;
    D.rec = rec; D.phase = 'throw'; D.quick = false; // you threw these, so the result plays out in full
    D.revealEnd = rec.vs !== undefined ? REV.hold : REV.plain;
  };
  // No manual throw (fast mode, or a monster rolling): the house throws for you.
  D.roll = (rec) => {
    fit(); const list = valueList(rec); if (!list.length) return;
    const slots = handSlots(list.length);
    // put the dice on the table first: launch() re-runs the joint run-ahead over D.dice, so a die launched before it is
    // in that list would fly with no landing face computed
    D.dice = list.map((v, i) => { const d = makeDie(v.sides, v.kind, slots[i]); Object.assign(d, { value: v.value, kept: v.kept, counts: v.counts }); return d; });
    for (const d of D.dice) launch(d, houseVel());
    D.caption = rec.label || null; D.lastVel = null; D.phase = 'throw'; reset(rec.kind);
    D.rec = rec; D.quick = true; // the house threw these: read them out briskly
    D.revealEnd = (rec.vs !== undefined ? REV.hold : REV.plain) * QUICK;
  };

  // ---- picking a die up and throwing it ----
  // Listens on the window in the capture phase so a press on a die is ours and a press anywhere else still reaches
  // the game. The die follows your finger anywhere on screen; on release it flies off with the speed of your drag.
  D.bindInput = () => {
    let drag = null;
    const grabbable = () => D.active && D.phase === 'ready' && !D.rec;
    const pick = (x, y) => { let best = null, bd = 1e9; for (const d of D.dice) { if (d.st !== 'hand') continue; const [sx, sy] = D.project(d.p); const dd = Math.hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = d; } } return bd < Math.max(56, (D.S || 30) * 1.6) ? best : null; };
    window.addEventListener('pointerdown', (e) => {
      // a result you have finished reading: a tap anywhere sends it on its way (unless a dialog owns the screen)
      if (!(window.UI && UI.modalOpen && UI.modalOpen()) && D.skip()) { e.preventDefault(); e.stopPropagation(); return; }
      if (!grabbable()) return; const d = pick(e.clientX, e.clientY); if (!d) return;
      e.preventDefault(); e.stopPropagation();
      drag = { d, id: e.pointerId, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], moved: 0 }; d.st = 'held'; d.p[1] = 0.55; AudioSys.play('click');
    }, true);
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return; e.preventDefault(); e.stopPropagation();
      const last = drag.pts[drag.pts.length - 1]; drag.moved += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      drag.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); while (drag.pts.length > 8) drag.pts.shift();
      const t = D.unproject(e.clientX, e.clientY); drag.d.p[0] = t[0]; drag.d.p[2] = t[1]; drag.d.p[1] = 0.55;
    }, true);
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return; e.stopPropagation();
      const d = drag.d, pts = drag.pts, moved = drag.moved; drag = null;
      let vel;
      if (moved < 6 || pts.length < 2) vel = houseVel(); // a tap: just toss it
      else {
        const a = pts[0], b = pts[pts.length - 1]; const dt = Math.max(0.016, (b.t - a.t) / 1000);
        const S = D.S || 30; const vx = (b.x - a.x) / dt / S * THROW.scale, vz = (b.y - a.y) / dt / (S * st) * THROW.scale;
        const sp = Math.hypot(vx, vz) || 0.001, cl = U.clamp(sp, THROW.min, THROW.max);
        vel = [vx * cl / sp, 0, vz * cl / sp];
      }
      launch(d, vel); D.lastVel = vel; AudioSys.play('dice');
      if (D.allThrown()) { D.phase = 'throw'; if (D.onAllThrown) D.onAllThrown(); }
    };
    window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true);
  };

  // True while dice are in the air or the result is still being read out: the UI holds dialogs back on this.
  D.busy = () => D.active && D.phase === 'throw' && (D.settledAt === null || D.t - D.settledAt < (D.revealEnd || REV.plain) + 0.15);
  D.showing = () => D.active && D.phase !== 'ready';
  D.waiting = () => D.active && D.phase === 'ready';
  D.pin = () => { if (!D.showing()) return false; D.pinned = true; D.canvas.style.opacity = '1'; return true; };
  // Unpinning only restarts the fade-out; the result sequence itself never replays.
  D.unpin = () => { if (!D.pinned) return; D.pinned = false; if (D.active && D.settledAt !== null) D.fadeFrom = Math.max(D.fadeFrom || 0, D.t - (D.revealEnd || REV.plain)); };
  // Skip ahead: once every die has landed, jump the read-out to its verdict and start the fade now. Returns whether it did.
  D.skip = () => { if (!D.active || D.phase !== 'throw' || D.pinned || D.settledAt === null) return false; const end = D.revealEnd || REV.plain; if (D.t - D.settledAt >= end + 0.5) return false; D.settledAt = Math.min(D.settledAt, D.t - end); D.fadeFrom = Math.min(D.fadeFrom === null ? D.t : D.fadeFrom, D.t - end - 0.5); return true; };
  D.hide = () => { D.phase = 'off'; D.active = false; D.dice = []; D.canvas.style.opacity = '0'; };
  D.frame = (now) => {
    requestAnimationFrame(D.frame); if (!D.active) return; const g = D.g; const dt = Math.min(0.05, (now - D.last) / 1000); D.last = now; D.t += dt * D.speed; // D.t is the read-out clock: Fast hurries it, Slow stretches it
    // the result panel slides when a dialog asks for room
    const want = D.panelTopTarget === null ? D.rect.y0 : D.panelTopTarget; if (D.panelTop === null) D.panelTop = want; else if (Math.abs(want - D.panelTop) > 0.5) D.panelTop += (want - D.panelTop) * Math.min(1, dt * 9); else D.panelTop = want;
    D.acc = (D.acc || 0) + dt * Math.max(1, D.speed); // dice tumble faster on Fast, never slower than real time
    while (D.acc >= DT) { D.acc -= DT; for (const d of worldStep(D.dice)) { d.landAt = D.t; if (d.counts) D.running += d.value; AudioSys.play('click'); } }
    const allSettled = D.phase === 'throw' && D.dice.length && D.dice.every((d) => d.settled);
    if (allSettled && D.settledAt === null) { D.settledAt = D.t; D.fadeFrom = D.t; if (D.rec && D.rec.nat20) AudioSys.play('crit'); else if (D.rec && D.rec.nat1) AudioSys.play('fumble'); }
    const fadeAt = (D.revealEnd || REV.plain) + 0.5;
    const hold = D.fadeFrom !== null && D.phase === 'throw' && !D.pinned ? D.t - D.fadeFrom : 0;
    if (hold > fadeAt) { D.canvas.style.opacity = String(Math.max(0, 1 - (hold - fadeAt) / 0.6)); if (hold > fadeAt + 0.6) { D.phase = 'off'; D.active = false; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, D.canvas.width, D.canvas.height); return; } }
    D.draw();
  };

  // projection: camera tilted down ~58°, orthographic, centred on the screen. The table is the screen.
  const TILT = 58 * Math.PI / 180, ct = Math.cos(TILT), st = Math.sin(TILT);
  const layout = () => {
    D.S = U.clamp(Math.min(D.W, D.H) / 13, 28, 44); D.cx = D.W / 2; D.cy = D.H / 2;
    // The table is the screen minus the HUD strips (party bar and buttons at the top, d-pad and context buttons at the
    // bottom), with a whole die's margin; the far edge gets extra room because a hopping die is drawn above its spot.
    const m = 0.62, top = 74 + (D.safeTop || 0), bottom = D.H - (D.phone ? 200 : 110);
    D.bounds = { x0: -D.cx / D.S + m, x1: D.cx / D.S - m, z0: (top - D.cy) / (D.S * st) + m + 1.0, z1: (bottom - D.cy) / (D.S * st) - m };
    const w = Math.min(440, D.W * 0.94), h = D.phone ? 200 : 224; const y0 = Math.round(D.H * 0.5 - h / 2);
    D.rect = { x: (D.W - w) / 2, y: D.panelTop === null || D.panelTop === undefined ? y0 : D.panelTop, y0, w, h };
    return D.S;
  };
  D.project = (p) => { const S = D.S || layout(); return [D.cx + p[0] * S, D.cy + (p[2] * st - p[1] * ct) * S]; };
  D.unproject = (sx, sy) => { const S = D.S || layout(); return [(sx - D.cx) / S, (sy - D.cy) / (S * st)]; };
  const COLORS = { d20: ['#e8c46a', '#2a1a08'], crit: ['#ffe07a', '#3a2a08'], fumble: ['#c0392b', '#ffffff'], dmg: ['#d85a3a', '#ffffff'], heal: ['#5cb85c', '#ffffff'], misc: ['#e8dcc4', '#2a1a08'], init: ['#7ab0d8', '#101820'], check: ['#e8c46a', '#2a1a08'], save: ['#b07ce0', '#ffffff'], attack: ['#e8c46a', '#2a1a08'] };
  const ease = (k) => 1 - Math.pow(1 - U.clamp(k, 0, 1), 3);
  const NUMF = (px) => 'bold ' + px + 'px "Palatino Linotype", Georgia, serif';

  function pill(g, x, y, w, h, fill, edge) {
    const r = Math.min(h / 2, 9); g.beginPath();
    g.moveTo(x - w / 2 + r, y - h / 2); g.lineTo(x + w / 2 - r, y - h / 2); g.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    g.lineTo(x + w / 2, y + h / 2 - r); g.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    g.lineTo(x - w / 2 + r, y + h / 2); g.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
    g.lineTo(x - w / 2, y - h / 2 + r); g.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2); g.closePath();
    g.fillStyle = fill; g.fill(); if (edge) { g.strokeStyle = edge; g.lineWidth = 2; g.stroke(); }
  }
  function stamp(g, x, y, text, px, fill, edge, scale) {
    g.save(); g.translate(x, y); if (scale && scale !== 1) g.scale(scale, scale);
    g.font = NUMF(px); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = edge || 'rgba(0,0,0,.85)'; g.strokeText(text, 0, 0);
    g.fillStyle = fill; g.fillText(text, 0, 0); g.restore();
  }

  // ---- dice sets: colour, ink and a face motif; chosen in the menu, used by every roll ----
  const SKINS = {
    gilded: { name: 'Gilded', desc: 'Polished brass and dark ink.', base: '#e8c46a', ink: '#2a1a08', pattern: 'none' },
    dragon: { name: 'Dragon', desc: 'Blood-red scales, gold numbers.', base: '#8a1a1a', ink: '#ffd76a', pattern: 'scales', glow: 'rgba(255,90,30,.28)' },
    fire: { name: 'Fire', desc: 'Embers that never quite go out.', base: '#e0561c', ink: '#fff2c0', pattern: 'flames', glow: 'rgba(255,140,40,.42)' },
    ice: { name: 'Ice', desc: 'Frost-cracked, cold to the touch.', base: '#9fd4f0', ink: '#10304a', pattern: 'frost', glow: 'rgba(160,220,255,.32)' },
    acid: { name: 'Acid', desc: 'Bubbling green, faintly luminous.', base: '#5cb82a', ink: '#0c2a06', pattern: 'drips', glow: 'rgba(120,255,60,.34)' },
    shadow: { name: 'Shadow', desc: 'Void-black with a violet halo.', base: '#2a1a3a', ink: '#d0a8ff', pattern: 'void', glow: 'rgba(150,80,255,.38)' },
    bone: { name: 'Bone', desc: 'Carved ivory, a little worn.', base: '#e8dcc0', ink: '#4a3020', pattern: 'speckle' },
  };
  D.SKINS = SKINS;
  D.skin = () => { let id = 'gilded'; try { id = (window.Save && Save.settings().diceSkin) || 'gilded'; } catch (e) {} return SKINS[id] || SKINS.gilded; };
  const hash01 = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  // A motif drawn inside one face (clipped to it): scales, wisps of flame, frost cracks, acid bubbles, a void, speckles.
  function facePattern(g, skin, pts, cen, R, seed, fi) {
    if (!skin.pattern || skin.pattern === 'none') return;
    g.save(); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    const [cx, cy] = cen; const h = (i) => hash01(seed * 31 + fi * 7 + i);
    switch (skin.pattern) {
      case 'scales': { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; const s = R * 0.22; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = cx + (i + (j % 2 ? 0.5 : 0)) * s, y = cy + j * s * 0.7; g.beginPath(); g.arc(x, y, s * 0.5, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } break; }
      case 'flames': { g.lineCap = 'round'; for (let k = 0; k < 3; k++) { const ph = D.t * 5 + k * 2.1 + seed; const x0 = cx + (k - 1) * R * 0.28, y0 = cy + R * 0.45; g.strokeStyle = k === 1 ? 'rgba(255,240,150,.55)' : 'rgba(255,190,60,.45)'; g.lineWidth = R * 0.09; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.sin(ph) * R * 0.15, y0 - R * 0.35, x0 + Math.sin(ph * 1.3) * R * 0.1, y0 - R * (0.6 + 0.1 * Math.sin(ph * 0.7))); g.stroke(); } break; }
      case 'frost': { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const a = h(k) * Math.PI * 2, l = R * (0.25 + h(k + 9) * 0.35); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); const mx = cx + Math.cos(a) * l * 0.55, my = cy + Math.sin(a) * l * 0.55; g.moveTo(mx, my); g.lineTo(mx + Math.cos(a + 0.9) * l * 0.25, my + Math.sin(a + 0.9) * l * 0.25); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(cx - R * 0.2, cy - R * 0.22, R * 0.06, 0, Math.PI * 2); g.fill(); break; }
      case 'drips': { for (let k = 0; k < 3; k++) { const x = cx + (h(k) - 0.5) * R * 0.9, y = cy + (h(k + 5) - 0.5) * R * 0.9, r = R * (0.06 + h(k + 11) * 0.1); g.fillStyle = 'rgba(200,255,120,.5)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(20,80,10,.4)'; g.beginPath(); g.arc(x + r * 0.4, y + r * 0.4, r * 0.5, 0, Math.PI * 2); g.fill(); } break; }
      case 'void': { const gr = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R * 0.75); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.7, 'rgba(120,60,200,.15)'); gr.addColorStop(1, 'rgba(180,120,255,.5)'); g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2); break; }
      case 'speckle': { g.fillStyle = 'rgba(120,80,40,.32)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + (h(k) - 0.5) * R * 0.9, cy + (h(k + 7) - 0.5) * R * 0.9, R * 0.03 + h(k + 3) * R * 0.03, 0, Math.PI * 2); g.fill(); } break; }
      default: break;
    }
    g.restore();
  }
  const LIGHT = norm([-0.4, 1, -0.5]);
  // One die: drop shadow, halo, lit faces with the set's motif, numbers on the faces turned toward you.
  function drawDie(g, d, S, proj, dimAll, skin, seed) {
    const P = poly(d.sides); const base = skin.base, ink = skin.ink; const R = S * 0.95 * (d.sides === 4 ? 1.1 : 1) * (d.st === 'held' ? 1.12 : 1);
    const dim = (d.st === 'rest' && D.rec && D.rec.type === 'd20' && !d.counts ? 0.55 : 1) * d.alpha * dimAll;
    g.globalAlpha = dim;
    const sh = proj([d.p[0], 0, d.p[2]]); g.fillStyle = 'rgba(0,0,0,' + (0.4 / (1 + d.p[1] * 0.6)).toFixed(2) + ')'; g.beginPath(); g.ellipse(sh[0], sh[1], R * 0.9 / (1 + d.p[1] * 0.15), R * 0.5 / (1 + d.p[1] * 0.15), 0, 0, Math.PI * 2); g.fill();
    if (skin.glow) { const c = proj(d.p); const gr = g.createRadialGradient(c[0], c[1], R * 0.4, c[0], c[1], R * 1.7); gr.addColorStop(0, skin.glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], R * 1.7, 0, Math.PI * 2); g.fill(); }
    // waiting in your hand: a soft pulse so you know these are yours to throw
    if (d.st === 'hand' && D.phase === 'ready') { const a = 0.35 + 0.3 * Math.sin(D.t * 4 + d.p[0]); const c = proj([d.p[0], 0, d.p[2]]); g.strokeStyle = 'rgba(255,224,122,' + a.toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(c[0], c[1], R * 1.25, R * 0.7, 0, 0, Math.PI * 2); g.stroke(); }
    const verts = P.V.map((v) => { const w = qrot(d.q, v); return [d.p[0] + w[0] * 0.95, d.p[1] + w[1] * 0.95, d.p[2] + w[2] * 0.95]; });
    const faces = P.F.map((f, i) => { const n = faceNormal(P, f, d.q); const c = [0, 1, 2].map((a) => f.reduce((s, vi) => s + verts[vi][a], 0) / f.length); return { f, i, n, c, facing: n[1] * st + n[2] * ct, depth: c[1] * st + c[2] * ct }; }).filter((fc) => fc.facing > 0.02).sort((a, b) => a.depth - b.depth);
    for (const fc of faces) {
      const pts = fc.f.map((vi) => proj(verts[vi])); const lt = Math.max(0, dot(fc.n, LIGHT)); const shade = (0.55 + lt * 0.55) * (d.st === 'held' ? 1.15 : 1);
      g.fillStyle = mixColor(base, shade); g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
      facePattern(g, skin, pts, proj(fc.c), R, seed, fc.i);
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.stroke();
      const facing = fc.facing; if (facing > 0.35 && d.labels) { const c = proj(fc.c); const lbl = d.labels[fc.i]; if (lbl === undefined) continue; const fs = Math.max(7, R * (d.sides >= 12 ? 0.42 : d.sides >= 8 ? 0.55 : 0.7)); g.save(); g.translate(c[0], c[1]); g.scale(1, Math.max(0.35, facing)); g.font = NUMF(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink; g.globalAlpha = dim * Math.min(1, facing * 1.4); g.fillText(String(lbl) + ((lbl === 6 || lbl === 9) && d.sides >= 10 ? '.' : ''), 0, 1); g.globalAlpha = dim; g.restore(); }
    }
    if (d.st === 'rest' && (d.kind === 'crit' || d.kind === 'fumble')) { const c = proj(d.p); g.strokeStyle = (d.kind === 'crit' ? 'rgba(255,224,122,' : 'rgba(255,90,90,') + (0.5 + 0.5 * Math.sin(D.t * 10)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(c[0], c[1], R * 1.3, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 1;
  }
  // A still of one d20 in a given set, for the picker in the menu.
  D.preview = (canvas, skinId) => {
    const skin = SKINS[skinId] || SKINS.gilded; const g = canvas.getContext('2d'); const W = canvas.width, H = canvas.height; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const S = Math.min(W, H) / 3.2; const proj = (p) => [W / 2 + p[0] * S, H * 0.6 + (p[2] * st - p[1] * ct) * S];
    const die = { sides: 20, kind: 'd20', value: 20, p: [0, 0, 0], q: qnorm([0.82, 0.32, 0.4, 0.2]), st: 'rest', alpha: 1, counts: true, labels: null };
    die.faceIdx = snap(die); labelFaces(die, die.faceIdx); drawDie(g, die, S, proj, 1, skin, 3);
  };

  D.draw = () => {
    const g = D.g; g.setTransform(D.dpr, 0, 0, D.dpr, 0, 0); g.clearRect(0, 0, D.W, D.H);
    const S = layout(); const proj = D.project;
    const dimAll = D.pinned ? 0.35 : 1; // a dialog is up: the dice step back, the verdict stays crisp
    const skin = D.skin();
    const order = D.dice.slice().sort((a, b) => a.p[2] - b.p[2]);
    order.forEach((d, i) => drawDie(g, d, S, proj, dimAll, skin, i));
    drawReveal(g, S, proj);
  };

  // Numbers pop as the dice land and add themselves up; then the modifier; then your total against the target.
  function drawReveal(g, S, proj) {
    const cx = D.cx, R0 = D.rect, W = R0.w, H = R0.h, X0 = R0.x, Y0 = R0.y;
    const by = 84; // running total, below the top bar
    if (D.phase === 'ready') {
      g.font = 'bold 12px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const a = 0.55 + 0.35 * Math.sin(D.t * 3); const hy = handY() - 150; // above the Throw button, which sits above your hand
      if (D.caption) { g.fillStyle = 'rgba(0,0,0,.8)'; g.fillText(D.caption, cx + 1, hy - 17); g.fillStyle = '#cbbfa8'; g.fillText(D.caption, cx, hy - 18); }
      const hint = D.dice.some((d) => d.st === 'hand') && D.dice.some((d) => d.thrown) ? 'throw the rest' : 'press a die and flick it';
      g.fillStyle = 'rgba(0,0,0,.8)'; g.fillText(hint, cx + 1, hy + 1); g.fillStyle = 'rgba(232,196,106,' + a.toFixed(2) + ')'; g.fillText(hint, cx, hy);
      return;
    }
    const rec = D.rec;
    for (const d of D.dice) {
      if (d.landAt === null) continue; const k = (D.t - d.landAt) / REV.pop; if (k > 1) continue;
      const [sx, sy] = proj([d.p[0], d.p[1] + 0.7, d.p[2]]);
      const rise = 26 * ease(k * 1.6); const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const sc = 1 + 1.1 * Math.max(0, 1 - k * 5);
      g.globalAlpha = a;
      stamp(g, sx, sy - rise, String(d.value), 22, d.counts ? '#ffe9a8' : '#9aa0ae', 'rgba(0,0,0,.9)', sc);
      if (!d.counts) { g.strokeStyle = 'rgba(200,60,60,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 13, sy - rise + 8); g.lineTo(sx + 13, sy - rise - 8); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (!rec) return;
    const e = D.settledAt === null ? -1 : (D.t - D.settledAt) / (D.quick ? QUICK : 1);
    const mods = (rec.mod || 0) + (rec.extras || []).reduce((t, x) => t + x.total, 0);
    const shown = e < REV.mod || !mods ? D.running : Math.round(D.running + mods * ease((e - REV.mod) / (REV.modEnd - REV.mod)));
    const badgeA = rec.vs === undefined ? 1 : 1 - U.clamp((e - REV.vs + 0.18) / 0.22, 0, 1);
    if (badgeA > 0.01) {
      g.globalAlpha = badgeA;
      const bump = e >= REV.mod && e < REV.modEnd ? 1 + 0.12 * Math.sin((e - REV.mod) / (REV.modEnd - REV.mod) * Math.PI) : 1;
      pill(g, cx, by, 74, 30, 'rgba(12,26,14,.92)', '#4e9c4e');
      stamp(g, cx, by, String(shown), 20, '#9cf09c', 'rgba(0,0,0,.9)', bump);
      if (D.caption) { g.font = 'bold 10px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.8)'; g.fillText(D.caption, cx + 1, by + 23); g.fillStyle = '#cbbfa8'; g.fillText(D.caption, cx, by + 22); }
      g.globalAlpha = 1;
    }
    if (mods && e >= REV.mod && e < REV.modEnd + 0.12) {
      const k = ease((e - REV.mod) / (REV.modEnd - REV.mod));
      const x = cx + 118 - 118 * k, a = 1 - Math.max(0, (k - 0.82) / 0.18);
      g.globalAlpha = a; pill(g, x, by, 60, 30, 'rgba(30,22,10,.95)', '#c9962e');
      stamp(g, x, by, (mods >= 0 ? '+' : '') + mods, 19, '#ffe07a', 'rgba(0,0,0,.9)', 1); g.globalAlpha = 1;
    }
    if (rec.vs === undefined || e < REV.vs) return;
    const k = U.clamp((e - REV.vs) / (REV.hit - REV.vs), 0, 1);
    const gap = (1 - ease(k)) * (W * 0.42);
    const dim = U.clamp((e - REV.vs) / 0.3, 0, 1);
    const py = Y0 + H * 0.38, vy = Y0 + H * 0.72; const hit = e >= REV.hit;
    g.globalAlpha = dim; pill(g, cx, (py + vy) / 2, W - 16, vy - py + 96, 'rgba(14,10,18,.94)', 'rgba(201,150,46,.55)'); g.globalAlpha = 1;
    const shake = hit ? Math.max(0, 1 - (e - REV.hit) / 0.22) * 5 : 0;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    pill(g, cx - 50 - gap + ox, py, 92, 46, 'rgba(12,34,14,.98)', '#6ee06e');
    stamp(g, cx - 50 - gap + ox, py, String(rec.total), 28, '#a8f5a8', 'rgba(0,0,0,.9)', 1);
    pill(g, cx + 50 + gap - ox, py, 92, 46, 'rgba(38,8,8,.98)', '#e05a5a');
    stamp(g, cx + 50 + gap - ox, py, String(rec.vs), 28, '#ffb0b0', 'rgba(0,0,0,.9)', 1);
    g.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#8ad48a'; g.fillText('YOUR ROLL', cx - 50 - gap + ox, py - 32); g.fillStyle = '#e08a8a'; g.fillText('TO BEAT', cx + 50 + gap - ox, py - 32);
    if (!hit) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(D.t * 12)).toFixed(2) + ')'; g.font = NUMF(16); g.fillText('vs', cx, py); return; }
    const fk = U.clamp((e - REV.hit) / 0.3, 0, 1);
    if (fk < 1) { g.globalAlpha = 1 - fk; g.fillStyle = rec.success ? 'rgba(160,255,160,.5)' : 'rgba(255,140,140,.45)'; g.beginPath(); g.arc(cx, py, 26 + fk * 90, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
    if (e < REV.verdict) return;
    const vk = ease((e - REV.verdict) / 0.24);
    const crit = rec.nat20, fumble = rec.nat1;
    const text = crit ? 'CRITICAL!' : fumble ? 'FUMBLE!' : rec.success ? 'PASS' : 'FAIL';
    const col = crit ? '#ffe07a' : fumble ? '#ff8a8a' : rec.success ? '#8cf08c' : '#ff9a9a';
    const px = Math.min(W * 0.13, 34) * (1 + 0.6 * (1 - vk));
    g.globalAlpha = Math.min(1, vk * 1.4);
    stamp(g, cx, vy, text, px, col, 'rgba(0,0,0,.95)', 1);
    g.globalAlpha = Math.min(1, vk) * 0.7; g.font = '11px "Trebuchet MS", Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#cbbfa8'; g.fillText('tap to continue', cx, vy + 30);
    g.globalAlpha = 1;
  }
  function mixColor(hexc, m) { const c = hexc.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), gg = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * m))); return 'rgb(' + f(r) + ',' + f(gg) + ',' + f(b) + ')'; }
  D._upFace = upFace; D._geom = (sides) => poly(sides);
  window.Dice3D = D;
})();
