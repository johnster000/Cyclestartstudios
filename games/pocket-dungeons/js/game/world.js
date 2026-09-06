/* World: builds the overworld and interiors from WORLDMAP, and provides passability, line of sight,
   visibility/lighting for dungeons, and prop lookups. Map shape is shared with dungeon.js. */
(function () {
  const W = {};
  const T = TILE;
  W.newMap = (w, h, kind, theme) => { const m = { w, h, kind, theme, t: new Uint8Array(w * h), seen: new Uint8Array(w * h), vis: new Uint8Array(w * h), light: new Float32Array(w * h), props: [], propIndex: new Map(), buildings: [], npcs: [], name: '' }; if (kind !== 'dungeon') { m.seen.fill(1); m.vis.fill(1); m.light.fill(1); } return m; };
  W.get = (m, x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? T.VOID : m.t[y * m.w + x];
  W.set = (m, x, y, t) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.t[y * m.w + x] = t; };
  W.addProp = (m, p) => { p.id = p.id || U.uid('p'); m.props.push(p); const k = U.key(p.x, p.y); if (!m.propIndex.has(k)) m.propIndex.set(k, []); m.propIndex.get(k).push(p); return p; };
  W.removeProp = (m, p) => { p.removed = true; const list = m.propIndex.get(U.key(p.x, p.y)); if (list) { const i = list.indexOf(p); if (i >= 0) list.splice(i, 1); } };
  W.propsAt = (m, x, y) => (m.propIndex.get(U.key(x, y)) || []).filter((p) => !p.removed);
  W.propAt = (m, x, y) => W.propsAt(m, x, y)[0] || null;
  W.reindex = (m) => { m.propIndex = new Map(); for (const p of m.props) { if (p.removed) continue; const k = U.key(p.x, p.y); if (!m.propIndex.has(k)) m.propIndex.set(k, []); m.propIndex.get(k).push(p); } };
  const SOLID_TILES = new Set([T.VOID, T.WALL, T.WATER, T.MOUNTAIN, T.BUILDING, T.PIT, T.BAR]);
  W.solidProp = (p) => { if (p.removed) return false; if (p.kind === 'door' || p.kind === 'secretDoor') return !p.open; if (p.kind === 'cage') return true; return !!p.solid; };
  W.passable = (m, x, y) => { const t = W.get(m, x, y); if (SOLID_TILES.has(t)) return false; for (const p of W.propsAt(m, x, y)) if (W.solidProp(p)) return false; return true; };
  W.difficult = (m, x, y) => { const t = W.get(m, x, y); return t === T.RUBBLE || t === T.SHALLOW || t === T.SWAMP || t === T.TALLGRASS; };
  W.blocksSight = (m, x, y) => { const t = W.get(m, x, y); if (t === T.VOID || t === T.WALL || t === T.MOUNTAIN || t === T.BUILDING) return true; for (const p of W.propsAt(m, x, y)) { if ((p.kind === 'door' || p.kind === 'secretDoor') && !p.open) return true; if (p.kind === 'pillar' || p.kind === 'bookshelf' || p.kind === 'tree' || p.kind === 'pine') return true; } return false; };
  W.los = (m, x0, y0, x1, y1) => { const pts = U.line(x0, y0, x1, y1); for (let i = 1; i < pts.length - 1; i++) if (W.blocksSight(m, pts[i][0], pts[i][1])) return false; return true; };
  W.findFloorNear = (m, x, y, isFree) => { for (let r = 0; r < 8; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x + dx, ny = y + dy; if (W.passable(m, nx, ny) && (!isFree || isFree(nx, ny))) return [nx, ny]; } return [x, y]; };

  // ---- Visibility & lighting (dungeons) ----
  W.computeVisibility = (m, viewers, extraLights) => {
    if (m.kind !== 'dungeon') return;
    m.vis.fill(0); m.light.fill(0);
    const seesCell = (l, x, y, R) => { // LOS from light/viewer to cell; walls adjacent to a visible floor count as visible so they render
      if (W.los(m, l.x, l.y, x, y) || (Math.abs(x - l.x) <= 1 && Math.abs(y - l.y) <= 1)) return true;
      if (!W.blocksSight(m, x, y)) return false;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1], [x - 1, y - 1], [x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1]]) if (!W.blocksSight(m, nx, ny) && Math.hypot(nx - l.x, ny - l.y) <= R && W.los(m, l.x, l.y, nx, ny)) return true;
      return false;
    };
    const vs = viewers.filter((v) => !v.dead).map((v) => ({ x: v.x, y: v.y, r: Math.max(v.lightRadius || 0, 3), dv: (!v.mon && RACES[v.race].darkvision) ? 12 : 0 }));
    // 1) what the party can see by its own light / darkvision
    for (const l of vs) { const R = Math.max(l.r, l.dv); for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) { const x = l.x + dx, y = l.y + dy; if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue; const d = Math.hypot(dx, dy); if (d > R + 0.5) continue; const i = y * m.w + x; if (m.t[i] === T.VOID) continue; if (!seesCell(l, x, y, R)) continue; let lv = d <= l.r ? U.clamp(1 - (d / (l.r + 1)) * 0.9, 0.12, 1) : 0; if (l.dv && d <= l.dv) lv = Math.max(lv, 0.3); m.vis[i] = 1; m.seen[i] = 1; if (lv > m.light[i]) m.light[i] = lv; } }
    // 2) static lights: they light cells, and reveal lit cells that some viewer has line of sight to (a lit room seen through a doorway)
    for (const l of (extraLights || [])) { const R = l.r; for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) { const x = l.x + dx, y = l.y + dy; if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue; const d = Math.hypot(dx, dy); if (d > R + 0.5) continue; const i = y * m.w + x; if (m.t[i] === T.VOID) continue; if (!seesCell(l, x, y, R)) continue; const lv = U.clamp(1 - (d / (R + 1)) * 0.9, 0.12, 1); if (!m.vis[i]) { const seenByViewer = vs.some((v) => Math.hypot(v.x - x, v.y - y) <= 14 && seesCell(v, x, y, 14)); if (!seenByViewer) continue; m.vis[i] = 1; m.seen[i] = 1; } if (lv > m.light[i]) m.light[i] = lv; } }
    // 3) a room you are standing in is lit as a whole: walk through the door and the chamber opens up (Diablo-style),
    //    dimmer than your torchlight but never a black box you have to feel your way around
    for (const v of vs) { const room = (m.rooms || []).find((r) => v.x >= r.x && v.x < r.x + r.w && v.y >= r.y && v.y < r.y + r.h); if (!room) continue;
      for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) { const i = y * m.w + x; if (m.t[i] === T.VOID) continue; m.vis[i] = 1; m.seen[i] = 1; if (m.light[i] < ROOM_GLOW) m.light[i] = ROOM_GLOW; } }
    for (let i = 0; i < m.t.length; i++) if (m.vis[i] && m.light[i] < 0.22) m.light[i] = 0.22;
  };
  const ROOM_GLOW = 0.42;
  W.staticLights = (m) => m.props.filter((p) => !p.removed && (p.kind === 'brazier' || p.kind === 'torch' || (p.kind === 'campfire' && p.lit !== false) || p.kind === 'fireplace' || p.kind === 'lamp')).map((p) => ({ x: p.x, y: p.y, r: p.kind === 'torch' ? 4 : 5 }));

  // ---- Overworld ----
  W.buildOverworld = (flags) => {
    flags = flags || {}; const D = WORLDMAP; const m = W.newMap(D.w, D.h, 'overworld', 'overworld'); m.name = 'Hollowmere'; const rng = RNG(D.seed);
    const kindTile = { grass: T.GRASS, forest: T.FOREST, hills: T.HILL, mountain: T.MOUNTAIN, swamp: T.SWAMP, sand: T.SAND, water: T.WATER, graveyard: T.GRAVE };
    const region = new Array(D.w * D.h).fill(null);
    for (const r of D.regions) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { if (x < 0 || y < 0 || x >= D.w || y >= D.h) continue; if (r.kind === 'forest' || r.kind === 'hills' || r.kind === 'swamp') { if (rng() > (r.density || 0.5) + 0.25) { region[y * D.w + x] = { kind: 'grass' }; continue; } } region[y * D.w + x] = r; }
    for (let i = 0; i < region.length; i++) { const r = region[i]; m.t[i] = r ? kindTile[r.kind] : T.GRASS; if (r && r.kind === 'grass' && rng() < 0.12) m.t[i] = T.TALLGRASS; if (r && r.kind === 'swamp' && rng() < 0.18) m.t[i] = T.SHALLOW; if (r && r.kind === 'hills' && rng() < 0.3) m.t[i] = T.GRASS; }
    // rivers
    const paint = (pts, w, t) => { for (let i = 0; i < pts.length - 1; i++) { for (const [x, y] of U.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])) for (let k = 0; k < w; k++) W.set(m, x + k, y, t); } };
    for (const rv of D.rivers) paint(rv, 2, T.WATER);
    for (const rd of D.roads) paint(rd, 1, T.ROAD);
    for (const b of D.bridges) for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.h; y++) W.set(m, x, y, T.BRIDGE);
    // town square cobbles
    for (let y = 33; y <= 39; y++) for (let x = 26; x <= 36; x++) if (W.get(m, x, y) !== T.WATER) W.set(m, x, y, T.COBBLE);
    // buildings
    for (const b of D.buildings) { if (b.locked && !flags[b.locked]) continue; const bb = Object.assign({}, b); m.buildings.push(bb); for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) W.set(m, x, y, T.BUILDING); for (let x = b.x - 1; x <= b.x + b.w; x++) { if (W.get(m, x, b.y + b.h) !== T.WATER) W.set(m, x, b.y + b.h, x === b.door ? T.ROAD : (W.get(m, x, b.y + b.h) === T.BUILDING ? T.BUILDING : T.DIRT)); } W.addProp(m, { kind: 'doorTrigger', x: b.door, y: b.y + b.h, building: bb, invisible: true }); }
    // trees on forest tiles & decorations
    for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) {
      const t = W.get(m, x, y); const near = (tt) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W.get(m, x + dx, y + dy) === tt);
      if (t === T.FOREST) { if (rng() < 0.75 && !near(T.ROAD)) W.addProp(m, { kind: rng() < 0.5 ? 'tree' : 'pine', x, y, solid: true, opt: { color: rng() < 0.5 ? '#3a6f38' : '#316231', autumn: rng() < 0.15 } }); else if (rng() < 0.3) W.addProp(m, { kind: 'bush', x, y, opt: { berries: rng() < 0.3 } }); }
      else if (t === T.GRASS && rng() < 0.03 && !near(T.ROAD) && !near(T.COBBLE)) W.addProp(m, { kind: rng() < 0.6 ? 'tree' : 'bush', x, y, solid: rng() < 0.6, opt: {} });
      else if (t === T.HILL && rng() < 0.08) W.addProp(m, { kind: 'rock', x, y, solid: true, opt: {} });
      else if (t === T.SWAMP && rng() < 0.12) W.addProp(m, { kind: rng() < 0.5 ? 'pine' : 'mushroom', x, y, solid: rng() < 0.4, opt: { color: rng() < 0.5 ? '#22402a' : '#4a7a50' } });
      else if (t === T.GRAVE && rng() < 0.2) W.addProp(m, { kind: 'grave', x, y, solid: true, opt: {} });
    }
    // props
    for (const p of D.props) { if (p.locked && !flags[p.locked]) continue; W.addProp(m, Object.assign({ solid: p.kind !== 'campfire', opt: { color: p.color } }, p)); }
    // dungeon sites
    for (const d of D.dungeons) { const site = Object.assign({}, d); site.available = !d.locked || !!flags[d.locked]; W.addProp(m, { kind: 'entrance', x: d.x, y: d.y, solid: true, opt: { kind: d.kind }, site, label: d.name }); for (const [dx, dy] of [[0, 1], [-1, 1], [1, 1], [0, 2]]) if (W.get(m, d.x + dx, d.y + dy) !== T.WATER) { W.set(m, d.x + dx, d.y + dy, T.DIRT); const ps = W.propsAt(m, d.x + dx, d.y + dy); ps.forEach((pp) => W.removeProp(m, pp)); } }
    // clear props from roads/cobbles/doors and ensure solid props don't sit on roads
    for (const p of m.props) { const t = W.get(m, p.x, p.y); if ((t === T.ROAD || t === T.COBBLE || t === T.BRIDGE || t === T.DIRT) && (p.kind === 'tree' || p.kind === 'pine' || p.kind === 'bush' || p.kind === 'rock' || p.kind === 'grave')) W.removeProp(m, p); }
    W.reindex(m);
    // NPC entities
    for (const n of D.npcs) { if (n.locked && !flags[n.locked]) continue; m.npcs.push(W.makeNpc(n)); }
    m.spawn = { x: 23, y: 35 };
    return m;
  };
  W.makeNpc = (n) => ({ id: n.id, name: n.name, npc: true, dialog: n.dialog, x: n.x, y: n.y, ax: n.x, ay: n.y, home: { x: n.x, y: n.y }, sprite: Object.assign({ hairStyle: n.sprite && n.sprite.sex === 'f' ? 'long' : 'short' }, n.sprite), facing: 'l', wander: n.wander !== false, nameTag: (() => { const w = n.name.split(' '); return ['Big', 'Old', 'Bosun', 'Brother', 'Sister', 'Master', 'Auntie', 'Guard'].includes(w[0]) && w[1] ? w[1] : w[0]; })(), role: n.role });

  // ---- Interiors ----
  W.buildInterior = (def) => {
    const rows = def.rows, h = rows.length, w = rows[0].length; const m = W.newMap(w, h, 'interior', def.theme || 'tavern'); m.name = def.name;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x]; let t = T.WOOD;
      switch (c) {
        case '#': t = T.WALL; break; case '=': t = T.BAR; break; case 'D': t = T.DOORWAY; W.addProp(m, { kind: 'exitTrigger', x, y, invisible: true }); break;
        case 'k': t = T.WALL; W.addProp(m, { kind: 'keg', x, y, solid: true, depthBias: 0.3 }); break;
        case 'c': W.addProp(m, { kind: 'barrel', x, y, solid: true, searchable: true }); break;
        case 't': W.addProp(m, { kind: 'table', x, y, solid: true, searchable: true, opt: { items: true } }); break;
        case 'o': W.addProp(m, { kind: 'stool', x, y, solid: false }); break;
        case 'F': t = T.WALL; W.addProp(m, { kind: 'fireplace', x, y, solid: true, animated: true, depthBias: 0.3 }); break;
        case 'w': t = T.WALL; W.addProp(m, { kind: 'window', x, y, depthBias: 0.3 }); break;
        case 'p': W.addProp(m, { kind: 'plant', x, y, solid: true }); break;
        case '>': W.addProp(m, { kind: 'trapdoor', x, y, solid: false, cellar: true, label: 'Cellar' }); break;
        case 'r': t = T.RUG; break;
        default: break;
      }
      W.set(m, x, y, t);
    }
    // rug under central tables
    for (const [x, y] of [[6, 4], [7, 4], [8, 4], [9, 4], [6, 5], [9, 5]]) if (W.get(m, x, y) === T.WOOD && !W.propAt(m, x, y)) W.set(m, x, y, T.RUG);
    W.addProp(m, { kind: 'dragonhead', x: 5, y: 0, depthBias: 0.3 }); W.addProp(m, { kind: 'banner', x: 8, y: 0, depthBias: 0.3, opt: { color: '#a02020' } }); W.addProp(m, { kind: 'banner', x: 11, y: 0, depthBias: 0.3, opt: { color: '#a02020' } });
    W.addProp(m, { kind: 'counter', x: 4, y: 1, depthBias: 0.2, opt: { items: true } });
    for (const s of (def.searchables || [])) { const p = W.propAt(m, s.x, s.y); if (p) { p.searchable = true; p.search = s; } else W.addProp(m, { kind: 'searchSpot', x: s.x, y: s.y, invisible: true, searchable: true, search: s }); }
    W.reindex(m);
    for (const n of (def.npcs || [])) m.npcs.push(W.makeNpc(Object.assign({ wander: false }, n)));
    m.spawn = def.wake || def.exit; m.exit = def.exit; m.cellar = def.cellar;
    return m;
  };

  // ---- Building interiors ----
  // Every building in town can be walked into. Rooms are generated from the building footprint: four walls, a door on
  // the south wall, dressing per kind, and — for shops — a counter with the keeper standing behind it. You talk to the
  // keeper across the counter to open their shop; nothing opens on its own.
  W.roomDefs = {
    temple: { theme: 'temple', floor: T.FLOOR, counter: 'altar', decor: 'temple', keeper: { id: 'k_odile', name: 'Sister Odile', ui: 'temple', sprite: { skin: '#f1c9a5', cloth: '#e8e0c8', hair: '#8a8a8a', sex: 'f', hat: 'hood' } } },
    smith: { decor: 'smith', keeper: { id: 'k_bela', name: 'Bela Ironbelly', ui: 'smith', sprite: { skin: '#b97a52', cloth: '#5a4a3a', hair: '#2a1a10', sex: 'f', scale: 1.05 } } },
    merchant: { decor: 'merchant', keeper: { id: 'k_nib', name: 'Nib the Apprentice', ui: 'merchant', sprite: { skin: '#e0b08a', cloth: '#3a6a4a', hair: '#c05020', hat: 'cap', scale: 0.85 } } },
    guild: { decor: 'guild', keeper: { id: 'k_hallow', name: 'Clerk Hallow', ui: 'guild', sprite: { skin: '#d9a37a', cloth: '#8a6a2a', hair: '#5a4a3a' } } },
    btavern: { decor: 'tavern', keeper: { id: 'k_marrow', name: 'Marrow', ui: 'btavern', sprite: { skin: '#a9a08a', cloth: '#4a5a3a', hair: '#3a4a2a', beard: true } } },
    bmerchant: { decor: 'merchant', keeper: { id: 'k_hessel', name: 'Hessel Mudd', ui: 'bmerchant', sprite: { skin: '#b97a52', cloth: '#5a5a4a', hair: '#8a9a7a', hat: 'hood' } } },
    house1: { decor: 'home', keeper: { id: 'k_mabel', name: 'Old Mabel', dialog: 'mabel', sprite: { skin: '#e0b08a', cloth: '#7a5a8a', hair: '#e0e0e0', sex: 'f', scale: 0.8 } } },
    house2: { decor: 'home', keeper: { id: 'k_fenwick', name: 'Fenwick the Cooper', dialog: 'fenwick', sprite: { skin: '#c9906a', cloth: '#5a4a3a', hair: '#3a2a1a', beard: true } } },
    house3: { decor: 'home', keeper: { id: 'k_sela', name: 'Sela Ord', dialog: 'cottager', sprite: { skin: '#d9a37a', cloth: '#4a6a7a', hair: '#2a2a2a', sex: 'f' } } },
    house4: { decor: 'home', keeper: { id: 'k_rooke', name: 'Rooke', dialog: 'cottager2', sprite: { skin: '#f1c9a5', cloth: '#7a6a4a', hair: '#c0a030', hat: 'cap' } } },
  };
  W.roomDef = (b) => W.roomDefs[b.id] || { decor: 'home', keeper: null };

  W.buildRoom = (b, def) => {
    def = def || W.roomDef(b);
    const w = U.clamp((b.w || 4) + 5, 9, 15), h = U.clamp((b.h || 4) + 4, 8, 11);
    const m = W.newMap(w, h, 'interior', def.theme || 'cellar');
    m.name = b.name; m.buildingId = b.id; m.isRoom = true;
    const floor = def.floor || T.WOOD;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) W.set(m, x, y, (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? T.WALL : floor);
    const doorX = Math.floor(w / 2);
    W.set(m, doorX, h - 1, T.DOORWAY); W.addProp(m, { kind: 'exitTrigger', x: doorX, y: h - 1, invisible: true });
    m.exit = { x: doorX, y: h - 1 }; m.spawn = { x: doorX, y: h - 2 };
    const free = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1 && !W.propAt(m, x, y) && !(x === doorX && y >= h - 2);
    const put = (kind, x, y, extra) => (free(x, y) ? W.addProp(m, Object.assign({ kind, x, y }, extra || {})) : null);
    const onWall = (kind, x, y, extra) => { if (W.propAt(m, x, y)) return null; W.set(m, x, y, T.WALL); return W.addProp(m, Object.assign({ kind, x, y, depthBias: 0.3 }, extra || {})); };
    for (let x = 2; x < w - 2; x += 3) if (x !== doorX) onWall('window', x, 0);
    // counter (or altar rail) with the keeper behind it
    const cy = 2, keeperX = Math.floor(w / 2);
    const hasCounter = !!(def.keeper && (def.counter || def.keeper.ui)); // shops and the temple; homes are just rooms
    if (hasCounter) {
      const kind = def.counter === 'altar' ? 'altar' : 'counter';
      for (let x = 2; x <= w - 3; x++) put(kind, x, cy, { solid: true, opt: { spiral: def.counter === 'altar' }, depthBias: 0.2 });
      put('lamp', 1, cy); put('lamp', w - 2, cy);
    }
    switch (def.decor) {
      case 'smith': onWall('fireplace', 0, cy + 2); put('crate', 2, h - 3); put('barrel', 3, h - 2); put('table', w - 3, h - 3, { solid: true, opt: { items: true } }); put('crate', w - 2, h - 2); put('barrel', 1, 1); break;
      case 'merchant': put('bookshelf', 1, 1, { solid: true }); put('bookshelf', w - 2, 1, { solid: true }); put('crate', 2, h - 3); put('barrel', 3, h - 3); put('crate', w - 3, h - 3); put('table', w - 4, h - 2, { solid: true, opt: { items: true } }); break;
      case 'temple': put('pillar', 1, h - 3, { solid: true }); put('pillar', w - 2, h - 3, { solid: true }); put('brazier', 2, h - 2, { solid: true, animated: true }); put('brazier', w - 3, h - 2, { solid: true, animated: true }); onWall('banner', 2, 0, { opt: { color: '#5a6a8a' } }); onWall('banner', w - 3, 0, { opt: { color: '#5a6a8a' } }); break;
      case 'guild': put('questBoard', 1, h - 3, { solid: true }); put('table', 3, h - 3, { solid: true, opt: { items: true } }); put('stool', 3, h - 2); put('table', w - 3, h - 3, { solid: true }); put('stool', w - 3, h - 2); onWall('banner', 3, 0, { opt: { color: '#8a6a2a' } }); put('bookshelf', w - 2, 1, { solid: true }); break;
      case 'tavern': put('keg', 1, 1, { solid: true }); put('barrel', w - 2, 1, { solid: true }); put('table', 2, h - 3, { solid: true, opt: { items: true } }); put('stool', 2, h - 2); put('table', w - 3, h - 3, { solid: true }); put('stool', w - 3, h - 2); onWall('fireplace', w - 1, cy + 2); break;
      default: { put('bed', w - 2, 1, { solid: true }); put('table', 3, 3, { solid: true, opt: { items: true } }); put('stool', 3, 4); put('plant', 1, h - 2, { solid: true }); put('barrel', w - 2, h - 2, { solid: true }); onWall('fireplace', 0, 2); break; }
    }
    if (def.keeper) {
      const k = def.keeper;
      const npc = W.makeNpc({ id: k.id, name: k.name, x: hasCounter ? keeperX : 2, y: hasCounter ? cy - 1 : 3, sprite: k.sprite, dialog: k.dialog || null, wander: false });
      npc.shopUi = k.ui || null; npc.counter = hasCounter; npc.role = 'keeper'; // counter keepers are talked to across the counter (reach 2)
      m.npcs.push(npc);
    }
    W.reindex(m);
    return m;
  };

  window.World = W;
})();
