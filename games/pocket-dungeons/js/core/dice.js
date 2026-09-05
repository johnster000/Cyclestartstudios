/* Dice engine. Every random game outcome flows through here so the UI can show every roll.
   Dice.roll('2d6+3') -> {total, rolls:[..], mod, sides, expr}
   Dice.d20({mod, adv, dis, label, reroll1}) -> {total, raw, kept, rolls, nat20, nat1, adv, dis}
   Listeners (UI) subscribe with Dice.on(fn) and receive a roll record for animation + log. */
(function () {
  const listeners = [];
  const Dice = {
    rng: Math.random,
    history: [],
    on(fn) { listeners.push(fn); },
    emit(rec) { Dice.history.push(rec); if (Dice.history.length > 200) Dice.history.shift(); listeners.forEach((f) => { try { f(rec); } catch (e) { console.error(e); } }); return rec; },
    die(sides) { return 1 + Math.floor(Dice.rng() * sides); },
    parse(expr) {
      // "2d6+3", "1d8", "d20", "3d6-1", "4" ; also supports "2d6+1d4+2" via sum of terms
      const terms = String(expr).replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean);
      const out = [];
      for (const t of terms) {
        const m = t.match(/^(-?)(\d*)d(\d+)$/i);
        if (m) out.push({ n: parseInt(m[2] || '1', 10) * (m[1] ? -1 : 1), sides: parseInt(m[3], 10) });
        else out.push({ flat: parseInt(t, 10) || 0 });
      }
      return out;
    },
    // Roll a damage/heal style expression. opts: {label, kind:'dmg'|'heal'|'misc', crit:boolean (double dice), silent}
    roll(expr, opts) {
      opts = opts || {};
      const terms = Dice.parse(expr);
      const rolls = []; let total = 0, mod = 0, sides = 0;
      for (const t of terms) {
        if (t.flat !== undefined) { mod += t.flat; total += t.flat; continue; }
        const n = Math.abs(t.n) * (opts.crit ? 2 : 1); sides = sides || t.sides;
        for (let i = 0; i < n; i++) { const r = Dice.die(t.sides); rolls.push({ sides: t.sides, v: r }); total += r * U.sign(t.n); }
      }
      if (opts.min !== undefined) total = Math.max(opts.min, total);
      const rec = { type: 'roll', expr, rolls, mod, total, kind: opts.kind || 'misc', label: opts.label || '', crit: !!opts.crit };
      if (!opts.silent) Dice.emit(rec);
      return rec;
    },
    // Roll a d20 test. adv/dis cancel. reroll1 = Halfling Lucky. bonusDice like Bless (+1d4) can be passed in extra:[{expr,label}]
    d20(opts) {
      opts = opts || {};
      let adv = !!opts.adv, dis = !!opts.dis; if (adv && dis) { adv = dis = false; }
      const rolls = [Dice.die(20)];
      if (adv || dis) rolls.push(Dice.die(20));
      let kept = adv ? Math.max(...rolls) : dis ? Math.min(...rolls) : rolls[0];
      let lucky = false;
      if (kept === 1 && opts.reroll1) { const r = Dice.die(20); rolls.push(r); kept = r; lucky = true; }
      const mod = opts.mod || 0;
      let extraTotal = 0; const extras = [];
      for (const ex of (opts.extra || [])) { const r = Dice.roll(ex.expr, { silent: true }); extras.push({ label: ex.label, total: r.total }); extraTotal += r.total; }
      const total = kept + mod + extraTotal;
      const rec = { type: 'd20', label: opts.label || 'Check', rolls, kept, raw: kept, mod, extras, total, adv, dis, lucky, nat20: kept === 20, nat1: kept === 1, vs: opts.vs, kind: opts.kind || 'check', actor: opts.actor };
      if (opts.vs !== undefined) rec.success = rec.nat20 ? true : (rec.nat1 && opts.autoFail1 ? false : total >= opts.vs);
      if (!opts.silent) Dice.emit(rec);
      return rec;
    },
    // Average of an expression (for monster HP etc.)
    avg(expr) { let t = 0; for (const term of Dice.parse(expr)) t += term.flat !== undefined ? term.flat : term.n * (term.sides + 1) / 2; return Math.floor(t); },
    max(expr) { let t = 0; for (const term of Dice.parse(expr)) t += term.flat !== undefined ? term.flat : term.n * term.sides; return t; },
    // Format for the log: "d20(14) +5 = 19"
    fmt(rec) {
      if (rec.type === 'd20') {
        let s = 'd20(' + (rec.rolls.length > 1 ? rec.rolls.join('/') + '→' + rec.kept : rec.kept) + ')';
        if (rec.mod) s += ' ' + U.fmtMod(rec.mod);
        for (const e of rec.extras) s += ' +' + e.total + '(' + e.label + ')';
        s += ' = ' + rec.total;
        if (rec.vs !== undefined) s += ' vs ' + rec.vs;
        return s;
      }
      return rec.expr + ' → [' + rec.rolls.map((r) => r.v).join(',') + ']' + (rec.mod ? ' ' + U.fmtMod(rec.mod) : '') + ' = ' + rec.total;
    },
  };
  window.Dice = Dice;
})();
