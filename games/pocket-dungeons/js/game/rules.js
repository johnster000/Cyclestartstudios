/* The 5e-flavoured rules engine: modifiers, AC, checks, saves, attacks, damage, conditions, rests, XP/levels, monsters. */
(function () {
  const R = {};
  R.mod = (score) => Math.floor((score - 10) / 2);
  R.prof = (ent) => ent.mon ? R.monsterProf(ent) : 2 + Math.floor((ent.level - 1) / 4);
  R.monsterProf = (m) => { const cr = m.cr || 0; return cr < 5 ? 2 : cr < 9 ? 3 : 4; };
  R.ab = (ent, a) => ent.mon ? ent.abilities[a] : ent.abilities[a];
  R.abMod = (ent, a) => R.mod(R.ab(ent, a));
  R.has = (ent, id) => !!(ent.conditions || []).find((c) => c.id === id);
  R.cond = (ent, id) => (ent.conditions || []).find((c) => c.id === id);
  R.feat = (ch, id) => { if (ch.mon) return false; const f = CLASSES[ch.cls].features; for (const lvl in f) if (+lvl <= ch.level && f[lvl].some((x) => x.id === id)) return true; return false; };
  R.raceFeat = (ch, id) => !ch.mon && !!RACES[ch.race].feats[id];
  R.accessory = (ch) => (!ch.mon && getItem(ch.equipment.accessory)) || null;
  R.accBonus = (ch, k) => { const a = R.accessory(ch); return a && a.bonus ? a.bonus[k] : undefined; };
  R.weapon = (ch) => ch.mon ? null : (getItem(ch.equipment.mainHand) || null);
  R.offhand = (ch) => ch.mon ? null : (getItem(ch.equipment.offHand) || null);
  R.armor = (ch) => ch.mon ? null : (getItem(ch.equipment.armor) || null);
  R.maxSpellLevel = (ch) => { const t = R.slotTable(ch); return t.length; };
  R.slotTable = (ch) => { const sc = CLASSES[ch.cls].spellcasting; if (!sc) return []; const tbl = SLOT_TABLE[sc.type][Math.min(ch.level, MAX_LEVEL)] || []; return (sc.startLevel && ch.level < sc.startLevel) ? [] : tbl; };
  R.spellAbility = (ch) => CLASSES[ch.cls].spellcasting ? CLASSES[ch.cls].spellcasting.ability : 'int';
  R.spellMod = (ent) => ent.mon ? R.mod(ent.abilities[ent.spellAb || 'wis']) : R.abMod(ent, R.spellAbility(ent));
  R.spellDC = (ent) => ent.mon ? (ent.spellDC || 8 + R.monsterProf(ent) + R.spellMod(ent)) : 8 + R.prof(ent) + R.spellMod(ent);
  R.spellAttack = (ent) => ent.mon ? (ent.spellHit || R.monsterProf(ent) + R.spellMod(ent)) : R.prof(ent) + R.spellMod(ent);
  R.hasSlot = (ch, lvl) => { const s = ch.spells && ch.spells.slots[lvl]; return s && s.used < s.max; };
  R.lowestSlot = (ch, minLvl) => { for (let l = minLvl; l <= 5; l++) if (R.hasSlot(ch, l)) return l; return 0; };
  R.useSlot = (ch, lvl) => { if (ch.spells.slots[lvl]) ch.spells.slots[lvl].used++; };
  R.canCast = (ch, spellId) => { const s = SPELLS[spellId]; if (!s) return false; if (s.level === 0) return ch.spells.cantrips.includes(spellId); return ch.spells.known.includes(spellId) && R.lowestSlot(ch, s.level) > 0; };

  // ---- Proficiency ----
  R.armorProf = (ch, item) => { if (ch.mon) return true; const cl = CLASSES[ch.cls]; if (item.type === 'shield') return cl.armor.includes('shield'); if (cl.armor.includes(item.cat)) return true; if (ch.cls === 'cleric' && (ch.choices.domain === 'life' || ch.choices.domain === 'war') && item.cat === 'heavy') return true; return false; };
  R.weaponProf = (ch, w) => { if (ch.mon) return true; const cl = CLASSES[ch.cls]; if (cl.weapons.includes(w.cat)) return true; if (cl.weapons.includes(w.base || w.id)) return true; if (ch.cls === 'cleric' && ch.choices.domain === 'war') return true; return false; };
  R.canEquip = (ch, item) => { if (item.type === 'armor' || item.type === 'shield') return R.armorProf(ch, item); return true; };
  R.equip = (ch, item) => { // returns replaced item id (to go back to pack) or false
    const it = getItem(item); if (!it) return false;
    if (it.type === 'weapon') { const old = ch.equipment.mainHand; ch.equipment.mainHand = typeof item === 'object' ? item : it.id; if (it.props.includes('twoHanded') && ch.equipment.offHand) { const off = ch.equipment.offHand; ch.equipment.offHand = null; return [old, off].filter(Boolean); } return old ? [old] : []; }
    if (it.type === 'shield') { const w = R.weapon(ch); if (w && w.props.includes('twoHanded')) return false; const old = ch.equipment.offHand; ch.equipment.offHand = typeof item === 'object' ? item : it.id; return old ? [old] : []; }
    if (it.type === 'armor') { if (!R.armorProf(ch, it)) return false; const old = ch.equipment.armor; ch.equipment.armor = typeof item === 'object' ? item : it.id; return old ? [old] : []; }
    if (it.type === 'accessory') { const old = ch.equipment.accessory; ch.equipment.accessory = typeof item === 'object' ? item : it.id; Character.recompute(ch); return old ? [old] : []; }
    return false;
  };
  R.unequip = (ch, slot) => { const old = ch.equipment[slot]; ch.equipment[slot] = null; if (slot === 'accessory') Character.recompute(ch); return old; };

  // ---- Derived stats ----
  R.ac = (ent) => {
    if (ent.mon) { let ac = ent.ac; if (R.has(ent, 'shield')) ac += 5; if (R.has(ent, 'haste')) ac += 2; return ac; }
    const ch = ent, dex = R.abMod(ch, 'dex'), armor = R.armor(ch); let ac;
    if (armor) { ac = armor.ac + (armor.magicBonus || 0) + (armor.cat === 'light' ? dex : armor.cat === 'medium' ? Math.min(2, dex) : 0); if (armor.strReq && ch.abilities.str < armor.strReq) ac -= 0; }
    else { ac = 10 + dex; if (ch.cls === 'barbarian') ac += R.abMod(ch, 'con'); if (R.has(ch, 'mageArmor')) ac = 13 + dex; if (R.accBonus(ch, 'acUnarmored')) ac += R.accBonus(ch, 'acUnarmored'); }
    const off = R.offhand(ch); if (off && off.type === 'shield') ac += off.ac;
    if (ch.cls === 'fighter' && ch.choices.style === 'defense' && armor) ac += 1; if (ch.cls === 'fighter' && ch.level >= 10 && armor) ac += 1;
    if (R.accBonus(ch, 'ac')) ac += R.accBonus(ch, 'ac');
    if (R.has(ch, 'shield')) ac += 5; if (R.has(ch, 'shieldOfFaith')) ac += 2; if (R.has(ch, 'haste')) ac += 2;
    return ac;
  };
  R.speedFt = (ent) => {
    if (R.has(ent, 'restrained') || R.has(ent, 'grappled') || R.has(ent, 'paralyzed') || R.has(ent, 'asleep') || R.has(ent, 'stunned')) return 0;
    let s = ent.mon ? ent.speed : RACES[ent.race].speed;
    if (!ent.mon) { if (ent.cls === 'barbarian' && ent.level >= 5 && !(R.armor(ent) && R.armor(ent).cat === 'heavy')) s += 10; if (R.accBonus(ent, 'speed')) s += R.accBonus(ent, 'speed'); const ar = R.armor(ent); if (ar && ar.strReq && ent.abilities.str < ar.strReq) s -= 10; }
    if (R.has(ent, 'haste')) s *= 2; if (R.has(ent, 'slowed')) s = Math.max(0, s - 10);
    return s;
  };
  R.speedTiles = (ent) => Math.floor(R.speedFt(ent) / 5);
  R.initiativeMod = (ent) => R.abMod(ent, 'dex') + (!ent.mon && ent.cls === 'fighter' && ent.level >= 7 ? Math.ceil(R.prof(ent) / 2) : 0);
  R.skillBonus = (ch, skill) => { if (ch.mon) return (ch.skills && ch.skills[skill]) !== undefined ? ch.skills[skill] : R.abMod(ch, SKILLS[skill].ab); let b = R.abMod(ch, SKILLS[skill].ab); if (ch.expertise.includes(skill)) b += R.prof(ch) * 2; else if (ch.skillProf.includes(skill)) b += R.prof(ch); else if (ch.cls === 'fighter' && ch.level >= 7 && ['str', 'dex', 'con'].includes(SKILLS[skill].ab)) b += Math.floor(R.prof(ch) / 2); if (skill === 'stealth' && R.has(ch, 'passWithoutTrace')) b += 10; return b; };
  R.passivePerception = (ch) => 10 + R.skillBonus(ch, 'perception') + (ch.cls === 'ranger' ? 5 : 0);
  R.saveBonus = (ent, ab) => { if (ent.mon) return R.abMod(ent, ab) + ((ent.saves || []).includes(ab) ? R.monsterProf(ent) : 0); let b = R.abMod(ent, ab); if (CLASSES[ent.cls].saves.includes(ab)) b += R.prof(ent); if (R.accBonus(ent, 'saves')) b += R.accBonus(ent, 'saves'); return b; };

  // ---- Checks & saves ----
  R.checkAdvantage = (ent, skill) => { let adv = false, dis = false; if (R.has(ent, 'poisoned') || R.has(ent, 'frightened')) dis = true; if (skill === 'stealth' && R.armor(ent) && R.armor(ent).stealthDis) dis = true; if (!ent.mon && R.accBonus(ent, 'advSkill') && R.accBonus(ent, 'advSkill').includes(skill)) adv = true; if (skill === 'stealth' && !ent.mon && ent.cls === 'rogue' && ent.level >= 9) adv = true; if (!ent.mon && R.raceFeat(ent, 'tinker') && (skill === 'sleightOfHand' || skill === 'investigation')) adv = true; if (!ent.mon && ent.cls === 'barbarian' && R.has(ent, 'raging') && SKILLS[skill] && SKILLS[skill].ab === 'str') adv = true; return { adv, dis }; };
  // How many d20 the tray should hand the player for this check (two on advantage or disadvantage).
  R.d20Spec = (ent, skill, opts) => { const a = R.checkAdvantage(ent, skill); const adv = a.adv || !!(opts && opts.adv), dis = a.dis || !!(opts && opts.dis); return { n: adv !== dis ? 2 : 1, sides: 20, kind: 'check' }; };
  R.skillCheck = (ent, skill, dc, opts) => {
    opts = opts || {}; const { adv, dis } = R.checkAdvantage(ent, skill); const extra = [];
    if (R.has(ent, 'guidance')) { extra.push({ expr: '1d4', label: 'Guidance' }); R.removeCondition(ent, 'guidance'); }
    if (skill === 'intimidation' && R.has(ent, 'thaumaturgy')) { R.removeCondition(ent, 'thaumaturgy'); opts.adv = true; }
    const rec = Dice.d20({ mod: R.skillBonus(ent, skill) + (opts.bonus || 0), adv: adv || opts.adv, dis: dis || opts.dis, vs: dc, label: (opts.label || SKILLS[skill].name + ' check'), kind: 'check', actor: ent.name, reroll1: R.raceFeat(ent, 'lucky'), extra });
    return rec;
  };
  R.savingThrow = (ent, ab, dc, opts) => {
    opts = opts || {}; let adv = !!opts.adv, dis = !!opts.dis;
    if ((ab === 'str' || ab === 'dex') && (R.has(ent, 'paralyzed') || R.has(ent, 'stunned') || R.has(ent, 'asleep'))) return { total: -99, success: false, autoFail: true, label: 'Auto-fail (' + (R.has(ent, 'paralyzed') ? 'paralyzed' : 'incapacitated') + ')' };
    if (ab === 'dex' && R.has(ent, 'restrained')) dis = true; if (ab === 'dex' && R.has(ent, 'dodging')) adv = true;
    if (!ent.mon) { if (opts.vsPoison && R.raceFeat(ent, 'poisonResist')) adv = true; if (opts.vsFear && R.raceFeat(ent, 'brave')) adv = true; if (opts.magic && ['int', 'wis', 'cha'].includes(ab) && R.raceFeat(ent, 'gnomeCunning')) adv = true; if (opts.vsCharm && R.raceFeat(ent, 'feyAncestry')) adv = true; if (ab === 'dex' && opts.trapOrSpell && ent.cls === 'barbarian' && ent.level >= 2) adv = true; if (ab === 'wis' && R.has(ent, 'beaconOfHope')) adv = true; }
    if (ent.mon && (ent.traits || []).includes('magicResistance') && opts.magic) adv = true;
    if (ent.mon && (ent.traits || []).includes('darkDevotion') && (opts.vsFear || opts.vsCharm)) adv = true;
    const extra = []; if (R.has(ent, 'bless')) extra.push({ expr: '1d4', label: 'Bless' });
    const rec = Dice.d20({ mod: R.saveBonus(ent, ab), adv, dis, vs: dc, label: (opts.label || ABILITY_NAMES[ab] + ' save'), kind: 'save', actor: ent.name, reroll1: !ent.mon && R.raceFeat(ent, 'lucky'), extra });
    if (!rec.success && ent.mon && ent.legendaryResist > 0) { ent.legendaryResist--; rec.success = true; rec.legendary = true; }
    return rec;
  };
  R.deathSave = (ch) => { const rec = Dice.d20({ mod: 0, vs: 10, label: 'Death save', kind: 'save', actor: ch.name, adv: R.has(ch, 'beaconOfHope') }); if (rec.nat20) { ch.hp = 1; ch.downed = false; ch.deathSaves = { s: 0, f: 0 }; rec.revive = true; return rec; } if (rec.nat1) ch.deathSaves.f += 2; else if (rec.success) ch.deathSaves.s++; else ch.deathSaves.f++; if (ch.deathSaves.s >= 3) { ch.stable = true; rec.stable = true; } if (ch.deathSaves.f >= 3) { ch.dead = true; rec.died = true; } return rec; };

  // ---- Attacks ----
  R.attackAbility = (ch, w) => { if (!w) return 'str'; if (w.ranged && !w.props.includes('thrown')) return 'dex'; if (w.props.includes('finesse')) return R.abMod(ch, 'dex') > R.abMod(ch, 'str') ? 'dex' : 'str'; return 'str'; };
  R.attackBonus = (ch, w) => { let b = R.abMod(ch, R.attackAbility(ch, w)); if (!w || R.weaponProf(ch, w)) b += R.prof(ch); if (w && w.magic && w.magic.bonus) b += w.magic.bonus; if (w && w.ranged && ((ch.cls === 'fighter' && ch.choices.style === 'archery') || (ch.cls === 'ranger' && ch.level >= 2))) b += 2; return b; };
  R.weaponDie = (ch, w) => { if (!w) return '1d1'; let d = w.dmg; const v = w.props.find((p) => p.startsWith('versatile:')); if (v && !ch.equipment.offHand) d = v.split(':')[1]; return d; };
  R.critRange = (ch) => (!ch.mon && ch.cls === 'fighter' && ch.level >= 3) ? 19 : 20;
  // Is target within reach for melee / range for ranged? returns {ok, dis} (dis for long range)
  R.attackRange = (att, w) => { if (att.mon) return null; if (!w) return { normal: 1, long: 1 }; if (w.ranged || w.props.includes('thrown')) return { normal: Math.floor((w.range ? w.range[0] : 20) / 5), long: Math.floor((w.range ? w.range[1] : 60) / 5), ranged: true, thrown: w.props.includes('thrown') }; return { normal: w.props.includes('reach') ? 2 : 1, long: w.props.includes('reach') ? 2 : 1 }; };
  // Compute advantage/disadvantage for an attack roll
  R.attackAdvantage = (att, tgt, opts) => {
    opts = opts || {}; let adv = false, dis = false; const dist = U.dist(att.x, att.y, tgt.x, tgt.y);
    if (R.has(tgt, 'paralyzed') || R.has(tgt, 'asleep') || R.has(tgt, 'stunned') || R.has(tgt, 'restrained') || R.has(tgt, 'blinded') || R.has(tgt, 'reckless') || R.has(tgt, 'guided')) adv = true;
    if (R.has(tgt, 'prone')) { if (dist <= 1) adv = true; else dis = true; }
    if (R.has(tgt, 'dodging') || R.has(tgt, 'blur') || R.has(tgt, 'invisible')) dis = true;
    if (R.has(att, 'hidden') || R.has(att, 'invisible') || R.has(att, 'reckless')) adv = true;
    if (R.has(att, 'poisoned') || R.has(att, 'frightened') || R.has(att, 'prone') || R.has(att, 'restrained') || R.has(att, 'blinded')) dis = true;
    if (opts.ranged && opts.adjacentEnemy) dis = true; if (opts.longRange) dis = true;
    if (opts.heavy && !att.mon && RACES[att.race].size === 'S') dis = true;
    if (att.mon && (att.traits || []).includes('packTactics') && opts.allyAdjacentToTarget) adv = true;
    if (opts.adv) adv = true; if (opts.dis) dis = true;
    return { adv, dis };
  };
  R.rollWeaponDamage = (ch, w, crit, opts) => {
    opts = opts || {}; let die = R.weaponDie(ch, w); const parts = [];
    let rec = Dice.roll(die, { crit, silent: true });
    if (ch.cls === 'fighter' && ch.choices.style === 'greatWeapon' && w && w.props.includes('twoHanded')) { rec.rolls.forEach((r) => { if (r.v <= 2) { const nv = Dice.die(r.sides); rec.total += nv - r.v; r.v = nv; r.rerolled = true; } }); }
    parts.push(rec.expr + '[' + rec.rolls.map((r) => r.v).join(',') + ']');
    let total = rec.total; const abMod = opts.offhand ? Math.min(0, R.abMod(ch, R.attackAbility(ch, w))) : R.abMod(ch, R.attackAbility(ch, w)); total += abMod; if (abMod) parts.push(U.fmtMod(abMod));
    if (w && w.magic && w.magic.bonus) { total += w.magic.bonus; parts.push('+' + w.magic.bonus + ' magic'); }
    if (ch.cls === 'fighter' && ch.choices.style === 'dueling' && w && !w.ranged && !w.props.includes('twoHanded') && !(R.offhand(ch) && R.offhand(ch).type === 'weapon')) { total += 2; parts.push('+2 dueling'); }
    if (R.has(ch, 'raging') && w && !w.ranged) { const rb = ch.level >= 9 ? 3 : 2; total += rb; parts.push('+' + rb + ' rage'); }
    if (crit) { if (R.raceFeat(ch, 'savageAttacks') || (ch.cls === 'barbarian' && ch.level >= 9)) { const ex = Dice.roll(die.replace(/^\d+/, '1'), { silent: true }); total += ex.total; parts.push('+' + ex.total + ' brutal'); } }
    if (R.has(ch, 'weakened') && R.attackAbility(ch, w) === 'str') { total = Math.max(1, total - 2); parts.push('-2 weakened'); }
    return { total: Math.max(0, total), parts, dtype: w ? w.dtype : 'bludgeoning', rolls: rec.rolls };
  };

  // ---- Damage & healing ----
  R.resistance = (ent, dtype) => { // returns multiplier 0, .5, 1, 2
    if (!dtype || dtype === 'none') return 1;
    const has = (arr) => (arr || []).includes(dtype);
    if (ent.mon) { if (has(ent.immune)) return 0; if (has(ent.vuln)) return 2; if (has(ent.resist)) return 0.5; return 1; }
    let m = 1; if (R.raceFeat(ent, 'poisonResist') && dtype === 'poison') m = 0.5; if (R.raceFeat(ent, 'fireResist') && dtype === 'fire') m = 0.5;
    if (R.raceFeat(ent, 'breathWeapon') && dtype === (ent.draconicType || 'fire')) m = 0.5;
    if (R.accBonus(ent, 'resist') && R.accBonus(ent, 'resist').includes(dtype)) m = 0.5;
    if (R.has(ent, 'raging') && ['bludgeoning', 'piercing', 'slashing'].includes(dtype)) m = 0.5;
    return m;
  };
  // Apply damage. Returns {taken, killed, downed, absorbed}. ctx: {crit, source, magical, log(fn)}
  R.applyDamage = (tgt, amount, dtype, ctx) => {
    ctx = ctx || {}; const log = ctx.log || (() => {});
    if (tgt.dead) return { taken: 0 };
    let mult = R.resistance(tgt, dtype); let dmg = Math.floor(amount * mult);
    if (mult === 0) log(tgt.name + ' is immune to ' + dtype + '!', 'miss'); else if (mult === 0.5) log(tgt.name + ' resists ' + dtype + ' (halved to ' + dmg + ').', 'miss'); else if (mult === 2) log(tgt.name + ' is vulnerable to ' + dtype + ' (doubled to ' + dmg + ')!', 'crit');
    if (!tgt.mon && tgt.cls === 'rogue' && tgt.level >= 5 && ctx.isAttack && !tgt.turn?.reaction && !R.has(tgt, 'paralyzed')) { dmg = Math.floor(dmg / 2); if (tgt.turn) tgt.turn.reaction = true; log(tgt.name + ' uses Uncanny Dodge: damage halved to ' + dmg + '.', 'miss'); }
    if (tgt.tempHp > 0) { const a = Math.min(tgt.tempHp, dmg); tgt.tempHp -= a; dmg -= a; }
    if (tgt.mon && tgt.vampiricSource) { /* handled by caller */ }
    const before = tgt.hp; tgt.hp -= dmg;
    if (R.has(tgt, 'asleep') && dmg > 0) R.removeCondition(tgt, 'asleep');
    if (tgt.concentration && dmg > 0 && !tgt.mon) { const dc = Math.max(10, Math.floor(dmg / 2)); const rec = R.savingThrow(tgt, 'con', dc, { label: 'Concentration (' + SPELLS[tgt.concentration.spell].name + ')' }); if (!rec.success) { log(tgt.name + ' loses concentration on ' + SPELLS[tgt.concentration.spell].name + '!', 'warn'); R.breakConcentration(tgt); } }
    tgt.flash = 0.25; tgt.flashColor = '#ff6060';
    const out = { taken: dmg, killed: false, downed: false };
    if (tgt.hp <= 0) {
      if (tgt.mon) {
        // Undead fortitude / relentless once
        if ((tgt.traits || []).includes('undeadFortitude') && dtype !== 'radiant' && !ctx.crit) { const rec = R.savingThrow(tgt, 'con', 5 + dmg, { label: 'Undead Fortitude' }); if (rec.success) { tgt.hp = 1; log(tgt.name + ' refuses to die! (Undead Fortitude)', 'warn'); return out; } }
        if (tgt.relentlessOnce) { tgt.relentlessOnce = false; tgt.hp = 1; log(tgt.name + ' fights on through sheer zeal!', 'warn'); return out; }
        tgt.hp = 0; tgt.dead = true; out.killed = true;
      } else {
        if (R.has(tgt, 'deathWard')) { R.removeCondition(tgt, 'deathWard'); tgt.hp = 1; log('Death Ward saves ' + tgt.name + '!', 'heal'); return out; }
        if (tgt.resources.relentless && tgt.resources.relentless.used < tgt.resources.relentless.max && before > 0) { tgt.resources.relentless.used++; tgt.hp = 1; log(tgt.name + ' endures through Relentless Endurance!', 'heal'); return out; }
        const massive = -tgt.hp >= tgt.maxHp;
        tgt.hp = 0;
        if (massive) { tgt.dead = true; out.killed = true; log(tgt.name + ' is slain outright by massive damage!', 'warn'); }
        else if (tgt.downed) { tgt.deathSaves.f += ctx.crit ? 2 : 1; log(tgt.name + ' takes a hit while down: death save failure!', 'warn'); if (tgt.deathSaves.f >= 3) { tgt.dead = true; out.killed = true; } }
        else { tgt.downed = true; tgt.stable = false; tgt.deathSaves = { s: 0, f: 0 }; out.downed = true; R.breakConcentration(tgt); tgt.conditions = tgt.conditions.filter((c) => ['bless'].includes(c.id)); }
      }
    }
    return out;
  };
  R.heal = (tgt, amount, ctx) => { if (tgt.dead) return 0; if (R.has(tgt, 'noHeal') || R.has(tgt, 'cursed')) return 0; if (R.has(tgt, 'beaconOfHope') && ctx && ctx.expr) amount = Dice.max(ctx.expr.replace('MOD', ctx.mod || 0)); const before = tgt.hp; tgt.hp = Math.min(tgt.maxHp, tgt.hp + amount); if (tgt.hp > 0 && tgt.downed) { tgt.downed = false; tgt.stable = false; tgt.deathSaves = { s: 0, f: 0 }; } tgt.flash = 0.25; tgt.flashColor = '#80ff80'; return tgt.hp - before; };
  R.addCondition = (ent, id, rounds, extra) => { if (ent.mon && (ent.condImmune || []).includes(id)) return false; if (id === 'asleep' && !ent.mon && R.raceFeat(ent, 'feyAncestry')) return false; const ex = R.cond(ent, id); if (ex) { ex.rounds = Math.max(ex.rounds, rounds); Object.assign(ex, extra || {}); return true; } ent.conditions.push(Object.assign({ id, rounds }, extra || {})); return true; };
  R.removeCondition = (ent, id) => { ent.conditions = (ent.conditions || []).filter((c) => c.id !== id); };
  R.breakConcentration = (ent) => { if (!ent.concentration) return; const c = ent.concentration; ent.concentration = null; if (c.targets && c.remove) for (const t of c.targets) R.removeCondition(t, c.remove); if (c.onEnd) c.onEnd(); };
  R.canAct = (ent) => !ent.dead && !ent.downed && !R.has(ent, 'paralyzed') && !R.has(ent, 'asleep') && !R.has(ent, 'stunned') && !R.has(ent, 'commanded');
  // Start-of-turn condition upkeep: durations, repeated saves, ongoing damage. Returns log lines.
  R.startTurn = (ent, log) => {
    log = log || (() => {});
    for (const c of (ent.conditions || []).slice()) {
      if (c.id === 'burning') { const r = Dice.roll('1d4', { label: 'Burning', kind: 'dmg' }); R.applyDamage(ent, r.total, 'fire', { log }); log(ent.name + ' burns for ' + r.total + '.', 'hit'); const s = R.savingThrow(ent, 'dex', 10, { label: 'Put out flames' }); if (s.success) { R.removeCondition(ent, 'burning'); log(ent.name + ' puts out the flames.', 'miss'); } }
      if (c.repeatSave && c.dc) { const s = R.savingThrow(ent, c.repeatSave, c.dc, { label: 'Shake off ' + c.id }); if (s.success) { R.removeCondition(ent, c.id); log(ent.name + ' shakes off ' + c.id + '!', 'heal'); continue; } }
      if (c.id === 'ensnared') { const r = Dice.roll('1d6', { label: 'Ensnaring thorns', kind: 'dmg' }); R.applyDamage(ent, r.total, 'piercing', { log }); }
    }
    if (ent.mon) { const reg = (ent.traits || []).find((t) => String(t).startsWith('regeneration')); if (reg && ent.hp > 0 && !ent.noRegen) { const n = parseInt(reg.split(':')[1] || '10', 10); const h = R.heal(ent, n); if (h > 0) log(ent.name + ' regenerates ' + h + ' HP.', 'heal'); } ent.noRegen = false; }
    ent.turn = { moved: 0, action: false, bonus: false, reaction: false, attacksLeft: 0, extraActions: 0, sneakUsed: false, colossusUsed: false, divineStrikeUsed: false, dashed: false, disengaged: false };
    if (R.has(ent, 'haste')) ent.turn.extraActions = 1;
    if (!ent.mon) R.removeCondition(ent, 'reckless');
  };
  R.endTurn = (ent, log) => { // tick durations
    for (const c of (ent.conditions || []).slice()) { if (c.rounds !== undefined && c.rounds < 900) { c.rounds--; if (c.rounds <= 0) { R.removeCondition(ent, c.id); if (log && !['guided', 'noReactions', 'shield', 'noHeal', 'commanded', 'dodging', 'hidden', 'reckless'].includes(c.id)) log(ent.name + ' is no longer ' + c.id + '.', 'miss'); } } }
    if (ent.concentration && ent.concentration.rounds !== undefined) { ent.concentration.rounds--; if (ent.concentration.rounds <= 0) R.breakConcentration(ent); }
  };
  R.clearCombatState = (ent) => { ent.conditions = (ent.conditions || []).filter((c) => ['mageArmor', 'deathWard', 'passWithoutTrace', 'poisoned', 'cursed', 'weakened', 'aidBoost'].includes(c.id) || c.rounds >= 900); if (ent.concentration && !['mageArmor', 'passWithoutTrace'].includes(ent.concentration.spell)) R.breakConcentration(ent); ent.turn = null; ent.activeTurn = false; };

  // ---- Rests ----
  R.shortRest = (ch, log) => { // spend hit dice until above 75% (auto), restore short-rest resources
    log = log || (() => {}); if (ch.dead) return; if (ch.downed) { ch.downed = false; ch.hp = 1; }
    const total = ch.level + (R.raceFeat(ch, 'tranceRest') ? 1 : 0); let spent = 0;
    while (ch.hitDice.used < total && ch.hp < ch.maxHp * 0.8) { ch.hitDice.used++; const r = Dice.roll('1d' + CLASSES[ch.cls].hitDie, { label: ch.name + ' hit die', kind: 'heal', silent: true }); let h = Math.max(0, r.total + R.abMod(ch, 'con')); if (R.accBonus(ch, 'doubleHitDice')) h *= 2; ch.hp = Math.min(ch.maxHp, ch.hp + h); spent++; }
    if (spent) log(ch.name + ' spends ' + spent + ' hit ' + (spent === 1 ? 'die' : 'dice') + ' and recovers to ' + ch.hp + '/' + ch.maxHp + ' HP.', 'heal');
    const r = ch.resources; ['secondWind', 'actionSurge', 'channelDivinity', 'wardingFlare', 'breathWeapon'].forEach((k) => { if (r[k]) r[k].used = 0; });
    if (r.arcaneRecovery && r.arcaneRecovery.used < 1 && ch.cls === 'wizard') { let budget = Math.ceil(ch.level / 2), got = []; for (let l = Math.min(5, budget); l >= 1; l--) { while (budget >= l && ch.spells.slots[l] && ch.spells.slots[l].used > 0) { ch.spells.slots[l].used--; budget -= l; got.push(l); } } if (got.length) { r.arcaneRecovery.used = 1; log(ch.name + ' recovers spell slots (Arcane Recovery): ' + got.map((l) => U.ordinal(l)).join(', ') + '.', 'heal'); } }
    ch.conditions = ch.conditions.filter((c) => c.rounds >= 900 || ['poisoned', 'cursed'].includes(c.id));
  };
  R.longRest = (ch) => { if (ch.dead) return; ch.hp = ch.maxHp; ch.tempHp = 0; ch.downed = false; ch.stable = false; ch.deathSaves = { s: 0, f: 0 }; ch.hitDice.used = Math.max(0, ch.hitDice.used - Math.max(1, Math.floor(ch.level / 2))); ch.conditions = ch.conditions.filter((c) => c.id === 'cursed'); ch.concentration = null; Character.resetResources(ch); ch.maxHpBoost = 0; if (ch.usedItems) ch.usedItems = {}; };

  // ---- XP & Levels ----
  R.xpToNext = (ch) => ch.level >= MAX_LEVEL ? Infinity : XP_TABLE[ch.level];
  R.gainXp = (ch, xp) => { if (ch.dead) return 0; ch.xp += xp; let ups = 0; while (ch.level < MAX_LEVEL && ch.xp >= XP_TABLE[ch.level]) { ch.pendingLevel = (ch.pendingLevel || 0) + 1; ch.level++; ups++; } if (ups) ch.level -= ups; return ups; }; // level applied by levelUp()
  // Apply one level. choices: {asi:{str:2} , spells:[ids], cantrip:id} ; auto=true picks for companions
  R.levelUp = (ch, choices, auto) => {
    if (ch.level >= MAX_LEVEL) return null; ch.level++; if (ch.pendingLevel) ch.pendingLevel--;
    const cl = CLASSES[ch.cls]; const gained = { level: ch.level, features: (cl.features[ch.level] || []).slice(), hp: 0, spells: [] };
    const hpGain = Math.floor(cl.hitDie / 2) + 1 + R.abMod(ch, 'con') + (RACES[ch.race].feats.hpPerLevel || 0); ch.maxHp += Math.max(1, hpGain); ch.hp += Math.max(1, hpGain); gained.hp = Math.max(1, hpGain);
    const hasASI = gained.features.some((f) => f.id === 'asi');
    if (hasASI) { let asi = choices && choices.asi; if (!asi) { const p = cl.primary[0]; asi = ch.abilities[p] >= 20 ? { [cl.primary[1]]: 2 } : ch.abilities[p] >= 19 ? { [p]: 1, [cl.primary[1]]: 1 } : { [p]: 2 }; } for (const k in asi) ch.asi[k] = (ch.asi[k] || 0) + asi[k]; Character.recompute(ch); gained.asi = asi; }
    if (gained.features.some((f) => f.id === 'expertise2') && ch.cls === 'rogue') { const more = ch.skillProf.filter((s) => !ch.expertise.includes(s)).slice(0, 2); ch.expertise.push(...more); }
    if (cl.spellcasting) {
      const before = ch.spells.known.slice(), beforeC = ch.spells.cantrips.slice();
      if (choices && choices.spells) choices.spells.forEach((s) => { if (!ch.spells.known.includes(s)) ch.spells.known.push(s); });
      if (choices && choices.cantrip && !ch.spells.cantrips.includes(choices.cantrip)) ch.spells.cantrips.push(choices.cantrip);
      Character.fillSpells(ch);
      gained.spells = ch.spells.known.filter((s) => !before.includes(s)).concat(ch.spells.cantrips.filter((s) => !beforeC.includes(s)));
    }
    Character.resetResources(ch);
    return gained;
  };
  R.sneakDice = (ch) => Math.ceil(ch.level / 2);

  // ---- Monsters ----
  R.spawnMonster = (id, opts) => {
    opts = opts || {}; const d = MONSTERS[id]; if (!d) throw new Error('no monster ' + id);
    const hp = opts.maxHp ? Dice.max(d.hp) : Math.max(1, Dice.roll(d.hp, { silent: true }).total);
    const m = { id: U.uid('m'), mon: id, name: d.name, hostile: true, team: 'monsters', ac: d.ac, hp, maxHp: hp, speed: d.speed, abilities: Object.assign({}, d.ab), size: d.size, type: d.type, cr: d.cr, xp: d.xp,
      attacks: U.deepClone(d.attacks), multiattack: d.multiattack ? d.multiattack.slice() : null, traits: (d.traits || []).slice(), resist: d.resist || [], immune: d.immune || [], vuln: d.vuln || [], condImmune: d.condImmune || [], skills: d.skills || {}, senses: d.senses || {},
      spells: d.spells ? d.spells.slice() : null, spellAb: d.spellAb, spellDC: d.spellDC, spellHit: d.spellHit, morale: d.morale || 'normal', boss: !!opts.boss || !!d.boss, conditions: [], x: opts.x || 0, y: opts.y || 0, facing: 'l', dead: false, alerted: false, groupId: opts.groupId || null, recharge: {}, level: Math.max(1, Math.round(d.cr * 2)) };
    m.ax = m.x; m.ay = m.y;
    const lr = m.traits.find((t) => String(t).startsWith('legendaryResistance')); if (lr) m.legendaryResist = parseInt(lr.split(':')[1], 10) || 2;
    if (opts.boss && opts.modifier) { const mod = typeof opts.modifier === 'string' ? NAMES.bossModifiers.find((x) => x.id === opts.modifier) : opts.modifier; if (mod) { mod.apply(m); m.modifier = mod.id; m.name = mod.name + ' ' + m.name; } }
    if (opts.name) m.name = opts.name;
    return m;
  };
  R.monsterAttackBonus = (m, atk) => atk.hit;
  R.xpForParty = (monsters, partySize) => { const total = monsters.reduce((s, m) => s + (m.xp || 0), 0); return Math.max(1, Math.floor(total / Math.max(1, partySize))); };
  window.Rules = R;
})();
