/* Items — weapons, armor, consumables, accessories, scrolls, quest items. SRD-inspired.
   Weapon props: finesse, light, heavy, twoHanded, versatile:XdY, reach, thrown, ammo, loading. */
(function () {
  const I = {};
  const W = (id, name, cat, dmg, dtype, props, cost, extra) => { I[id] = Object.assign({ id, name, type: 'weapon', cat, dmg, dtype, props: props || [], cost, icon: 'sword', tier: 1 }, extra || {}); };
  // Simple melee
  W('club', 'Club', 'simple', '1d4', 'bludgeoning', ['light'], 1, { icon: 'club' });
  W('dagger', 'Dagger', 'simple', '1d4', 'piercing', ['finesse', 'light', 'thrown'], 2, { range: [20, 60], icon: 'dagger' });
  W('handaxe', 'Handaxe', 'simple', '1d6', 'slashing', ['light', 'thrown'], 5, { range: [20, 60], icon: 'axe' });
  W('javelin', 'Javelin', 'simple', '1d6', 'piercing', ['thrown'], 5, { range: [30, 120], icon: 'spear' });
  W('mace', 'Mace', 'simple', '1d6', 'bludgeoning', [], 5, { icon: 'mace' });
  W('quarterstaff', 'Quarterstaff', 'simple', '1d6', 'bludgeoning', ['versatile:1d8'], 2, { icon: 'staff' });
  W('spear', 'Spear', 'simple', '1d6', 'piercing', ['thrown', 'versatile:1d8'], 1, { range: [20, 60], icon: 'spear' });
  W('greatclub', 'Greatclub', 'simple', '1d8', 'bludgeoning', ['twoHanded'], 2, { icon: 'club' });
  // Simple ranged
  W('lightCrossbow', 'Light Crossbow', 'simple', '1d8', 'piercing', ['ammo', 'twoHanded', 'loading'], 25, { range: [80, 320], ranged: true, icon: 'crossbow' });
  W('shortbow', 'Shortbow', 'simple', '1d6', 'piercing', ['ammo', 'twoHanded'], 25, { range: [80, 320], ranged: true, icon: 'bow' });
  W('sling', 'Sling', 'simple', '1d4', 'bludgeoning', ['ammo'], 1, { range: [30, 120], ranged: true, icon: 'sling' });
  W('dart', 'Darts', 'simple', '1d4', 'piercing', ['finesse', 'thrown'], 1, { range: [20, 60], ranged: true, icon: 'dagger' });
  // Martial melee
  W('battleaxe', 'Battleaxe', 'martial', '1d8', 'slashing', ['versatile:1d10'], 10, { icon: 'axe' });
  W('flail', 'Flail', 'martial', '1d8', 'bludgeoning', [], 10, { icon: 'mace' });
  W('glaive', 'Glaive', 'martial', '1d10', 'slashing', ['heavy', 'reach', 'twoHanded'], 20, { icon: 'spear' });
  W('greataxe', 'Greataxe', 'martial', '1d12', 'slashing', ['heavy', 'twoHanded'], 30, { icon: 'greataxe' });
  W('greatsword', 'Greatsword', 'martial', '2d6', 'slashing', ['heavy', 'twoHanded'], 50, { icon: 'greatsword' });
  W('longsword', 'Longsword', 'martial', '1d8', 'slashing', ['versatile:1d10'], 15, { icon: 'sword' });
  W('maul', 'Maul', 'martial', '2d6', 'bludgeoning', ['heavy', 'twoHanded'], 10, { icon: 'hammer' });
  W('morningstar', 'Morningstar', 'martial', '1d8', 'piercing', [], 15, { icon: 'mace' });
  W('rapier', 'Rapier', 'martial', '1d8', 'piercing', ['finesse'], 25, { icon: 'rapier' });
  W('scimitar', 'Scimitar', 'martial', '1d6', 'slashing', ['finesse', 'light'], 25, { icon: 'scimitar' });
  W('shortsword', 'Shortsword', 'martial', '1d6', 'piercing', ['finesse', 'light'], 10, { icon: 'shortsword' });
  W('warhammer', 'Warhammer', 'martial', '1d8', 'bludgeoning', ['versatile:1d10'], 15, { icon: 'hammer' });
  W('warpick', 'War Pick', 'martial', '1d8', 'piercing', [], 5, { icon: 'axe' });
  // Martial ranged
  W('longbow', 'Longbow', 'martial', '1d8', 'piercing', ['ammo', 'heavy', 'twoHanded'], 50, { range: [150, 600], ranged: true, icon: 'bow' });
  W('handCrossbow', 'Hand Crossbow', 'martial', '1d6', 'piercing', ['ammo', 'light', 'loading'], 75, { range: [30, 120], ranged: true, icon: 'crossbow' });
  W('heavyCrossbow', 'Heavy Crossbow', 'martial', '1d10', 'piercing', ['ammo', 'heavy', 'twoHanded', 'loading'], 50, { range: [100, 400], ranged: true, icon: 'crossbow' });

  // Armor: cat light (AC + full Dex), medium (Dex max 2), heavy (no Dex, may need Str)
  const A = (id, name, cat, ac, cost, extra) => { I[id] = Object.assign({ id, name, type: 'armor', cat, ac, cost, icon: 'armor', tier: 1 }, extra || {}); };
  A('paddedArmor', 'Padded Armor', 'light', 11, 5, { stealthDis: true });
  A('leatherArmor', 'Leather Armor', 'light', 11, 10);
  A('studdedLeather', 'Studded Leather', 'light', 12, 45, { tier: 2 });
  A('hideArmor', 'Hide Armor', 'medium', 12, 10);
  A('chainShirt', 'Chain Shirt', 'medium', 13, 50, { tier: 2 });
  A('scaleMail', 'Scale Mail', 'medium', 14, 50, { stealthDis: true, tier: 2 });
  A('breastplate', 'Breastplate', 'medium', 14, 400, { tier: 3 });
  A('halfPlate', 'Half Plate', 'medium', 15, 750, { stealthDis: true, tier: 3 });
  A('ringMail', 'Ring Mail', 'heavy', 14, 30, { stealthDis: true });
  A('chainMail', 'Chain Mail', 'heavy', 16, 75, { strReq: 13, stealthDis: true, tier: 2 });
  A('splintArmor', 'Splint Armor', 'heavy', 17, 200, { strReq: 15, stealthDis: true, tier: 3 });
  A('plateArmor', 'Plate Armor', 'heavy', 18, 1500, { strReq: 15, stealthDis: true, tier: 4 });
  I.shield = { id: 'shield', name: 'Shield', type: 'shield', ac: 2, cost: 10, icon: 'shield', tier: 1 };

  // Consumables
  const C = (id, name, effect, cost, desc, extra) => { I[id] = Object.assign({ id, name, type: 'consumable', effect, cost, desc, icon: 'potion', stack: true }, extra || {}); };
  C('potionHealing', 'Potion of Healing', { heal: '2d4+2' }, 50, 'Regain 2d4+2 HP. Drink as a bonus action.', { icon: 'potionRed' });
  C('potionGreaterHealing', 'Potion of Greater Healing', { heal: '4d4+4' }, 150, 'Regain 4d4+4 HP.', { icon: 'potionRed', tier: 2 });
  C('potionSuperiorHealing', 'Potion of Superior Healing', { heal: '8d4+8' }, 450, 'Regain 8d4+8 HP.', { icon: 'potionRed', tier: 3 });
  C('antitoxin', 'Antitoxin', { cure: ['poisoned'], status: { id: 'poisonResist', rounds: 10 } }, 50, 'Cures poison and grants advantage on poison saves for 1 minute.', { icon: 'potionGreen' });
  C('potionSpeed', 'Potion of Speed', { status: { id: 'haste', rounds: 10 } }, 400, 'Haste yourself for 1 minute.', { icon: 'potionYellow', tier: 3 });
  C('potionHeroism', 'Potion of Heroism', { status: { id: 'bless', rounds: 10 }, tempHp: 10 }, 180, 'Gain 10 temporary HP and Bless for 1 minute.', { icon: 'potionYellow', tier: 2 });
  C('potionFireBreath', 'Potion of Fire Breath', { status: { id: 'fireBreath', rounds: 10 } }, 150, 'Breathe fire: your next action can exhale a 4d6 cone (Dex save).', { icon: 'potionOrange', tier: 2 });
  C('goodberry', 'Goodberry', { heal: '1' }, 0, 'A magical berry. Restores 1 HP.', { icon: 'berry' });
  C('rations', 'Trail Rations', { rest: true }, 5, 'Enables a short rest in a dungeon (consumed).', { icon: 'food' });
  C('torch', 'Torch', { light: true }, 1, 'Light radius +2 tiles for the dungeon.', { icon: 'torch' });
  C('holyWater', 'Holy Water', { throwDamage: '2d6', dtype: 'radiant', vsTypes: ['undead', 'fiend'] }, 25, 'Throw at an undead or fiend: 2d6 radiant.', { icon: 'potionBlue' });
  C('alchemistFire', "Alchemist's Fire", { throwDamage: '1d4', dtype: 'fire', burn: true }, 50, 'Throw: 1d4 fire and the target burns for 1d4 each turn (Dex save to put out).', { icon: 'potionOrange' });
  I.thievesTools = { id: 'thievesTools', name: "Thieves' Tools", type: 'tool', cost: 25, icon: 'tools', desc: 'Lockpicks and trap kit. Add proficiency to lockpicking/disarm checks.' };
  I.spellbook = { id: 'spellbook', name: 'Spellbook', type: 'tool', cost: 50, icon: 'book', desc: 'Your spells, in your own handwriting. Mostly.' };
  I.holySymbol = { id: 'holySymbol', name: 'Holy Symbol', type: 'tool', cost: 5, icon: 'amulet', desc: 'A focus for divine magic.' };
  I.lantern = { id: 'lantern', name: 'Hooded Lantern', type: 'tool', cost: 5, icon: 'torch', desc: 'Light radius +3 tiles in dungeons.', light: 3 };

  // Accessories (magic items) — bonus applied by rules.js
  const M = (id, name, rarity, bonus, cost, desc, extra) => { I[id] = Object.assign({ id, name, type: 'accessory', rarity, bonus: bonus || {}, cost, desc, icon: 'ring', tier: rarity === 'uncommon' ? 2 : rarity === 'rare' ? 3 : 4 }, extra || {}); };
  M('ringProtection', 'Ring of Protection', 'rare', { ac: 1, saves: 1 }, 800, '+1 AC and +1 to all saving throws.');
  M('amuletHealth', 'Amulet of Health', 'rare', { setAbility: { con: 19 } }, 1200, 'Your Constitution becomes 19.', { icon: 'amulet' });
  M('gauntletsOgre', 'Gauntlets of Ogre Power', 'uncommon', { setAbility: { str: 19 } }, 900, 'Your Strength becomes 19.', { icon: 'gloves' });
  M('headbandIntellect', 'Headband of Intellect', 'uncommon', { setAbility: { int: 19 } }, 900, 'Your Intelligence becomes 19.', { icon: 'circlet' });
  M('cloakElvenkind', 'Cloak of Elvenkind', 'uncommon', { advSkill: ['stealth'] }, 500, 'Advantage on Stealth checks.', { icon: 'cloak' });
  M('cloakProtection', 'Cloak of Protection', 'uncommon', { ac: 1, saves: 1 }, 700, '+1 AC and +1 saves.', { icon: 'cloak' });
  M('bootsSpeed', 'Boots of Speed', 'rare', { speed: 10 }, 900, '+10 ft movement speed.', { icon: 'boots' });
  M('bootsBlinking', 'Boots of Blinking', 'rare', { blink: true }, 1100, 'Bonus action: teleport 3 tiles (once per combat).', { icon: 'boots', legendary: true });
  M('ringFireResist', 'Ring of Fire Resistance', 'rare', { resist: ['fire'] }, 600, 'Resistance to fire damage.');
  M('ringSecondChance', 'Ring of Second Chance', 'rare', { rerollNat1: true }, 1000, 'Reroll one natural 1 per dungeon.', { legendary: true });
  M('diceOfFate', 'Dice of Fate', 'legendary', { fate: true }, 3000, 'Once per dungeon, declare a d20 roll a natural 20 before rolling.', { icon: 'd20', legendary: true });
  M('lanternRevealing', 'Lantern of Revealing', 'rare', { revealSecrets: true, light: 3 }, 800, 'Secret doors and traps within your light are revealed automatically.', { icon: 'torch', legendary: true });
  M('bagRations', 'Bag of Endless Rations', 'uncommon', { freeRest: true }, 600, 'Short rests in dungeons never consume rations.', { icon: 'bag', legendary: true });
  M('periaptWoundClosure', 'Periapt of Wound Closure', 'uncommon', { stabilize: true, doubleHitDice: true }, 700, 'You stabilize automatically when dying and hit dice heal double.', { icon: 'amulet' });
  M('braceletsDefense', 'Bracers of Defense', 'rare', { acUnarmored: 2 }, 900, '+2 AC while wearing no armor.', { icon: 'gloves' });
  M('wandMagicMissiles', 'Wand of Magic Missiles', 'uncommon', { wandSpell: 'magicMissile', charges: 3 }, 600, 'Any hero can cast Magic Missile 3 times per dungeon.', { icon: 'wand' });
  M('circletBlasting', 'Circlet of Blasting', 'uncommon', { wandSpell: 'scorchingRay', charges: 1 }, 500, 'Cast Scorching Ray once per dungeon.', { icon: 'circlet' });

  // Scrolls: any caster of the spell's list casts freely; others need an Arcana check DC 10 + spell level.
  const scrollFor = (spellId) => { const s = SPELLS[spellId]; return { id: 'scroll_' + spellId, name: 'Scroll of ' + s.name, type: 'scroll', spell: spellId, cost: [25, 75, 150, 300, 500, 1000][s.level], icon: 'scroll', stack: true, tier: Math.max(1, s.level), desc: 'Single-use. Casters of this spell\'s class read it freely; others need an Arcana check (DC ' + (10 + s.level) + ').' }; };
  ['magicMissile', 'burningHands', 'cureWounds', 'bless', 'sleep', 'shield', 'scorchingRay', 'holdPerson', 'shatter', 'fireball', 'lightningBolt', 'revivify', 'iceStorm', 'flameStrike', 'massCureWounds', 'guidingBolt', 'mistyStep', 'haste'].forEach((id) => { const sc = scrollFor(id); I[sc.id] = sc; });
  I.scrollMagicMissile = I.scroll_magicMissile;

  // Quest items
  const Q = (id, name, desc, icon) => { I[id] = { id, name, type: 'quest', desc, icon: icon || 'gem', cost: 0 }; };
  Q('sigilCoin', 'Sigil-Stamped Coin', 'A gold coin stamped with a spiral of eyes. Whoever robbed you carried this.', 'coin');
  Q('cultLetter', 'Sealed Letter', 'Written in a looping hand: "The forgetful one wakes at the Flagon. Watch them."', 'scroll');
  Q('cryptKey', 'Iron Crypt Key', 'Heavy and cold. Opens something you probably shouldn\'t open.', 'key');
  Q('dungeonKey', 'Rusty Key', 'Opens a locked door somewhere in this dungeon.', 'key');
  Q('memoryVial', 'Vial of Grey Mist', 'The mist inside swirls when you look at it. It smells like a name you almost remember.', 'potionGrey');
  Q('captainLedger', "Bandit Captain's Ledger", 'Names, dates, payments. One entry is circled: "Delivered the sleeper. 200gp. — V."', 'book');
  Q('templeIdol', 'Idol of the Spiral Eye', 'A palm-sized idol. Its eyes seem to follow the dice.', 'gem');
  Q('lostLocket', 'Silver Locket', 'A locket with a tiny portrait inside. Somebody misses this.', 'amulet');
  Q('caravanManifest', 'Caravan Manifest', 'Lists a shipment of "assorted reagents" to a buyer in Hollowmere.', 'scroll');
  Q('ancientTablet', 'Ancient Tablet', 'Cracked stone covered in runes. Arcana might read it.', 'gem');

  // Magic weapon factory: makeMagicWeapon('longsword', {bonus:1, extraDmg:'1d6', extraType:'fire', name:'Flame Tongue'})
  window.makeMagicWeapon = (baseId, magic) => {
    const base = I[baseId]; if (!base) return null;
    const w = U.deepClone(base);
    w.base = baseId; w.magic = magic; w.id = baseId + '_' + (magic.name || ('p' + magic.bonus)).replace(/\W+/g, '');
    w.name = magic.name ? magic.name + ' ' + base.name : base.name + ' +' + magic.bonus;
    w.rarity = magic.rarity || (magic.bonus >= 3 ? 'legendary' : magic.bonus === 2 ? 'rare' : 'uncommon');
    w.cost = base.cost + (magic.bonus || 0) * 500 + (magic.extraDmg ? 800 : 0);
    w.tier = 2 + (magic.bonus || 0);
    w.desc = (magic.bonus ? '+' + magic.bonus + ' to attack and damage. ' : '') + (magic.extraDmg ? 'Deals an extra ' + magic.extraDmg + ' ' + magic.extraType + ' damage. ' : '') + (magic.desc || '');
    return w;
  };
  window.makeMagicArmor = (baseId, bonus) => { const a = U.deepClone(I[baseId]); a.base = baseId; a.id = baseId + '_p' + bonus; a.name = a.name + ' +' + bonus; a.magicBonus = bonus; a.rarity = bonus >= 2 ? 'rare' : 'uncommon'; a.cost = a.cost + bonus * 600; a.tier = a.tier + bonus; a.desc = '+' + bonus + ' AC.'; return a; };

  window.ITEMS = I;
  // Resolve an item id that may be a generated magic item (encoded as base|json) or plain id
  window.getItem = (idOrObj) => {
    if (!idOrObj) return null;
    if (typeof idOrObj === 'object') return idOrObj;
    return I[idOrObj] || null;
  };
})();
