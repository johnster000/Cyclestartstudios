/* 3D prop definitions for the rotatable straight-on renderer.
   Every prop is a list of primitives in tile units, relative to the tile centre (x right, y down/south, z up):
     box   {t:'box', x,y,z, w,d,h, col, top?}          axis-aligned block, w along x, d along y
     cyl   {t:'cyl', x,y,z, r,h, col, top?}            vertical cylinder
     sph   {t:'sph', x,y,z, r, col}                    shaded ball (billboard)
     flat  {t:'flat', x,y,z, w,d, col, alpha?}         horizontal quad
     vflat {t:'vflat', x,y,z, axis:'x'|'y', w,h, col}   vertical quad (sign faces, windows, banners)
     flame {t:'flame', x,y,z, s}                       animated fire billboard
     bill  {t:'bill', x,y,z, key, make}                cached sprite billboard (statues, prisoners)
   Props3D.build(kind, prop, ctx) → prims. ctx: {theme, interior, wallDir(x,y) → [dx,dy] toward open floor, doorAxis(x,y)} */
(function () {
  const sh = (c, f) => Sprites.shade(c, f);
  // Brighten a colour by scaling its channels instead of blending toward white: greens stay green.
  // (sh with a positive factor washes dark colours out to grey, which made the old foliage look like stone.)
  const lit = (c, f) => { const h = c.replace('#', ''); const p2 = (i) => parseInt(h.slice(i, i + 2), 16) * (1 + f); const q = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return '#' + q(p2(0)) + q(p2(2)) + q(p2(4)); };
  const B = (x, y, z, w, d, h, col, top) => ({ t: 'box', x, y, z, w, d, h, col, top });
  const CY = (x, y, z, r, h, col, top) => ({ t: 'cyl', x, y, z, r, h, col, top });
  const SP = (x, y, z, r, col) => ({ t: 'sph', x, y, z, r, col });
  const FL = (x, y, z, w, d, col, alpha) => ({ t: 'flat', x, y, z, w, d, col, alpha });
  const VF = (x, y, z, axis, w, h, col) => ({ t: 'vflat', x, y, z, axis, w, h, col });
  const FLAME = (x, y, z, s) => ({ t: 'flame', x, y, z, s: s || 1 });
  const BILL = (x, y, z, key, make) => ({ t: 'bill', x, y, z, key, make });
  // soft, irregular painterly mass (foliage, rocks): drawn with a radial gradient and a noisy outline
  const BLOB = (x, y, z, r, col, seed, sq) => ({ t: 'blob', x, y, z, r, col, seed: seed || 0, sq: sq || 0.86 });
  const WOOD = '#7a5a3a', DARK = '#3a2a1a', STONE = '#6e6a78', METAL = '#a8aebc', GOLD = '#e0c040';
  const legs = (hw, hd, h, col, inset) => { const i = inset || 0.06; return [B(-hw + i, -hd + i, 0, 0.08, 0.08, h, col), B(hw - i, -hd + i, 0, 0.08, 0.08, h, col), B(-hw + i, hd - i, 0, 0.08, 0.08, h, col), B(hw - i, hd - i, 0, 0.08, 0.08, h, col)]; };
  const books = (x, y, z, axis, n, seed) => { const out = []; const cols = ['#a04040', '#4060a0', '#40a060', '#c0a030', '#805090', '#c06030']; for (let i = 0; i < n; i++) { const w = 0.07 + ((seed + i) % 3) * 0.02, hh = 0.16 + ((seed * 7 + i) % 3) * 0.03; const off = -0.3 + i * (0.62 / n); out.push(axis === 'x' ? B(x + off, y, z, w, 0.18, hh, cols[(i + seed) % 6]) : B(x, y + off, z, 0.18, w, hh, cols[(i + seed) % 6])); } return out; };

  const P3 = {};
  P3.build = (kind, p, ctx) => {
    const o = p.opt || {}; const seed = ((p.x || 0) * 31 + (p.y || 0) * 17) | 0;
    // per-tile jitter so a forest is not the same tree stamped over and over
    const jit = (i) => { let v = (seed * 374761393 + i * 668265263) | 0; v = (v ^ (v >> 13)) * 1274126177; return ((v ^ (v >> 16)) >>> 0) / 4294967296; };
    const wd = ctx.wallDir ? ctx.wallDir(p.x, p.y) : [0, 1]; // direction from a wall-mounted prop toward the room
    const face = (dist) => [wd[0] * dist, wd[1] * dist];
    switch (kind) {
      case 'chest': { const col = p.color || o.color || '#8a5a2a'; const out = [B(0, 0, 0, 0.62, 0.42, 0.3, col, sh(col, 0.1)), B(0, 0, 0.3, 0.64, 0.44, 0.06, sh(col, -0.2)), B(0, 0.22, 0.14, 0.1, 0.03, 0.1, p.locked && !p.open ? '#e04040' : GOLD), B(-0.24, 0, 0.02, 0.05, 0.44, 0.3, '#5a4a3a'), B(0.24, 0, 0.02, 0.05, 0.44, 0.3, '#5a4a3a')]; if (p.open) { out.push(B(0, -0.24, 0.36, 0.64, 0.06, 0.34, sh(col, -0.1))); out.push(FL(0, 0, 0.31, 0.5, 0.3, '#ffe080')); } else out.push(B(0, 0, 0.36, 0.62, 0.42, 0.12, sh(col, 0.05), sh(col, 0.2))); return out; }
      case 'barrel': return [CY(0, 0, 0, 0.3, 0.6, WOOD, sh(WOOD, 0.15)), B(0, 0, 0.12, 0.62, 0.62, 0.04, '#5a5a64'), B(0, 0, 0.44, 0.62, 0.62, 0.04, '#5a5a64')];
      case 'keg': return [CY(0, 0, 0, 0.32, 0.55, WOOD, sh(WOOD, 0.1)), B(0, 0, 0.1, 0.66, 0.66, 0.04, '#5a5a64'), B(0, 0, 0.4, 0.66, 0.66, 0.04, '#5a5a64'), B(wd[0] * 0.34, wd[1] * 0.34, 0.25, 0.08, 0.08, 0.08, GOLD)];
      case 'crate': return [B(0, 0, 0, 0.62, 0.62, 0.6, WOOD, sh(WOOD, 0.15)), B(0, 0, 0.58, 0.66, 0.08, 0.04, DARK), B(0, 0, 0.58, 0.08, 0.66, 0.04, DARK)];
      case 'coffin': { const c = '#5a5a68'; return [B(0, 0, 0, 0.54, 0.9, 0.28, c, sh(c, 0.12)), B(0, 0, 0.28, 0.5, 0.86, 0.1, p.open ? '#101018' : sh(c, 0.05), p.open ? '#101018' : sh(c, 0.25)), B(0, -0.2, 0.39, 0.06, 0.28, 0.02, GOLD), B(0, -0.2, 0.39, 0.18, 0.06, 0.02, GOLD)]; }
      case 'urn': return [CY(0, 0, 0, 0.16, 0.08, '#8a6a4a'), CY(0, 0, 0.08, 0.26, 0.4, '#a07a50'), CY(0, 0, 0.48, 0.16, 0.1, '#8a6a4a'), B(0, 0, 0.26, 0.54, 0.54, 0.04, '#c040a0')];
      case 'cart': return [B(0, 0, 0.2, 0.9, 0.6, 0.3, WOOD, sh(WOOD, 0.15)), B(0, 0, 0.5, 0.7, 0.4, 0.1, '#c08a3a'), CY(-0.3, -0.33, 0, 0.16, 0.06, '#3a3a3a'), CY(0.3, -0.33, 0, 0.16, 0.06, '#3a3a3a'), CY(-0.3, 0.33, 0, 0.16, 0.06, '#3a3a3a'), CY(0.3, 0.33, 0, 0.16, 0.06, '#3a3a3a')];
      case 'pillar': return [B(0, 0, 0, 0.6, 0.6, 0.1, STONE), CY(0, 0, 0.1, 0.22, 1.6, STONE, sh(STONE, 0.2)), B(0, 0, 1.7, 0.6, 0.6, 0.1, STONE, sh(STONE, 0.25))];
      case 'pillarBroken': return [B(0, 0, 0, 0.6, 0.6, 0.1, STONE), CY(0, 0, 0.1, 0.22, 0.6, STONE, sh(STONE, -0.1)), B(0.12, -0.1, 0.7, 0.16, 0.16, 0.14, STONE)];
      case 'statue': return [B(0, 0, 0, 0.7, 0.7, 0.18, STONE, sh(STONE, 0.2)), BILL(0, 0, 0.18, 'statue:' + (o.weapon || 'sword') + ':' + (o.hat || 'none'), () => Sprites.humanoid({ skin: STONE, hair: STONE, cloth: STONE, boots: sh(STONE, -0.3), hairStyle: 'short', weapon: o.weapon || 'sword', hat: o.hat || 'none', outfit: 'plain', eyes: sh(STONE, -0.4), belt: sh(STONE, -0.3) }))];
      case 'altar': { const out = [B(0, 0, 0, 0.8, 0.5, 0.42, STONE, sh(STONE, 0.15)), B(0, 0, 0.42, 0.9, 0.6, 0.08, sh(STONE, 0.1), sh(STONE, 0.3)), B(-0.3, -0.15, 0.5, 0.06, 0.06, 0.16, '#f0e0c0'), FLAME(-0.3, -0.15, 0.66, 0.5), B(0.3, -0.15, 0.5, 0.06, 0.06, 0.16, '#f0e0c0'), FLAME(0.3, -0.15, 0.66, 0.5)]; if (o.spiral) out.push(FL(0, 0.05, 0.51, 0.3, 0.3, '#c040a0')); return out; }
      case 'table': { const out = [B(0, 0, 0.4, 0.86, 0.6, 0.06, WOOD, sh(WOOD, 0.2))].concat(legs(0.43, 0.3, 0.4, sh(WOOD, -0.3))); if (o.items) { out.push(CY(-0.2, -0.05, 0.46, 0.08, 0.12, '#c0c0c0')); out.push(B(0.2, 0.08, 0.46, 0.14, 0.1, 0.06, '#e0c040')); } return out; }
      case 'counter': return [B(0, 0, 0, 1.0, 0.7, 0.55, WOOD, sh(WOOD, 0.05)), B(0, 0, 0.55, 1.04, 0.74, 0.06, sh(WOOD, 0.25), sh(WOOD, 0.35)), CY(-0.3, -0.1, 0.61, 0.07, 0.12, '#c0c0c0'), B(0.25, 0.05, 0.61, 0.16, 0.12, 0.08, '#e0c040')];
      case 'stool': return [CY(0, 0, 0.26, 0.2, 0.06, WOOD, sh(WOOD, 0.2))].concat(legs(0.14, 0.14, 0.26, sh(WOOD, -0.3), 0));
      case 'bookshelf': { const along = ctx.wallDir ? (Math.abs(wd[0]) > 0 ? 'y' : 'x') : 'x'; const w = along === 'x' ? 0.9 : 0.34, d = along === 'x' ? 0.34 : 0.9; const out = [B(0, 0, 0, w, d, 1.3, WOOD, sh(WOOD, 0.15))]; for (let r = 0; r < 3; r++) out.push(...books(wd[0] * 0.1, wd[1] * 0.1, 0.12 + r * 0.4, along, 5, seed + r)); return out; }
      case 'brazier': return [CY(0, 0, 0, 0.14, 0.4, '#4a4a54'), CY(0, 0, 0.4, 0.28, 0.16, '#4a4a54', '#2a1a10'), FLAME(0, 0, 0.56, 1.1)];
      case 'torch': { const [fx, fy] = face(0.42); return [B(fx, fy, 0, 0.07, 0.07, 1.05, DARK), B(fx, fy, 1.05, 0.14, 0.14, 0.08, '#3a3a3a'), FLAME(fx, fy, 1.13, 0.7)]; } // a standing iron sconce, since walls are now open ledges
      case 'campfire': { const out = [B(0, 0, 0, 0.7, 0.14, 0.12, '#5a4a3a'), B(0, 0, 0, 0.14, 0.7, 0.12, '#5a4a3a'), B(0, 0, 0.1, 0.5, 0.14, 0.1, '#4a3a2a')]; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; out.push(B(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0, 0.12, 0.12, 0.1, STONE)); } if (p.lit !== false) out.push(FLAME(0, 0, 0.18, 1.3)); return out; }
      case 'lever': return [B(0, 0, 0, 0.36, 0.36, 0.34, '#5a5a64', sh('#5a5a64', 0.2)), B(p.on ? 0 : -0.14, 0, 0.34, 0.06, 0.06, p.on ? 0.36 : 0.3, METAL), B(p.on ? 0 : -0.16, 0, p.on ? 0.7 : 0.62, 0.14, 0.14, 0.14, '#e04040', '#f05a5a')];
      case 'cage': { const out = [B(0, 0, 0, 0.8, 0.8, 0.06, '#6a6a74'), B(0, 0, 1.2, 0.8, 0.8, 0.06, '#6a6a74')]; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { if (!i && !j) continue; if (p.open && j === 1 && i === 0) continue; out.push(B(i * 0.36, j * 0.36, 0.06, 0.04, 0.04, 1.14, METAL)); } if (p.prisonerSprite && !p.open) out.push(BILL(0, 0, 0.06, 'prisoner', () => Sprites.humanoid(p.prisonerSprite))); return out; }
      case 'grave': return [B(0, 0.1, 0, 0.5, 0.2, 0.6, STONE, sh(STONE, 0.2)), B(0, 0.1, 0.6, 0.36, 0.2, 0.1, STONE), FL(0, -0.15, 0.005, 0.5, 0.5, p.open ? '#1a1410' : '#3a3020')];
      case 'pedestal': { const out = [B(0, 0, 0, 0.44, 0.44, 0.5, STONE, sh(STONE, 0.2)), B(0, 0, 0.5, 0.52, 0.52, 0.06, sh(STONE, 0.1), sh(STONE, 0.3))]; if (p.keyPedestal ? !p.taken : p.event && !p.taken) out.push(p.keyPedestal ? B(0, 0, 0.6, 0.16, 0.06, 0.06, GOLD) : B(0, 0, 0.62, 0.26, 0.26, 0.26, '#c040a0', '#d860c0')); if (p.keyPedestal && !p.taken) out.push(B(0.08, 0, 0.6, 0.04, 0.06, 0.14, GOLD)); return out; }
      case 'stairs': { const out = [FL(0, 0, 0.004, 0.9, 0.9, '#0a0a10')]; for (let i = 0; i < 4; i++) out.push(B(0, -0.35 + i * 0.22, 0, 0.9, 0.22, 0.22 - i * 0.055, sh(STONE, -0.1 * i), sh(STONE, 0.1 - 0.1 * i))); return out; }
      case 'trapdoor': return [B(0, 0, 0, 0.8, 0.6, 0.04, WOOD, sh(WOOD, 0.1)), B(0, 0, 0.04, 0.8, 0.06, 0.02, DARK), B(0.28, 0, 0.04, 0.1, 0.06, 0.02, METAL)];
      case 'door': case 'secretDoor': { const axis = ctx.doorAxis ? ctx.doorAxis(p.x, p.y) : 'x'; const col = p.color || (kind === 'secretDoor' ? '#5a5a60' : WOOD); const w = axis === 'x' ? 1 : 0.18, d = axis === 'x' ? 0.18 : 1; if (p.open) { return [B(axis === 'x' ? -0.42 : 0, axis === 'x' ? 0 : -0.42, 0, axis === 'x' ? 0.16 : 0.18, axis === 'x' ? 0.18 : 0.16, 1.3, col), B(axis === 'x' ? 0.42 : 0, axis === 'x' ? 0 : 0.42, 0, axis === 'x' ? 0.16 : 0.18, axis === 'x' ? 0.18 : 0.16, 1.3, col)]; } const out = [B(0, 0, 0, w, d, 1.3, col, sh(col, 0.1))]; for (const k of [0.45, 0.9]) out.push(B(0, 0, k, w * 0.9, d * 1.1, 0.03, sh(col, -0.45))); out.push(B(axis === 'x' ? 0.3 : 0, axis === 'x' ? 0 : 0.3, 0.6, axis === 'x' ? 0.08 : 0.24, axis === 'x' ? 0.24 : 0.08, 0.08, p.locked ? '#e04040' : METAL)); return out; }
      case 'tree': { const leaf = o.color || '#3a6f38'; const j = jit(1) * 0.3 - 0.15, k = jit(2) * 0.2;
        const out = [CY(0, 0, 0, 0.11 + jit(3) * 0.05, 0.95 + k, '#4a3424', '#5a4030'),
          BLOB(0, 0, 0.72 + k, 0.62, sh(leaf, -0.28), seed + 5, 0.7), // shadowed underside
          BLOB(-0.28 + j, 0.14, 0.92 + k, 0.46, sh(leaf, -0.08), seed + 1),
          BLOB(0.3 - j, -0.12, 0.98 + k, 0.44, leaf, seed + 2),
          BLOB(0.02, 0.02, 1.16 + k, 0.5, lit(leaf, 0.08), seed + 3),
          BLOB(-0.08 + j, -0.08, 1.42 + k, 0.32, lit(leaf, 0.22), seed + 4)];
        if (o.autumn) out.push(BLOB(0.22, -0.2, 1.3 + k, 0.26, '#b8642c', seed + 6));
        return out; }
      case 'pine': { const leaf = o.color || '#2c5c3a'; const k = jit(4) * 0.25;
        return [CY(0, 0, 0, 0.09, 0.6, '#3a2416', '#4a3020'),
          BLOB(0, 0, 0.5 + k, 0.56, sh(leaf, -0.2), seed + 1, 0.62), BLOB(0, 0, 0.82 + k, 0.46, sh(leaf, -0.05), seed + 2, 0.64),
          BLOB(0, 0, 1.12 + k, 0.36, lit(leaf, 0.1), seed + 3, 0.66), BLOB(0, 0, 1.4 + k, 0.24, lit(leaf, 0.24), seed + 4, 0.7), BLOB(0, 0, 1.62 + k, 0.11, lit(leaf, 0.36), seed + 5, 0.8)]; }
      case 'bush': { const leaf = o.color || '#4a8a3a';
        const out = [BLOB(0, 0, 0.16, 0.4, sh(leaf, -0.2), seed + 1, 0.7), BLOB(-0.18, 0.1, 0.3, 0.3, leaf, seed + 2), BLOB(0.2, -0.06, 0.34, 0.28, lit(leaf, 0.14), seed + 3), BLOB(0, 0.02, 0.46, 0.24, lit(leaf, 0.26), seed + 4)];
        if (o.berries) { out.push(SP(-0.12, 0.16, 0.5, 0.05, '#e04040')); out.push(SP(0.2, 0.04, 0.46, 0.05, '#e04040')); out.push(SP(0.02, -0.14, 0.58, 0.045, '#e04040')); } return out; }
      case 'rock': return [BLOB(0.04, 0.06, 0.02, 0.34, sh(STONE, -0.35), seed + 1, 0.6), BLOB(0, 0, 0.16, 0.36, STONE, seed + 2, 0.66), BLOB(-0.08, -0.06, 0.34, 0.22, lit(STONE, 0.18), seed + 3, 0.7)];
      case 'mushroom': { const cap = o.color || '#c04040'; return [CY(0, 0, 0, 0.07, 0.26, '#e0d0b0', '#efe4cc'), BLOB(0, 0, 0.28, 0.24, cap, seed + 1, 0.62), SP(-0.06, -0.06, 0.36, 0.04, '#f0f0e0')]; }
      case 'well': return [CY(0, 0, 0, 0.42, 0.4, STONE, '#203050'), B(-0.34, 0, 0.4, 0.08, 0.08, 0.8, WOOD), B(0.34, 0, 0.4, 0.08, 0.08, 0.8, WOOD), B(0, 0, 1.2, 0.9, 0.7, 0.1, '#8a3a2a', '#a04a3a'), CY(0, 0, 0.98, 0.06, 0.06, '#5a5a5a'), B(0, 0, 1.02, 0.7, 0.04, 0.04, '#5a5a5a')];
      case 'lamp': return [B(0, 0, 0, 0.24, 0.24, 0.06, '#3a3a44'), CY(0, 0, 0.06, 0.05, 1.3, '#3a3a44'), B(0, 0, 1.36, 0.26, 0.26, 0.26, '#3a3a44', '#3a3a44'), SP(0, 0, 1.49, 0.11, '#ffd060'), B(0, 0, 1.62, 0.3, 0.3, 0.04, '#2a2a34')];
      case 'signpost': return [CY(0, 0, 0, 0.05, 1.0, WOOD), B(0, -0.02, 0.62, 0.7, 0.08, 0.3, sh(WOOD, 0.25), sh(WOOD, 0.3)), VF(0, -0.07, 0.68, 'x', 0.5, 0.05, DARK), VF(0, -0.07, 0.8, 'x', 0.4, 0.05, DARK)];
      case 'questBoard': return [B(-0.34, 0, 0, 0.08, 0.1, 1.2, DARK), B(0.34, 0, 0, 0.08, 0.1, 1.2, DARK), B(0, 0, 0.5, 0.86, 0.08, 0.7, WOOD, sh(WOOD, 0.1)), B(0, 0, 1.2, 0.94, 0.14, 0.08, DARK), VF(-0.2, -0.05, 0.62, 'x', 0.24, 0.3, '#f0e8d0'), VF(0.12, -0.05, 0.7, 'x', 0.28, 0.34, '#e8dcc0'), VF(0.3, -0.05, 0.56, 'x', 0.16, 0.22, '#f0e8d0'), VF(-0.2, -0.06, 0.9, 'x', 0.04, 0.04, '#e04040'), VF(0.12, -0.06, 1.0, 'x', 0.04, 0.04, '#e04040')];
      case 'bed': return [B(0, 0, 0, 0.8, 0.96, 0.22, WOOD, sh(WOOD, 0.1)), B(0, 0.05, 0.22, 0.74, 0.8, 0.12, '#8a3a3a', '#a04848'), B(0, -0.32, 0.22, 0.6, 0.22, 0.12, '#f0e8d8', '#f8f4ec'), B(0, -0.46, 0, 0.8, 0.06, 0.6, WOOD, sh(WOOD, 0.2))];
      case 'fireplace': { const [fx, fy] = face(0.2); return [B(fx * 0.5, fy * 0.5, 0, 0.9 - Math.abs(wd[0]) * 0.3, 0.9 - Math.abs(wd[1]) * 0.3, 1.4, '#7a7a80', '#8a8a90'), B(fx, fy, 0.12, 0.5, 0.5, 0.5, '#1a0a0a', '#1a0a0a'), B(fx, fy, 0.9, 0.9 - Math.abs(wd[0]) * 0.2, 0.9 - Math.abs(wd[1]) * 0.2, 0.08, sh('#7a7a80', 0.2), sh('#7a7a80', 0.3)), FLAME(fx * 1.1, fy * 1.1, 0.18, 1.0)]; }
      case 'plant': return [CY(0, 0, 0, 0.16, 0.24, '#a07a50', '#5a3a20'), BLOB(0, 0, 0.36, 0.24, '#3a8a3a', seed + 1), BLOB(-0.12, 0.06, 0.48, 0.16, '#4a9a4a', seed + 2), BLOB(0.14, -0.04, 0.54, 0.14, '#5aaa5a', seed + 3)];
      case 'window': { const [fx, fy] = face(0.5); const axis = Math.abs(wd[0]) > 0 ? 'y' : 'x'; return [VF(fx, fy, 0.6, axis, 0.5, 0.5, '#8ab0d0'), VF(fx * 1.02, fy * 1.02, 0.6, axis, 0.04, 0.5, WOOD), VF(fx * 1.02, fy * 1.02, 0.84, axis, 0.5, 0.04, WOOD)]; }
      case 'banner': { const [fx, fy] = face(0.5); const axis = Math.abs(wd[0]) > 0 ? 'y' : 'x'; const col = o.color || '#a02020'; return [VF(fx, fy, 0.45, axis, 0.44, 0.85, col), VF(fx * 1.02, fy * 1.02, 0.85, axis, 0.2, 0.2, GOLD), B(fx, fy, 1.3, axis === 'x' ? 0.5 : 0.06, axis === 'x' ? 0.06 : 0.5, 0.05, WOOD)]; }
      case 'dragonhead': { const [fx, fy] = face(0.4); return [B(fx, fy, 0.9, 0.6, 0.5, 0.36, '#3a7a8a', '#4a8a9a'), B(fx * 1.6, fy * 1.6, 0.86, 0.3, 0.3, 0.2, '#2a5a6a'), SP(fx * 1.3 - 0.14, fy * 1.3, 1.2, 0.05, '#ffd040'), SP(fx * 1.3 + 0.14, fy * 1.3, 1.2, 0.05, '#ffd040'), B(fx * 0.8 - 0.2, fy * 0.8, 1.26, 0.06, 0.06, 0.2, '#e0d0c0'), B(fx * 0.8 + 0.2, fy * 0.8, 1.26, 0.06, 0.06, 0.2, '#e0d0c0')]; }
      case 'web': { const [fx, fy] = face(0.46); const axis = Math.abs(wd[0]) > 0 ? 'y' : 'x'; return [VF(fx, fy, 0.7, axis, 0.7, 0.6, 'rgba(230,230,240,.35)')]; }
      case 'bones': return [FL(0, 0, 0.004, 0.6, 0.4, '#e8e0d0', 0.9), B(-0.12, -0.05, 0.02, 0.2, 0.18, 0.16, '#e8e0d0', '#f2ece0'), B(0.14, 0.08, 0.02, 0.3, 0.05, 0.05, '#d8d0c0')];
      case 'entrance': {
        const k = o.kind || 'cave';
        if (k === 'cave') return [B(0, 0.1, 0, 1.5, 0.9, 1.1, '#5a5a60', '#6a6a70'), B(0, 0, 1.1, 1.1, 0.7, 0.4, '#5a5a60', '#6a6a70'), B(-0.7, 0.3, 0, 0.5, 0.5, 0.6, '#4a4a50'), B(0.7, 0.3, 0, 0.5, 0.5, 0.7, '#4a4a50'), VF(0, 0.56, 0.02, 'x', 0.7, 0.8, '#0a0a10')];
        if (k === 'crypt') return [B(0, 0, 0, 1.2, 1.0, 1.2, '#6a6a78', '#7a7a88'), B(0, 0, 1.2, 0.9, 0.8, 0.3, '#6a6a78', '#7a7a88'), VF(0, 0.51, 0, 'x', 0.5, 0.9, '#5a3a2a'), VF(0, 0.52, 0.45, 'x', 0.08, 0.08, METAL), B(0, 0, 1.5, 0.08, 0.08, 0.3, '#c0c0c0'), B(0, 0, 1.68, 0.26, 0.08, 0.06, '#c0c0c0')];
        if (k === 'fort') return [CY(-0.7, 0, 0, 0.32, 1.6, '#6a6058', '#7a7068'), CY(0.7, 0, 0, 0.32, 1.6, '#6a6058', '#7a7068'), B(0, 0, 0, 1.0, 0.8, 1.1, '#5a5048', '#6a6058'), VF(0, 0.41, 0, 'x', 0.5, 0.8, '#4a3a2a'), B(-0.7, 0, 1.6, 0.7, 0.7, 0.1, '#6a6058'), B(0.7, 0, 1.6, 0.7, 0.7, 0.1, '#6a6058'), B(0, 0, 1.1, 0.04, 0.04, 0.6, WOOD), VF(0.14, -0.02, 1.5, 'x', 0.26, 0.18, '#a02020')];
        if (k === 'mine') return [B(-0.5, 0.2, 0, 0.14, 0.14, 1.0, WOOD), B(0.5, 0.2, 0, 0.14, 0.14, 1.0, WOOD), B(0, 0.2, 1.0, 1.2, 0.16, 0.14, WOOD), B(0, -0.2, 0, 1.4, 0.6, 1.0, '#5a5a60', '#6a6a70'), VF(0, 0.12, 0, 'x', 0.8, 0.95, '#0a0a10'), B(-0.3, 0.45, 0, 0.2, 0.14, 0.1, '#c08a3a')];
        if (k === 'ruin') return [B(-0.6, 0, 0, 0.3, 0.3, 0.8, '#6a6a70'), B(0.55, -0.1, 0, 0.3, 0.3, 1.2, '#6a6a70'), B(0, -0.35, 0, 0.9, 0.3, 0.5, '#5a5a60', '#6a6a70'), VF(0, -0.19, 0, 'x', 0.5, 0.4, '#0a0a10'), B(-0.5, 0.3, 0, 0.3, 0.3, 0.22, '#3a5a3a', '#4a6a44'), B(0.3, 0.35, 0, 0.26, 0.26, 0.18, '#3a5a3a', '#4a6a44')];
        if (k === 'temple') return [B(0, 0, 0, 1.6, 1.0, 0.3, '#4a5a72', '#5a6a82'), B(0, 0, 0.3, 1.2, 0.8, 1.0, '#4a5a72', '#5a6a82'), B(0, 0, 1.3, 0.9, 0.6, 0.3, '#4a5a72', '#5a6a82'), VF(0, 0.41, 0.3, 'x', 0.5, 0.8, '#0a0a1a'), VF(0, 0.31, 1.35, 'x', 0.3, 0.3, '#c040a0'), FL(0, 0.7, 0.002, 1.8, 0.4, '#203050')];
        return [B(0, 0, 0, 1.1, 1.1, 1.2, '#5a3a2a', '#6a4a3a'), B(0, 0, 1.2, 1.4, 1.4, 0.5, '#3a6a3a', '#4a7a4a'), B(0.24, 0.16, 1.7, 0.8, 0.8, 0.36, '#4a7a4a', '#5a8a54'), VF(0, 0.56, 0, 'x', 0.5, 0.7, '#0a0a08')];
      }
      default: return null; // invisible / trigger props
    }
  };

  // Buildings: walls, gabled roof, door + windows on the south face, extras.
  P3.building = (b) => {
    const wall = b.wall || '#8a7a5a', roof = b.roof || '#8a3a2a'; const H = 1.4, RH = 0.9;
    const cx = b.x + (b.w - 1) / 2, cy = b.y + (b.h - 1) / 2;
    const out = [B(0, 0, 0, b.w, b.h, 0.24, sh('#6a6a74', -0.1), sh('#6a6a74', 0.1)), Object.assign(B(0, 0, 0.24, b.w, b.h, H - 0.24, wall, sh(wall, 0.1)), { tex: 'stone' })];
    out.push({ t: 'roof', x: 0, y: 0, z: H, w: b.w + 0.3, d: b.h + 0.3, rh: RH, col: roof, along: b.w >= b.h ? 'x' : 'y' });
    if (b.door !== undefined) { const dx = b.door - cx; out.push(VF(dx, b.h / 2 + 0.005, 0.02, 'x', 0.6, 0.95, '#3a2212')); out.push(VF(dx, b.h / 2 + 0.01, 0.06, 'x', 0.5, 0.85, '#5a3a1e')); out.push(VF(dx + 0.16, b.h / 2 + 0.015, 0.45, 'x', 0.06, 0.06, GOLD)); if (b.locked) out.push(VF(dx, b.h / 2 + 0.015, 0.5, 'x', 0.14, 0.14, '#e04040')); if (b.sign) { out.push(B(dx - 0.55, b.h / 2 + 0.16, 1.02, 0.5, 0.06, 0.26, '#3a2412')); out.push(VF(dx - 0.55, b.h / 2 + 0.2, 1.06, 'x', 0.42, 0.18, '#d8c8a0')); } }
    for (let i = 0; i < b.w; i += 2) { if (b.door !== undefined && b.x + i === b.door) continue; out.push(VF(b.x + i - cx, b.h / 2 + 0.005, 0.55, 'x', 0.4, 0.38, '#2a2a3a')); out.push(VF(b.x + i - cx, b.h / 2 + 0.01, 0.6, 'x', 0.3, 0.28, 'rgba(255,190,90,.9)')); }
    for (let i = 0; i < b.h; i += 2) { out.push(VF(b.w / 2 + 0.005, b.y + i - cy, 0.55, 'y', 0.4, 0.38, '#2a2a3a')); out.push(VF(b.w / 2 + 0.01, b.y + i - cy, 0.6, 'y', 0.3, 0.28, 'rgba(255,190,90,.9)')); out.push(VF(-b.w / 2 - 0.005, b.y + i - cy, 0.55, 'y', 0.4, 0.38, '#2a2a3a')); out.push(VF(-b.w / 2 - 0.01, b.y + i - cy, 0.6, 'y', 0.3, 0.28, 'rgba(255,190,90,.9)')); }
    if (b.chimney) out.push(B(b.w / 2 - 0.7, -b.h / 2 + 0.6, H, 0.4, 0.4, RH + 0.5, '#5a5a62', '#3a3a42'));
    if (b.spire) out.push({ t: 'spire', x: 0, y: 0, z: H + RH, r: 0.5, h: 1.2, col: sh(roof, -0.2) });
    if (b.banner) out.push(VF(b.w / 2 + 0.03, b.h / 2 - 1.2, 0.5, 'y', 0.4, 0.9, '#8a1a1a'));
    return { cx, cy, prims: out };
  };

  // Floor decals as 32x32 textures (blood, skull, cobweb, puddle, crack, moss)
  const decalCache = new Map();
  P3.decalTex = (kind, seed) => {
    const key = kind + ':' + (seed % 7); if (decalCache.has(key)) return decalCache.get(key);
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const h = (i) => { let v = (seed * 374761393 + i * 668265263) | 0; v = (v ^ (v >> 13)) * 1274126177; return ((v ^ (v >> 16)) >>> 0) / 4294967296; };
    if (kind === 'blood') { g.fillStyle = 'rgba(110,14,20,.85)'; for (let i = 0; i < 12; i++) { const a = h(i) * Math.PI * 2, r = h(i + 20) * 11; g.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r), 1 + Math.floor(h(i + 40) * 3), 1 + Math.floor(h(i + 60) * 3)); } g.fillRect(11, 13, 10, 6); g.fillStyle = 'rgba(150,20,30,.7)'; g.fillRect(13, 14, 4, 2); }
    else if (kind === 'skull') { g.fillStyle = '#e0d8c8'; g.fillRect(12, 12, 7, 6); g.fillRect(13, 18, 5, 2); g.fillStyle = '#1a1420'; g.fillRect(13, 14, 2, 2); g.fillRect(16, 14, 2, 2); g.fillStyle = '#c8c0b0'; g.fillRect(20, 20, 6, 2); g.fillRect(5, 21, 5, 2); g.fillRect(7, 8, 2, 6); }
    else if (kind === 'cobweb') { g.strokeStyle = 'rgba(230,230,240,.55)'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 6; i++) { g.moveTo(1, 1); g.lineTo(1 + i * 5, 26 - i * 4); } for (let r = 6; r < 26; r += 6) { g.moveTo(1, r); g.quadraticCurveTo(r * 0.6, r * 0.6, r, 1); } g.stroke(); }
    else if (kind === 'puddle') { g.fillStyle = 'rgba(40,60,90,.6)'; g.beginPath(); g.ellipse(16 + (h(1) - 0.5) * 6, 16, 11, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(160,190,230,.4)'; g.fillRect(12, 13, 5, 1); }
    else if (kind === 'crack') { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(4, 8); g.lineTo(13, 14); g.lineTo(17, 22); g.lineTo(28, 26); g.moveTo(13, 14); g.lineTo(20, 9); g.stroke(); }
    else if (kind === 'moss') { g.fillStyle = 'rgba(70,120,60,.55)'; for (let i = 0; i < 8; i++) g.fillRect(Math.floor(h(i) * 28), Math.floor(h(i + 9) * 28), 2 + Math.floor(h(i + 18) * 4), 2); }
    decalCache.set(key, c); return c;
  };
  window.Props3D = P3;
})();
