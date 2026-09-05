/* Procedural dungeon generator built from handcrafted room pieces (data/rooms.js).
   generate({theme, level, rooms, seed, quest, partySize}) → map (see world.js shape) with monsters, props, puzzles, events. */
(function () {
  const T = TILE, D = {};
  const XP_BUDGET = { 1: 50, 2: 100, 3: 150, 4: 250, 5: 500, 6: 600, 7: 750, 8: 900, 9: 1100, 10: 1200 }; // medium encounter per character
  D.tierFor = (level) => level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : 4;

  // Corridors: 4-directional A* that charges for changing direction, so hallways run straight and turn in clean
  // right angles. (An 8-way search produced diagonal staircases, which read as a zigzag mess of wall stubs.)
  const CDIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  function corridorPath(sx, sy, tx, ty, pass, maxLen) {
    if (sx === tx && sy === ty) return [];
    const kk = (x, y, d) => x + ',' + y + ',' + d;
    const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const open = new Map(), bestG = new Map(), came = new Map();
    const k0 = kk(sx, sy, -1); open.set(k0, { x: sx, y: sy, d: -1, g: 0, f: h(sx, sy) }); bestG.set(k0, 0);
    let iter = 0;
    while (open.size && iter++ < 30000) {
      let cur = null, ck = null; for (const [k, n] of open) if (!cur || n.f < cur.f || (n.f === cur.f && n.g > cur.g)) { cur = n; ck = k; }
      open.delete(ck);
      if (cur.x === tx && cur.y === ty) { const out = []; let k = ck, n = cur; while (n) { out.push([n.x, n.y]); const par = came.get(k); if (!par) break; k = par.k; n = par.n; } out.reverse(); out.shift(); return out; }
      if (cur.g > maxLen) continue;
      for (let i = 0; i < 4; i++) {
        const nx = cur.x + CDIRS[i][0], ny = cur.y + CDIRS[i][1];
        if (!(nx === tx && ny === ty) && !pass(nx, ny)) continue;
        const ng = cur.g + 1 + (cur.d >= 0 && cur.d !== i ? 3 : 0); const nk = kk(nx, ny, i);
        if (bestG.has(nk) && bestG.get(nk) <= ng) continue;
        bestG.set(nk, ng); open.set(nk, { x: nx, y: ny, d: i, g: ng, f: ng + h(nx, ny) }); came.set(nk, { k: ck, n: cur });
      }
    }
    return null;
  }

  function parseTemplate(tpl) { const rows = tpl.rows; const h = rows.length, w = Math.max(...rows.map((r) => r.length)); return { role: tpl.role, puzzle: tpl.puzzle, w, h, rows: rows.map((r) => r.padEnd(w, ' ')) }; }

  D.generate = (opts) => {
    const theme = opts.theme || 'cave', level = opts.level || 1, nRooms = opts.rooms || 6, seed = opts.seed || Math.floor(Math.random() * 1e9);
    const rng = RNG(seed); const tier = D.tierFor(level); const partySize = opts.partySize || 1;
    const size = 40 + nRooms * 3; const m = World.newMap(size, size, 'dungeon', theme); m.seed = seed; m.level = level; m.tier = tier; m.theme = theme;
    m.name = opts.name || rng.pick(NAMES.dungeonNames[theme] || NAMES.dungeonNames.cave); m.rooms = []; m.runes = {}; m.trapsRevealed = {}; m.hazards = []; m.monsters = []; m.quest = opts.quest || null;
    const byRole = (r) => ROOMS.filter((t) => t.role === r).map(parseTemplate);
    // Room plan
    const plan = ['entrance']; const combatN = Math.max(1, Math.round((nRooms - 3) * 0.5)); for (let i = 0; i < combatN; i++) plan.push('combat');
    plan.push('treasure'); if (nRooms >= 6) plan.push('puzzle'); plan.push('story'); if (nRooms >= 7) plan.push('rest'); if (nRooms >= 8) plan.push('treasure'); while (plan.length < nRooms) plan.push(rng.chance(0.5) ? 'hall' : 'combat'); plan.push('boss');
    const placed = [];
    const fits = (tpl, ox, oy) => { if (ox < 1 || oy < 1 || ox + tpl.w >= size - 1 || oy + tpl.h >= size - 1) return false; for (const r of placed) if (!(ox + tpl.w + 1 < r.x || r.x + r.w + 1 < ox || oy + tpl.h + 1 < r.y || r.y + r.h + 1 < oy)) return false; return true; };
    const stamp = (tpl, ox, oy, role) => {
      const room = { x: ox, y: oy, w: tpl.w, h: tpl.h, role, puzzle: tpl.puzzle, cx: ox + Math.floor(tpl.w / 2), cy: oy + Math.floor(tpl.h / 2), markers: {}, doors: [], secrets: [], id: placed.length, cells: [] };
      for (let y = 0; y < tpl.h; y++) for (let x = 0; x < tpl.w; x++) {
        const c = tpl.rows[y][x], gx = ox + x, gy = oy + y; if (c === ' ') continue;
        if (c === '#') { World.set(m, gx, gy, T.WALL); continue; }
        if (c === '+') { World.set(m, gx, gy, T.WALL); room.doors.push([gx, gy]); continue; }
        if (c === 's') { World.set(m, gx, gy, T.WALL); room.secrets.push([gx, gy]); continue; }
        World.set(m, gx, gy, T.FLOOR); room.cells.push([gx, gy]);
        if (c !== '.') { (room.markers[c] = room.markers[c] || []).push([gx, gy]); }
      }
      placed.push(room); return room;
    };
    // place rooms: entrance first near an edge, then grow outward; boss placed farthest
    const first = rng.pick(byRole('entrance')); stamp(first, 3 + rng.int(0, 4), size - first.h - 4 - rng.int(0, 4), 'entrance');
    for (let i = 1; i < plan.length; i++) {
      const role = plan[i]; const pool = byRole(role); let best = null;
      for (let attempt = 0; attempt < 400 && !best; attempt++) {
        const tpl = rng.pick(pool); const anchor = rng.pick(placed); const dir = rng.int(0, 3); const gap = rng.int(3, 7);
        let ox, oy; if (dir === 0) { ox = anchor.x + rng.int(-tpl.w + 3, anchor.w - 3); oy = anchor.y - tpl.h - gap; } else if (dir === 1) { ox = anchor.x + anchor.w + gap; oy = anchor.y + rng.int(-tpl.h + 3, anchor.h - 3); } else if (dir === 2) { ox = anchor.x + rng.int(-tpl.w + 3, anchor.w - 3); oy = anchor.y + anchor.h + gap; } else { ox = anchor.x - tpl.w - gap; oy = anchor.y + rng.int(-tpl.h + 3, anchor.h - 3); }
        if (!fits(tpl, ox, oy)) continue;
        if (role === 'boss') { const d = U.dist(ox, oy, placed[0].x, placed[0].y); if (d < size * 0.45 && attempt < 300) continue; }
        best = { tpl, ox, oy };
      }
      if (!best) { // fallback: scan
        const tpl = rng.pick(pool); for (let y = 2; y < size - tpl.h - 2 && !best; y += 2) for (let x = 2; x < size - tpl.w - 2 && !best; x += 2) if (fits(tpl, x, y)) best = { tpl, ox: x, oy: y };
      }
      if (best) stamp(best.tpl, best.ox, best.oy, role);
    }
    m.rooms = placed;
    // ---- Connect rooms (MST + extras) ----
    const edges = []; for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) edges.push([U.manhattan(placed[i].cx, placed[i].cy, placed[j].cx, placed[j].cy), i, j]);
    edges.sort((a, b) => a[0] - b[0]); const parent = placed.map((_, i) => i); const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const chosen = []; for (const e of edges) { if (find(e[1]) !== find(e[2])) { parent[find(e[1])] = find(e[2]); chosen.push(e); } }
    for (const e of edges) if (chosen.length < placed.length + 1 && !chosen.includes(e) && e[0] < size / 2 && rng.chance(0.25)) chosen.push(e);
    const isRoomCell = (x, y) => { const t = World.get(m, x, y); return t === T.FLOOR || t === T.WALL; };
    const corridorCells = new Set();
    const carve = (a, b) => {
      const da = a.doors.slice().sort((p, q) => U.manhattan(p[0], p[1], b.cx, b.cy) - U.manhattan(q[0], q[1], b.cx, b.cy))[0], db = b.doors.slice().sort((p, q) => U.manhattan(p[0], p[1], a.cx, a.cy) - U.manhattan(q[0], q[1], a.cx, a.cy))[0];
      if (!da || !db) return false;
      const outside = (room, d) => { const [x, y] = d; if (x === room.x) return [x - 1, y]; if (x === room.x + room.w - 1) return [x + 1, y]; if (y === room.y) return [x, y - 1]; return [x, y + 1]; };
      const s = outside(a, da), e = outside(b, db);
      const pass = (x, y) => x > 0 && y > 0 && x < size - 1 && y < size - 1 && (!isRoomCell(x, y) || corridorCells.has(U.key(x, y)));
      let path = corridorPath(s[0], s[1], e[0], e[1], pass, size * 4);
      if (!path) path = U.astar(s[0], s[1], e[0], e[1], (x, y) => pass(x, y) || (x === e[0] && y === e[1]), size * 3);
      if (!path) return false;
      path.unshift(s);
      for (const [x, y] of path) { if (World.get(m, x, y) !== T.FLOOR) World.set(m, x, y, T.FLOOR); corridorCells.add(U.key(x, y)); }
      // corridor cells must be 4-connected: A* uses diagonals, so fill diagonal steps
      for (let i = 1; i < path.length; i++) { const [x0, y0] = path[i - 1], [x1, y1] = path[i]; if (x0 !== x1 && y0 !== y1) { const fx = x1, fy = y0; if (World.get(m, fx, fy) === T.VOID || corridorCells.has(U.key(fx, fy))) { World.set(m, fx, fy, T.FLOOR); corridorCells.add(U.key(fx, fy)); } else { World.set(m, x0, y1, T.FLOOR); corridorCells.add(U.key(x0, y1)); } } }
      a.usedDoors = a.usedDoors || []; b.usedDoors = b.usedDoors || []; a.usedDoors.push(da); b.usedDoors.push(db);
      return true;
    };
    for (const [, i, j] of chosen) carve(placed[i], placed[j]);
    // ensure connectivity: any room without a used door gets connected to nearest
    for (const r of placed) if (!r.usedDoors || !r.usedDoors.length) { const near = placed.filter((o) => o !== r).sort((p, q) => U.manhattan(p.cx, p.cy, r.cx, r.cy) - U.manhattan(q.cx, q.cy, r.cx, r.cy)); for (const o of near) if (carve(r, o)) break; }
    // walls around corridors
    for (const k of corridorCells) { const [x, y] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (World.get(m, x + dx, y + dy) === T.VOID) World.set(m, x + dx, y + dy, T.WALL); }
    // doors
    const lockedDoorsDC = 12 + level; let keyNeeded = false;
    for (const r of placed) for (const d of (r.usedDoors || [])) {
      World.set(m, d[0], d[1], T.DOORWAY);
      const isBoss = r.role === 'boss'; const locked = isBoss ? false : rng.chance(0.12);
      World.addProp(m, { kind: 'door', x: d[0], y: d[1], open: false, locked, dc: lockedDoorsDC, room: r.id, bossDoor: isBoss, color: theme === 'temple' ? '#4a3a6a' : undefined });
    }
    // ---- Secret rooms ----
    const secretPool = byRole('secret'); const hostRooms = placed.filter((r) => r.secrets.length && (r.role === 'treasure' || r.role === 'story'));
    m.secretRooms = 0;
    for (const host of hostRooms) { if (m.secretRooms >= 1 && rng.chance(0.6)) continue; const s = rng.pick(host.secrets); const tpl = rng.pick(secretPool); let dirs = []; if (s[1] === host.y) dirs = [[s[0] - Math.floor(tpl.w / 2), s[1] - tpl.h]]; else if (s[1] === host.y + host.h - 1) dirs = [[s[0] - Math.floor(tpl.w / 2), s[1] + 1]]; else if (s[0] === host.x) dirs = [[s[0] - tpl.w, s[1] - Math.floor(tpl.h / 2)]]; else dirs = [[s[0] + 1, s[1] - Math.floor(tpl.h / 2)]];
      for (const [ox, oy] of dirs) { if (!fits(tpl, ox, oy)) continue; const room = stamp(tpl, ox, oy, 'secret'); room.secret = true; // connect: carve straight from secret cell to nearest room floor of the secret room
        const target = room.cells.slice().sort((a, b) => U.manhattan(a[0], a[1], s[0], s[1]) - U.manhattan(b[0], b[1], s[0], s[1]))[0]; for (const [x, y] of U.line(s[0], s[1], target[0], target[1])) if (World.get(m, x, y) !== T.FLOOR && !(x === s[0] && y === s[1])) World.set(m, x, y, T.FLOOR);
        World.set(m, s[0], s[1], T.WALL); World.addProp(m, { kind: 'secretDoor', x: s[0], y: s[1], open: false, revealed: false, dc: 12 + level }); m.secretRooms++; break; }
    }
    // ---- Populate ----
    const enc = ENCOUNTERS[theme] || ENCOUNTERS.cave; const list = enc[tier] || enc[1];
    const budgetPerRoom = XP_BUDGET[Math.min(10, level)] * partySize;
    const freeCells = (room) => room.cells.filter(([x, y]) => World.passable(m, x, y) && !m.monsters.some((mm) => mm.x === x && mm.y === y) && !World.propAt(m, x, y));
    const groupCounter = { n: 0 };
    const spawnGroup = (room, spots, budgetMult, forcedList) => {
      const gid = 'g' + (++groupCounter.n); let budget = budgetPerRoom * budgetMult, count = 0; const pool = forcedList || list; const cells = spots.slice();
      const extra = freeCells(room); while (cells.length < 6 && extra.length) cells.push(extra.splice(rng.int(0, extra.length - 1), 1)[0]);
      while (budget > 0 && cells.length) { const id = rng.pick(pool); const def = MONSTERS[id]; const mult = count >= 5 ? 2.5 : count >= 2 ? 2 : count >= 1 ? 1.5 : 1; if (def.xp * mult > budget * 1.6 && count > 0) break; const [x, y] = cells.shift(); const mon = Rules.spawnMonster(id, { x, y, groupId: gid }); mon.room = room.id; m.monsters.push(mon); budget -= def.xp * mult; count++; if (count >= 6) break; }
      return count;
    };
    const lootTier = level;
    const chestFor = (room, x, y, opts) => World.addProp(m, Object.assign({ kind: 'chest', x, y, solid: true, open: false, locked: rng.chance(0.3), dc: 10 + level, loot: D.rollLoot(lootTier, rng, opts && opts.rich), mimic: !(opts && opts.noMimic) && level >= 2 && rng.chance(0.06), room: room.id }, opts || {}));
    const trapKinds = [{ id: 'dart', name: 'Dart Trap', dmg: '2d4', dtype: 'piercing', save: 'dex', dc: 12 }, { id: 'pit', name: 'Pit Trap', dmg: '2d6', dtype: 'bludgeoning', save: 'dex', dc: 13, prone: true }, { id: 'gas', name: 'Poison Gas', dmg: '2d6', dtype: 'poison', save: 'con', dc: 12, status: 'poisoned' }, { id: 'fire', name: 'Fire Jet', dmg: '3d6', dtype: 'fire', save: 'dex', dc: 13 }, { id: 'alarm', name: 'Alarm Trap', dmg: '0', dtype: 'none', save: 'dex', dc: 20, alarm: true }];
    const usedEvents = new Set(); const questEvent = opts.quest && opts.quest.objective === 'rescue' ? 'prisoner' : null;
    let storyRooms = 0;
    for (const room of placed) {
      const mk = room.markers;
      if (room.role === 'entrance') { const at = (mk['@'] || [[room.cx, room.cy]])[0]; m.spawn = { x: at[0], y: at[1] }; World.addProp(m, { kind: 'stairs', x: at[0], y: at[1] - 1 >= room.y + 1 ? at[0] : at[0], y: at[1], solid: false, exit: true, entrance: true, label: 'Way out', invisibleWhenStanding: true }); }
      if (room.role === 'combat' || room.role === 'hall') { const spots = mk.M || []; if (spots.length || room.role === 'combat') spawnGroup(room, spots, room.role === 'hall' ? 0.35 : (level <= 2 ? 0.5 + rng() * 0.4 : 0.7 + rng() * 0.6)); }
      if (room.role === 'treasure') { if (mk.M && rng.chance(0.6)) spawnGroup(room, mk.M, 0.45); }
      if (room.role === 'boss') {
        const bId = (opts.quest && opts.quest.bossId) || enc.boss[tier] || enc.boss[1]; const spot = (mk.B || [[room.cx, room.cy]])[0];
        const modifier = rng.chance(0.5) ? rng.pick(NAMES.bossModifiers).id : null;
        const boss = Rules.spawnMonster(bId, { x: spot[0], y: spot[1], boss: true, modifier, groupId: 'boss' }); boss.room = room.id; boss.isBoss = true; m.monsters.push(boss); m.boss = boss;
        for (const [x, y] of (mk.m || []).slice(0, Math.max(1, partySize))) { if (rng.chance(0.85)) { const mon = Rules.spawnMonster(rng.pick(list), { x, y, groupId: 'boss' }); mon.room = room.id; m.monsters.push(mon); } }
        if (m.quest && m.quest.bossMinions) for (const [x, y] of (mk.m || []).slice(0, 2)) { const mon = Rules.spawnMonster(m.quest.bossMinions, { x, y, groupId: 'boss' }); mon.room = room.id; m.monsters.push(mon); }
        const ex = (mk.X || [[room.cx, room.cy + 1]])[0]; World.addProp(m, { kind: 'stairs', x: ex[0], y: ex[1], solid: false, exit: true, label: 'Descend & leave' }); m.exit = { x: ex[0], y: ex[1] };
        if (mk.A) for (const [x, y] of mk.A) World.addProp(m, { kind: 'altar', x, y, solid: true, opt: { spiral: theme === 'temple' }, searchable: true, flavor: 'A dark altar. Something was sacrificed here recently. Best not to ask what.' });
        m.bossRoom = room;
      }
      if (room.role === 'rest') { for (const [x, y] of (mk.R || [])) World.addProp(m, { kind: 'campfire', x, y, lit: true, rest: true, usesLeft: 1, label: 'Campfire' }); }
      if (room.role === 'story' || room.role === 'secret') {
        for (const [x, y] of (mk['!'] || [])) { let ev; if (questEvent && !usedEvents.has(questEvent) && room.role === 'story') ev = STORY.events.find((e) => e.id === questEvent); else { const pool = STORY.events.filter((e) => !usedEvents.has(e.id) && e.id !== 'prisoner'); ev = rng.pick(pool); } if (!ev) continue; usedEvents.add(ev.id); World.addProp(m, { kind: ev.id === 'prisoner' ? 'cage' : ev.id === 'cursedIdol' ? 'pedestal' : ev.id === 'shrine' || ev.id === 'fountain' ? 'altar' : ev.id === 'gambler' ? 'table' : ev.id === 'library' ? 'bookshelf' : ev.id === 'ghostMerchant' ? 'cart' : 'bones', x, y, solid: true, event: ev.id, label: 'Something here', opt: ev.id === 'gambler' ? { items: true } : {}, prisonerSprite: ev.id === 'prisoner' ? { skin: '#d9a37a', cloth: '#5a5a5a', hair: '#3a2a1a' } : undefined, taken: ev.id === 'cursedIdol' ? false : undefined }); storyRooms++; }
        for (const [x, y] of (mk.G || [])) { if (!World.propAt(m, x, y)) World.addProp(m, { kind: 'cage', x, y, solid: true, open: rng.chance(0.5), flavor: 'An empty cage. The lock is broken from the inside.' }); }
      }
      if (room.role === 'puzzle') D.buildPuzzle(m, room, rng, level, () => { keyNeeded = true; });
      // generic markers in any room
      for (const [x, y] of (mk.C || [])) if (!World.propAt(m, x, y)) chestFor(room, x, y, room.role === 'treasure' || room.role === 'secret' ? { rich: true } : null);
      for (const [x, y] of (mk.c || [])) { const th = THEMES[theme]; World.addProp(m, { kind: th.container, x, y, solid: true, searchable: true, container: true, loot: rng.chance(0.45) ? D.rollLoot(Math.max(1, lootTier - 1), rng, false, true) : null }); }
      for (const [x, y] of (mk.T || [])) { if (room.puzzle === 'pressure') continue; if (rng.chance(0.55)) { World.set(m, x, y, T.TRAP); const tk = rng.pick(trapKinds); World.addProp(m, { kind: 'trap', x, y, invisible: true, trap: Object.assign({}, tk, { dc: tk.dc + Math.floor(level / 2), spotDC: 10 + level, disarmDC: 12 + level, armed: true, spotted: false }) }); } }
      for (const [x, y] of (mk.P || [])) World.addProp(m, { kind: rng.chance(0.2) ? 'pillarBroken' : 'pillar', x, y, solid: true });
      for (const [x, y] of (mk.S || [])) if (!World.propAt(m, x, y)) World.addProp(m, { kind: 'statue', x, y, solid: true, searchable: true, opt: { weapon: rng.pick(['sword', 'staff', 'spear']) }, flavor: rng.pick(['A statue of a forgotten hero. Someone has drawn a moustache on it.', 'A weathered statue. Its plaque reads: "Turn back." Helpful.', 'A statue of a robed figure holding a spiral. Its eyes are inlaid with something that used to be gems.']), hiddenGold: rng.chance(0.3) ? rng.int(5, 15) * level : 0 });
      for (const [x, y] of (mk.A || [])) if (!World.propAt(m, x, y)) World.addProp(m, { kind: 'altar', x, y, solid: true, searchable: true, altar: true, opt: { spiral: theme === 'temple' || theme === 'crypt' } });
      for (const [x, y] of (mk.b || [])) if (!World.propAt(m, x, y)) World.addProp(m, { kind: 'bookshelf', x, y, solid: true, searchable: true, shelf: true });
      for (const [x, y] of (mk.t || [])) if (!World.propAt(m, x, y)) World.addProp(m, { kind: 'table', x, y, solid: true, searchable: true, opt: { items: rng.chance(0.5) }, tableLoot: rng.chance(0.4) ? rng.int(2, 6) * level : 0 });
      for (const [x, y] of (mk.f || [])) World.addProp(m, { kind: 'brazier', x, y, solid: true, animated: true });
      for (const [x, y] of (mk.w || [])) World.set(m, x, y, T.SHALLOW);
      for (const [x, y] of (mk['~'] || [])) World.set(m, x, y, T.RUBBLE);
      for (const [x, y] of (mk.g || [])) World.addProp(m, { kind: theme === 'crypt' || theme === 'temple' ? 'coffin' : 'grave', x, y, solid: true, searchable: true, grave: true, disturbed: false });
      for (const [x, y] of (mk.k || [])) { World.addProp(m, { kind: 'pedestal', x, y, solid: true, keyPedestal: true, taken: false, label: 'Key' }); keyNeeded = true; }
    }
    // Lock the boss door if a key exists
    if (keyNeeded) { const bd = m.props.find((p) => p.kind === 'door' && p.bossDoor); if (bd) { bd.locked = true; bd.needsKey = true; bd.dc = 99; } }
    // Objective item in boss room (quest item found on boss death) handled by quests. Flavor decorations
    const floorCells = []; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m.t[y * size + x] === T.FLOOR && !World.propAt(m, x, y) && !m.monsters.some((mm) => mm.x === x && mm.y === y)) floorCells.push([x, y]);
    const deco = { forest: ['web', 'mushroom', 'bones'], cave: ['mushroom', 'rock', 'bones'], crypt: ['bones', 'web'], fort: ['bones', 'crate'], temple: ['bones'], mine: ['rock', 'cart'], swamp: ['mushroom', 'bones'], cellar: ['barrel', 'crate'] }[theme] || ['bones'];
    const roomCellSet = new Set(); for (const r of placed) for (const [x, y] of r.cells) roomCellSet.add(U.key(x, y));
    const openSpot = (x, y) => { // room interior, not next to a doorway, plenty of passable neighbours (never block a route)
      if (!roomCellSet.has(U.key(x, y))) return false; let free = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const t = World.get(m, x + dx, y + dy); if (t === T.DOORWAY) return false; if (World.passable(m, x + dx, y + dy)) free++; } return free >= 6; };
    for (let i = 0; i < Math.floor(floorCells.length * 0.04); i++) { const [x, y] = rng.pick(floorCells); if (World.propAt(m, x, y) || (x === m.spawn.x && y === m.spawn.y)) continue; const k = rng.pick(deco); const solid = k === 'rock' || k === 'barrel' || k === 'crate' || k === 'cart'; if (solid && !openSpot(x, y)) continue; World.addProp(m, { kind: k, x, y, solid, searchable: k === 'barrel' || k === 'crate' || k === 'cart', container: k === 'barrel' || k === 'crate' || k === 'cart', loot: rng.chance(0.3) ? D.rollLoot(1, rng, false, true) : null, opt: {} }); }
    // Decals: blood, skulls, cracks, puddles, moss; cobwebs in wall corners
    const decalKinds = { crypt: ['blood', 'skull', 'crack', 'cobweb', 'skull'], cave: ['puddle', 'crack', 'moss', 'skull', 'cobweb'], cellar: ['puddle', 'crack', 'cobweb', 'blood'], fort: ['blood', 'crack', 'skull', 'blood'], temple: ['blood', 'crack', 'puddle', 'skull'], mine: ['crack', 'puddle', 'skull', 'cobweb'], swamp: ['puddle', 'moss', 'skull', 'puddle'], forest: ['cobweb', 'moss', 'skull', 'cobweb'] }[theme] || ['crack', 'skull'];
    for (let i = 0; i < Math.floor(floorCells.length * 0.09); i++) { const [x, y] = rng.pick(floorCells); const k = rng.pick(decalKinds); if (k === 'cobweb' && !(World.get(m, x, y - 1) === T.WALL && World.get(m, x - 1, y) === T.WALL)) continue; World.addProp(m, { kind: k, x, y, decal: true }); }
    for (const room of placed) if (room.role === 'boss' || (room.role === 'combat' && rng.chance(0.6))) { for (let i = 0; i < 2; i++) { const [x, y] = rng.pick(room.cells); World.addProp(m, { kind: 'blood', x, y, decal: true }); } }
    // Wall torches in rooms (light sources) — place on a wall cell adjacent to room floor
    for (const room of placed) { if (room.role === 'secret') continue; const n = room.role === 'boss' ? 3 : rng.chance(0.7) ? 1 : 0; for (let i = 0; i < n; i++) { const [x, y] = rng.pick(room.cells); const wallN = [[x, y - 1], [x - 1, y]].find(([wx, wy]) => World.get(m, wx, wy) === T.WALL); if (wallN) World.addProp(m, { kind: 'torch', x: wallN[0], y: wallN[1], animated: true, depthBias: 0.3 }); } }
    // Safety net: never let a solid prop sit on the tile in front of or behind a doorway
    for (const p of m.props.slice()) { if (p.removed || !World.solidProp(p) || p.kind === 'door' || p.kind === 'secretDoor' || p.kind === 'chest') continue; let nearDoor = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (World.get(m, p.x + dx, p.y + dy) === T.DOORWAY) nearDoor = true; if (nearDoor) World.removeProp(m, p); }
    World.reindex(m);
    m.flavor = STORY.dungeonFlavor[theme] || [];
    m.shortRestsLeft = 1; m.timeStart = Date.now();
    return m;
  };

  D.buildPuzzle = (m, room, rng, level, onKey) => {
    const mk = room.markers; const chest = (mk.C || [])[0]; const statue = (mk.S || [])[0];
    const sealChest = () => { if (chest) { const c = World.addProp(m, { kind: 'chest', x: chest[0], y: chest[1], solid: true, open: false, locked: true, sealed: true, dc: 99, loot: D.rollLoot(level + 1, rng, true), room: room.id, label: 'Sealed chest' }); return c; } return null; };
    switch (room.puzzle) {
      case 'levers': { const levers = mk.L || []; const order = rng.shuffle(levers.map((_, i) => i)); const signs = ['sun', 'moon', 'stars', 'dark']; const puzzle = { kind: 'levers', order, pulled: [], solved: false, signs }; room.puzzleState = puzzle; levers.forEach(([x, y], i) => World.addProp(m, { kind: 'lever', x, y, solid: true, on: false, lever: i, puzzle, label: 'Lever of the ' + signs[order.indexOf(i)] })); const c = sealChest(); puzzle.chest = c; if (statue) World.addProp(m, { kind: 'statue', x: statue[0], y: statue[1], solid: true, searchable: true, flavor: 'The statue\'s plaque reads: "' + STORY.leverHints[0] + '"', opt: { weapon: 'staff' } }); break; }
      case 'runes': { const runes = mk.r || []; const elems = ['Frost', 'Flame', 'Storm', 'Stone']; const order = rng.shuffle(runes.map((_, i) => i)).slice(0, 4); const puzzle = { kind: 'runes', order, stepped: [], solved: false }; room.puzzleState = puzzle; runes.forEach(([x, y], i) => { World.set(m, x, y, T.RUNE); m.runes[U.key(x, y)] = { idx: i, lit: false, puzzle, name: order.includes(i) ? elems[order.indexOf(i)] : rng.pick(['Dust', 'Ash', 'Salt', 'Bone']) }; }); const c = sealChest(); puzzle.chest = c; if (statue) World.addProp(m, { kind: 'statue', x: statue[0], y: statue[1], solid: true, searchable: true, flavor: 'The statue whispers: "Walk the runes as the seasons turn: ' + order.map((i) => elems[order.indexOf(i)]).join(', ') + '. Tread wrongly and be shocked."', opt: { weapon: 'staff' } }); break; }
      case 'riddle': { const riddle = rng.pick(STORY.riddles); const door = (mk.D || [])[0]; const puzzle = { kind: 'riddle', riddle, solved: false }; room.puzzleState = puzzle; if (door) { World.set(m, door[0], door[1], T.DOORWAY); World.addProp(m, { kind: 'door', x: door[0], y: door[1], open: false, locked: true, riddle: puzzle, dc: 18 + level, color: '#5a5a70', label: 'Riddle door' }); } const c = sealChest(); if (c) { c.sealed = false; c.locked = rng.chance(0.5); c.dc = 10 + level; } if (statue) World.addProp(m, { kind: 'statue', x: statue[0], y: statue[1], solid: true, searchable: true, riddleStatue: puzzle, opt: { weapon: 'none' }, label: 'Speaking statue' }); break; }
      case 'altar': { const a = (mk.A || [])[0]; if (a) World.addProp(m, { kind: 'altar', x: a[0], y: a[1], solid: true, puzzleAltar: true, used: false, cost: 10 * level, opt: { spiral: false }, label: 'Ancient altar' }); const c = sealChest(); if (c) { c.sealed = false; c.locked = false; c.dc = 0; } break; }
      case 'pressure': { const plates = mk.T || []; plates.forEach(([x, y]) => { World.set(m, x, y, T.TRAP); m.trapsRevealed[U.key(x, y)] = true; World.addProp(m, { kind: 'trap', x, y, invisible: true, trap: { id: 'dart', name: 'Pressure Plate', dmg: '2d4', dtype: 'piercing', save: 'dex', dc: 12 + Math.floor(level / 2), spotDC: 0, disarmDC: 12 + level, armed: true, spotted: true } }); }); const k = (mk.k || [])[0]; if (k) { World.addProp(m, { kind: 'pedestal', x: k[0], y: k[1], solid: true, keyPedestal: true, taken: false, label: 'Key pedestal' }); onKey(); } const c = sealChest(); if (c) { c.sealed = false; c.locked = false; } break; }
      default: break;
    }
  };

  // Loot tables. Returns array of {item:id|obj, qty} plus gold
  D.rollLoot = (tier, rng, rich, minor) => {
    const out = { gold: 0, items: [] }; const L = Math.max(1, tier);
    if (minor) { out.gold = rng.chance(0.7) ? rng.int(1, 6) * L : 0; if (rng.chance(0.35)) out.items.push({ item: rng.pick(['potionHealing', 'torch', 'rations', 'goodberry', 'antitoxin']), qty: 1 }); return out; }
    out.gold = rng.int(5, 15) * L * (rich ? 2 : 1);
    const rolls = rich ? 2 + rng.int(0, 1) : 1 + (rng.chance(0.4) ? 1 : 0);
    for (let i = 0; i < rolls; i++) {
      const r = rng();
      if (r < 0.3) out.items.push({ item: L >= 5 ? 'potionSuperiorHealing' : L >= 3 ? 'potionGreaterHealing' : 'potionHealing', qty: rng.int(1, 2) });
      else if (r < 0.45) { const scrolls = Object.values(ITEMS).filter((it) => it.type === 'scroll' && it.tier <= Math.ceil(L / 2)); out.items.push({ item: rng.pick(scrolls).id, qty: 1 }); }
      else if (r < 0.65) { const weapons = Object.values(ITEMS).filter((it) => it.type === 'weapon' && !it.magic && it.cost >= (L >= 3 ? 10 : 1)); const base = rng.pick(weapons); if (L >= 3 && rng.chance(0.35 + L * 0.05)) { const bonus = L >= 7 && rng.chance(0.3) ? 2 : 1; const flavors = [{ name: 'Flame Tongue', extraDmg: '1d6', extraType: 'fire' }, { name: 'Frost Brand', extraDmg: '1d6', extraType: 'cold' }, { name: 'Storm', extraDmg: '1d4', extraType: 'lightning' }, { name: 'Venomous', extraDmg: '1d4', extraType: 'poison' }, { name: 'Holy', extraDmg: '1d6', extraType: 'radiant' }]; const mg = rng.chance(0.3) ? Object.assign({ bonus }, rng.pick(flavors)) : { bonus }; out.items.push({ item: makeMagicWeapon(base.id, mg), qty: 1 }); } else out.items.push({ item: base.id, qty: 1 }); }
      else if (r < 0.8) { const armors = Object.values(ITEMS).filter((it) => (it.type === 'armor' || it.type === 'shield') && (it.tier || 1) <= Math.ceil(L / 2) + 1); const base = rng.pick(armors); if (L >= 4 && rng.chance(0.3) && base.type === 'armor') out.items.push({ item: makeMagicArmor(base.id, 1), qty: 1 }); else out.items.push({ item: base.id, qty: 1 }); }
      else if (r < 0.93) { const acc = Object.values(ITEMS).filter((it) => it.type === 'accessory' && it.tier <= Math.ceil(L / 2) + 1 && !it.legendary); if (acc.length) out.items.push({ item: rng.pick(acc).id, qty: 1 }); }
      else { const leg = Object.values(ITEMS).filter((it) => it.type === 'accessory' && it.legendary && it.tier <= Math.ceil(L / 2) + 2); if (leg.length && L >= 3) out.items.push({ item: rng.pick(leg).id, qty: 1 }); else out.items.push({ item: 'potionHeroism', qty: 1 }); }
    }
    return out;
  };
  window.Dungeon = D;
})();
