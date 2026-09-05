/* Procedural pixel-art sprites. Every sprite is drawn with rectangles onto a tiny canvas (1 unit = 1 game pixel)
   and cached. Sprites return {c: canvas, w, h, ox, oy} where (ox, oy) is the anchor (feet center) inside the canvas. */
(function () {
  const cache = new Map();
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return [c, g]; };
  const hex = (c) => { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map((x) => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const rgb = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const shade = (c, f) => { const [r, g, b] = hex(c); return f < 0 ? rgb(r * (1 + f), g * (1 + f), b * (1 + f)) : rgb(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };
  const dark = (c) => shade(c, -0.45), darker = (c) => shade(c, -0.7), light = (c) => shade(c, 0.25);
  const OUT = '#14101a';
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

  function finish(c, ox, oy, scale, glow) {
    let out = c;
    if (glow) { const [c2, g2] = mk(c.width + 4, c.height + 4); g2.globalAlpha = 0.35; g2.shadowColor = glow; g2.shadowBlur = 3; g2.drawImage(c, 2, 2); g2.globalAlpha = 1; g2.drawImage(c, 2, 2); out = c2; ox += 2; oy += 2; }
    if (scale && scale !== 1) { const w = Math.round(out.width * scale), h = Math.round(out.height * scale); const [c3, g3] = mk(w, h); g3.drawImage(out, 0, 0, w, h); return { c: c3, w, h, ox: Math.round(ox * scale), oy: Math.round(oy * scale) }; }
    return { c: out, w: out.width, h: out.height, ox, oy };
  }

  // ---------------- Humanoid ("pixel wizard" style: big floppy hat, soft square face, pointed beard, robe flaring to a
  //                  scalloped hem, stubby sleeves with fist hands, one arm raised. Three-tone cel shading + dark outline.) ----------------
  const HW = 32, HH = 40, OY = 2; // canvas size; OY leaves room above y=0 for hat tips
  function humanoid(o, frame) {
    o = o || {}; frame = frame || 0;
    const [c, g] = mk(HW, HH);
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y) + OY, Math.round(w), Math.round(h)); };
    const CL = (x, y, w, h) => g.clearRect(Math.round(x), Math.round(y) + OY, Math.round(w), Math.round(h));
    const T = (col) => ({ b: col, hi: shade(col, 0.22), sh: shade(col, -0.32), dk: shade(col, -0.55) });
    const skin = o.skin || '#e0b08a', hair = o.hair || '#3a2a1a', cloth = o.cloth || '#5a6a9a', boots = o.boots || '#3a2a1a';
    const S = T(skin), C = T(cloth), Hh = T(hair), metal = T('#a8aebc'), wood = T('#7a5a3a'), gold = '#e0c040';
    const outfit = o.outfit || 'plain', f = o.sex === 'f', fw = f ? 1 : 0, bw = f ? 4 : 5, bwb = bw + 1; const b = frame === 1 ? 1 : 0; const hunch = o.hunch ? 2 : 0; const shamble = o.shamble ? 1 : 0;
    const hat = o.hat || 'none'; const hc = T(o.hoodColor || shade(cloth, -0.25)); const hatC = T(o.hatColor || cloth);
    const faceDark = o.faceDark !== undefined ? o.faceDark : (hat === 'hood' && !!o.isMonster);
    const cx = 16, longRobe = outfit === 'robe' || outfit === 'tabard';
    const hy = 11 + b + hunch, hx = cx - 5 + shamble, hw = 10, fh = 8; // face box
    const by = 19 + b, hemY = 37; // shoulders, bottom row
    const eyeY = hy + 3;
    // ---- wings (behind everything) ----
    if (o.wings) { const wc = shade(skin, -0.4), wl = shade(skin, -0.15); P(1, by - 5, 7, 3, wc); P(0, by - 2, 8, 10, wc); P(1, by - 1, 2, 7, wl); P(3, by + 8, 3, 2, wc); P(HW - 8, by - 5, 7, 3, wc); P(HW - 8, by - 2, 8, 10, wc); P(HW - 6, by + 8, 3, 2, wc); }
    // ---- cloak behind the body (ranger) ----
    if (outfit === 'cloak') { const ck = T(o.hoodColor || shade(cloth, -0.35)); for (let y = by - 1; y <= hemY - 1; y++) { const hwid = bw + 1 + Math.floor((y - by + 1) * 4 / 18); P(cx - hwid, y, hwid * 2, 1, ck.b); P(cx - hwid, y, 1, 1, ck.hi); P(cx + hwid - 3, y, 3, 1, ck.sh); } const ch2 = bw + 5; P(cx - ch2, hemY - 1, ch2 * 2, 1, ck.dk); for (let x = cx - ch2 + ((frame + 1) % 2) * 2; x <= cx + ch2; x += 4) CL(x, hemY - 1, 1, 1); }
    // ---- body ----
    if (longRobe) {
      for (let y = by; y <= hemY; y++) { const hwid = bw + Math.floor((y - by) * 4.4 / (hemY - by)) - (f && y >= by + 4 && y <= by + 8 ? 1 : 0); P(cx - hwid, y, hwid * 2, 1, C.b); P(cx - hwid, y, 2, 1, C.hi); P(cx + hwid - 3, y, 3, 1, C.sh); }
      for (let y = hemY - 9; y <= hemY; y++) { P(cx - 4 - Math.floor((y - (hemY - 9)) / 4), y, 1, 1, C.sh); P(cx + 2 + Math.floor((y - (hemY - 9)) / 5), y, 1, 1, C.sh); if (y > hemY - 5) P(cx - 8, y, 1, 1, C.sh); }
      const hh = bw + 4; P(cx - hh, hemY - 1, hh * 2, 1, C.sh); P(cx - hh, hemY, hh * 2, 1, C.dk);
      for (let x = cx - hh + ((frame + 1) % 2) * 2; x <= cx + hh; x += 4) CL(x, hemY, 1, 1); // scalloped hem
      if (outfit === 'tabard') { const tb = T('#ece4cc'); for (let y = by; y <= hemY - 1; y++) { const w2 = 3 + Math.floor((y - by) / 9); P(cx - w2, y, w2 * 2, 1, tb.b); P(cx + w2 - 1, y, 1, 1, tb.sh); P(cx - w2, y, 1, 1, tb.hi); } P(cx - 1, by + 2, 2, 6, gold); P(cx - 3, by + 4, 6, 2, gold); P(cx - 6, by + 9, 12, 1, '#5a3a20'); P(cx - 3, hemY - 1, 6, 1, tb.sh); }
      else { P(cx - bwb, by + 8, bwb * 2, 1, o.belt || shade(cloth, -0.5)); P(cx - 1, by + 8, 2, 1, gold); }
      if (outfit === 'robe') { const st = shade(cloth, 0.5); [[cx - 5, by + 12], [cx + 4, by + 14], [cx - 2, by + 16], [cx + 5, by + 10], [cx - 7, by + 17], [cx + 1, by + 11], [cx + 6, by + 17]].forEach(([x, y]) => P(x, y, 1, 1, st)); P(cx - 2, by + 15, 1, 1, st); P(cx - 3, by + 16, 1, 1, st); P(cx - 1, by + 16, 1, 1, st); P(cx - 2, by + 17, 1, 1, st); }
      P(cx - 3, by, 6, 1, C.dk);
    } else {
      const tunicEnd = 32 + b; const bodyT = outfit === 'plate' ? metal : outfit === 'bare' ? S : C;
      for (let y = by; y <= tunicEnd; y++) { const hwid = bw + Math.floor((y - by) * 2.4 / (tunicEnd - by)) - (f && y >= by + 4 && y <= by + 8 ? 1 : 0); P(cx - hwid, y, hwid * 2, 1, bodyT.b); P(cx - hwid, y, 2, 1, bodyT.hi); P(cx + hwid - 3, y, 3, 1, bodyT.sh); }
      P(cx - bw - 2, tunicEnd, (bw + 2) * 2, 1, bodyT.dk);
      if (outfit === 'plate') { P(cx - 3, by + 2, 6, 4, metal.hi); P(cx - 1, by + 3, 2, 2, '#e8ecf4'); P(cx - bw - 3, by - 1, 4, 4, metal.b); P(cx - bw - 3, by - 1, 4, 1, metal.hi); P(cx + bw - 1, by - 1, 4, 4, metal.sh); P(cx - bwb, by + 8, bwb * 2, 2, '#4a3220'); P(cx - 1, by + 8, 2, 2, gold); P(cx - bwb, by + 10, bwb * 2, 3, metal.sh); P(cx - bwb + 1, by + 10, 4, 3, metal.b); }
      else if (outfit === 'bare') { P(cx - 1, by + 2, 2, 5, S.sh); P(cx - 5, by + 3, 2, 2, S.sh); P(cx + 3, by + 3, 2, 2, S.sh); const fur = T('#6a4a2a'); for (let y = by + 8; y <= tunicEnd; y++) P(cx - bwb, y, bwb * 2, 1, (y % 2) ? fur.b : fur.sh); P(cx - bwb, by + 8, bwb * 2, 1, '#8a6a3a'); P(cx - 1, by + 8, 2, 1, gold); }
      else if (outfit === 'hood') { P(cx - bwb, by + 8, bwb * 2, 1, '#2a2024'); P(cx - 2, by + 1, 4, 7, shade(cloth, -0.2)); P(cx - 1, by + 8, 2, 1, '#8a8a90'); P(cx - 6, by + 10, 3, 3, '#3a2a1a'); P(cx + 4, by + 10, 2, 2, '#3a2a1a'); }
      else { P(cx - bwb, by + 8, bwb * 2, 1, o.belt || '#4a3220'); P(cx - 1, by + 8, 2, 1, gold); P(cx - 1, by, 2, 4, C.dk); }
      const lift = frame === 1 ? 1 : 0; const bt = T(boots), bh = hemY - tunicEnd;
      const bootW = bwb - 1; P(cx - bwb, tunicEnd + 1 - lift, bootW, bh - lift, bt.b); P(cx + 1, tunicEnd + 1, bootW, bh, bt.b); P(cx - bwb, tunicEnd + 1 - lift, 2, bh - lift, bt.hi); P(cx + bootW - 1, tunicEnd + 1, 2, bh, bt.sh); P(cx - bwb, hemY - lift, bootW, 1, bt.dk); P(cx + 1, hemY, bootW, 1, bt.dk);
    }
    if (f && !o.wraps) { const bT = outfit === 'plate' ? metal : outfit === 'bare' ? C : longRobe || outfit === 'cloak' || outfit === 'plain' || outfit === 'hood' ? C : C; if (outfit === 'bare') { P(cx - bw, by + 1, bw * 2, 4, C.b); P(cx - bw, by + 1, 2, 4, C.hi); P(cx + bw - 2, by + 1, 2, 4, C.sh); } P(cx - 3, by + 2, 2, 1, bT.hi); P(cx + 1, by + 2, 2, 1, bT.hi); P(cx - 3, by + 4, 3, 1, bT.sh); P(cx + 1, by + 4, 2, 1, bT.sh); P(cx - 1, by + 3, 2, 1, bT.sh); }
    if (o.wraps) { const wr = shade(skin, -0.22), wl = shade(skin, 0.15); const te = longRobe ? hemY : 32 + b; for (let y = by + 1; y <= te - 1; y += 2) { const hwid = bw + Math.floor((y - by) * (longRobe ? 4.4 : 2.4) / (te - by)); P(cx - hwid + 1, y, hwid * 2 - 2, 1, wr); P(cx - hwid + 1, y, 2, 1, wl); } P(cx - 6, by + 3, 4, 1, wr); P(cx + 1, by + 7, 5, 1, wr); }
    if (o.tail) { P(cx - 13, hemY - 2, 4, 2, S.b); P(cx - 15, hemY - 4, 2, 3, S.b); P(cx - 15, hemY - 5, 1, 1, S.sh); }
    // ---- arms ----
    const armT = outfit === 'bare' ? S : outfit === 'plate' ? metal : C; const cuff = longRobe || outfit === 'cloak' ? 1 : 0;
    const lax = cx - bw - 5; // left arm hangs, fist forward
    P(lax + fw, by + 2, 4 - fw, 6, armT.b); P(lax + fw, by + 2, 1, 6, armT.hi); P(lax + 3, by + 3, 1, 5, armT.sh); P(lax + fw - cuff, by + 6, 4 - fw + cuff, 3, armT.b); P(lax + fw - cuff, by + 6, 1, 3, armT.hi);
    P(lax + fw, by + 9, 3, 3, S.b); P(lax + fw, by + 9, 1, 3, S.hi); P(lax + fw + 2, by + 10, 1, 2, S.sh);
    const rax = cx + bw + 1, wpn = o.weapon || 'none', raised = wpn !== 'none' && wpn !== 'claws'; const handY = raised ? by - 6 : by + 9;
    if (raised) { // right arm raised, holding something
      P(rax, by + 2, 4 - fw, 5, armT.b); P(rax + 3 - fw, by + 2, 1, 5, armT.sh);
      P(rax + 2, handY + 3, 4 - fw, by - handY, armT.b); P(rax + 5 - fw, handY + 3, 1, by - handY, armT.sh); P(rax + 2, handY + 3, 1, by - handY, armT.hi);
      P(rax + 1, by - 2 - cuff, 6 - fw, 3 + cuff, armT.b); P(rax + 1, by - 2 - cuff, 1, 3 + cuff, armT.hi); P(rax + 6 - fw, by - 2 - cuff, 1, 3 + cuff, armT.sh);
      P(rax + 2, handY, 4 - fw, 3, S.b); P(rax + 2, handY, 1, 3, S.hi); P(rax + 5 - fw, handY + 1, 1, 2, S.sh);
    } else { // right arm hangs at the side like the left
      P(rax, by + 2, 4 - fw, 6, armT.b); P(rax + 3 - fw, by + 2, 1, 6, armT.sh); P(rax, by + 6, 4 - fw + cuff, 3, armT.b); P(rax + 3 - fw + cuff, by + 6, 1, 3, armT.sh);
      P(rax, by + 9, 3, 3, S.b); P(rax + 2, by + 10, 1, 2, S.sh);
    }
    // ---- shield on the left arm ----
    if (o.shield) { const sc = T(o.shieldColor || '#8a3a2a'); P(1, by + 1, 7, 10, sc.b); P(2, by + 11, 5, 2, sc.b); P(3, by + 13, 3, 1, sc.b); P(1, by + 1, 7, 1, metal.hi); P(2, by + 2, 2, 8, sc.hi); P(6, by + 2, 1, 9, sc.sh); P(3, by + 4, 3, 4, gold); P(4, by + 5, 1, 2, sc.b); }
    // ---- weapon in the raised hand ----
    const wx = rax + 3, wy = handY;
    const shaft = (top, bot, col) => { P(wx - 1, top, 2, bot - top, col.b); P(wx - 1, top, 1, bot - top, col.hi); };
    switch (wpn) {
      case 'sword': shaft(wy - 12, wy, metal); P(wx - 1, wy - 13, 1, 1, metal.hi); P(wx - 3, wy - 1, 6, 1, gold); P(wx - 1, wy + 3, 2, 4, wood.b); P(wx - 1, wy + 7, 2, 1, gold); break;
      case 'greatsword': P(wx - 2, wy - 15, 4, 15, metal.b); P(wx - 1, wy - 15, 1, 15, metal.hi); P(wx + 1, wy - 14, 1, 14, metal.sh); P(wx - 1, wy - 16, 2, 1, metal.hi); P(wx - 4, wy - 1, 8, 1, gold); P(wx - 1, wy + 3, 2, 5, wood.b); P(wx - 1, wy + 8, 2, 1, gold); break;
      case 'shortsword': case 'scimitar': shaft(wy - 8, wy, metal); if (wpn === 'scimitar') { P(wx, wy - 10, 2, 2, metal.b); P(wx + 1, wy - 11, 1, 1, metal.hi); } P(wx - 2, wy - 1, 4, 1, gold); P(wx - 1, wy + 3, 2, 3, wood.b); break;
      case 'rapier': P(wx, wy - 13, 1, 13, metal.hi); P(wx - 2, wy - 1, 5, 1, gold); P(wx - 1, wy - 3, 1, 2, gold); P(wx, wy + 3, 1, 3, wood.b); break;
      case 'dagger': shaft(wy - 6, wy, metal); P(wx - 2, wy - 1, 4, 1, gold); P(wx - 1, wy + 3, 2, 2, wood.b); break;
      case 'axe': shaft(wy - 11, wy + 8, wood); P(wx + 1, wy - 11, 4, 6, metal.b); P(wx + 5, wy - 10, 1, 4, metal.b); P(wx + 1, wy - 11, 4, 1, metal.hi); P(wx + 4, wy - 6, 1, 1, metal.sh); break;
      case 'greataxe': shaft(wy - 13, wy + 9, wood); P(wx + 1, wy - 14, 4, 8, metal.b); P(wx - 5, wy - 14, 4, 8, metal.b); P(wx + 4, wy - 13, 1, 6, metal.hi); P(wx - 5, wy - 13, 1, 6, metal.sh); P(wx - 5, wy - 14, 10, 1, metal.hi); break;
      case 'mace': shaft(wy - 9, wy + 7, wood); P(wx - 2, wy - 13, 4, 4, metal.sh); P(wx - 1, wy - 14, 2, 1, metal.sh); P(wx - 3, wy - 12, 1, 2, metal.sh); P(wx + 2, wy - 12, 1, 2, metal.sh); P(wx - 2, wy - 13, 1, 1, metal.hi); break;
      case 'hammer': shaft(wy - 11, wy + 8, wood); P(wx - 3, wy - 14, 7, 4, metal.sh); P(wx - 3, wy - 14, 7, 1, metal.hi); P(wx + 3, wy - 13, 1, 3, metal.dk); break;
      case 'club': shaft(wy - 8, wy + 7, wood); P(wx - 2, wy - 12, 4, 5, wood.sh); P(wx - 1, wy - 13, 2, 1, wood.sh); P(wx - 1, wy - 11, 1, 3, wood.b); break;
      case 'staff': { const gem = o.gem || '#60c0ff'; shaft(wy - 10, wy + 14, wood); P(wx - 2, wy - 14, 4, 4, gem); P(wx - 1, wy - 15, 2, 1, gem); P(wx - 1, wy - 10, 2, 1, gem); P(wx - 1, wy - 13, 1, 1, '#ffffff'); P(wx - 4, wy - 12, 1, 1, shade(gem, 0.4)); P(wx + 3, wy - 12, 1, 1, shade(gem, 0.4)); P(wx, wy - 17, 1, 1, shade(gem, 0.4)); break; }
      case 'spear': shaft(wy - 11, wy + 14, wood); P(wx - 1, wy - 15, 2, 4, metal.b); P(wx - 2, wy - 13, 4, 1, metal.b); P(wx - 1, wy - 16, 1, 1, metal.hi); break;
      case 'bow': P(wx + 1, wy - 10, 2, 18, wood.b); P(wx, wy - 11, 1, 2, wood.b); P(wx, wy + 7, 1, 2, wood.b); P(wx + 3, wy - 10, 1, 18, '#e8e8d8'); P(wx + 1, wy - 10, 1, 8, wood.hi); break;
      case 'crossbow': P(wx - 4, wy - 3, 9, 2, wood.b); P(wx - 1, wy - 6, 2, 6, wood.b); P(wx - 3, wy - 6, 7, 1, metal.b); P(wx - 4, wy - 5, 1, 3, metal.b); P(wx + 4, wy - 5, 1, 3, metal.b); break;
      case 'claws': P(lax + fw - 1, by + 12, 1, 3, '#f4f0e0'); P(lax + fw + 1, by + 12, 1, 3, '#f4f0e0'); P(rax, by + 12, 1, 3, '#f4f0e0'); P(rax + 2, by + 12, 1, 3, '#f4f0e0'); break;
      default: break;
    }
    // ---- neck & face ----
    P(hx + 3, hy + fh, 4, 1, S.sh);
    P(hx, hy, hw, fh, S.b); CL(hx, hy, 1, 1); CL(hx + hw - 1, hy, 1, 1); CL(hx, hy + fh - 1, 1, 1); CL(hx + hw - 1, hy + fh - 1, 1, 1);
    P(hx + 1, hy + 1, 2, 3, S.hi); P(hx + hw - 2, hy + 1, 1, fh - 2, S.sh); P(hx + 1, hy + fh - 1, hw - 2, 1, S.sh);
    if (faceDark) { P(hx, hy, hw, fh, '#1a1018'); CL(hx, hy, 1, 1); CL(hx + hw - 1, hy, 1, 1); CL(hx, hy + fh - 1, 1, 1); CL(hx + hw - 1, hy + fh - 1, 1, 1); }
    const eyeCol = o.glowEyes || (faceDark ? '#ff9a30' : (o.eyes || '#20141c'));
    P(hx + 2, eyeY, 2, 2, eyeCol); P(hx + hw - 4, eyeY, 2, 2, eyeCol);
    if (o.wraps) { const wr = shade(skin, -0.22); P(hx, hy + 1, hw, 1, wr); P(hx, hy + 6, hw, 1, wr); P(hx + 1, hy - 2, hw - 2, 3, S.b); P(hx, hy - 1, hw, 1, wr); P(hx + 3, hy + 4, 4, 1, wr); }
    if (o.tusks) { P(hx + 2, hy + fh - 1, 1, 2, '#f4f0e0'); P(hx + hw - 3, hy + fh - 1, 1, 2, '#f4f0e0'); }
    if (!o.beard && !o.wraps && !faceDark) P(hx + 4, hy + fh - 2, 2, 1, f ? '#c0607a' : S.sh);
    if (f && !faceDark) { P(hx + 1, eyeY, 1, 1, eyeCol); P(hx + hw - 2, eyeY, 1, 1, eyeCol); CL(hx, hy + fh - 2, 1, 1); CL(hx + hw - 1, hy + fh - 2, 1, 1); P(hx + 1, hy + fh - 1, 1, 1, S.sh); P(hx + hw - 2, hy + fh - 1, 1, 1, S.sh); }
    if (o.ears) { P(hx - 3, hy + 2, 3, 2, S.b); P(hx - 4, hy + 1, 1, 2, S.b); P(hx + hw, hy + 2, 3, 2, S.b); P(hx + hw + 3, hy + 1, 1, 2, S.sh); }
    if (o.beard) { const rows = [10, 10, 8, 6, 4, 2]; rows.forEach((w2, i) => P(hx + (hw - w2) / 2, hy + fh - 2 + i, w2, 1, i >= 4 ? Hh.sh : Hh.b)); P(hx + 1, hy + fh - 1, 2, 3, Hh.hi); P(hx + 3, hy + fh - 2, 4, 1, Hh.sh); P(hx + hw - 2, hy + fh - 1, 1, 3, Hh.sh); }
    // ---- hair ----
    const hs = o.hairStyle || (f ? 'long' : 'short');
    const hairTop = ['none', 'crown', 'circlet', 'horns'].includes(hat) && !o.wraps && hs !== 'bald' && !faceDark;
    const hairSides = !['hood', 'helm', 'mitre'].includes(hat) && !o.wraps && hs !== 'bald' && !faceDark;
    if (hairTop) {
      P(hx - 1, hy - 3, hw + 2, 3, Hh.b); P(hx, hy - 4, hw, 1, Hh.b); P(hx - 1, hy, hw + 2, 1, Hh.b); P(hx + 1, hy - 3, 2, 1, Hh.hi); P(hx, hy - 2, 1, 1, Hh.hi); P(hx + hw - 2, hy - 3, 3, 4, Hh.sh);
      P(hx, hy + 1, 1, 1, Hh.b); P(hx + 3, hy + 1, 2, 1, Hh.b); P(hx + hw - 1, hy + 1, 1, 1, Hh.sh);
      if (hs === 'mohawk') { CL(hx - 1, hy - 4, hw + 2, 4); P(hx + 3, hy - 8, 4, 9, Hh.b); P(hx + 3, hy - 8, 1, 8, Hh.hi); P(hx + 6, hy - 7, 1, 7, Hh.sh); }
      if (hs === 'bun') { P(hx + 2, hy - 7, 6, 3, Hh.b); P(hx + 3, hy - 7, 2, 1, Hh.hi); P(hx + 7, hy - 6, 1, 2, Hh.sh); }
      if (hs === 'spiky') { P(hx - 1, hy - 6, 2, 2, Hh.b); P(hx + 3, hy - 7, 2, 3, Hh.b); P(hx + 7, hy - 6, 2, 2, Hh.b); P(hx + hw, hy - 5, 1, 2, Hh.sh); P(hx + 3, hy - 7, 1, 2, Hh.hi); }
      if (hs === 'curly') { P(hx - 2, hy - 4, hw + 4, 6, Hh.b); P(hx - 3, hy - 1, 1, 5, Hh.b); P(hx + hw + 2, hy - 1, 1, 5, Hh.sh); P(hx - 1, hy - 5, hw + 2, 1, Hh.b); P(hx, hy - 4, 3, 1, Hh.hi); P(hx + 5, hy - 5, 2, 1, Hh.hi); P(hx + hw - 1, hy - 4, 3, 5, Hh.sh); }
    }
    if (hairSides) {
      if (hs === 'long' || hs === 'curly') { P(hx - 2, hy, 2, 12, Hh.b); P(hx + hw, hy, 2, 12, Hh.sh); P(hx - 2, hy + 1, 1, 6, Hh.hi); P(hx - 3, hy + 10, 3, 3, Hh.b); P(hx + hw, hy + 10, 3, 3, Hh.sh); }
      if (hs === 'ponytail') { P(hx + hw, hy - 1, 2, 3, Hh.b); P(hx + hw + 1, hy + 1, 2, 10, Hh.b); P(hx + hw + 1, hy + 2, 1, 5, Hh.hi); P(hx + hw + 2, hy + 7, 1, 4, Hh.sh); }
      if (hs === 'short' && hat === 'none') { P(hx - 1, hy + 1, 1, 3, Hh.b); P(hx + hw, hy + 1, 1, 3, Hh.sh); }
    }
    // ---- hats ----
    if (hat === 'wizard') {
      const brimY = hy - 2;
      P(hx - 5, brimY, hw + 10, 1, hatC.b); P(hx - 5, brimY + 1, hw + 10, 1, hatC.sh); P(hx - 4, brimY, 4, 1, hatC.hi); P(hx + hw + 1, brimY, 4, 2, hatC.sh); P(hx - 5, brimY + 1, 1, 1, hatC.dk); P(hx + hw + 4, brimY + 1, 1, 1, hatC.dk);
      for (let i = 1; i <= 7; i++) { const y = brimY - i; const hwid = Math.max(1, Math.round(6.5 - i * 0.85)); const ccx = cx + Math.round(i * 0.35); P(ccx - hwid, y, hwid * 2, 1, hatC.b); P(ccx - hwid, y, 1, 1, hatC.hi); P(ccx + hwid - 2, y, 2, 1, hatC.sh); }
      P(cx + 3, brimY - 8, 3, 1, hatC.b); P(cx + 5, brimY - 9, 3, 1, hatC.b); P(cx + 8, brimY - 9, 1, 1, hatC.sh); P(cx + 8, brimY - 8, 1, 1, hatC.sh); P(cx + 9, brimY - 7, 1, 1, hatC.dk);
      P(cx - 6, brimY - 1, 12, 1, hatC.dk); P(cx + 2, brimY - 1, 2, 1, gold);
      if (outfit === 'robe') { const st = shade(hatC.b, 0.5); P(cx - 2, brimY - 4, 1, 1, st); P(cx + 2, brimY - 6, 1, 1, st); P(cx - 3, brimY - 3, 1, 1, st); }
    }
    if (hat === 'hood') {
      P(hx - 2, hy - 3, hw + 4, 4, hc.b); P(hx - 1, hy - 4, hw + 2, 1, hc.b); P(hx, hy - 5, hw - 2, 1, hc.b);
      P(hx - 3, hy - 1, 3, fh + 4, hc.b); P(hx + hw, hy - 1, 3, fh + 4, hc.sh); P(hx - 4, hy + fh + 1, hw + 8, 2, hc.b); P(hx + hw - 1, hy + fh + 1, 5, 2, hc.sh);
      P(hx - 2, hy - 3, 3, 1, hc.hi); P(hx - 2, hy - 2, 1, fh + 3, hc.hi); P(hx + hw - 1, hy - 3, 3, 1, hc.sh);
      P(hx, hy, hw, 1, hc.dk); P(hx - 1, hy + 1, 1, fh - 1, hc.dk); P(hx + hw, hy + 1, 1, fh - 1, hc.dk);
      P(hx + 2, hy - 6, 3, 1, hc.b); P(hx + 4, hy - 7, 2, 1, hc.sh); P(hx + 6, hy - 6, 1, 1, hc.sh);
      P(hx + 2, eyeY, 2, 2, eyeCol); P(hx + hw - 4, eyeY, 2, 2, eyeCol);
    }
    if (hat === 'helm') { P(hx - 2, hy - 3, hw + 4, 5, metal.b); P(hx - 1, hy - 4, hw + 2, 1, metal.hi); P(hx, hy - 5, hw - 2, 1, metal.hi); P(hx - 2, hy + 2, 2, fh - 2, metal.b); P(hx + hw, hy + 2, 2, fh - 2, metal.sh); P(hx + hw - 2, hy - 3, 4, 5, metal.sh); P(hx + 4, hy + 2, 2, 5, metal.b); P(hx - 1, hy - 3, 3, 1, '#e8ecf4'); P(hx + 3, hy - 8, 4, 4, o.plume || '#a02020'); P(hx + 4, hy - 9, 2, 1, o.plume || '#a02020'); P(hx + 5, hy - 7, 1, 3, shade(o.plume || '#a02020', -0.3)); }
    if (hat === 'cap') { const cc = T(o.hatColor || '#6a4a2a'); P(hx - 1, hy - 3, hw + 2, 3, cc.b); P(hx, hy - 4, hw - 2, 1, cc.b); P(hx + hw + 1, hy - 1, 3, 1, cc.sh); P(hx, hy - 3, 3, 1, cc.hi); P(hx + hw - 2, hy - 3, 3, 3, cc.sh); }
    if (hat === 'crown' || o.crown) { P(hx, hy - 3, hw, 2, gold); P(hx, hy - 5, 2, 2, gold); P(hx + 4, hy - 5, 2, 2, gold); P(hx + hw - 2, hy - 5, 2, 2, gold); P(hx + 4, hy - 3, 2, 1, '#e04040'); P(hx + 1, hy - 3, 1, 1, '#f8f0a0'); P(hx + hw - 1, hy - 3, 1, 2, shade(gold, -0.35)); }
    if (hat === 'circlet') { P(hx, hy + 1, hw, 1, gold); P(hx + 4, hy, 2, 2, '#40c0e0'); }
    if (hat === 'mitre') { const mc = T(o.hatColor || '#ece4ec'); P(hx, hy - 9, hw, 9, mc.b); P(hx + 2, hy - 11, hw - 4, 2, mc.b); P(hx + 4, hy - 10, 2, 9, '#c040a0'); P(hx + 1, hy - 8, 1, 7, mc.hi); P(hx + hw - 2, hy - 8, 2, 8, mc.sh); }
    if (hat === 'bandana') { const bc = T(o.hatColor || '#c03030'); P(hx - 1, hy - 2, hw + 2, 3, bc.b); P(hx, hy - 3, hw, 1, bc.b); P(hx + hw + 1, hy, 3, 2, bc.b); P(hx + hw + 2, hy + 2, 2, 3, bc.sh); P(hx, hy - 2, 4, 1, bc.hi); P(hx + hw - 2, hy - 2, 3, 3, bc.sh); }
    if (o.horns || hat === 'horns') { const hn = T('#e8e0d0'); P(hx, hy - 3, 2, 3, hn.b); P(hx - 1, hy - 5, 2, 2, hn.b); P(hx - 2, hy - 6, 1, 1, hn.sh); P(hx + hw - 2, hy - 3, 2, 3, hn.sh); P(hx + hw - 1, hy - 5, 2, 2, hn.sh); P(hx + hw + 1, hy - 6, 1, 1, hn.sh); }
    if (o.twoHeads) { P(hx + hw + 1, hy - 1, 7, 7, S.b); P(hx + hw + 1, hy - 3, 7, 2, Hh.b); P(hx + hw + 2, hy + 2, 1, 2, eyeCol); P(hx + hw + 5, hy + 2, 1, 2, eyeCol); P(hx + hw + 7, hy, 1, 6, S.sh); }
    if (o.glowEyes) { P(hx + 2, eyeY, 2, 2, o.glowEyes); P(hx + hw - 4, eyeY, 2, 2, o.glowEyes); }
    shadePass(g, HW, HH, 0.3); outline(g, HW, HH);
    return finish(c, cx, HH - 1, o.scale || 1, o.glow);
  }

  // Form-shading pass (16-bit look): darken pixels toward the right/bottom of each sprite, lighten toward the top-left.
  function shadePass(g, W, H, strength) {
    strength = strength || 1; const img = g.getImageData(0, 0, W, H), d = img.data;
    let minX = W, maxX = 0, minY = H, maxY = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const cw = Math.max(1, maxX - minX), chh = Math.max(1, maxY - minY);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] === 0) continue; if (d[i] < 30 && d[i + 1] < 30 && d[i + 2] < 40) continue;
      const fx = (x - minX) / cw, fy = (y - minY) / chh; let m = 1;
      if (fx > 0.62) m -= 0.18 * strength * ((fx - 0.62) / 0.38 + 0.5); if (fy > 0.7) m -= 0.1 * strength; if (fx < 0.3 && fy < 0.45) m += 0.08 * strength;
      // right edge: darker rim
      const rightEdge = x + 1 >= W || d[i + 7] === 0; if (rightEdge && fx > 0.4) m -= 0.15 * strength;
      d[i] = Math.max(0, Math.min(255, d[i] * m)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * m)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * m)); }
    g.putImageData(img, 0, 0);
  }
  // Outline pass: dark pixel around every opaque pixel that borders transparency
  function outline(g, W, H) {
    const img = g.getImageData(0, 0, W, H), d = img.data; const src = new Uint8ClampedArray(d);
    const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : src[(y * W + x) * 4 + 3];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (a(x, y)) continue;
      if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) { const i = (y * W + x) * 4; d[i] = 20; d[i + 1] = 16; d[i + 2] = 26; d[i + 3] = 230; }
    }
    g.putImageData(img, 0, 0);
  }

  // ---------------- Monster templates ----------------
  function skeleton(o, frame) {
    const [c, g] = mk(18, 28); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const bone = o.skin || '#e8e0d0', bob = frame ? 1 : 0;
    P(6, 5 + bob, 6, 6, bone); P(7, 8 + bob, 1, 1, o.eyes || '#80ff80'); P(10, 8 + bob, 1, 1, o.eyes || '#80ff80'); P(7, 10 + bob, 4, 1, dark(bone)); P(8, 11 + bob, 1, 1, bone); P(10, 11 + bob, 1, 1, bone);
    P(8, 12 + bob, 2, 7, bone); for (let i = 0; i < 3; i++) P(6, 13 + bob + i * 2, 6, 1, bone);
    P(4, 12 + bob, 2, 1, bone); P(4, 13 + bob, 1, 5, bone); P(12, 12 + bob, 2, 1, bone); P(13, 13 + bob, 1, 5, bone);
    P(7, 19 + bob, 1, 6, bone); P(10, 19 + bob, 1, 6, bone); P(6, 25 + bob, 2, 1, bone); P(10, 25 + bob, 2, 1, bone);
    const wx = 14, wy = 17 + bob; if (o.weapon === 'bow') { P(wx + 1, wy - 8, 1, 12, '#7a5a3a'); P(wx + 2, wy - 8, 1, 12, '#e0e0d0'); } else { P(wx, wy - 6, 1, 6, '#c8ccd8'); P(wx - 1, wy - 1, 3, 1, '#c0a030'); }
    shadePass(g, 18, 28, 0.8); outline(g, 18, 28); return finish(c, 9, 27, o.scale || 1, o.glow);
  }
  function rat(o, frame) {
    const [c, g] = mk(18, 12); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const fur = o.skin || '#6a5a4a'; const b = frame ? 1 : 0;
    P(4, 4 + b, 9, 5, fur); P(3, 5 + b, 1, 3, fur); P(12, 3 + b, 4, 4, fur); P(13, 2 + b, 1, 1, '#e0a0a0'); P(15, 2 + b, 1, 1, '#e0a0a0'); P(14, 4 + b, 1, 1, o.eyes || '#ff4040'); P(16, 5 + b, 1, 1, '#f0c0c0');
    P(0, 3 + b, 4, 1, '#c09080'); P(0, 2 + b, 1, 1, '#c09080'); P(5, 9 + b, 1, 2, fur); P(8, 9 + b, 1, 2, fur); P(11, 9 + b, 1, 2, fur);
    if (o.crown) { P(12, 0 + b, 4, 1, '#e0c040'); P(12, -1 + b + 1, 1, 1, '#e0c040'); P(15, 0 + b, 1, 1, '#e0c040'); }
    shadePass(g, 18, 12, 1); outline(g, 18, 12); return finish(c, 9, 11, o.scale || 1, o.glow);
  }
  function quadruped(o, frame) {
    const [c, g] = mk(22, 16); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const fur = o.skin || '#7a7a7a', b = frame ? 1 : 0;
    P(4, 5 + b, 12, 6, fur); P(3, 6 + b, 1, 3, fur); P(14, 3 + b, 6, 5, fur); P(15, 2 + b, 1, 1, fur); P(18, 2 + b, 1, 1, fur);
    P(16, 4 + b, 1, 1, o.eyes || '#ffd040'); P(18, 4 + b, 1, 1, o.eyes || '#ffd040'); P(19, 7 + b, 1, 1, '#f0f0f0');
    if (o.beak) { P(19, 6 + b, 3, 2, '#e0c040'); P(20, 8 + b, 1, 1, '#e0c040'); }
    if (o.fire) { P(15, 7 + b, 4, 1, '#ff8020'); P(16, 8 + b, 2, 1, '#ffd040'); }
    P(0, 4 + b, 4, 1, fur); P(0, 3 + b, 1, 1, fur);
    P(5, 11 + b - (frame ? 1 : 0), 2, 4, fur); P(8, 11 + b, 2, 4, fur); P(12, 11 + b - (frame ? 1 : 0), 2, 4, fur); P(15, 10 + b, 2, 5, fur);
    P(4, 5 + b, 12, 1, light(fur)); P(4, 10 + b, 12, 1, dark(fur));
    shadePass(g, 22, 16, 1); outline(g, 22, 16); return finish(c, 11, 15, o.scale || 1, o.glow);
  }
  function spider(o, frame) {
    const [c, g] = mk(20, 14); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const sk = o.skin || '#2a2a3a', b = frame ? 1 : 0;
    P(6, 4 + b, 8, 6, sk); P(7, 3 + b, 6, 1, sk); P(13, 6 + b, 4, 4, sk); P(14, 7 + b, 1, 1, o.eyes || '#ff2020'); P(16, 7 + b, 1, 1, o.eyes || '#ff2020'); P(15, 8 + b, 1, 1, o.eyes || '#ff2020');
    P(7, 5 + b, 6, 1, light(sk)); P(9, 6 + b, 2, 2, '#c04040');
    for (let i = 0; i < 4; i++) { const yy = 6 + b + (i % 2 ? 1 : 0); P(2 + i, yy + 2 - (frame && i % 2 ? 1 : 0), 4, 1, sk); P(1 + i, yy + 3, 1, 3, sk); P(14 - i, yy + 2 - (frame && i % 2 ? 0 : 1), 4, 1, sk); P(18 - i, yy + 3, 1, 3, sk); }
    shadePass(g, 20, 14, 1); outline(g, 20, 14); return finish(c, 10, 13, o.scale || 1, o.glow);
  }
  function bat(o, frame) {
    const [c, g] = mk(22, 12); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const sk = o.skin || '#3a2a3a'; const up = frame ? 0 : 2;
    P(9, 4, 4, 5, sk); P(9, 3, 1, 1, sk); P(12, 3, 1, 1, sk); P(10, 5, 1, 1, o.eyes || '#ff8040'); P(11, 5, 1, 1, o.eyes || '#ff8040');
    P(1, 2 + up, 8, 1, sk); P(2, 3 + up, 7, 2, sk); P(4, 5 + up, 5, 1, sk); P(13, 2 + up, 8, 1, sk); P(13, 3 + up, 7, 2, sk); P(13, 5 + up, 5, 1, sk);
    shadePass(g, 22, 12, 0.8); outline(g, 22, 12); return finish(c, 11, 10, o.scale || 1, o.glow);
  }
  function swarm(o, frame) {
    const [c, g] = mk(22, 14); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const fur = o.skin || '#5a4a3a'; const pts = [[1, 6], [7, 3], [13, 5], [5, 9], [12, 9], [17, 8]];
    pts.forEach(([x, y], i) => { const b = (frame + i) % 2; P(x, y + b, 5, 3, fur); P(x + 4, y - 1 + b, 2, 2, fur); P(x + 5, y + b, 1, 1, o.eyes || '#ff4040'); P(x - 1, y + 1 + b, 1, 1, '#c09080'); });
    shadePass(g, 22, 14, 0.8); outline(g, 22, 14); return finish(c, 11, 13, o.scale || 1, o.glow);
  }
  function shadow(o, frame) {
    const [c, g] = mk(18, 28); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const sk = o.skin || '#1a1020'; const b = frame ? 1 : 0;
    g.globalAlpha = o.ghost ? 0.75 : 0.9;
    P(6, 4 + b, 6, 6, sk); P(5, 10 + b, 8, 9, sk); P(3, 11 + b, 2, 6, sk); P(13, 11 + b, 2, 6, sk);
    for (let i = 0; i < 4; i++) P(5 + i * 2, 19 + b + (i % 2) * 2, 2, 4 - (i % 2) * 2, sk);
    g.globalAlpha = 1; P(7, 7 + b, 1, 1, o.eyes || '#c0c0ff'); P(10, 7 + b, 1, 1, o.eyes || '#c0c0ff');
    if (o.crown) { P(6, 2 + b, 6, 1, '#605080'); P(6, 1 + b, 1, 1, '#605080'); P(11, 1 + b, 1, 1, '#605080'); P(8, 1 + b, 1, 1, '#605080'); }
    return finish(c, 9, 27, o.scale || 1, o.glow || (o.ghost ? '#8080ff' : null));
  }
  function mimic(o, frame) {
    const [c, g] = mk(20, 16); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const wood = o.skin || '#8a5a2a', open = frame ? 2 : 0;
    P(2, 8, 16, 7, wood); P(2, 8, 16, 1, light(wood)); P(3, 4 - open, 14, 5, wood); P(3, 4 - open, 14, 1, light(wood)); P(2, 6 - open, 1, 3, '#c0a030'); P(17, 6 - open, 1, 3, '#c0a030');
    P(4, 8 - open, 12, 1 + open, '#3a0a0a'); for (let i = 0; i < 6; i++) { P(4 + i * 2, 8 - open, 1, 1, '#f0f0e0'); P(5 + i * 2, 8, 1, 1, '#f0f0e0'); }
    P(6, 5 - open, 2, 2, o.eyes || '#ffff40'); P(12, 5 - open, 2, 2, o.eyes || '#ffff40'); P(9, 9, 2, 1, '#e04060');
    shadePass(g, 20, 16, 1); outline(g, 20, 16); return finish(c, 10, 15, o.scale || 1, o.glow);
  }
  function armor(o, frame) { return humanoid({ skin: '#1a1a24', cloth: '#9aa0b0', pants: '#8a90a0', boots: '#6a7080', hat: 'helm', outfit: 'plate', weapon: o.weapon || 'sword', shield: true, shieldColor: '#5a6070', glowEyes: o.eyes || '#80c0ff', hairStyle: 'bald', scale: o.scale || 1, glow: o.glow }, frame); }

  const TPL = { humanoid, skeleton, rat, quadruped, spider, bat, swarm, shadow, mimic, armor };

  // ---------------- Props (true isometric solids) ----------------
  // Iso axes: world +x → screen (1, .5), world +y → screen (-1, .5). P(u,v) maps a footprint offset to the screen.
  const PW = 40, PH = 56, PAX = 20, PAY = 52;
  function prop(kind, opt, frame) {
    opt = opt || {}; frame = frame || 0;
    const [c, g] = mk(PW, PH); const ax = PAX, ay = PAY; let ox = ax, oy = ay;
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const wood = opt.wood || '#7a5a3a', stone = opt.stone || '#6e6a78', metal = '#b0b4c0';
    // crisp scanline polygon fill
    const poly = (pts, col) => { g.fillStyle = col; let minY = Infinity, maxY = -Infinity; for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); } for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) { const yc = y + 0.5; const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } xs.sort((p, q) => p - q); for (let i = 0; i + 1 < xs.length; i += 2) { const x0 = Math.round(xs[i]), x1 = Math.round(xs[i + 1]); if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1); } } };
    const pt = (cx, by, u, v, h) => [cx + u - v, by + (u + v) / 2 - (h || 0)];
    // box: half-extents hw (along x), hd (along y), height h; base centre (cx, by)
    const box = (cx, by, hw, hd, h, col, o2) => { o2 = o2 || {}; const top = shade(col, o2.topShade !== undefined ? o2.topShade : 0.22), lf = shade(col, -0.12), rt = shade(col, -0.42);
      poly([pt(cx, by, -hw, hd), pt(cx, by, hw, hd), pt(cx, by, hw, hd, h), pt(cx, by, -hw, hd, h)], lf);
      poly([pt(cx, by, hw, -hd), pt(cx, by, hw, hd), pt(cx, by, hw, hd, h), pt(cx, by, hw, -hd, h)], rt);
      if (!o2.noTop) poly([pt(cx, by, -hw, -hd, h), pt(cx, by, hw, -hd, h), pt(cx, by, hw, hd, h), pt(cx, by, -hw, hd, h)], top);
      // edge highlights / shadows
      const e1 = pt(cx, by, -hw, hd, h), e2 = pt(cx, by, hw, hd, h), e3 = pt(cx, by, hw, -hd, h); g.fillStyle = shade(col, 0.45); for (const [a, b] of [[e1, e2], [e2, e3]]) { const n = Math.max(1, Math.abs(b[0] - a[0])); for (let i = 0; i <= n; i++) g.fillRect(Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), 1, 1); }
      g.fillStyle = shade(col, -0.6); g.fillRect(Math.round(e2[0]), Math.round(e2[1]), 1, h); };
    // cylinder: radius r, height h
    const cyl = (cx, by, r, h, col, o2) => { o2 = o2 || {}; for (let i = -r; i <= r; i++) { const t = (i + r) / (2 * r); const m = 0.25 - Math.abs(t - 0.3) * 0.9; const yy = by + Math.sqrt(Math.max(0, 1 - (i / r) * (i / r))) * (r / 2); P(cx + i, Math.round(yy) - h, 1, Math.round(h + (by - Math.round(yy)) + 0.5), shade(col, m)); } if (!o2.noTop) { g.fillStyle = shade(col, o2.topShade !== undefined ? o2.topShade : 0.28); g.beginPath(); g.ellipse(cx + 0.5, by - h + 0.5, r, r / 2, 0, 0, Math.PI * 2); g.fill(); } if (o2.bands) for (const b of o2.bands) { g.strokeStyle = o2.bandCol || '#3a3a44'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx + 0.5, by - h * b + 0.5, r, r / 2, 0, 0, Math.PI); g.stroke(); } };
    const flame = (x, y) => { const f = (frame + (opt.seed || 0)) % 3; P(x - 1, y - 2 - f, 3, 3 + f, '#ff8020'); P(x, y - 3 - f, 1, 2 + f, '#ffd040'); P(x - 1, y - 4 - (f === 1 ? 1 : 0), 1, 1, '#ff6010'); P(x + 1, y - 5 + (f === 2 ? 1 : 0), 1, 1, '#ff6010'); P(x, y - 1, 1, 1, '#fff8c0'); };
    const sphere = (cx, cy, r, col) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.sqrt(x * x + y * y); if (d > r + 0.3) continue; const n = (x * -0.5 + y * -0.6) / r; let m = 0.05 + n * 0.45; if (d > r - 1.2) m -= 0.25; const hx2 = -r * 0.35, hy2 = -r * 0.4; if (Math.hypot(x - hx2, y - hy2) < r * 0.28) m += 0.25; if (hash(x + cx * 7, y + cy * 13) > 0.85) m -= 0.12; P(cx + x, cy + y, 1, 1, shade(col, m)); } };
    switch (kind) {
      case 'chest': { const col = opt.color || '#8a5a2a'; box(ax, ay, 7, 5, 6, col); if (opt.open) { box(ax - 1, ay - 9, 7, 2, 4, shade(col, -0.1)); poly([pt(ax, ay, -7, -5, 6), pt(ax, ay, 7, -5, 6), pt(ax, ay, 7, 5, 6), pt(ax, ay, -7, 5, 6)], '#2a1a08'); g.fillStyle = '#ffe080'; g.fillRect(ax - 4, ay - 8, 8, 2); g.fillRect(ax - 2, ay - 10, 4, 2); } else { box(ax, ay, 7, 5, 9, col, { topShade: 0.3 }); poly([pt(ax, ay, -7, -5, 10), pt(ax, ay, 7, -5, 10), pt(ax, ay, 7, 5, 10), pt(ax, ay, -7, 5, 10)], shade(col, 0.15)); } const b1 = pt(ax, ay, -7, 5, 6), b2 = pt(ax, ay, 7, 5, 6); g.fillStyle = '#c0a030'; for (let i = 0; i <= 14; i++) g.fillRect(Math.round(b1[0] + i), Math.round(b1[1] + i / 2), 1, 1); const l = pt(ax, ay, 0, 5, 4); P(Math.round(l[0]) - 1, Math.round(l[1]) - 1, 3, 3, opt.locked ? '#e04040' : '#e0c040'); break; }
      case 'barrel': cyl(ax, ay, 6, 13, wood, { bands: [0.25, 0.75], bandCol: '#4a4a54' }); g.fillStyle = shade(wood, -0.5); g.fillRect(ax - 3, ay - 13, 1, 13); g.fillRect(ax + 2, ay - 13, 1, 13); break;
      case 'crate': box(ax, ay, 6, 6, 11, wood); { const a = pt(ax, ay, -6, 6, 11), b = pt(ax, ay, 6, 6, 11); g.fillStyle = shade(wood, -0.5); for (let k = 3; k < 11; k += 4) for (let i = 0; i <= 12; i++) g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2 + k), 1, 1); const c2 = pt(ax, ay, 6, -6, 11); for (let k = 3; k < 11; k += 4) for (let i = 0; i <= 12; i++) g.fillRect(Math.round(b[0] + i), Math.round(b[1] - i / 2 + k), 1, 1); } break;
      case 'coffin': box(ax, ay, 9, 5, 6, '#5a5a68'); { const t = pt(ax, ay, 0, 0, 6); P(Math.round(t[0]) - 1, Math.round(t[1]) - 3, 2, 6, shade('#5a5a68', -0.5)); P(Math.round(t[0]) - 3, Math.round(t[1]) - 2, 6, 2, shade('#5a5a68', -0.5)); if (opt.open) poly([pt(ax, ay, -7, -3, 6), pt(ax, ay, 7, -3, 6), pt(ax, ay, 7, 3, 6), pt(ax, ay, -7, 3, 6)], '#0c0c14'); } break;
      case 'urn': cyl(ax, ay, 4, 4, '#8a6a4a'); cyl(ax, ay - 4, 6, 7, '#a07a50'); cyl(ax, ay - 11, 3, 3, '#8a6a4a'); g.strokeStyle = '#c040a0'; g.beginPath(); g.ellipse(ax + 0.5, ay - 7.5, 6, 3, 0, 0, Math.PI); g.stroke(); break;
      case 'cart': box(ax, ay - 3, 9, 6, 7, wood); poly([pt(ax, ay - 3, -8, -5, 7), pt(ax, ay - 3, 8, -5, 7), pt(ax, ay - 3, 8, 5, 7), pt(ax, ay - 3, -8, 5, 7)], '#c08a3a'); g.fillStyle = '#3a3a3a'; g.beginPath(); g.ellipse(ax - 6, ay - 2, 2, 3, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(ax + 7, ay - 1, 2, 3, 0, 0, Math.PI * 2); g.fill(); break;
      case 'pillar': box(ax, ay, 6, 6, 2, stone); cyl(ax, ay - 2, 4, 30, stone, { noTop: true }); box(ax, ay - 33, 6, 6, 2, stone); break;
      case 'pillarBroken': box(ax, ay, 6, 6, 2, stone); cyl(ax, ay - 2, 4, 12, stone, { noTop: true }); P(ax - 4, ay - 16, 3, 3, stone); P(ax, ay - 15, 4, 2, stone); P(ax - 1, ay - 17, 2, 1, stone); break;
      case 'statue': { box(ax, ay, 8, 6, 5, stone); const s = humanoid({ skin: stone, hair: stone, cloth: stone, pants: stone, boots: dark(stone), hairStyle: 'short', weapon: opt.weapon || 'sword', hat: opt.hat || 'none', outfit: 'plain', eyes: dark(stone), belt: shade(stone, -0.3) }); g.drawImage(s.c, ax - s.ox, ay - 5 - s.oy); break; }
      case 'altar': box(ax, ay, 9, 6, 8, stone); poly([pt(ax, ay, -9, -6, 8), pt(ax, ay, 9, -6, 8), pt(ax, ay, 9, 6, 8), pt(ax, ay, -9, 6, 8)], opt.spiral ? '#4a2040' : '#6a1a1a'); { const l = pt(ax, ay, -6, -3, 8), r = pt(ax, ay, 6, 3, 8); P(Math.round(l[0]), Math.round(l[1]) - 4, 1, 4, '#f0e0c0'); flame(Math.round(l[0]), Math.round(l[1]) - 4); P(Math.round(r[0]), Math.round(r[1]) - 4, 1, 4, '#f0e0c0'); flame(Math.round(r[0]), Math.round(r[1]) - 4); if (opt.spiral) { const t = pt(ax, ay, 0, 0, 8); P(Math.round(t[0]) - 2, Math.round(t[1]) - 1, 4, 2, '#c040a0'); } } break;
      case 'table': { for (const [u, v] of [[-7, -4], [7, -4], [7, 4], [-7, 4]]) { const p = pt(ax, ay, u, v); P(Math.round(p[0]) - 1, Math.round(p[1]) - 8, 2, 8, shade(wood, -0.3)); } box(ax, ay - 8, 9, 6, 2, wood); if (opt.items) { const a = pt(ax, ay - 8, -3, 0, 2), b2 = pt(ax, ay - 8, 4, 1, 2); cyl(Math.round(a[0]), Math.round(a[1]), 2, 3, '#c0c0c0'); P(Math.round(b2[0]) - 1, Math.round(b2[1]) - 3, 3, 3, '#e0c040'); } break; }
      case 'stool': cyl(ax, ay - 4, 3, 2, wood); P(ax - 2, ay - 4, 1, 4, shade(wood, -0.3)); P(ax + 2, ay - 4, 1, 4, shade(wood, -0.3)); P(ax, ay - 3, 1, 3, shade(wood, -0.4)); break;
      case 'bookshelf': box(ax, ay, 8, 4, 24, wood); { const a = pt(ax, ay, -8, 4, 24), b = pt(ax, ay, 8, 4, 24); for (let row = 0; row < 3; row++) { const yoff = 3 + row * 7; for (let i = 1; i < 16; i++) { const x = Math.round(a[0] + i), y = Math.round(a[1] + i / 2 + yoff); P(x, y, 1, 5, '#1a1410'); if (i % 2) P(x, y + (i % 3 === 0 ? 1 : 0), 1, 5 - (i % 3 === 0 ? 1 : 0), ['#a04040', '#4060a0', '#40a060', '#c0a030', '#805090', '#c06030'][(i + row) % 6]); } for (let i = 0; i <= 16; i++) g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2 + yoff + 5), 1, 1); } } break;
      case 'brazier': cyl(ax, ay, 3, 2, '#4a4a54'); P(ax, ay - 7, 1, 5, '#4a4a54'); cyl(ax, ay - 7, 5, 3, '#4a4a54', { topShade: -0.6 }); flame(ax, ay - 10); flame(ax - 2, ay - 9); flame(ax + 2, ay - 9); break;
      case 'torch': P(ax - 1, ay - 16, 2, 8, wood); P(ax - 2, ay - 17, 4, 2, '#3a3a3a'); flame(ax, ay - 17); break;
      case 'campfire': for (const [u, v, r] of [[-5, 2, 0.3], [5, 2, -0.2], [0, -5, 0]]) { const p = pt(ax, ay, u, v); P(Math.round(p[0]) - 3, Math.round(p[1]) - 2, 6, 2, shade('#5a4a3a', r)); } P(ax - 4, ay - 4, 8, 2, '#4a3a2a'); if (opt.lit !== false) { flame(ax, ay - 5); flame(ax - 3, ay - 4); flame(ax + 3, ay - 4); } break;
      case 'lever': box(ax, ay, 4, 4, 5, '#5a5a64'); if (opt.on) { P(ax, ay - 12, 1, 7, metal); P(ax + 1, ay - 13, 2, 2, '#e04040'); } else { P(ax - 4, ay - 10, 1, 4, metal); P(ax - 3, ay - 8, 2, 1, metal); P(ax - 6, ay - 12, 2, 2, '#e04040'); } break;
      case 'cage': { box(ax, ay, 7, 7, 1, '#6a6a74'); const a = pt(ax, ay, -7, 7), b = pt(ax, ay, 7, 7), c2 = pt(ax, ay, 7, -7), d = pt(ax, ay, -7, -7); for (const p of [a, b, c2, d]) P(Math.round(p[0]), Math.round(p[1]) - 22, 1, 22, metal); if (opt.prisoner && !opt.open) { const s = humanoid(opt.prisoner); g.drawImage(s.c, ax - s.ox, ay - 1 - s.oy); } for (const [p, q] of [[a, b], [b, c2]]) { for (let i = 3; i < 14; i += 3) { const x = Math.round(p[0] + (q[0] - p[0]) * i / 14), y = Math.round(p[1] + (q[1] - p[1]) * i / 14); if (!(opt.open && p === a && i > 4 && i < 10)) P(x, y - 22, 1, 22, shade(metal, -0.2)); } } poly([pt(ax, ay, -7, -7, 22), pt(ax, ay, 7, -7, 22), pt(ax, ay, 7, 7, 22), pt(ax, ay, -7, 7, 22)], 'rgba(120,124,140,.6)'); break; }
      case 'grave': box(ax, ay, 4, 1, 12, stone); { const t = pt(ax, ay, 0, 1, 12); P(Math.round(t[0]) - 2, Math.round(t[1]) - 2, 4, 2, stone); const f = pt(ax, ay, -3, 1, 6); P(Math.round(f[0]) + 3, Math.round(f[1]), 1, 3, shade(stone, -0.5)); P(Math.round(f[0]) + 2, Math.round(f[1]) + 1, 3, 1, shade(stone, -0.5)); } if (opt.open) poly([pt(ax, ay, -6, 3), pt(ax, ay, 6, 3), pt(ax, ay, 6, 8), pt(ax, ay, -6, 8)], '#1a1410'); else poly([pt(ax, ay, -5, 3), pt(ax, ay, 5, 3), pt(ax, ay, 5, 7), pt(ax, ay, -5, 7)], '#4a3a28'); break;
      case 'pedestal': box(ax, ay, 5, 5, 2, stone); cyl(ax, ay - 2, 3, 9, stone); box(ax, ay - 11, 5, 5, 1, stone); if (opt.key) { P(ax - 2, ay - 17, 3, 3, '#e0c040'); P(ax, ay - 14, 1, 2, '#e0c040'); P(ax + 1, ay - 13, 1, 1, '#e0c040'); } break;
      case 'stairs': for (let i = 0; i < 4; i++) box(ax, ay, 8 - i * 2, 8 - i * 2, 1, shade(stone, -0.15 * i), { noTop: i > 0 }); poly([pt(ax, ay, -2, -2, 1), pt(ax, ay, 2, -2, 1), pt(ax, ay, 2, 2, 1), pt(ax, ay, -2, 2, 1)], '#08080e'); poly([pt(ax, ay, -8, -8, 1), pt(ax, ay, 8, -8, 1), pt(ax, ay, 8, 8, 1), pt(ax, ay, -8, 8, 1)], 'rgba(0,0,0,0)'); for (let i = 0; i < 4; i++) { poly([pt(ax, ay, -8 + i * 2, -8 + i * 2, 1 - i), pt(ax, ay, 8 - i * 2, -8 + i * 2, 1 - i), pt(ax, ay, 8 - i * 2, 8 - i * 2, 1 - i), pt(ax, ay, -8 + i * 2, 8 - i * 2, 1 - i)], shade(stone, -0.12 - 0.18 * i)); } poly([pt(ax, ay, -3, -3, -3), pt(ax, ay, 3, -3, -3), pt(ax, ay, 3, 3, -3), pt(ax, ay, -3, 3, -3)], '#06060c'); break;
      case 'trapdoor': box(ax, ay, 7, 5, 1, wood); { const a = pt(ax, ay, -7, 5, 1), b = pt(ax, ay, 7, -5, 1); g.fillStyle = shade(wood, -0.5); for (let i = 0; i <= 14; i++) g.fillRect(Math.round(a[0] + 7 + i * 0), 0, 0, 0); const m = pt(ax, ay, 0, 0, 1); P(Math.round(m[0]) + 3, Math.round(m[1]), 2, 1, metal); const l1 = pt(ax, ay, -3, -5, 1), l2 = pt(ax, ay, -3, 5, 1); for (let i = 0; i <= 10; i++) g.fillRect(Math.round(l1[0] - i), Math.round(l1[1] + i / 2), 1, 1); const r1 = pt(ax, ay, 3, -5, 1); for (let i = 0; i <= 10; i++) g.fillRect(Math.round(r1[0] - i), Math.round(r1[1] + i / 2), 1, 1); } break;
      case 'door': { const col = opt.color || '#7a5a3a'; if (opt.open) { box(ax - 6, ay - 3, 2, 1, 22, col); box(ax + 6, ay + 3, 2, 1, 22, col); } else { box(ax, ay, 6, 2, 22, col); const a = pt(ax, ay, -6, 2, 22), b = pt(ax, ay, 6, 2, 22); g.fillStyle = shade(col, -0.5); for (const k of [7, 15]) for (let i = 0; i <= 12; i++) g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2 + k), 1, 1); const h = pt(ax, ay, 3, 2, 11); P(Math.round(h[0]), Math.round(h[1]), 2, 2, opt.locked ? '#e04040' : metal); P(Math.round(a[0]) + 1, Math.round(a[1]) + 1, 1, 20, shade(col, 0.3)); } break; }
      case 'tree': { const leaf = opt.color || '#2e5a30'; cyl(ax, ay, 2, 14, '#4a3020', { noTop: true }); P(ax - 4, ay - 1, 2, 2, '#4a3020'); P(ax + 3, ay - 2, 2, 3, '#4a3020'); sphere(ax, ay - 26, 12, leaf); sphere(ax - 6, ay - 20, 7, shade(leaf, -0.05)); sphere(ax + 6, ay - 21, 7, shade(leaf, -0.1)); sphere(ax + 1, ay - 33, 6, shade(leaf, 0.06)); if (opt.autumn) { P(ax + 4, ay - 28, 3, 2, '#c07030'); P(ax - 7, ay - 21, 2, 2, '#c07030'); P(ax + 2, ay - 18, 2, 1, '#d08040'); } break; }
      case 'pine': { const leaf = opt.color || '#24482e'; cyl(ax, ay, 1, 9, '#3a2416', { noTop: true }); for (let i = 0; i < 5; i++) { const w = 4 + i * 4, y0 = ay - 36 + i * 7; poly([[ax, y0], [ax + w / 2 + 1, y0 + 8], [ax, y0 + 9]], shade(leaf, -0.35)); poly([[ax, y0], [ax - w / 2, y0 + 8], [ax, y0 + 9]], shade(leaf, 0.12)); P(ax - 1, y0 + 2, 1, 4, shade(leaf, 0.3)); } P(ax - 1, ay - 38, 2, 2, leaf); if (opt.snow) P(ax - 2, ay - 37, 4, 1, '#e8eef4'); break; }
      case 'bush': { const leaf = opt.color || '#4a8a3a'; sphere(ax, ay - 5, 6, leaf); sphere(ax - 4, ay - 3, 4, shade(leaf, -0.1)); sphere(ax + 4, ay - 3, 4, shade(leaf, 0.05)); if (opt.berries) { P(ax - 2, ay - 6, 1, 1, '#e04040'); P(ax + 3, ay - 4, 1, 1, '#e04040'); P(ax, ay - 2, 1, 1, '#e04040'); } break; }
      case 'rock': box(ax, ay, 6, 4, 4, stone, { topShade: 0.3 }); box(ax - 2, ay - 4, 3, 2, 3, shade(stone, 0.05)); P(ax + 4, ay - 3, 3, 2, shade(stone, -0.2)); break;
      case 'mushroom': P(ax - 1, ay - 4, 2, 4, '#e0d0b0'); sphere(ax, ay - 6, 3, opt.color || '#c04040'); P(ax - 1, ay - 7, 1, 1, '#f0f0e0'); P(ax + 1, ay - 6, 1, 1, '#f0f0e0'); break;
      case 'stall': { const col = opt.color || '#c04040'; box(ax, ay, 9, 5, 9, wood); for (const [u, v] of [[-9, 5], [9, 5], [9, -5], [-9, -5]]) { const p = pt(ax, ay, u, v); P(Math.round(p[0]), Math.round(p[1]) - 24, 1, 24, wood); } const t1 = pt(ax, ay, -10, -6, 24), t2 = pt(ax, ay, 10, -6, 24), t3 = pt(ax, ay, 10, 6, 21), t4 = pt(ax, ay, -10, 6, 21); poly([t1, t2, t3, t4], col); g.fillStyle = '#f0e8d8'; for (let i = 0; i < 20; i += 4) for (let k = 0; k < 9; k++) g.fillRect(Math.round(t4[0] + i + k * 0.15), Math.round(t4[1] - k * 0.35) - 4 + 0, 2, 1); { const a = pt(ax, ay, -5, 0, 9), b2 = pt(ax, ay, 3, 1, 9); P(Math.round(a[0]) - 1, Math.round(a[1]) - 3, 3, 3, '#e0a030'); P(Math.round(b2[0]) - 1, Math.round(b2[1]) - 3, 3, 3, '#40a040'); } break; }
      case 'well': cyl(ax, ay, 7, 6, stone, { topShade: -0.7 }); g.strokeStyle = shade(stone, 0.3); g.beginPath(); g.ellipse(ax + 0.5, ay - 5.5, 7, 3.5, 0, 0, Math.PI * 2); g.stroke(); P(ax - 6, ay - 22, 1, 16, wood); P(ax + 5, ay - 22, 1, 16, wood); poly([[ax - 9, ay - 21], [ax, ay - 27], [ax + 9, ay - 21], [ax + 9, ay - 19], [ax, ay - 25], [ax - 9, ay - 19]], '#8a3a2a'); poly([[ax, ay - 27], [ax + 9, ay - 21], [ax + 9, ay - 19], [ax, ay - 25]], '#6a2a1a'); P(ax - 1, ay - 21, 2, 8, '#5a5a5a'); break;
      case 'lamp': P(ax - 1, ay - 26, 2, 26, '#3a3a44'); box(ax, ay - 27, 3, 3, 5, '#3a3a44', { topShade: 0.1 }); { const f = pt(ax, ay - 27, 0, 3, 3); P(Math.round(f[0]) - 2, Math.round(f[1]) - 2, 4, 3, '#ffd060'); } cyl(ax, ay, 4, 1, '#3a3a44'); break;
      case 'signpost': P(ax - 1, ay - 20, 2, 20, wood); box(ax, ay - 20, 8, 1, 6, shade(wood, 0.2)); { const a = pt(ax, ay - 20, -7, 1, 5), b = pt(ax, ay - 20, 6, 1, 2); g.fillStyle = shade(wood, -0.5); for (let i = 0; i <= 12; i++) { g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2), 1, 1); g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2 + 2), 1, 1); } } break;
      case 'questBoard': P(ax - 8, ay - 8, 2, 8, shade(wood, -0.3)); P(ax + 6, ay - 8, 2, 8, shade(wood, -0.3)); box(ax, ay - 8, 9, 1, 18, wood); { const a = pt(ax, ay - 8, -9, 1, 18); for (const [dx, dy, w, h] of [[2, 3, 5, 6], [8, 4, 6, 7], [12, 10, 4, 5]]) { P(Math.round(a[0]) + dx, Math.round(a[1]) + dy + dx / 2, w, h, '#f0e8d0'); P(Math.round(a[0]) + dx + 1, Math.round(a[1]) + dy + dx / 2 + 2, w - 2, 1, '#a08060'); P(Math.round(a[0]) + dx + Math.floor(w / 2), Math.round(a[1]) + dy + dx / 2, 1, 1, '#e04040'); } } break;
      case 'bed': box(ax, ay, 9, 6, 5, wood); poly([pt(ax, ay, -8, -5, 6), pt(ax, ay, 8, -5, 6), pt(ax, ay, 8, 5, 6), pt(ax, ay, -8, 5, 6)], '#8a3a3a'); poly([pt(ax, ay, -8, -5, 7), pt(ax, ay, -3, -5, 7), pt(ax, ay, -3, 5, 7), pt(ax, ay, -8, 5, 7)], '#f0e8d8'); box(ax - 9, ay - 9, 1, 6, 10, wood); break;
      case 'keg': cyl(ax, ay, 6, 11, wood, { bands: [0.3, 0.7] }); P(ax + 5, ay - 6, 3, 2, '#c0a030'); break;
      case 'counter': box(ax, ay, 12, 5, 12, wood); poly([pt(ax, ay, -12, -5, 13), pt(ax, ay, 12, -5, 13), pt(ax, ay, 12, 5, 13), pt(ax, ay, -12, 5, 13)], shade(wood, 0.3)); if (opt.items) { const a = pt(ax, ay, -6, 0, 13), b2 = pt(ax, ay, 4, 0, 13); cyl(Math.round(a[0]), Math.round(a[1]), 2, 3, '#c0c0c0'); P(Math.round(b2[0]) - 1, Math.round(b2[1]) - 3, 3, 3, '#e0c040'); } break;
      case 'fireplace': box(ax, ay, 10, 5, 30, '#7a7a80'); { const a = pt(ax, ay, -10, 5, 30); g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 4; k < 30; k += 5) for (let i = 0; i <= 20; i++) g.fillRect(Math.round(a[0] + i), Math.round(a[1] + i / 2 + k), 1, 1); const o1 = pt(ax, ay, -6, 5, 14), o2 = pt(ax, ay, 6, 5, 14), o3 = pt(ax, ay, 6, 5, 0), o4 = pt(ax, ay, -6, 5, 0); poly([o1, o2, o3, o4], '#1a0a0a'); const f = pt(ax, ay, 0, 5, 3); P(Math.round(f[0]) - 5, Math.round(f[1]) - 1, 10, 2, '#3a2a1a'); flame(Math.round(f[0]), Math.round(f[1]) - 2); flame(Math.round(f[0]) - 3, Math.round(f[1]) - 1); flame(Math.round(f[0]) + 3, Math.round(f[1]) - 1); box(ax, ay - 14, 11, 6, 2, '#8a8a90'); } break;
      case 'plant': cyl(ax, ay, 4, 5, '#a07a50'); P(ax - 4, ay - 13, 3, 5, '#3a8a3a'); P(ax + 1, ay - 14, 3, 5, '#3a8a3a'); P(ax - 1, ay - 17, 2, 10, '#4a9a4a'); P(ax - 3, ay - 12, 1, 2, '#6ab060'); break;
      case 'window': P(ax - 4, ay - 24, 8, 8, '#8ab0d0'); P(ax - 4, ay - 24, 8, 1, wood); P(ax - 4, ay - 17, 8, 1, wood); P(ax - 4, ay - 24, 1, 8, wood); P(ax + 3, ay - 24, 1, 8, wood); P(ax, ay - 24, 1, 8, wood); P(ax - 4, ay - 21, 8, 1, wood); P(ax - 3, ay - 23, 2, 2, '#c8e0f0'); break;
      case 'banner': { const col = opt.color || '#a02020'; P(ax - 4, ay - 30, 8, 16, col); P(ax - 4, ay - 14, 3, 2, col); P(ax + 1, ay - 14, 3, 2, col); P(ax - 5, ay - 31, 10, 1, wood); P(ax - 2, ay - 26, 4, 4, '#e0c040'); P(ax - 4, ay - 30, 1, 16, shade(col, 0.25)); P(ax + 3, ay - 30, 1, 16, shade(col, -0.3)); break; }
      case 'dragonhead': P(ax - 10, ay - 22, 20, 10, '#3a7a8a'); P(ax - 12, ay - 18, 4, 6, '#3a7a8a'); P(ax + 8, ay - 20, 6, 4, '#3a7a8a'); P(ax - 6, ay - 26, 2, 4, '#e0d0c0'); P(ax + 3, ay - 26, 2, 4, '#e0d0c0'); P(ax - 5, ay - 19, 2, 2, '#ffd040'); P(ax + 3, ay - 19, 2, 2, '#ffd040'); P(ax - 8, ay - 14, 16, 2, '#2a5a6a'); for (let i = 0; i < 5; i++) P(ax - 7 + i * 3, ay - 13, 1, 2, '#f0f0e0'); P(ax - 9, ay - 21, 6, 3, shade('#3a7a8a', 0.2)); break;
      case 'web': g.globalAlpha = 0.6; P(ax - 8, ay - 20, 16, 1, '#e0e0e0'); P(ax, ay - 24, 1, 12, '#e0e0e0'); for (let i = -6; i <= 6; i += 3) { P(ax + i, ay - 20 + Math.abs(i), 1, 1, '#e0e0e0'); P(ax + i, ay - 20 - Math.abs(i) / 2, 1, 1, '#e0e0e0'); } g.globalAlpha = 1; break;
      case 'bones': P(ax - 6, ay - 3, 5, 1, '#e8e0d0'); P(ax + 1, ay - 2, 4, 1, '#e8e0d0'); P(ax - 2, ay - 6, 4, 3, '#e8e0d0'); P(ax - 1, ay - 5, 1, 1, '#1a1a1a'); P(ax + 1, ay - 5, 1, 1, '#1a1a1a'); P(ax - 2, ay - 6, 1, 1, '#f8f4ec'); break;
      case 'entrance': { const k = opt.kind || 'cave';
        if (k === 'cave') { box(ax, ay, 14, 8, 16, '#5a5a60', { topShade: 0.12 }); sphere(ax - 6, ay - 18, 7, '#5a5a60'); sphere(ax + 7, ay - 17, 6, '#5a5a60'); sphere(ax, ay - 22, 6, '#606068'); const o1 = pt(ax, ay, -6, 8, 13), o2 = pt(ax, ay, 6, 8, 13), o3 = pt(ax, ay, 6, 8, 0), o4 = pt(ax, ay, -6, 8, 0); poly([o1, o2, o3, o4], '#0a0a10'); }
        else if (k === 'crypt') { box(ax, ay, 12, 8, 20, '#6a6a78'); box(ax, ay - 20, 9, 6, 3, '#6a6a78'); const o1 = pt(ax, ay, -5, 8, 16), o2 = pt(ax, ay, 5, 8, 16), o3 = pt(ax, ay, 5, 8, 0), o4 = pt(ax, ay, -5, 8, 0); poly([o1, o2, o3, o4], '#1a1a24'); poly([pt(ax, ay, -4, 8, 14), pt(ax, ay, 4, 8, 14), pt(ax, ay, 4, 8, 0), pt(ax, ay, -4, 8, 0)], '#5a3a2a'); const c2 = pt(ax, ay, 0, 0, 23); P(Math.round(c2[0]) - 1, Math.round(c2[1]) - 5, 2, 5, '#c0c0c0'); P(Math.round(c2[0]) - 3, Math.round(c2[1]) - 4, 6, 1, '#c0c0c0'); }
        else if (k === 'fort') { box(ax - 10, ay + 3, 4, 4, 26, '#6a6058'); box(ax + 10, ay - 3, 4, 4, 26, '#6a6058'); box(ax, ay, 8, 6, 18, '#5a5048'); poly([pt(ax, ay, -5, 6, 14), pt(ax, ay, 5, 6, 14), pt(ax, ay, 5, 6, 0), pt(ax, ay, -5, 6, 0)], '#3a2a1a'); const b1 = pt(ax + 10, ay - 3, 0, 0, 26); P(Math.round(b1[0]) - 1, Math.round(b1[1]) - 8, 1, 8, wood); P(Math.round(b1[0]), Math.round(b1[1]) - 8, 5, 4, '#a02020'); }
        else if (k === 'mine') { box(ax - 9, ay + 3, 1, 1, 18, wood); box(ax + 9, ay - 3, 1, 1, 18, wood); box(ax, ay - 18, 10, 2, 2, wood); box(ax, ay - 2, 8, 6, 14, '#5a5a60', { noTop: false }); poly([pt(ax, ay, -6, 6, 14), pt(ax, ay, 6, 6, 14), pt(ax, ay, 6, 6, 0), pt(ax, ay, -6, 6, 0)], '#0a0a10'); P(ax - 4, ay - 8, 3, 2, '#c08a3a'); }
        else if (k === 'ruin') { cyl(ax - 10, ay + 2, 3, 14, '#6a6a70'); cyl(ax + 9, ay - 2, 3, 20, '#6a6a70'); box(ax, ay, 8, 3, 6, '#5a5a60'); poly([pt(ax, ay, -4, 3, 6), pt(ax, ay, 4, 3, 6), pt(ax, ay, 4, 3, 0), pt(ax, ay, -4, 3, 0)], '#0a0a10'); sphere(ax - 7, ay - 1, 3, '#3a5a3a'); sphere(ax + 4, ay - 1, 3, '#3a5a3a'); }
        else if (k === 'temple') { box(ax, ay, 14, 8, 20, '#4a5a72'); box(ax, ay - 20, 11, 6, 4, '#4a5a72'); poly([pt(ax, ay, -5, 8, 18), pt(ax, ay, 5, 8, 18), pt(ax, ay, 5, 8, 0), pt(ax, ay, -5, 8, 0)], '#0a0a1a'); const c2 = pt(ax, ay, 0, 0, 27); sphere(Math.round(c2[0]), Math.round(c2[1]), 3, '#c040a0'); poly([pt(ax, ay, -16, 8, -1), pt(ax, ay, 16, 8, -1), pt(ax, ay, 16, 12, -1), pt(ax, ay, -16, 12, -1)], '#203050'); }
        else if (k === 'hollow') { cyl(ax, ay, 12, 26, '#5a3a2a', { noTop: true }); poly([pt(ax, ay, -5, 12, 14), pt(ax, ay, 5, 12, 14), pt(ax, ay, 5, 12, 0), pt(ax, ay, -5, 12, 0)], '#0a0a08'); sphere(ax, ay - 34, 11, '#3a6a3a'); sphere(ax - 8, ay - 28, 6, '#356535'); sphere(ax + 8, ay - 29, 6, '#356535'); }
        break; }
      default: P(ax - 4, ay - 8, 8, 8, '#ff00ff');
    }
    if (!['web', 'entrance', 'torch', 'brazier', 'campfire', 'fireplace', 'lamp', 'window', 'rug', 'statue', 'cage'].includes(kind)) outline(g, PW, PH); else if (kind === 'entrance' || kind === 'statue' || kind === 'cage') outline(g, PW, PH);
    return { c, w: PW, h: PH, ox, oy };
  }

  // ---------------- Icons (16x16) ----------------
  function icon(name, color) {
    const [c, g] = mk(16, 16); const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const metal = '#c8ccd8', wood = '#7a5a3a', gold = '#e0c040';
    switch (name) {
      case 'sword': case 'longsword': P(7, 1, 2, 9, metal); P(7, 0, 2, 1, '#f0f0f8'); P(5, 10, 6, 1, gold); P(7, 11, 2, 4, wood); break;
      case 'shortsword': case 'scimitar': P(7, 3, 2, 7, metal); P(5, 10, 6, 1, gold); P(7, 11, 2, 3, wood); if (name === 'scimitar') P(9, 2, 1, 3, metal); break;
      case 'rapier': P(7, 0, 1, 11, '#e0e0f0'); P(5, 11, 5, 1, gold); P(7, 12, 1, 3, wood); break;
      case 'dagger': P(7, 4, 2, 6, metal); P(5, 10, 6, 1, gold); P(7, 11, 2, 3, wood); break;
      case 'greatsword': P(7, 0, 2, 11, metal); P(9, 1, 1, 9, '#f0f0f8'); P(4, 11, 8, 1, gold); P(7, 12, 2, 4, wood); break;
      case 'axe': P(7, 3, 2, 12, wood); P(9, 2, 4, 5, metal); P(13, 3, 1, 3, metal); break;
      case 'greataxe': P(7, 2, 2, 13, wood); P(9, 1, 4, 6, metal); P(3, 1, 4, 6, metal); break;
      case 'mace': P(7, 6, 2, 9, wood); P(5, 2, 6, 5, '#8a8a98'); P(7, 1, 2, 1, '#8a8a98'); break;
      case 'hammer': P(7, 5, 2, 10, wood); P(4, 1, 8, 4, '#8a8a98'); break;
      case 'club': P(7, 6, 2, 9, wood); P(5, 1, 5, 5, dark(wood)); break;
      case 'staff': P(7, 3, 2, 13, wood); P(6, 0, 4, 3, '#60c0ff'); break;
      case 'spear': P(7, 4, 2, 12, wood); P(7, 0, 2, 4, metal); P(6, 1, 4, 1, metal); break;
      case 'bow': P(4, 1, 2, 14, wood); P(6, 1, 1, 14, '#e0e0d0'); P(3, 0, 1, 1, wood); P(3, 15, 1, 1, wood); P(8, 7, 7, 1, '#e0e0d0'); P(14, 6, 1, 3, metal); break;
      case 'crossbow': P(2, 6, 12, 2, wood); P(7, 3, 2, 10, wood); P(3, 5, 10, 1, metal); break;
      case 'sling': P(3, 3, 2, 10, '#8a6a4a'); P(11, 3, 2, 10, '#8a6a4a'); P(5, 12, 6, 2, '#8a6a4a'); P(7, 10, 2, 2, '#6a6a70'); break;
      case 'armor': P(4, 2, 8, 10, color || '#9aa0b0'); P(2, 3, 2, 5, color || '#9aa0b0'); P(12, 3, 2, 5, color || '#9aa0b0'); P(6, 1, 4, 1, dark(color || '#9aa0b0')); P(5, 4, 2, 4, light(color || '#9aa0b0')); P(4, 12, 8, 2, dark(color || '#9aa0b0')); break;
      case 'shield': P(3, 2, 10, 9, color || '#8a3a2a'); P(4, 11, 8, 2, color || '#8a3a2a'); P(6, 13, 4, 2, color || '#8a3a2a'); P(3, 2, 10, 1, metal); P(7, 4, 2, 7, gold); break;
      case 'potion': case 'potionRed': case 'potionGreen': case 'potionBlue': case 'potionYellow': case 'potionOrange': case 'potionGrey': { const col = { potionRed: '#e04040', potionGreen: '#40c060', potionBlue: '#4080e0', potionYellow: '#e0c040', potionOrange: '#f08030', potionGrey: '#a0a0b0' }[name] || '#e04040'; P(6, 1, 4, 3, '#8a6a4a'); P(6, 4, 4, 2, '#c0e0f0'); P(4, 6, 8, 8, '#c0e0f0'); P(5, 8, 6, 6, col); P(5, 7, 2, 1, '#f0f8ff'); P(6, 14, 4, 1, '#c0e0f0'); break; }
      case 'berry': P(5, 6, 6, 6, '#c04080'); P(4, 7, 8, 4, '#c04080'); P(6, 7, 2, 1, '#f0a0c0'); P(7, 3, 2, 3, '#4a8a3a'); break;
      case 'food': P(3, 6, 10, 6, '#c08a4a'); P(4, 5, 8, 1, '#e0b070'); P(5, 8, 2, 1, '#8a5a2a'); P(9, 9, 2, 1, '#8a5a2a'); break;
      case 'torch': P(7, 7, 2, 8, wood); P(6, 6, 4, 2, '#3a3a3a'); P(6, 3, 4, 3, '#ff8020'); P(7, 1, 2, 2, '#ffd040'); break;
      case 'tools': P(3, 3, 1, 10, metal); P(3, 3, 3, 1, metal); P(7, 5, 1, 9, metal); P(7, 4, 2, 1, metal); P(11, 2, 2, 12, '#8a6a4a'); P(10, 12, 4, 2, metal); break;
      case 'book': P(3, 2, 10, 12, color || '#a04040'); P(4, 3, 8, 10, light(color || '#a04040')); P(3, 2, 2, 12, dark(color || '#a04040')); P(6, 6, 4, 4, gold); break;
      case 'scroll': P(3, 3, 10, 10, '#f0e8d0'); P(2, 2, 12, 2, '#e0d0b0'); P(2, 12, 12, 2, '#e0d0b0'); P(5, 6, 6, 1, '#8a6a4a'); P(5, 8, 5, 1, '#8a6a4a'); P(5, 10, 6, 1, '#8a6a4a'); break;
      case 'amulet': P(6, 1, 4, 1, gold); P(5, 2, 1, 5, gold); P(10, 2, 1, 5, gold); P(5, 7, 6, 6, color || '#e04040'); P(6, 8, 2, 2, light(color || '#e04040')); break;
      case 'ring': P(5, 4, 6, 1, gold); P(4, 5, 1, 6, gold); P(11, 5, 1, 6, gold); P(5, 11, 6, 1, gold); P(6, 2, 4, 3, color || '#40c0e0'); break;
      case 'gloves': P(4, 4, 8, 9, color || '#9aa0b0'); P(2, 6, 2, 4, color || '#9aa0b0'); P(5, 2, 1, 3, color || '#9aa0b0'); P(7, 1, 1, 4, color || '#9aa0b0'); P(9, 2, 1, 3, color || '#9aa0b0'); break;
      case 'circlet': P(3, 6, 10, 2, gold); P(3, 8, 1, 2, gold); P(12, 8, 1, 2, gold); P(7, 4, 2, 3, color || '#40c0e0'); break;
      case 'cloak': P(4, 2, 8, 2, color || '#3a5a3a'); P(3, 4, 10, 10, color || '#3a5a3a'); P(7, 2, 2, 2, gold); P(4, 5, 2, 8, light(color || '#3a5a3a')); break;
      case 'boots': P(4, 2, 4, 9, color || '#6a4a2a'); P(4, 11, 8, 3, color || '#6a4a2a'); P(4, 2, 4, 1, light(color || '#6a4a2a')); break;
      case 'wand': P(7, 2, 2, 12, wood); P(6, 1, 4, 2, '#c040ff'); P(7, 0, 2, 1, '#ffffff'); break;
      case 'd20': P(5, 1, 6, 1, gold); P(3, 2, 10, 3, gold); P(2, 5, 12, 6, gold); P(3, 11, 10, 3, gold); P(5, 14, 6, 1, gold); P(6, 6, 1, 4, '#1a1420'); P(8, 6, 2, 1, '#1a1420'); P(9, 7, 1, 1, '#1a1420'); P(8, 8, 1, 1, '#1a1420'); P(8, 9, 2, 1, '#1a1420'); break;
      case 'bag': P(4, 5, 8, 9, '#8a6a4a'); P(5, 3, 6, 2, '#6a4a2a'); P(6, 2, 4, 1, '#6a4a2a'); P(5, 8, 2, 3, light('#8a6a4a')); break;
      case 'gem': P(6, 2, 4, 2, color || '#c040a0'); P(4, 4, 8, 4, color || '#c040a0'); P(5, 8, 6, 3, color || '#c040a0'); P(7, 11, 2, 2, color || '#c040a0'); P(6, 4, 2, 2, light(color || '#c040a0')); break;
      case 'coin': P(5, 3, 6, 1, gold); P(4, 4, 8, 8, gold); P(5, 12, 6, 1, gold); P(6, 5, 2, 2, light(gold)); P(7, 6, 3, 4, dark(gold)); break;
      case 'gold': P(2, 8, 5, 5, gold); P(6, 6, 5, 5, gold); P(9, 9, 5, 5, gold); P(3, 9, 2, 1, light(gold)); P(7, 7, 2, 1, light(gold)); break;
      case 'key': P(3, 5, 5, 5, gold); P(4, 6, 3, 3, '#1a1420'); P(8, 7, 6, 1, gold); P(12, 8, 1, 2, gold); P(10, 8, 1, 1, gold); break;
      case 'spellbook': P(3, 2, 10, 12, '#4040a0'); P(6, 6, 4, 4, '#60c0ff'); break;
      default: P(4, 4, 8, 8, '#ff00ff');
    }
    return { c, w: 16, h: 16, ox: 8, oy: 16 };
  }

  const Sprites = {
    humanoid, prop, icon, shade, dark, light,
    // Build a sprite for a character object (player/companion/npc)
    characterOpts(ch) {
      const cls = ch.cls || null; const outfitByClass = { wizard: 'robe', cleric: 'tabard', rogue: 'hood', fighter: 'plate', barbarian: 'bare', ranger: 'cloak' };
      const o = { skin: ch.skin || ch.skinTone, hair: ch.hairColor || ch.hair, hairStyle: ch.hairStyle, cloth: ch.clothesColor || ch.cloth, sex: ch.sex, scale: ch.scale, beard: ch.beard, ears: ch.race === 'elf' || ch.race === 'gnome' || ch.race === 'halfling', horns: ch.race === 'tiefling' || ch.race === 'dragonborn', tusks: ch.race === 'halforc', tail: ch.race === 'tiefling' || ch.race === 'dragonborn' };
      if (ch.race === 'halfling' || ch.race === 'gnome') o.scale = (o.scale || 1) * 0.8; if (ch.race === 'dwarf') { o.scale = (o.scale || 1) * 0.88; if (ch.sex !== 'f') o.beard = true; }
      if (cls) { o.outfit = outfitByClass[cls] || 'plain'; o.hat = cls === 'wizard' ? 'wizard' : cls === 'rogue' ? 'hood' : cls === 'ranger' ? 'hood' : 'none'; if (cls === 'ranger') o.hoodColor = shade(o.cloth || '#4a7a4a', -0.3);
        // reflect actual equipment
        const eq = ch.equipment || {}; const w = getItem(eq.mainHand); o.weapon = w ? (w.icon === 'sword' ? 'sword' : w.icon) : (cls === 'barbarian' ? 'greataxe' : 'none');
        if (w && w.icon === 'axe') o.weapon = 'axe'; const ar = getItem(eq.armor); if (ar && ar.cat === 'heavy') { o.outfit = 'plate'; } else if (ar && ar.cat === 'medium' && cls !== 'cleric') { o.outfit = o.outfit === 'bare' ? 'plain' : o.outfit; }
        if (ar && ar.cat === 'heavy' && cls !== 'wizard') o.hat = o.hat === 'none' ? 'helm' : o.hat; o.shield = !!(eq.offHand && getItem(eq.offHand) && getItem(eq.offHand).type === 'shield'); }
      else Object.assign(o, ch.sprite || {});
      return o;
    },
    actor(ent, frame) {
      // ent: character (has cls) or monster (has mon) or npc (has sprite)
      let key, make;
      if (ent.mon) { const d = MONSTERS[ent.mon] || {}; const s = Object.assign({}, d.sprite || {}); if (ent.spriteOverride) Object.assign(s, ent.spriteOverride); key = 'm:' + ent.mon + ':' + JSON.stringify(ent.spriteOverride || {}) + ':' + frame; make = () => (TPL[s.tpl] || humanoid)(Object.assign({ isMonster: true }, s), frame); }
      else { const o = Sprites.characterOpts(ent); key = 'c:' + JSON.stringify(o) + ':' + frame; make = () => humanoid(o, frame); }
      let s = cache.get(key); if (!s) { s = make(); cache.set(key, s); } return s;
    },
    propCached(kind, opt, frame) { const key = 'p:' + kind + ':' + JSON.stringify(opt || {}) + ':' + (frame || 0); let s = cache.get(key); if (!s) { s = prop(kind, opt, frame); cache.set(key, s); } return s; },
    iconCached(name, color) { const key = 'i:' + name + ':' + (color || ''); let s = cache.get(key); if (!s) { s = icon(name, color); cache.set(key, s); } return s; },
    // Portrait: head/shoulders crop scaled up, as canvas element for DOM
    portraitEl(ent, size) {
      const s = Sprites.actor(ent, 0); const c = document.createElement('canvas'); c.width = 32; c.height = 40; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const sc = ent.mon ? Math.min(32 / s.w, 40 / s.h) * 0.95 : 2.0; const dw = s.w * sc, dh = s.h * sc;
      g.drawImage(s.c, (32 - dw) / 2, ent.mon ? (40 - dh) / 2 : -6, dw, dh);
      if (size) { c.style.width = size + 'px'; c.style.height = (size * 1.25) + 'px'; }
      c.style.imageRendering = 'pixelated'; return c;
    },
    spriteEl(ent, scale) { const s = Sprites.actor(ent, 0); const c = document.createElement('canvas'); c.width = s.w; c.height = s.h; c.getContext('2d').drawImage(s.c, 0, 0); c.style.width = (s.w * (scale || 3)) + 'px'; c.style.height = (s.h * (scale || 3)) + 'px'; c.style.imageRendering = 'pixelated'; return c; },
    iconEl(name, color, px) { const s = Sprites.iconCached(name, color); const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').drawImage(s.c, 0, 0); c.style.width = (px || 32) + 'px'; c.style.height = (px || 32) + 'px'; c.style.imageRendering = 'pixelated'; c.className = 'icon-canvas'; return c; },
    clearCache() { cache.clear(); },
  };
  window.Sprites = Sprites;
})();
