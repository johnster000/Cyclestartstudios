/* Character creation, companions, and progression data. Rules-derived numbers live in rules.js. */
(function () {
  const C = {};
  C.standardArray = [15, 14, 13, 12, 10, 8];
  C.hairStyles = ['short', 'long', 'ponytail', 'mohawk', 'bun', 'spiky', 'curly', 'bald'];
  C.hairColors = ['#2a1a0a', '#5a3a1a', '#8a5a2a', '#c08a3a', '#e0c060', '#c04020', '#e0e0e0', '#3a3a5a', '#8a2a8a', '#2a8a5a'];
  C.clothColors = ['#5a6a9a', '#8a3a2a', '#3a7a4a', '#6a3a7a', '#c07a2a', '#3a3a3a', '#a0a0b0', '#2a6a8a', '#8a7a3a', '#c05070'];
  C.newDraft = () => ({ name: '', sex: 'm', race: 'human', cls: 'fighter', hairStyle: 'short', hairColor: C.hairColors[1], clothesColor: C.clothColors[0], skin: RACES.human.skinTones[1], method: 'recommended', base: null, rolled: null, skills: [], choices: {} });
  C.rollAbilities = () => { // 4d6 drop lowest, six times, all shown
    const out = []; for (let i = 0; i < 6; i++) { const r = Dice.roll('4d6', { label: 'Ability roll ' + (i + 1), kind: 'misc' }); const vals = r.rolls.map((x) => x.v).sort((a, b) => b - a); out.push(vals[0] + vals[1] + vals[2]); } return out;
  };
  C.recommendedBase = (cls) => Object.assign({}, CLASSES[cls].recommended);
  C.applyRace = (base, race) => { const r = RACES[race], out = {}; ABILITIES.forEach((a) => { out[a] = (base[a] || 10) + (r.bonus[a] || 0); }); return out; };
  C.defaultSkills = (cls, race) => { const cl = CLASSES[cls]; const picks = cl.skills.slice(0, cl.skillCount); return picks; };

  // Turn a creator draft into a real character
  C.finalize = (d) => {
    const cl = CLASSES[d.cls], race = RACES[d.race];
    const base = d.base || C.recommendedBase(d.cls);
    const ch = {
      id: U.uid('pc'), name: d.name || NAMES.random(d.race, d.sex), sex: d.sex, race: d.race, cls: d.cls, level: 1, xp: 0,
      hairStyle: d.hairStyle, hairColor: d.hairColor, clothesColor: d.clothesColor, skin: d.skin,
      base, asi: {}, abilities: {}, hp: 0, maxHp: 0, tempHp: 0, hitDice: { used: 0 },
      skillProf: (d.skills && d.skills.length ? d.skills : C.defaultSkills(d.cls, d.race)).slice(), expertise: (d.choices.expertise || []).slice(),
      equipment: { mainHand: null, offHand: null, armor: null, accessory: null }, spells: { cantrips: [], known: [], slots: {} },
      choices: Object.assign({}, d.choices), resources: {}, conditions: [], concentration: null, isParty: true, isPlayer: !!d.isPlayer, team: 'party',
      x: 0, y: 0, facing: 'r', dead: false, downed: false, deathSaves: { s: 0, f: 0 }, personality: d.personality || null, joinedAt: 1,
    };
    if (race.feats.skillProf) race.feats.skillProf.forEach((s) => { if (!ch.skillProf.includes(s)) ch.skillProf.push(s); });
    C.recompute(ch);
    // Spells
    if (cl.spellcasting) {
      const sc = cl.spellcasting;
      if (d.choices.cantrips) ch.spells.cantrips = d.choices.cantrips.slice();
      if (d.choices.spells) ch.spells.known = d.choices.spells.slice();
      if (sc.knowsAll) ch.spells.known = spellList(d.cls).filter((s) => s.level >= 1).map((s) => s.id);
      if (d.choices.domain === 'light') { if (!ch.spells.cantrips.includes('fireBolt')) ch.spells.cantrips.push('fireBolt'); if (!ch.spells.known.includes('burningHands')) ch.spells.known.push('burningHands'); }
      C.fillSpells(ch);
    }
    if (race.feats.bonusCantrip) ch.spells.cantrips.push(race.feats.bonusCantrip);
    // HP at level 1: max hit die + con
    ch.maxHp = cl.hitDie + Rules.mod(ch.abilities.con) + (race.feats.hpPerLevel || 0); ch.hp = ch.maxHp;
    C.startingKit(ch, d.choices.weapon);
    C.resetResources(ch);
    return ch;
  };
  // recompute ability scores from base + race + ASIs + items
  C.recompute = (ch) => {
    const race = RACES[ch.race]; ABILITIES.forEach((a) => { ch.abilities[a] = (ch.base[a] || 10) + (race.bonus[a] || 0) + (ch.asi[a] || 0); });
    const acc = getItem(ch.equipment && ch.equipment.accessory); if (acc && acc.bonus && acc.bonus.setAbility) for (const k in acc.bonus.setAbility) ch.abilities[k] = Math.max(ch.abilities[k], acc.bonus.setAbility[k]);
    ABILITIES.forEach((a) => { ch.abilities[a] = Math.min(20, ch.abilities[a]); if (acc && acc.bonus && acc.bonus.setAbility && acc.bonus.setAbility[a]) ch.abilities[a] = Math.max(ch.abilities[a], acc.bonus.setAbility[a]); });
  };
  C.fillSpells = (ch) => { // make sure spell counts match level (used for companions and level ups)
    const sc = CLASSES[ch.cls].spellcasting; if (!sc) return;
    const maxLvl = Rules.maxSpellLevel(ch);
    const cantripCount = C.cantripsKnown(ch);
    const cantrips = spellList(ch.cls, 0).map((s) => s.id).filter((id) => !ch.spells.cantrips.includes(id));
    while (ch.spells.cantrips.length < cantripCount && cantrips.length) ch.spells.cantrips.push(cantrips.shift());
    if (sc.knowsAll) { ch.spells.known = spellList(ch.cls).filter((s) => s.level >= 1 && s.level <= maxLvl).map((s) => s.id); return; }
    const want = C.spellsKnownCount(ch);
    const pool = spellList(ch.cls).filter((s) => s.level >= 1 && s.level <= maxLvl && !ch.spells.known.includes(s.id)).sort((a, b) => b.level - a.level || Math.random() - 0.5).map((s) => s.id);
    while (ch.spells.known.length < want && pool.length) ch.spells.known.push(pool.shift());
  };
  C.cantripsKnown = (ch) => { const sc = CLASSES[ch.cls].spellcasting; if (!sc || !sc.cantrips) return 0; let n = 0; for (const k of Object.keys(sc.cantrips).map(Number).sort((a, b) => a - b)) if (ch.level >= k) n = sc.cantrips[k]; return n; };
  C.spellsKnownCount = (ch) => { const sc = CLASSES[ch.cls].spellcasting; if (!sc) return 0; if (sc.knownTable) { let n = 0; for (const k of Object.keys(sc.knownTable).map(Number).sort((a, b) => a - b)) if (ch.level >= k) n = sc.knownTable[k]; return n; } return (sc.startSpells || 0) + (sc.learnPerLevel || 0) * (ch.level - 1); };

  C.startingKit = (ch, weaponId) => {
    const cl = CLASSES[ch.cls]; const w = weaponId || cl.startChoices.find((c) => c.type === 'weapon').options[0];
    const wpn = ITEMS[w]; ch.equipment.mainHand = w;
    const twoH = wpn.props.includes('twoHanded');
    const kit = (twoH && cl.startEquipTwoHanded) ? cl.startEquipTwoHanded : cl.startEquip;
    ch.pack = []; // items granted to party inventory by game on creation
    for (const id of kit) { const it = ITEMS[id]; if (!it) continue; if (it.type === 'armor' && !ch.equipment.armor && Rules.canEquip(ch, it)) ch.equipment.armor = id; else if (it.type === 'shield' && !twoH && !ch.equipment.offHand && !(wpn.ranged)) ch.equipment.offHand = id; else ch.pack.push(id); }
    if (ch.choices.domain === 'war' || ch.choices.domain === 'life') { /* heavy armor prof handled in rules */ }
  };
  C.resetResources = (ch) => {
    const r = ch.resources; const L = ch.level;
    if (ch.cls === 'barbarian') r.rage = { max: L >= 6 ? 4 : L >= 3 ? 3 : 2, used: 0 };
    if (ch.cls === 'fighter') { r.secondWind = { max: 1, used: 0 }; if (L >= 2) r.actionSurge = { max: 1, used: 0 }; if (L >= 9) r.indomitable = { max: 1, used: 0 }; }
    if (ch.cls === 'cleric' && L >= 2) r.channelDivinity = { max: L >= 6 ? 2 : 1, used: 0 };
    if (ch.cls === 'cleric' && ch.choices.domain === 'light') r.wardingFlare = { max: Math.max(1, Rules.mod(ch.abilities.wis)), used: 0 };
    if (ch.cls === 'cleric' && ch.choices.domain === 'war') r.warPriest = { max: Math.max(1, Rules.mod(ch.abilities.wis)), used: 0 };
    if (ch.cls === 'wizard') r.arcaneRecovery = { max: 1, used: 0 };
    if (ch.cls === 'cleric' && L >= 10) r.divineIntervention = { max: 1, used: 0 };
    if (RACES[ch.race].feats.breathWeapon) r.breathWeapon = { max: 1, used: 0 };
    if (RACES[ch.race].feats.relentless) r.relentless = { max: 1, used: 0 };
    if (RACES[ch.race].feats.hellishRebuke) r.hellishRebuke = { max: 1, used: 0 };
    ch.spells.slots = {}; const tbl = Rules.slotTable(ch); tbl.forEach((n, i) => { ch.spells.slots[i + 1] = { max: n, used: 0 }; });
  };

  // Random companion (recruits, rescued prisoners)
  C.randomCompanion = (level, rng, opts) => {
    rng = rng || Math.random; opts = opts || {};
    const race = opts.race || U.pick(Object.keys(RACES), rng), cls = opts.cls || U.pick(Object.keys(CLASSES), rng), sex = rng() < 0.5 ? 'm' : 'f';
    const d = C.newDraft(); Object.assign(d, { race, cls, sex, name: opts.name || NAMES.random(race, sex, rng), hairStyle: U.pick(C.hairStyles, rng), hairColor: U.pick(C.hairColors, rng), clothesColor: U.pick(C.clothColors, rng), skin: U.pick(RACES[race].skinTones, rng) });
    // base: recommended shuffled slightly (random traits)
    d.base = C.recommendedBase(cls); const ks = ABILITIES.slice(); const a = U.pick(ks, rng), b = U.pick(ks, rng); if (a !== b) { d.base[a] += 1; d.base[b] -= 1; }
    const cl = CLASSES[cls]; d.skills = U.shuffle(cl.skills, rng).slice(0, cl.skillCount);
    const wc = cl.startChoices.find((c) => c.type === 'weapon'); d.choices.weapon = U.pick(wc.options, rng);
    cl.startChoices.forEach((c) => { if (c.type === 'pick') d.choices[c.id] = U.pick(c.options, rng).id; if (c.type === 'expertise') d.choices.expertise = d.skills.slice(0, 2); if (c.type === 'spells') { const list = spellList(cls, c.level).map((s) => s.id); d.choices[c.id] = U.shuffle(list, rng).slice(0, c.count); } });
    d.personality = U.pick(NAMES.personalities, rng).id;
    const ch = C.finalize(d); ch.isPlayer = false; ch.quirk = NAMES.personalities.find((p) => p.id === ch.personality).quirk;
    ch.personalQuest = { done: false, title: U.pick(['A Debt in ' + U.cap(U.pick(Object.keys(NAMES.dungeonNames), rng)), 'The One That Got Away', 'Family Business', 'An Old Promise'], rng) };
    while (ch.level < (level || 1)) Rules.levelUp(ch, null, true);
    ch.hp = ch.maxHp; ch.hireCost = 20 + ch.level * 15;
    return ch;
  };
  C.summary = (ch) => CLASSES[ch.cls].name + ' ' + ch.level + ' · ' + RACES[ch.race].name;
  window.Character = C;
})();
