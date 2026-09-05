/* Turn-based combat: initiative, turn loop, movement with opportunity attacks, attacks, spells, items,
   class actions, reactions, monster AI. Uses Game (state/log) and UI (action bar) globals. */
(function () {
  const Cb = { active: false, order: [], idx: 0, round: 0, participants: new Set(), _resolve: null, selectedAction: null };
  const log = (t, k) => Game.log(t, k);
  const delay = (ms) => Game.fxDelay(ms);
  const alive = (e) => !e.dead && !e.escaped;
  const enemiesOf = (e) => (e.hostile ? Game.party.filter((p) => !p.dead) : Game.monsters.filter((m) => alive(m) && Cb.participants.has(m.id)));
  const alliesOf = (e) => (e.hostile ? Game.monsters.filter((m) => alive(m)) : Game.party.filter((p) => !p.dead));
  const adjacent = (a, b) => U.dist(a.x, a.y, b.x, b.y) <= 1;
  const dtypeColor = (t) => ({ fire: '#ff7020', cold: '#80d0ff', lightning: '#ffff60', acid: '#80ff40', poison: '#60c040', necrotic: '#a040c0', radiant: '#ffe080', force: '#c080ff', thunder: '#c0c0ff', psychic: '#ff60c0' }[t] || '#ffffff');

  Cb.start = async (initial) => {
    if (Cb.active) { initial.forEach((m) => Cb.join(m)); return; }
    Cb.active = true; Cb.round = 0; Cb.order = []; Cb.participants = new Set(); Cb.fled = []; Cb.noContact = 0;
    AudioSys.music(initial.some((m) => m.isBoss) ? 'boss' : 'combat'); AudioSys.play('alert');
    log('⚔ Combat begins! Roll for initiative.', 'crit');
    const all = Game.party.filter((p) => !p.dead).concat(initial);
    await UI.awaitThrow('initiative');
    // Only the player's own initiative is thrown in the tray; the rest roll behind the scenes so one result stays readable.
    for (const e of all) Cb.addToOrder(e, false, !e.isPlayer);
    // nearby monsters of the same groups join
    for (const m of Game.monsters) if (alive(m) && !Cb.participants.has(m.id) && initial.some((i) => i.groupId && i.groupId === m.groupId)) Cb.addToOrder(m, false, true);
    Cb.sortOrder(); Cb.idx = -1; Game.refreshHud();
    for (const p of Game.party) if (!p.dead) { p.reactionUsed = false; Game.bark(p, 'combat'); }
    await UI.waitForDice(); // nobody acts until the initiative dice have come to rest
    Cb.run();
  };
  Cb.addToOrder = (e, resort, quiet) => {
    if (Cb.participants.has(e.id)) return; Cb.participants.add(e.id);
    const feral = !e.mon && e.cls === 'barbarian' && e.level >= 7; const swift = e.mon && e.swift;
    const rec = Dice.d20({ mod: Rules.initiativeMod(e), adv: feral || swift, label: e.name + ' initiative', kind: 'init', actor: e.name, reroll1: !e.mon && Rules.raceFeat(e, 'lucky'), silent: quiet });
    e.initiative = rec.total; e.alerted = true; e.escaped = false; e.reactionUsed = false;
    if (e.mon) { const surprised = e.surprisedBy; if (surprised) e.surprised = true; }
    Cb.order.push(e); if (resort) Cb.sortOrder();
    log(e.name + ' rolls initiative: ' + Dice.fmt(rec), 'roll');
  };
  Cb.sortOrder = () => { const cur = Cb.order[Cb.idx]; Cb.order.sort((a, b) => b.initiative - a.initiative || Rules.abMod(b, 'dex') - Rules.abMod(a, 'dex')); if (cur) Cb.idx = Cb.order.indexOf(cur); };
  Cb.join = (m) => { if (!Cb.active || Cb.participants.has(m.id)) return; log(m.name + ' joins the fight!', 'warn'); Cb.addToOrder(m, true); Game.refreshHud(); };
  Cb.current = () => Cb.order[Cb.idx];
  Cb.isPlayerTurn = () => { const c = Cb.current(); return Cb.active && c && !c.mon && c.isParty; };

  Cb.run = async () => {
    while (Cb.active) {
      Cb.idx++;
      if (Cb.idx >= Cb.order.length) { Cb.idx = 0; Cb.round++; log('— Round ' + Cb.round + ' —', 'story'); Cb.checkJoiners();
        const contact = Cb.order.some((m) => m.mon && alive(m) && Game.party.some((p) => !p.dead && (U.dist(p.x, p.y, m.x, m.y) <= 2 || (Game.map.vis[m.y * Game.map.w + m.x] && World.los(Game.map, p.x, p.y, m.x, m.y))))); Cb.noContact = contact ? 0 : (Cb.noContact || 0) + 1; if (Cb.noContact >= 3) { log('The enemies have lost track of you. Combat ends.', 'miss'); for (const m of Cb.order) if (m.mon && alive(m)) { m.alerted = false; m.wantsToFlee = false; } Cb.finish(true); return; } for (const h of Game.map.hazards || []) { h.rounds--; } Game.map.hazards = (Game.map.hazards || []).filter((h) => h.rounds > 0); }
      if (Cb.round === 0) Cb.round = 1;
      const e = Cb.current(); if (!e) { Cb.finish(true); return; }
      if (!alive(e) || (e.isParty && e.dead)) continue;
      if (Cb.checkEnd()) return;
      Game.refreshHud();
      if (e.mon) { await Cb.monsterTurn(e); if (!Cb.active) return; continue; }
      // Party member
      if (e.downed) { Cb.setActive(e); await delay(300); await UI.awaitThrow(e.name + ': death save'); const rec = Rules.deathSave(e); log(e.name + ' death save: ' + Dice.fmt(rec) + (rec.revive ? ' — NATURAL 20! ' + e.name + ' springs back up with 1 HP!' : rec.died ? ' — ' + e.name + ' has died.' : rec.stable ? ' — stabilized.' : rec.success ? ' — success (' + e.deathSaves.s + '/3).' : ' — failure (' + e.deathSaves.f + '/3).'), rec.revive ? 'crit' : rec.died ? 'warn' : 'roll'); if (rec.died) { AudioSys.play('death'); Game.onCharacterDied(e); } Game.refreshHud(); await delay(600); Cb.setActive(null); if (Cb.checkEnd()) return; continue; }
      Rules.startTurn(e, log); e.reactionUsed = false;
      if (!Rules.canAct(e)) { Cb.setActive(e); log(e.name + ' cannot act (' + e.conditions.map((c) => c.id).join(', ') + ').', 'warn'); await delay(600); Rules.endTurn(e, log); Cb.setActive(null); continue; }
      Cb.hazardCheck(e); Cb.auraCheck(e);
      Cb.setActive(e); e.turn.attacksLeft = Cb.attacksPerAction(e);
      UI.turnBanner(e.name + "'s turn"); UI.showActionBar(e); Game.refreshHud();
      await new Promise((res) => { Cb._resolve = res; });
      if (!Cb.active) return;
      UI.hideActionBar(); Rules.endTurn(e, log); Cb.setActive(null); Game.refreshHud();
      if (Cb.checkEnd()) return;
    }
  };
  Cb.setActive = (e) => { for (const x of Cb.order) x.activeTurn = false; if (e) { e.activeTurn = true; Renderer.camTarget = e; } };
  Cb.endTurn = () => { const e = Cb.current(); if (e && e.turn) { Rules.removeCondition(e, 'reckless'); } Cb.selectedAction = null; Game.state.highlights = []; if (Cb._resolve) { const r = Cb._resolve; Cb._resolve = null; r(); } };
  Cb.checkJoiners = () => { for (const m of Game.monsters) { if (!alive(m) || Cb.participants.has(m.id)) continue; if (Game.party.some((p) => !p.dead && U.dist(p.x, p.y, m.x, m.y) <= 9 && World.los(Game.map, p.x, p.y, m.x, m.y))) Cb.join(m); } };
  Cb.checkEnd = () => {
    if (!Cb.active) return true;
    const foes = Cb.order.filter((e) => e.mon && alive(e)); if (!foes.length) { Cb.finish(true); return true; }
    if (Game.party.every((p) => p.dead || p.downed)) { Cb.finish(false); return true; }
    return false;
  };
  Cb.finish = (victory) => {
    Cb.active = false; if (Cb._resolve) { const r = Cb._resolve; Cb._resolve = null; r(); }
    UI.hideActionBar(); UI.turnBanner(null); Game.state.highlights = [];
    for (const e of Cb.order) { Rules.clearCombatState(e); e.activeTurn = false; }
    Cb.order = []; Cb.participants = new Set();
    Game.onCombatEnd(victory);
  };

  // ---- Movement ----
  Cb.attacksPerAction = (e) => { if (e.mon) return 1; let n = 1; if (Rules.feat(e, 'extraAttack')) n = 2; return n; };
  Cb.movementLeft = (e) => Math.max(0, Rules.speedTiles(e) * (e.turn && e.turn.dashed ? 2 : 1) - (e.turn ? e.turn.moved : 0));
  Cb.passableFor = (e) => (x, y) => World.passable(Game.map, x, y) && (!Game.entityAt(x, y) || Game.entityAt(x, y) === e);
  Cb.reachable = (e) => U.reachable(e.x, e.y, Cb.movementLeft(e), Cb.passableFor(e));
  Cb.moveAlong = async (e, path) => {
    for (const [nx, ny] of path) {
      if (!Cb.active || e.dead || e.downed) return;
      if (!e.turn) e.turn = { moved: 0 };
      const cost = World.difficult(Game.map, nx, ny) && !(e.cls === 'ranger' && e.level >= 8) ? 2 : 1;
      if (Cb.movementLeft(e) < cost) break;
      if (Game.entityAt(nx, ny) && Game.entityAt(nx, ny) !== e) break;
      const from = { x: e.x, y: e.y };
      // opportunity attacks from enemies adjacent to 'from' but not to (nx,ny)
      if (!e.turn.disengaged) for (const foe of enemiesOf(e)) { if (foe.dead || foe.downed || foe.reactionUsed || !Rules.canAct(foe) || Rules.has(foe, 'noReactions')) continue; if (U.dist(foe.x, foe.y, from.x, from.y) <= 1 && U.dist(foe.x, foe.y, nx, ny) > 1) { foe.reactionUsed = true; log(foe.name + ' makes an opportunity attack on ' + e.name + '!', 'warn'); await Cb.attack(foe, e, { free: true, opportunity: true }); if (e.dead || e.downed) return; } }
      e.x = nx; e.y = ny; e.turn.moved += cost; if (Rules.has(e, 'prone')) { Rules.removeCondition(e, 'prone'); e.turn.moved += Math.floor(Rules.speedTiles(e) / 2); }
      Game.updateVisibility(); Cb.hazardCheck(e); Cb.trapCheck(e);
      await delay(110);
    }
    Game.refreshHud();
  };
  Cb.trapCheck = (e) => { if (!e.mon) Game.stepOn(e, e.x, e.y); };
  Cb.hazardCheck = (e) => { for (const h of (Game.map.hazards || [])) { if (h.cells.some(([x, y]) => x === e.x && y === e.y) && !(h.casterTeam === e.team && h.sculpt)) { const r = Dice.roll(h.damage, { label: h.name, kind: 'dmg' }); let dmg = r.total; if (h.save) { const s = Rules.savingThrow(e, h.save, h.dc, { magic: true }); if (s.success) dmg = Math.floor(dmg / 2); } const res = Rules.applyDamage(e, dmg, h.dtype, { log }); log(e.name + ' takes ' + res.taken + ' ' + h.dtype + ' from ' + h.name + '.', 'hit'); Renderer.floatText(e.x, e.y, '-' + res.taken, dtypeColor(h.dtype)); if (res.killed && e.mon) Game.onMonsterDied(e, h.caster); } } };
  Cb.auraCheck = (e) => { // Spirit Guardians etc: enemies starting turn near a warded caster
    for (const c of Game.party.concat(Game.monsters)) { if (c === e || c.dead || c.team === e.team) continue; const sg = Rules.cond(c, 'spiritGuardians'); if (sg && U.dist(c.x, c.y, e.x, e.y) <= 3) { const r = Dice.roll(sg.damage || '3d8', { label: 'Spirit Guardians', kind: 'dmg' }); const s = Rules.savingThrow(e, 'wis', Rules.spellDC(c), { magic: true }); const dmg = s.success ? Math.floor(r.total / 2) : r.total; const res = Rules.applyDamage(e, dmg, 'radiant', { log }); log(e.name + ' is scoured by spirit guardians for ' + res.taken + '.', 'hit'); Renderer.floatText(e.x, e.y, '-' + res.taken, dtypeColor('radiant')); if (res.killed) Game.onMonsterDied(e, c); } } };

  // ---- Attacks ----
  Cb.weaponRangeTiles = (att, w) => Rules.attackRange(att, w);
  Cb.canAttack = (att, tgt, w) => { const r = Rules.attackRange(att, w); const d = U.dist(att.x, att.y, tgt.x, tgt.y); if (r.ranged) return d <= r.long && World.los(Game.map, att.x, att.y, tgt.x, tgt.y); return d <= r.normal; };
  // Resolve one attack. opts: {weapon, offhand, monsterAttack, free, opportunity}
  Cb.attack = async (att, tgt, opts) => {
    opts = opts || {}; if (tgt.dead) return null;
    const isMon = !!att.mon; let w = null, atk = null, toHit, dmgExpr, dtype, name, ranged = false, heavy = false, thrown = false, longRange = false;
    const dist = U.dist(att.x, att.y, tgt.x, tgt.y);
    if (isMon) { atk = opts.monsterAttack || att.attacks[0]; toHit = atk.hit; dmgExpr = atk.dmg; dtype = atk.type; name = atk.name; ranged = atk.range > 10; if (!ranged && dist > (atk.range >= 10 ? 2 : 1)) return null; if (ranged && dist > Math.floor(atk.range / 5)) return null; }
    else { w = opts.offhand ? Rules.offhand(att) : (opts.weapon || Rules.weapon(att)); toHit = Rules.attackBonus(att, w); dtype = w ? w.dtype : 'bludgeoning'; name = w ? w.name : 'Unarmed strike'; const r = Rules.attackRange(att, w); ranged = !!r.ranged && dist > 1; thrown = r.thrown; heavy = w && w.props.includes('heavy'); longRange = r.ranged && dist > r.normal; if (r.ranged && dist > r.long) { log('Out of range.', 'warn'); return null; } if (!r.ranged && dist > r.normal) { log('Too far away.', 'warn'); return null; } }
    const adjacentEnemy = enemiesOf(att).some((f) => f !== tgt && !f.downed && adjacent(att, f)) || (ranged && adjacent(att, tgt));
    const allyAdjacentToTarget = alliesOf(att).some((a) => a !== att && !a.downed && adjacent(a, tgt));
    const { adv, dis } = Rules.attackAdvantage(att, tgt, { ranged, adjacentEnemy, longRange, heavy: heavy && !ranged, allyAdjacentToTarget, adv: opts.adv, dis: opts.dis });
    const extra = []; if (Rules.has(att, 'bless')) extra.push({ expr: '1d4', label: 'Bless' });
    // Warding Flare (light cleric target) imposes disadvantage
    let wardDis = false; if (!tgt.mon && tgt.cls === 'cleric' && tgt.choices.domain === 'light' && tgt.resources.wardingFlare && tgt.resources.wardingFlare.used < tgt.resources.wardingFlare.max && !tgt.reactionUsed && dist <= 6) { tgt.resources.wardingFlare.used++; tgt.reactionUsed = true; wardDis = true; log(tgt.name + ' flares with warding light: ' + att.name + ' attacks at disadvantage!', 'heal'); }
    let ac = Rules.ac(tgt); if (tgt.mon && (tgt.traits || []).includes('parry') && !tgt.reactionUsed && !ranged) { ac += 2; tgt.reactionUsed = true; }
    if (!isMon) await UI.awaitThrow(att.name + ': ' + name + (opts.offhand ? ' (off-hand)' : opts.opportunity ? ' (opportunity attack)' : ''), { n: (adv && !wardDis) !== (dis || wardDis) ? 2 : 1, sides: 20, kind: 'attack' });
    const rec = Dice.d20({ mod: toHit, adv: adv && !wardDis, dis: dis || wardDis, vs: ac, label: att.name + ': ' + name, kind: 'attack', actor: att.name, reroll1: !isMon && Rules.raceFeat(att, 'lucky'), extra });
    if (!isMon && att.fateNext) { rec.kept = 20; rec.nat20 = true; rec.total = 20 + rec.mod; rec.success = true; att.fateNext = false; log('The Dice of Fate turn the roll to a natural 20!', 'crit'); }
    let crit = rec.success && rec.kept >= Rules.critRange(att); if (rec.nat1) rec.success = false;
    if (!crit && rec.success && dist <= 1 && (Rules.has(tgt, 'paralyzed') || Rules.has(tgt, 'asleep'))) crit = true;
    // Shield reaction (wizard with Shield known and a slot)
    if (rec.success && !crit && !tgt.mon && !tgt.reactionUsed && !tgt.downed && Rules.canAct(tgt) && tgt.spells && tgt.spells.known.includes('shield') && Rules.lowestSlot(tgt, 1) && rec.total < ac + 5 && !Rules.has(tgt, 'shield')) { tgt.reactionUsed = true; Rules.useSlot(tgt, Rules.lowestSlot(tgt, 1)); Rules.addCondition(tgt, 'shield', 1); log(tgt.name + ' casts Shield as a reaction! AC +5 turns the hit into a miss.', 'heal'); rec.success = false; rec.shielded = true; Renderer.ring(tgt.x, tgt.y, '#60a0ff'); }
    if (opts.opportunity && !tgt.mon && tgt.cls === 'ranger' && tgt.level >= 7 && rec.success && !rec.dis) { /* escape the horde applied via dis flag */ }
    Game.showRoll(rec);
    if (ranged || thrown) Renderer.projectile(att.x, att.y, tgt.x, tgt.y, isMon ? '#e0e0e0' : '#ffe0a0', 0.25); else { att.bump = { dx: Math.sign(tgt.x - att.x) - Math.sign(tgt.y - att.y), dy: (Math.sign(tgt.x - att.x) + Math.sign(tgt.y - att.y)) / 2, t: 0.2 }; att.facing = tgt.x - tgt.y > att.x - att.y ? 'r' : 'l'; }
    await delay(ranged ? 260 : 160);
    const advTxt = rec.adv ? ' (advantage)' : rec.dis ? ' (disadvantage)' : '';
    if (!rec.success) { log(att.name + ' attacks ' + tgt.name + ' with ' + name + ': ' + Dice.fmt(rec) + advTxt + ' — ' + (rec.nat1 ? 'NATURAL 1! Fumble!' : rec.shielded ? 'blocked by Shield!' : 'miss.'), rec.nat1 ? 'warn' : 'miss'); Renderer.floatText(tgt.x, tgt.y, rec.nat1 ? 'FUMBLE' : 'miss', '#a0a8b8'); AudioSys.play(rec.nat1 ? 'fumble' : 'miss'); if (rec.nat1 && !isMon) Cb.fumble(att); if (!isMon) att.turn.attacksLeft--; return rec; }
    // ---- Damage ----
    let total = 0, parts = [], extras = [];
    if (isMon) {
      const r = Dice.roll(dmgExpr, { crit, silent: true }); total = r.total; parts.push(dmgExpr + '[' + r.rolls.map((x) => x.v).join(',') + ']' + (r.mod ? U.fmtMod(r.mod) : ''));
      if (att.frenzied) { const fx = Dice.roll(dmgExpr.replace(/^\d+/, '1').replace(/[+-]\d+$/, ''), { silent: true }); total += fx.total; parts.push('+' + fx.total + ' frenzy'); }
      if ((att.traits || []).includes('martialAdvantage') && allyAdjacentToTarget && !att.turn.martialUsed) { const ma = Dice.roll('2d6', { silent: true }); total += ma.total; parts.push('+' + ma.total + ' martial advantage'); att.turn.martialUsed = true; }
      if ((att.traits || []).includes('surpriseAttack') && Cb.round === 1 && !att.surpriseUsed) { const sa = Dice.roll('2d6', { silent: true }); total += sa.total; parts.push('+' + sa.total + ' surprise'); att.surpriseUsed = true; }
      if ((att.traits || []).includes('brute') && !ranged) { const b = Dice.roll(dmgExpr.replace(/^\d+/, '1').replace(/[+-]\d+$/, ''), { silent: true }); total += b.total; parts.push('+' + b.total + ' brute'); }
      if (atk.extra) { if (atk.extra.save) { const s = Rules.savingThrow(tgt, atk.extra.save, atk.extra.dc, { vsPoison: atk.extra.type === 'poison', label: U.cap(atk.extra.type) + ' save' }); const r2 = Dice.roll(atk.extra.dmg, { silent: true }); let ed = s.success ? (atk.extra.half ? Math.floor(r2.total / 2) : 0) : r2.total; if (ed > 0) extras.push({ dmg: ed, type: atk.extra.type }); } else { const r2 = Dice.roll(atk.extra.dmg, { crit, silent: true }); extras.push({ dmg: r2.total, type: atk.extra.type }); } }
      if (att.type === 'undead' && Rules.has(tgt, 'raging')) { /* nothing */ }
    } else {
      const d = Rules.rollWeaponDamage(att, w, crit, { offhand: opts.offhand }); total = d.total; parts = d.parts; dtype = d.dtype;
      if (w && w.magic && w.magic.extraDmg) { const r2 = Dice.roll(w.magic.extraDmg, { crit, silent: true }); extras.push({ dmg: r2.total, type: w.magic.extraType }); }
      // Sneak Attack
      if (att.cls === 'rogue' && !att.turn.sneakUsed && w && (w.props.includes('finesse') || w.ranged) && (rec.adv || (allyAdjacentToTarget && !rec.dis))) { const sn = Dice.roll(Rules.sneakDice(att) + 'd6', { crit, silent: true }); total += sn.total; parts.push('+' + sn.total + ' sneak attack'); att.turn.sneakUsed = true; }
      if (att.cls === 'ranger') { const fe = att.choices.favoredEnemy; if (fe && tgt.type === fe) { const b = att.level >= 6 ? 4 : 2; total += b; parts.push('+' + b + ' favored enemy'); } if (att.level >= 3 && tgt.hp < tgt.maxHp && !att.turn.colossusUsed) { const cs = Dice.roll('1d8', { crit, silent: true }); total += cs.total; parts.push('+' + cs.total + ' colossus slayer'); att.turn.colossusUsed = true; } }
      if (att.cls === 'cleric' && att.level >= 8 && !att.turn.divineStrikeUsed) { const ds = Dice.roll('1d8', { crit, silent: true }); extras.push({ dmg: ds.total, type: 'radiant' }); att.turn.divineStrikeUsed = true; }
      const mark = Rules.cond(tgt, 'marked'); if (mark && mark.by === att.id) { const hm = Dice.roll('1d6', { crit, silent: true }); total += hm.total; parts.push('+' + hm.total + " hunter's mark"); }
      if (Rules.has(att, 'ensnaringStrike')) { Rules.removeCondition(att, 'ensnaringStrike'); const s = Rules.savingThrow(tgt, 'str', Rules.spellDC(att), { magic: true, label: 'Ensnaring Strike' }); if (!s.success) { Rules.addCondition(tgt, 'restrained', 10, { repeatSave: 'str', dc: Rules.spellDC(att) }); Rules.addCondition(tgt, 'ensnared', 10); log(tgt.name + ' is ensnared by thorny vines!', 'hit'); } }
      if (Rules.has(att, 'lightningArrow') && ranged) { Rules.removeCondition(att, 'lightningArrow'); const la = Dice.roll('4d8', { crit, silent: true }); total = la.total; dtype = 'lightning'; parts = ['4d8 lightning arrow[' + la.rolls.map((x) => x.v).join(',') + ']']; for (const o of enemiesOf(att)) if (o !== tgt && adjacent(o, tgt)) { const r2 = Dice.roll('2d8', { silent: true }); const s = Rules.savingThrow(o, 'dex', Rules.spellDC(att), { magic: true }); const res = Rules.applyDamage(o, s.success ? Math.floor(r2.total / 2) : r2.total, 'lightning', { log }); log(o.name + ' is struck by the lightning burst for ' + res.taken + '.', 'hit'); if (res.killed) Game.onMonsterDied(o, att); } }
      if (Rules.has(att, 'hailOfThorns') && ranged) { Rules.removeCondition(att, 'hailOfThorns'); for (const o of enemiesOf(att).concat([tgt])) if (o === tgt || adjacent(o, tgt)) { const r2 = Dice.roll('1d10', { silent: true }); const s = Rules.savingThrow(o, 'dex', Rules.spellDC(att), { magic: true }); const res = Rules.applyDamage(o, s.success ? Math.floor(r2.total / 2) : r2.total, 'piercing', { log }); if (o !== tgt) { log(o.name + ' is hit by the hail of thorns for ' + res.taken + '.', 'hit'); if (res.killed) Game.onMonsterDied(o, att); } else extras.push({ dmg: 0, type: 'piercing', note: 'thorns ' + res.taken }); } }
    }
    const res = Rules.applyDamage(tgt, total, dtype, { crit, isAttack: true, log, source: att });
    let txt = att.name + ' hits ' + tgt.name + ' with ' + name + ': ' + Dice.fmt(rec) + advTxt + (crit ? ' — CRITICAL HIT!' : '') + ' Damage ' + parts.join(' ') + ' = ' + res.taken + ' ' + dtype;
    for (const ex of extras) { if (ex.dmg > 0) { const r3 = Rules.applyDamage(tgt, ex.dmg, ex.type, { crit, log }); txt += ' +' + r3.taken + ' ' + ex.type; res.taken += r3.taken; if (r3.killed) res.killed = true; } }
    log(txt + '.', crit ? 'crit' : 'hit');
    Renderer.floatText(tgt.x, tgt.y, (crit ? '★' : '-') + res.taken, crit ? '#ffd54a' : '#ff8060', crit); Renderer.slash(tgt.x, tgt.y, crit ? '#ffd54a' : '#fff'); if (crit) Renderer.shake = 4;
    AudioSys.play(crit ? 'crit' : 'hit');
    if (isMon && att.vampiric && res.taken > 0) { const h = Rules.heal(att, Math.floor(res.taken / 2)); if (h) log(att.name + ' drinks deep and heals ' + h + '.', 'warn'); }
    if (isMon && att.cursedHits && !tgt.mon) Rules.addCondition(tgt, 'noHeal', 1);
    if (isMon && atk.onHit && !tgt.dead) Cb.applyOnHit(att, tgt, atk.onHit);
    if (!isMon) att.turn.attacksLeft--;
    if (!tgt.mon && res.downed) { log(tgt.name + ' falls unconscious!', 'warn'); Game.bark(tgt, 'down'); Renderer.floatText(tgt.x, tgt.y, 'DOWN', '#ff4040', true); }
    if (res.killed) { if (tgt.mon) { Game.onMonsterDied(tgt, att); if (!isMon) Game.bark(att, 'kill'); } else Game.onCharacterDied(tgt); }
    else if (!tgt.mon && res.taken > 0 && Math.random() < 0.3) Game.bark(tgt, 'hurt');
    if (tgt.mon && res.taken > 0 && tgt.morale === 'cowardly' && !tgt.isBoss && tgt.hp <= tgt.maxHp * 0.3) tgt.wantsToFlee = true;
    Game.refreshHud(); await delay(200);
    return rec;
  };
  Cb.applyOnHit = (att, tgt, oh) => {
    if (oh.maxHpReduce) { const s = Rules.savingThrow(tgt, oh.save || 'con', oh.dc || 10, { magic: true, label: 'Resist life drain' }); if (!s.success && !tgt.mon) { const red = Math.min(tgt.maxHp - 1, Math.floor(tgt.maxHp * 0.15)); tgt.maxHp -= red; tgt.hp = Math.min(tgt.hp, tgt.maxHp); log(tgt.name + "'s maximum HP is reduced by " + red + ' until a long rest!', 'warn'); } return; }
    if (oh.status) { if (oh.notVs && !tgt.mon && oh.notVs.includes(tgt.race)) return; if (oh.save) { const s = Rules.savingThrow(tgt, oh.save, oh.dc, { vsPoison: oh.status === 'poisoned', vsFear: oh.status === 'frightened' }); if (s.success) return; } if (Rules.addCondition(tgt, oh.status, oh.rounds || 1, { repeatSave: oh.repeatSave, dc: oh.dc })) log(tgt.name + ' is ' + oh.status + '!', 'warn'); }
  };
  Cb.fumble = (att) => { const r = Dice.die(6); if (r <= 2) { log('Fumble: ' + att.name + ' stumbles and falls prone!', 'warn'); Rules.addCondition(att, 'prone', 1); } else if (r <= 4) { log('Fumble: ' + att.name + ' overextends and loses the rest of their attacks.', 'warn'); att.turn.attacksLeft = 0; } else log('Fumble: ' + att.name + ' swings wildly at nothing. Embarrassing, but harmless.', 'warn'); };

  // ---- Spells ----
  Cb.areaCells = (spell, caster, tx, ty) => {
    const a = spell.area; if (!a) return [[tx, ty]]; const out = []; const r = Math.max(1, Math.round(a.size / 5)); const m = Game.map;
    if (a.shape === 'sphere') { for (let x = tx - r; x <= tx + r; x++) for (let y = ty - r; y <= ty + r; y++) { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); if (Math.max(dx, dy) + Math.min(dx, dy) * 0.5 <= r + 0.01 && World.get(m, x, y) !== TILE.VOID && World.get(m, x, y) !== TILE.WALL) out.push([x, y]); } }
    else if (a.shape === 'cube') { const h = Math.floor(r / 2); for (let x = tx - h; x <= tx + h; x++) for (let y = ty - h; y <= ty + h; y++) if (World.get(m, x, y) !== TILE.WALL) out.push([x, y]); if (spell.range === 0) { out.length = 0; for (let x = caster.x - r + 1; x <= caster.x + r - 1; x++) for (let y = caster.y - r + 1; y <= caster.y + r - 1; y++) if (!(x === caster.x && y === caster.y) && U.dist(x, y, caster.x, caster.y) <= r - 1) out.push([x, y]); } }
    else if (a.shape === 'cone') { const ang = Math.atan2(ty - caster.y, tx - caster.x); for (let x = caster.x - r; x <= caster.x + r; x++) for (let y = caster.y - r; y <= caster.y + r; y++) { if (x === caster.x && y === caster.y) continue; const d = Math.hypot(x - caster.x, y - caster.y); if (d > r + 0.3) continue; let da = Math.atan2(y - caster.y, x - caster.x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= Math.PI / 4 + 0.01 && World.los(m, caster.x, caster.y, x, y)) out.push([x, y]); } }
    else if (a.shape === 'line') { const dx = tx - caster.x, dy = ty - caster.y, len = Math.max(Math.abs(dx), Math.abs(dy)) || 1; const ex = caster.x + Math.round(dx / len * r), ey = caster.y + Math.round(dy / len * r); for (const [x, y] of U.line(caster.x, caster.y, ex, ey)) { if (x === caster.x && y === caster.y) continue; if (World.blocksSight(m, x, y)) break; out.push([x, y]); } }
    return out;
  };
  Cb.spellTargets = (spell, caster, tx, ty, ent) => { // returns entities affected
    const all = Game.party.filter((p) => !p.dead).concat(Game.monsters.filter((mm) => alive(mm)));
    const foes = enemiesOf(caster), friends = alliesOf(caster);
    if (spell.target === 'self') return [caster];
    if (spell.target === 'allies') return friends.filter((f) => U.dist(f.x, f.y, caster.x, caster.y) <= Math.max(1, spell.range / 5)).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)).slice(0, spell.maxTargets || 6);
    if (spell.target === 'enemies') { const cells = Cb.areaCells(spell, caster, caster.x, caster.y); return foes.filter((f) => cells.some(([x, y]) => x === f.x && y === f.y)); }
    if (spell.area) { const cells = Cb.areaCells(spell, caster, tx, ty); let list = all.filter((e) => cells.some(([x, y]) => x === e.x && y === e.y)); if (!caster.mon && caster.cls === 'wizard' && caster.level >= 2) list = list.filter((e) => e.team !== caster.team); if (spell.target === 'enemy') list = list.filter((e) => e.team !== caster.team); return list; }
    return ent ? [ent] : [];
  };
  Cb.cantripDice = (caster, expr) => { const lvl = caster.mon ? Math.max(1, Math.round(caster.cr * 2)) : caster.level; const mult = lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1; return expr.replace(/^(\d+)d/, (m, n) => (parseInt(n, 10) * mult) + 'd'); };
  Cb.castSpell = async (caster, spellId, target, opts) => {
    opts = opts || {}; const spell = SPELLS[spellId]; if (!spell) return false;
    const isMon = !!caster.mon; let slot = 0;
    if (spell.level > 0 && !isMon && !opts.free) { slot = opts.slot || Rules.lowestSlot(caster, spell.level); if (!slot) { log('No spell slot available.', 'warn'); return false; } Rules.useSlot(caster, slot); } else slot = spell.level;
    if (spell.outOfCombatOnly && Cb.active) { log(spell.name + ' takes too long to cast in combat.', 'warn'); return false; }
    const tx = target && target.x !== undefined ? target.x : caster.x, ty = target && target.y !== undefined ? target.y : caster.y; const tEnt = target && target.id ? target : null;
    if (spell.conc) Rules.breakConcentration(caster);
    const mod = Rules.spellMod(caster), dc = Rules.spellDC(caster), atkBonus = Rules.spellAttack(caster);
    const upcast = Math.max(0, slot - spell.level);
    const scaleExpr = (expr) => { let e = expr; if (spell.level === 0 && spell.cantripScale) e = Cb.cantripDice(caster, e); if (spell.slotScale && upcast > 0) { const m = spell.slotScale.match(/^(\d+)d(\d+)$/); if (m) e = e + '+' + (parseInt(m[1], 10) * upcast) + 'd' + m[2]; } return e.replace('MOD', mod); };
    if (!isMon && (spell.attack || spell.save || spell.damage || spell.heal)) await UI.awaitThrow(caster.name + ': ' + spell.name, spell.damage && spell.damage !== '0' ? UI.diceSpec(scaleExpr(spell.damage), 'dmg') : spell.heal ? UI.diceSpec(scaleExpr(spell.heal), 'heal') : { n: 1, sides: 20, kind: 'attack' });
    log(caster.name + ' casts ' + spell.name + (upcast ? ' (' + U.ordinal(slot) + ' level slot)' : '') + '!', 'story'); AudioSys.play(spell.dtype === 'fire' ? 'fire' : 'spell');
    caster.flash = 0.2; caster.flashColor = '#c080ff';
    const targets = Cb.spellTargets(spell, caster, tx, ty, tEnt);
    const color = dtypeColor(spell.dtype);
    if (spell.area) { for (const [x, y] of Cb.areaCells(spell, caster, tx, ty)) Renderer.burst(x, y, color, 0.8); } else if (tEnt && tEnt !== caster && spell.range > 5) Renderer.projectile(caster.x, caster.y, tEnt.x, tEnt.y, color, 0.3);
    await delay(spell.area ? 350 : 300);
    // ---- specials ----
    if (spell.special === 'magicMissile') { const darts = 3 + upcast; let total = 0; for (let i = 0; i < darts; i++) { const r = Dice.roll('1d4+1', { silent: true }); total += r.total; Renderer.projectile(caster.x, caster.y, tEnt.x, tEnt.y, color, 0.2 + i * 0.05); } await delay(300); const res = Rules.applyDamage(tEnt, total, 'force', { log }); log(darts + ' darts strike ' + tEnt.name + ' for ' + res.taken + ' force damage.', 'hit'); Renderer.floatText(tEnt.x, tEnt.y, '-' + res.taken, color); if (res.killed) Game.onMonsterDied(tEnt, caster); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'scorchingRay') { const rays = 3 + upcast; for (let i = 0; i < rays; i++) { if (tEnt.dead) break; const rec = Dice.d20({ mod: atkBonus, vs: Rules.ac(tEnt), label: 'Scorching Ray ' + (i + 1), kind: 'attack', actor: caster.name, adv: Rules.attackAdvantage(caster, tEnt).adv, dis: Rules.attackAdvantage(caster, tEnt).dis }); Game.showRoll(rec); Renderer.projectile(caster.x, caster.y, tEnt.x, tEnt.y, color, 0.25); await delay(220); if (rec.success) { const r = Dice.roll('2d6', { crit: rec.nat20, silent: true }); const res = Rules.applyDamage(tEnt, r.total, 'fire', { log, crit: rec.nat20 }); log('Ray ' + (i + 1) + ' hits: ' + Dice.fmt(rec) + ' — ' + res.taken + ' fire.', rec.nat20 ? 'crit' : 'hit'); Renderer.floatText(tEnt.x, tEnt.y, '-' + res.taken, color); if (res.killed) { Game.onMonsterDied(tEnt, caster); } } else { log('Ray ' + (i + 1) + ' misses: ' + Dice.fmt(rec), 'miss'); } } return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'sleep') { const pool = Dice.roll(scaleExpr(spell.damage), { label: 'Sleep', kind: 'misc' }); let hp = pool.total; log('Sleep: ' + hp + ' HP worth of creatures may fall asleep.', 'story'); for (const t of targets.filter((t) => t.team !== caster.team).sort((a, b) => a.hp - b.hp)) { if (t.hp <= hp && !(t.mon && (t.type === 'undead' || t.type === 'construct'))) { hp -= t.hp; if (Rules.addCondition(t, 'asleep', 10)) log(t.name + ' falls asleep!', 'hit'); } } return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'teleport') { if (Game.isFree(tx, ty) && U.dist(tx, ty, caster.x, caster.y) <= 6) { Renderer.burst(caster.x, caster.y, '#c0c0ff', 0.6); caster.x = tx; caster.y = ty; caster.ax = tx; caster.ay = ty; Renderer.burst(tx, ty, '#c0c0ff', 0.6); Game.updateVisibility(); } else log('Cannot teleport there.', 'warn'); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'goodberry') { Game.addItem('goodberry', 10); log('Ten goodberries appear in your pack.', 'loot'); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'aid') { for (const t of targets) { const b = 5 + 5 * upcast; t.maxHp += b; t.hp += b; t.maxHpBoost = (t.maxHpBoost || 0) + b; log(t.name + ' gains ' + b + ' maximum HP.', 'heal'); } return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'cure') { const t = tEnt || caster; for (const c of spell.cures) if (Rules.has(t, c)) { Rules.removeCondition(t, c); log(t.name + ' is no longer ' + c + '.', 'heal'); } if (spell.status) Rules.addCondition(t, spell.status.id, spell.status.rounds); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'revive') { const t = tEnt; if (t && t.dead && !t.mon) { t.dead = false; t.downed = false; t.deathSaves = { s: 0, f: 0 }; t.hp = spell.reviveHp === 'full' ? t.maxHp : 1; log(t.name + ' returns to life!', 'crit'); Renderer.burst(t.x, t.y, '#ffe080', 1); } else if (t && t.downed) { Rules.heal(t, 1); log(t.name + ' is back on their feet.', 'heal'); } else log('No fallen ally there.', 'warn'); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'dispel') { const t = tEnt || caster; const magical = ['bless', 'shield', 'mageArmor', 'shieldOfFaith', 'haste', 'blur', 'invisible', 'paralyzed', 'asleep', 'restrained', 'slowed', 'marked', 'guided', 'spiritGuardians', 'frightened', 'commanded']; const before = t.conditions.length; t.conditions = t.conditions.filter((c) => !magical.includes(c.id)); log('Magic is stripped from ' + t.name + ' (' + (before - t.conditions.length) + ' effects ended).', 'story'); return Cb.afterCast(caster, spell, opts); }
    if (spell.special === 'spiritualWeapon') { caster.spiritualWeapon = { rounds: 10, dmg: scaleExpr(spell.damage) }; }
    if (spell.special === 'hazard') { const cells = Cb.areaCells(spell, caster, tx, ty); Game.map.hazards = Game.map.hazards || []; Game.map.hazards.push({ name: spell.name, cells, damage: scaleExpr(spell.hazard.damage), dtype: spell.hazard.dtype, save: spell.hazard.save, dc, rounds: spell.hazard.rounds, caster, casterTeam: caster.team, sculpt: !isMon && caster.cls === 'wizard' && caster.level >= 2 }); Game.state.hazardCells = null; }
    // ---- generic damage / heal / status ----
    let dmgRoll = null; if (spell.damage && spell.damage !== '0') { let expr = scaleExpr(spell.damage); if (!isMon && caster.cls === 'wizard' && caster.level >= 10 && spell.school === 'evocation') expr += '+' + mod; dmgRoll = Dice.roll(expr, { label: spell.name + ' damage', kind: 'dmg' }); }
    const dtype = spell.dtype === 'random' ? U.pick(['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder']) : spell.dtype;
    for (const t of targets) {
      if (t.dead) continue;
      if (spell.onlyType && t.mon && t.type !== spell.onlyType) { log(t.name + ' is not a ' + spell.onlyType + '; the spell has no effect.', 'miss'); continue; }
      let hit = true, saved = false;
      if (spell.attack) { const { adv, dis } = Rules.attackAdvantage(caster, t, { ranged: spell.range > 5, adjacentEnemy: spell.range > 5 && enemiesOf(caster).some((f) => adjacent(f, caster)), adv: spell.advVsMetal && t.mon && (t.ac >= 15 || Rules.armor(t)) }); const rec = Dice.d20({ mod: atkBonus, vs: Rules.ac(t), adv, dis, label: spell.name + ' attack', kind: 'attack', actor: caster.name }); Game.showRoll(rec); hit = rec.success; if (hit && rec.nat20 && dmgRoll) { dmgRoll = Dice.roll(scaleExpr(spell.damage), { crit: true, silent: true }); log('Critical spell hit!', 'crit'); } log(spell.name + ' vs ' + t.name + ': ' + Dice.fmt(rec) + (hit ? ' — hit!' : ' — miss.'), hit ? 'hit' : 'miss'); }
      else if (spell.save) { const s = Rules.savingThrow(t, spell.save, dc, { magic: true, vsCharm: spell.school === 'enchantment', vsFear: spell.status && spell.status.id === 'frightened', trapOrSpell: true, label: spell.name + ' (' + spell.save.toUpperCase() + ' save)' }); saved = s.success; log(t.name + ' ' + ABILITY_NAMES[spell.save] + ' save: ' + (s.autoFail ? s.label : Dice.fmt(s)) + (saved ? ' — saved!' + (s.legendary ? ' (legendary resistance)' : '') : ' — failed!'), saved ? 'miss' : 'hit'); if (saved && spell.saveEffect === 'negate' && !(spell.level === 0 && !isMon && caster.cls === 'wizard' && caster.level >= 6)) hit = false; }
      if (!hit) { Renderer.floatText(t.x, t.y, 'miss', '#a0a8b8'); continue; }
      if (dmgRoll) { let amount = dmgRoll.total; if (spell.damageWounded && t.hp < t.maxHp) amount = Dice.roll(scaleExpr(spell.damageWounded), { silent: true }).total; if (saved) amount = Math.floor(amount / 2); if (!t.mon && t.cls === 'rogue' && t.level >= 7 && spell.save === 'dex') amount = saved ? 0 : Math.floor(amount / 2); const res = Rules.applyDamage(t, amount, dtype, { log }); log(t.name + ' takes ' + res.taken + ' ' + dtype + ' damage' + (saved ? ' (halved)' : '') + '.', 'hit'); Renderer.floatText(t.x, t.y, '-' + res.taken, color); if (res.killed) { if (t.mon) { Game.onMonsterDied(t, caster); if (!isMon) Game.bark(caster, 'kill'); } else Game.onCharacterDied(t); } else if (res.downed) log(t.name + ' falls unconscious!', 'warn'); if (t.mon && dtype === 'fire' || dtype === 'acid') t.noRegen = true; }
      if (spell.heal && !t.dead) { const expr = scaleExpr(spell.heal); const r = Dice.roll(expr, { label: spell.name + ' healing', kind: 'heal' }); let amt = r.total; if (!isMon && caster.cls === 'cleric' && caster.choices.domain === 'life') amt += 2 + Math.max(1, slot); const h = Rules.heal(t, amt, { expr, mod }); log(t.name + ' regains ' + h + ' HP.', 'heal'); Renderer.floatText(t.x, t.y, '+' + h, '#80ff80'); Renderer.burst(t.x, t.y, '#80ff80', 0.7); AudioSys.play('heal'); if (!isMon && caster.cls === 'cleric' && caster.level >= 6 && t !== caster) Rules.heal(caster, 2 + Math.max(1, slot)); }
      if (spell.status && !t.dead && !(saved && spell.saveEffect === 'negate')) { const st = spell.status; const ex = { repeatSave: st.repeatSave, dc, by: caster.id }; if (st.id === 'spiritGuardians') ex.damage = scaleExpr(spell.aura.damage); if (st.id === 'commanded') Rules.addCondition(t, 'prone', 1); if (Rules.addCondition(t, st.id, st.rounds, ex)) { if (!['guidance', 'thaumaturgy', 'shield', 'mageArmor', 'ensnaringStrike', 'hailOfThorns', 'lightningArrow', 'swiftQuiver'].includes(st.id)) log(t.name + ' is affected: ' + st.id + '.', 'story'); } }
      if (spell.push && !saved) { const dx = Math.sign(t.x - caster.x), dy = Math.sign(t.y - caster.y); for (let i = 0; i < spell.push; i++) { if (Game.isFree(t.x + dx, t.y + dy)) { t.x += dx; t.y += dy; } } }
    }
    if (spell.conc) caster.concentration = { spell: spellId, targets, remove: spell.status ? spell.status.id : null, rounds: spell.status ? spell.status.rounds : 10 };
    return Cb.afterCast(caster, spell, opts);
  };
  Cb.afterCast = (caster, spell, opts) => { if (!caster.mon && caster.turn && !opts.free) { if (spell.time === 'bonus') caster.turn.bonus = true; else if (spell.time === 'action') caster.turn.action = true; } Game.refreshHud(); return true; };

  // ---- Items ----
  Cb.useItem = async (user, item, target) => {
    const it = getItem(item); if (!it) return false; target = target || user; const fx = it.effect || {};
    if (it.type === 'scroll') { const spell = SPELLS[it.spell]; const canRead = !user.mon && (spell.classes.includes(user.cls) || (CLASSES[user.cls].spellcasting && spell.level === 0)); if (!canRead) { await UI.awaitThrow('Decipher scroll: Arcana'); const rec = Rules.skillCheck(user, 'arcana', 10 + spell.level, { label: 'Decipher scroll' }); log(user.name + ' tries to read the scroll: ' + Dice.fmt(rec) + (rec.success ? ' — success!' : ' — the words blur and the scroll crumbles.'), rec.success ? 'heal' : 'warn'); Game.removeItem(it.id, 1); if (!rec.success) { if (user.turn) user.turn.action = true; return true; } } else Game.removeItem(it.id, 1); await Cb.castSpell(user, it.spell, target, { free: true }); if (user.turn) { if (spell.time === 'bonus') user.turn.bonus = true; else user.turn.action = true; } return true; }
    if (it.type !== 'consumable') return false;
    Game.removeItem(it.id, 1); log(user.name + ' uses ' + it.name + (target !== user ? ' on ' + target.name : '') + '.', 'story');
    if (fx.heal) { if (!user.mon) await UI.awaitThrow(it.name, UI.diceSpec(fx.heal, 'heal')); const r = Dice.roll(fx.heal, { label: it.name, kind: 'heal' }); const h = Rules.heal(target, r.total); log(target.name + ' regains ' + h + ' HP.', 'heal'); Renderer.floatText(target.x, target.y, '+' + h, '#80ff80'); AudioSys.play('heal'); }
    if (fx.tempHp) { target.tempHp = Math.max(target.tempHp || 0, fx.tempHp); log(target.name + ' gains ' + fx.tempHp + ' temporary HP.', 'heal'); }
    if (fx.cure) for (const c of fx.cure) if (Rules.has(target, c)) { Rules.removeCondition(target, c); log(target.name + ' is cured of ' + c + '.', 'heal'); }
    if (fx.status) Rules.addCondition(target, fx.status.id, fx.status.rounds);
    if (fx.light) { user.lightRadius = Math.max(user.lightRadius || 0, 6); log('The torch pushes back the dark.', 'story'); Game.updateVisibility(); }
    if (fx.throwDamage && target !== user) { if (!user.mon) await UI.awaitThrow('Throw ' + it.name, UI.diceSpec(fx.throwDamage, 'dmg')); const r = Dice.roll(fx.throwDamage, { label: it.name, kind: 'dmg' }); let amt = r.total; if (fx.vsTypes && !(target.mon && fx.vsTypes.includes(target.type))) amt = 0; const res = Rules.applyDamage(target, amt, fx.dtype, { log }); Renderer.projectile(user.x, user.y, target.x, target.y, dtypeColor(fx.dtype), 0.3); log(target.name + ' takes ' + res.taken + ' ' + fx.dtype + '.', 'hit'); if (fx.burn && amt > 0) Rules.addCondition(target, 'burning', 10); if (res.killed) Game.onMonsterDied(target, user); }
    if (user.turn) { if (fx.heal && it.id.startsWith('potion') && target === user) user.turn.bonus = true; else if (!user.mon && user.cls === 'rogue' && user.level >= 3 && !user.turn.bonus) user.turn.bonus = true; else user.turn.action = true; }
    Game.refreshHud(); return true;
  };

  // ---- Class / general actions ----
  Cb.actions = (e) => { // list of available actions for the action bar
    const t = e.turn || {}; const acts = []; const w = Rules.weapon(e), off = Rules.offhand(e);
    const canAction = !t.action || t.extraActions > 0;
    acts.push({ id: 'attack', name: 'Attack', kind: 'act', enabled: canAction || t.attacksLeft > 0 && t.actionStarted, desc: (w ? w.name : 'Unarmed') + ' · ' + U.fmtMod(Rules.attackBonus(e, w)) + ' to hit, ' + Rules.weaponDie(e, w) + (t.attacksLeft > 1 ? ' ×' + t.attacksLeft : '') });
    if (CLASSES[e.cls].spellcasting && (e.spells.cantrips.length || e.spells.known.length)) acts.push({ id: 'cast', name: 'Cast', kind: 'act', enabled: canAction || !t.bonus, desc: 'Cast a spell' });
    acts.push({ id: 'item', name: 'Item', kind: 'act', enabled: canAction || !t.bonus, desc: 'Use a potion or scroll' });
    acts.push({ id: 'dash', name: 'Dash', kind: 'act', enabled: canAction && !t.dashed, desc: 'Double movement' });
    acts.push({ id: 'dodge', name: 'Dodge', kind: 'act', enabled: canAction, desc: 'Attacks against you have disadvantage' });
    acts.push({ id: 'disengage', name: 'Disengage', kind: 'act', enabled: canAction && !t.disengaged, desc: 'Move without provoking attacks' });
    if (e.cls === 'rogue') acts.push({ id: 'hide', name: 'Hide', kind: 'act', enabled: canAction, desc: 'Stealth check: gain advantage on your next attack' });
    if (e.resources.breathWeapon) acts.push({ id: 'breath', name: 'Breath', kind: 'act', enabled: canAction && e.resources.breathWeapon.used < 1, desc: 'Dragon breath: cone, Dex save', res: (1 - e.resources.breathWeapon.used) + '/1' });
    if (e.cls === 'cleric' && e.resources.channelDivinity) { acts.push({ id: 'turnUndead', name: 'Turn Undead', kind: 'act', enabled: canAction && e.resources.channelDivinity.used < e.resources.channelDivinity.max, desc: 'Undead within 6 tiles flee (Wis save)', res: (e.resources.channelDivinity.max - e.resources.channelDivinity.used) + '/' + e.resources.channelDivinity.max }); acts.push({ id: 'preserveLife', name: 'Preserve Life', kind: 'act', enabled: canAction && e.resources.channelDivinity.used < e.resources.channelDivinity.max, desc: 'Heal ' + (5 * e.level) + ' HP spread among wounded allies', res: (e.resources.channelDivinity.max - e.resources.channelDivinity.used) + '/' + e.resources.channelDivinity.max }); }
    if (e.cls === 'barbarian' && e.level >= 10) acts.push({ id: 'intimidate', name: 'Menace', kind: 'act', enabled: canAction, desc: 'Frighten a foe (Wis save)' });
    // bonus actions
    if (e.cls === 'barbarian') acts.push({ id: 'rage', name: 'Rage', kind: 'bonus', enabled: !t.bonus && !Rules.has(e, 'raging') && e.resources.rage.used < e.resources.rage.max, desc: '+2 melee damage, resist weapon damage', res: (e.resources.rage.max - e.resources.rage.used) + '/' + e.resources.rage.max });
    if (e.cls === 'barbarian' && e.level >= 2) acts.push({ id: 'reckless', name: 'Reckless', kind: 'bonus', enabled: !Rules.has(e, 'reckless'), desc: 'Advantage on attacks; enemies get advantage on you', free: true });
    if (e.cls === 'barbarian' && e.level >= 3 && Rules.has(e, 'raging')) acts.push({ id: 'frenzy', name: 'Frenzy', kind: 'bonus', enabled: !t.bonus, desc: 'Extra melee attack' });
    if (e.cls === 'fighter') { acts.push({ id: 'secondWind', name: '2nd Wind', kind: 'bonus', enabled: !t.bonus && e.resources.secondWind.used < 1, desc: 'Heal 1d10 + ' + e.level, res: (1 - e.resources.secondWind.used) + '/1' }); if (e.resources.actionSurge) acts.push({ id: 'actionSurge', name: 'Surge', kind: 'bonus', enabled: e.resources.actionSurge.used < 1, desc: 'Gain an extra action', free: true, res: (1 - e.resources.actionSurge.used) + '/1' }); }
    if (e.cls === 'rogue' && e.level >= 2) acts.push({ id: 'cunning', name: 'Cunning', kind: 'bonus', enabled: !t.bonus, desc: 'Bonus action: Dash, Disengage or Hide' });
    if (off && off.type === 'weapon' && off.props.includes('light') && w && w.props.includes('light')) acts.push({ id: 'offhand', name: 'Off-hand', kind: 'bonus', enabled: !t.bonus && t.action, desc: 'Attack with ' + off.name });
    if (e.cls === 'cleric' && e.resources.warPriest) acts.push({ id: 'warPriest', name: 'War Priest', kind: 'bonus', enabled: !t.bonus && e.resources.warPriest.used < e.resources.warPriest.max, desc: 'Bonus weapon attack', res: (e.resources.warPriest.max - e.resources.warPriest.used) + '/' + e.resources.warPriest.max });
    if (e.spiritualWeapon && e.spiritualWeapon.rounds > 0) acts.push({ id: 'spiritStrike', name: 'Spirit Wpn', kind: 'bonus', enabled: !t.bonus, desc: 'Spiritual weapon strikes (' + e.spiritualWeapon.dmg + ')' });
    if (Rules.accBonus(e, 'blink') && !e.blinkUsed) acts.push({ id: 'blink', name: 'Blink', kind: 'bonus', enabled: !t.bonus, desc: 'Teleport 3 tiles' });
    if (Rules.accBonus(e, 'fate') && !e.fateUsed) acts.push({ id: 'fate', name: 'Fate', kind: 'bonus', enabled: !e.fateNext, desc: 'Your next attack roll is a natural 20', free: true });
    if (Rules.accBonus(e, 'wandSpell') && (e.wandCharges === undefined || e.wandCharges > 0)) acts.push({ id: 'wand', name: SPELLS[Rules.accBonus(e, 'wandSpell')].name, kind: 'act', enabled: canAction, desc: 'From your ' + Rules.accessory(e).name, res: (e.wandCharges === undefined ? Rules.accBonus(e, 'charges') : e.wandCharges) + ' charges' });
    if (e.cls === 'wizard' && e.spells.known.includes('mageArmor') && !Rules.has(e, 'mageArmor') && !Rules.armor(e)) { /* cast via Cast menu */ }
    acts.push({ id: 'end', name: 'End Turn', kind: 'end', enabled: true, desc: '' });
    return acts;
  };
  Cb.doAction = async (e, id, extra) => {
    const t = e.turn; const spend = () => { if (t.extraActions > 0 && t.action) t.extraActions--; else t.action = true; };
    switch (id) {
      case 'dash': spend(); t.dashed = true; log(e.name + ' dashes.', 'story'); break;
      case 'dodge': spend(); Rules.addCondition(e, 'dodging', 1); log(e.name + ' takes the Dodge action.', 'story'); break;
      case 'disengage': spend(); t.disengaged = true; log(e.name + ' disengages.', 'story'); break;
      case 'hide': { spend(); await UI.awaitThrow('Hide: Stealth'); const rec = Rules.skillCheck(e, 'stealth', 12 + Math.floor(Game.map.level / 2), { label: 'Hide' }); log(e.name + ' tries to hide: ' + Dice.fmt(rec) + (rec.success ? ' — hidden! Next attack has advantage.' : ' — spotted!'), rec.success ? 'heal' : 'miss'); if (rec.success) Rules.addCondition(e, 'hidden', 2); break; }
      case 'cunning': { t.bonus = true; const sub = extra || 'dash'; if (sub === 'dash') { t.dashed = true; log(e.name + ' dashes (Cunning Action).', 'story'); } else if (sub === 'disengage') { t.disengaged = true; log(e.name + ' disengages (Cunning Action).', 'story'); } else { await UI.awaitThrow('Hide: Stealth'); const rec = Rules.skillCheck(e, 'stealth', 12 + Math.floor(Game.map.level / 2), { label: 'Hide' }); log(e.name + ' hides (Cunning Action): ' + Dice.fmt(rec) + (rec.success ? ' — hidden!' : ' — spotted!'), rec.success ? 'heal' : 'miss'); if (rec.success) Rules.addCondition(e, 'hidden', 2); } break; }
      case 'rage': t.bonus = true; e.resources.rage.used++; Rules.addCondition(e, 'raging', 10); log(e.name + ' RAGES!', 'crit'); Renderer.ring(e.x, e.y, '#ff4040'); AudioSys.play('alert'); break;
      case 'reckless': Rules.addCondition(e, 'reckless', 1); log(e.name + ' attacks recklessly.', 'story'); break;
      case 'frenzy': { t.bonus = true; const tgt = extra; if (tgt) await Cb.attack(e, tgt, {}); break; }
      case 'secondWind': { t.bonus = true; e.resources.secondWind.used++; await UI.awaitThrow('Second Wind', { n: 1, sides: 10, kind: 'heal' }); const r = Dice.roll('1d10+' + e.level, { label: 'Second Wind', kind: 'heal' }); const h = Rules.heal(e, r.total); log(e.name + ' catches a second wind: +' + h + ' HP.', 'heal'); Renderer.floatText(e.x, e.y, '+' + h, '#80ff80'); AudioSys.play('heal'); break; }
      case 'actionSurge': e.resources.actionSurge.used++; t.extraActions++; t.attacksLeft += Cb.attacksPerAction(e); log(e.name + ' surges with energy: extra action!', 'crit'); break;
      case 'offhand': { t.bonus = true; const tgt = extra; if (tgt) await Cb.attack(e, tgt, { offhand: true }); break; }
      case 'warPriest': { t.bonus = true; e.resources.warPriest.used++; const tgt = extra; if (tgt) await Cb.attack(e, tgt, {}); break; }
      case 'spiritStrike': { t.bonus = true; const tgt = extra; if (tgt) { await UI.awaitThrow('Spiritual Weapon'); const rec = Dice.d20({ mod: Rules.spellAttack(e), vs: Rules.ac(tgt), label: 'Spiritual Weapon', kind: 'attack', actor: e.name }); Game.showRoll(rec); Renderer.projectile(e.x, e.y, tgt.x, tgt.y, '#c080ff', 0.2); await delay(200); if (rec.success) { const r = Dice.roll(e.spiritualWeapon.dmg, { crit: rec.nat20, silent: true }); const res = Rules.applyDamage(tgt, r.total, 'force', { log }); log('Spiritual weapon strikes ' + tgt.name + ': ' + Dice.fmt(rec) + ' — ' + res.taken + ' force.', 'hit'); Renderer.floatText(tgt.x, tgt.y, '-' + res.taken, '#c080ff'); if (res.killed) Game.onMonsterDied(tgt, e); } else log('Spiritual weapon misses: ' + Dice.fmt(rec), 'miss'); e.spiritualWeapon.rounds--; } break; }
      case 'breath': { spend(); e.resources.breathWeapon.used++; const pt = extra; const dice = e.level >= 16 ? '5d6' : e.level >= 11 ? '4d6' : e.level >= 6 ? '3d6' : '2d6'; const dtype = e.draconicType || 'fire'; const cells = Cb.areaCells({ area: { shape: 'cone', size: 15 } }, e, pt.x, pt.y); await UI.awaitThrow('Breath weapon', UI.diceSpec(dice, 'dmg')); const r = Dice.roll(dice, { label: 'Breath weapon', kind: 'dmg' }); for (const [x, y] of cells) Renderer.burst(x, y, dtypeColor(dtype), 0.8); AudioSys.play('fire'); for (const f of enemiesOf(e)) if (cells.some(([x, y]) => x === f.x && y === f.y)) { const s = Rules.savingThrow(f, 'dex', 8 + Rules.prof(e) + Rules.abMod(e, 'con'), { magic: true }); const res = Rules.applyDamage(f, s.success ? Math.floor(r.total / 2) : r.total, dtype, { log }); log(f.name + ' is scorched for ' + res.taken + '.', 'hit'); Renderer.floatText(f.x, f.y, '-' + res.taken, dtypeColor(dtype)); if (res.killed) Game.onMonsterDied(f, e); } break; }
      case 'turnUndead': { spend(); e.resources.channelDivinity.used++; log(e.name + ' presents their holy symbol: TURN UNDEAD!', 'crit'); Renderer.ring(e.x, e.y, '#ffe080'); for (const f of enemiesOf(e)) { if (f.type !== 'undead' || U.dist(f.x, f.y, e.x, e.y) > 6) continue; const s = Rules.savingThrow(f, 'wis', Rules.spellDC(e), { magic: true, adv: (f.traits || []).includes('turnResistance') }); if (!s.success) { if (e.level >= 5 && f.cr <= 0.5) { log(f.name + ' is destroyed by divine light!', 'crit'); f.hp = 0; Game.onMonsterDied(f, e); } else { Rules.addCondition(f, 'frightened', 10, { turned: true }); f.turned = true; log(f.name + ' is turned and flees!', 'hit'); } } else log(f.name + ' resists the turning.', 'miss'); } break; }
      case 'preserveLife': { spend(); e.resources.channelDivinity.used++; let pool = 5 * e.level; const allies = Game.party.filter((p) => !p.dead && p.hp < p.maxHp / 2).sort((a, b) => a.hp - b.hp); log(e.name + ' channels divinity to preserve life (' + pool + ' HP).', 'heal'); while (pool > 0 && allies.length) { const a = allies.shift(); const give = Math.min(pool, Math.floor(a.maxHp / 2) - a.hp); if (give > 0) { Rules.heal(a, give); pool -= give; Renderer.floatText(a.x, a.y, '+' + give, '#80ff80'); log(a.name + ' regains ' + give + ' HP.', 'heal'); } } AudioSys.play('heal'); break; }
      case 'intimidate': { spend(); const tgt = extra; if (tgt) { const s = Rules.savingThrow(tgt, 'wis', 8 + Rules.prof(e) + Rules.abMod(e, 'cha'), { vsFear: true }); if (!s.success) { Rules.addCondition(tgt, 'frightened', 10); log(tgt.name + ' is frightened by ' + e.name + "'s presence!", 'hit'); } else log(tgt.name + ' is unimpressed.', 'miss'); } break; }
      case 'blink': { t.bonus = true; e.blinkUsed = true; const pt = extra; if (pt && Game.isFree(pt.x, pt.y) && U.dist(pt.x, pt.y, e.x, e.y) <= 3) { Renderer.burst(e.x, e.y, '#c0c0ff', 0.6); e.x = pt.x; e.y = pt.y; e.ax = pt.x; e.ay = pt.y; Game.updateVisibility(); } break; }
      case 'fate': e.fateUsed = true; e.fateNext = true; log('The Dice of Fate glow. Your next attack will strike true.', 'crit'); break;
      case 'wand': { const sp = Rules.accBonus(e, 'wandSpell'); if (e.wandCharges === undefined) e.wandCharges = Rules.accBonus(e, 'charges'); e.wandCharges--; await Cb.castSpell(e, sp, extra, { free: true }); spend(); break; }
      case 'end': Cb.endTurn(); return;
      default: break;
    }
    Game.refreshHud();
  };
  Cb.playerAttack = async (e, tgt) => { if (!e.turn.actionStarted) { if (e.turn.action && e.turn.extraActions <= 0) return; if (e.turn.action) e.turn.extraActions--; e.turn.action = true; e.turn.actionStarted = true; } if (e.turn.attacksLeft <= 0) return; await Cb.attack(e, tgt, {}); if (e.turn.attacksLeft <= 0) e.turn.actionStarted = false; if (Rules.has(e, 'hidden')) Rules.removeCondition(e, 'hidden'); Game.refreshHud(); };

  // ---- Monster AI ----
  Cb.monsterTurn = async (m) => {
    Rules.startTurn(m, log); m.reactionUsed = false; Cb.setActive(m);
    if (m.surprised) { m.surprised = false; log(m.name + ' is surprised and loses its turn!', 'miss'); await delay(400); Rules.endTurn(m, log); return; }
    if (!Rules.canAct(m)) { log(m.name + ' cannot act (' + m.conditions.map((c) => c.id).join(', ') + ').', 'miss'); await delay(500); Rules.endTurn(m, log); return; }
    Cb.hazardCheck(m); Cb.auraCheck(m); if (m.dead) return;
    await UI.waitForDice(); // let the previous roll land before this monster throws its own
    for (const k in m.recharge) if (m.recharge[k] > 0 && Dice.die(6) >= 5) m.recharge[k] = 0;
    const foes = Game.party.filter((p) => !p.dead && !p.downed && !(Rules.has(p, 'hidden') && !adjacent(p, m)));
    const visibleFoes = foes.filter((p) => World.los(Game.map, m.x, m.y, p.x, p.y) || adjacent(p, m));
    await delay(250);
    const moveToward = async (tx, ty, stopDist) => { const path = U.astar(m.x, m.y, tx, ty, Cb.passableFor(m), 60); if (!path) return; const steps = []; for (const [x, y] of path) { if (U.dist(x, y, tx, ty) < stopDist) break; steps.push([x, y]); if (U.dist(x, y, tx, ty) <= stopDist) break; } await Cb.moveAlong(m, steps); };
    const moveAway = async (from) => { const reach = Cb.reachable(m); let best = null, bd = -1; for (const [k] of reach) { const [x, y] = k.split(',').map(Number); const d = Math.min(...from.map((f) => U.dist(x, y, f.x, f.y))); if (d > bd) { bd = d; best = [x, y]; } } if (best && !(best[0] === m.x && best[1] === m.y)) { const path = U.astar(m.x, m.y, best[0], best[1], Cb.passableFor(m), 40); if (path) await Cb.moveAlong(m, path); } };
    // Fleeing / turned
    if (m.turned || Rules.has(m, 'frightened') || (m.wantsToFlee && Math.random() < 0.7)) { if ((m.traits || []).includes('nimbleEscape')) m.turn.disengaged = true; log(m.name + ' flees!', 'miss'); m.turn.dashed = true; await moveAway(foes); if (foes.every((f) => U.dist(f.x, f.y, m.x, m.y) > 10)) { m.escaped = true; m.hidden = true; log(m.name + ' escapes into the dark.', 'miss'); } Rules.endTurn(m, log); return; }
    if (!visibleFoes.length) { // seek: move toward nearest known party member
      const nearest = Game.party.filter((p) => !p.dead).sort((a, b) => U.dist(a.x, a.y, m.x, m.y) - U.dist(b.x, b.y, m.x, m.y))[0]; if (nearest) await moveToward(nearest.x, nearest.y, 1); Rules.endTurn(m, log); return;
    }
    // Target choice: nearest, prefer low HP among ties; wights/undead prefer clerics? keep simple
    visibleFoes.sort((a, b) => U.dist(a.x, a.y, m.x, m.y) - U.dist(b.x, b.y, m.x, m.y) || a.hp - b.hp);
    let target = visibleFoes[0];
    // Casters
    if (m.spells && m.spells.length && Math.random() < 0.55) {
      const allies = Game.monsters.filter((o) => alive(o) && o !== m); const hurt = allies.concat([m]).filter((o) => o.hp < o.maxHp * 0.5);
      let pick = null, tgt = target;
      const usable = m.spells.filter((s) => SPELLS[s] && (SPELLS[s].level === 0 || (m.spellUses === undefined || m.spellUses > 0)));
      if (hurt.length && usable.includes('cureWounds')) { pick = 'cureWounds'; tgt = hurt.sort((a, b) => a.hp - b.hp)[0]; if (U.dist(tgt.x, tgt.y, m.x, m.y) > 1) pick = null; }
      const clustered = (id) => { const sp = SPELLS[id]; if (!sp || !sp.area) return false; let best = 0; for (const f of visibleFoes) { const n = Cb.spellTargets(sp, m, f.x, f.y, f).filter((e) => !e.mon).length; if (n > best) { best = n; tgt = f; } } return best >= 2; };
      if (!pick && usable.includes('fireball') && clustered('fireball')) pick = 'fireball';
      if (!pick && usable.includes('iceStorm') && clustered('iceStorm')) pick = 'iceStorm';
      if (!pick && usable.includes('flameStrike') && clustered('flameStrike')) pick = 'flameStrike';
      if (!pick && usable.includes('holdPerson') && Math.random() < 0.5) { const t2 = visibleFoes.find((f) => !Rules.has(f, 'paralyzed') && ['fighter', 'barbarian', 'rogue', 'ranger'].includes(f.cls)); if (t2) { pick = 'holdPerson'; tgt = t2; } }
      if (!pick && usable.includes('spiritGuardians') && !Rules.has(m, 'spiritGuardians') && visibleFoes.some((f) => U.dist(f.x, f.y, m.x, m.y) <= 3)) { pick = 'spiritGuardians'; tgt = m; }
      if (!pick && usable.includes('spiritualWeapon') && !m.spiritualWeapon) { pick = 'spiritualWeapon'; }
      if (!pick) { const dmgSpells = usable.filter((s) => SPELLS[s].damage && !SPELLS[s].area && (SPELLS[s].range >= 30 || U.dist(target.x, target.y, m.x, m.y) <= 1)); if (dmgSpells.length) pick = U.pick(dmgSpells); }
      if (pick) { const sp = SPELLS[pick]; if (sp.range <= 5 && U.dist(tgt.x, tgt.y, m.x, m.y) > 1) await moveToward(tgt.x, tgt.y, 1); if (sp.range > 5 || U.dist(tgt.x, tgt.y, m.x, m.y) <= 1) { if (sp.level > 0) { if (m.spellUses === undefined) m.spellUses = m.isBoss ? 6 : 3; m.spellUses--; } await Cb.castSpell(m, pick, tgt, {}); if (m.spiritualWeapon && pick !== 'spiritualWeapon') { /* noop */ } Rules.endTurn(m, log); return; } }
    }
    // Recharge abilities (breath / web)
    const special = (m.attacks || []).find((a) => a.recharge && !(m.recharge[a.name] > 0) && (a.cone || a.range > 10));
    if (special && special.cone) { const cells = Cb.areaCells({ area: { shape: 'cone', size: special.range } }, m, target.x, target.y); const hit = foes.filter((f) => cells.some(([x, y]) => x === f.x && y === f.y)); if (hit.length >= 1 && (hit.length >= 2 || Math.random() < 0.5)) { m.recharge[special.name] = special.recharge; log(m.name + ' uses ' + special.name + '!', 'crit'); const r = Dice.roll(special.dmg, { label: special.name, kind: 'dmg' }); for (const [x, y] of cells) Renderer.burst(x, y, dtypeColor(special.type), 0.8); AudioSys.play('fire'); for (const f of hit) { const s = Rules.savingThrow(f, special.save, special.dc, { magic: true, trapOrSpell: true }); const dmg = s.success ? Math.floor(r.total / 2) : r.total; const res = Rules.applyDamage(f, dmg, special.type, { log }); log(f.name + ' takes ' + res.taken + ' ' + special.type + '.', 'hit'); Renderer.floatText(f.x, f.y, '-' + res.taken, dtypeColor(special.type)); if (res.downed) log(f.name + ' falls!', 'warn'); if (res.killed) Game.onCharacterDied(f); } await delay(400); Rules.endTurn(m, log); return; } }
    if (special && special.range > 10 && !special.cone && Math.random() < 0.6) { m.recharge[special.name] = special.recharge; await Cb.attack(m, target, { monsterAttack: special }); Rules.endTurn(m, log); return; }
    // Choose attack mode
    const melee = (m.attacks || []).filter((a) => a.range <= 10 && !a.recharge && a.dmg !== '0'), ranged = (m.attacks || []).filter((a) => a.range > 10 && !a.recharge && a.dmg !== '0');
    const dist = U.dist(target.x, target.y, m.x, m.y);
    const prefersRanged = (m.traits || []).includes('prefersRanged') || (!melee.length && ranged.length);
    if (ranged.length && dist > 1 && dist <= Math.floor(ranged[0].range / 5) && (prefersRanged || Math.random() < 0.5 || !melee.length)) { await Cb.multiattack(m, target, ranged[0]); Rules.endTurn(m, log); return; }
    if (prefersRanged && ranged.length && dist <= 1 && (m.traits || []).includes('nimbleEscape')) { m.turn.disengaged = true; await moveAway([target]); if (U.dist(target.x, target.y, m.x, m.y) > 1) await Cb.multiattack(m, target, ranged[0]); Rules.endTurn(m, log); return; }
    if (melee.length) {
      const reach = melee[0].range >= 10 ? 2 : 1;
      if (dist > reach) { if ((m.traits || []).includes('aggressive')) m.turn.dashed = true; await moveToward(target.x, target.y, reach); }
      if (U.dist(target.x, target.y, m.x, m.y) <= reach) { if ((m.traits || []).includes('charge') && m.turn.moved >= 4) { const gore = m.attacks.find((a) => a.name === 'Gore'); if (gore) await Cb.attack(m, target, { monsterAttack: gore }); } await Cb.multiattack(m, target, melee[0]); }
      else if (ranged.length && U.dist(target.x, target.y, m.x, m.y) <= Math.floor(ranged[0].range / 5)) await Cb.multiattack(m, target, ranged[0]);
    } else if (ranged.length) { if (dist <= 1) await moveAway([target]); if (U.dist(target.x, target.y, m.x, m.y) <= Math.floor(ranged[0].range / 5)) await Cb.multiattack(m, target, ranged[0]); }
    Rules.endTurn(m, log);
  };
  Cb.multiattack = async (m, target, primary) => {
    if (m.multiattack && m.multiattack.length) { for (const name of m.multiattack) { if (target.dead || target.downed || m.dead) break; const atk = m.attacks.find((a) => a.name === name) || primary; if (atk.range <= 10 && U.dist(target.x, target.y, m.x, m.y) > (atk.range >= 10 ? 2 : 1)) continue; if (atk.save && atk.dmg === '0') { const s = Rules.savingThrow(target, atk.save, atk.dc, { vsFear: true }); if (!s.success && atk.onFail) { Rules.addCondition(target, atk.onFail.status, atk.onFail.rounds); log(target.name + ' is ' + atk.onFail.status + ' by ' + atk.name + '!', 'warn'); } else log(target.name + ' resists ' + atk.name + '.', 'miss'); continue; } await Cb.attack(m, target, { monsterAttack: atk }); } }
    else await Cb.attack(m, target, { monsterAttack: primary });
    // if the target went down, retarget remaining attacks? keep simple
  };
  window.Combat = Cb;
})();
