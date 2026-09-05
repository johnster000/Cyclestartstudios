/* Game controller: state machine (title → tavern → town → dungeon), main loop, input, exploration,
   interactions, dialogue, dungeon lifecycle, combat hooks, XP/levels, saving. */
(function () {
  const G = { state: null, map: null, mode: 'title', fast: false };
  const T = TILE; const log = (t, k) => G.log(t, k);
  Object.defineProperty(G, 'party', { get: () => (G.state ? G.state.party : []) });
  Object.defineProperty(G, 'monsters', { get: () => (G.map && G.map.monsters) || [] });
  G.log = (text, kind) => { UI.log(text, kind); };
  G.showRoll = (rec) => { /* Dice listener already animates; hook kept for combat */ };
  G.toast = (t) => UI.toast(t);
  G.fxDelay = (ms) => U.wait(G.fast ? Math.min(ms, 30) : ms);
  G.partyLevel = () => { const alive = G.party.filter((p) => !p.dead); return alive.length ? Math.round(alive.reduce((s, p) => s + p.level, 0) / alive.length) : 1; };
  G.entities = () => G.party.filter((p) => !p.dead || p.corpse).concat(G.map ? G.map.npcs : [], G.monsters.filter((m) => !m.escaped));
  G.entityAt = (x, y) => G.entities().find((e) => !e.dead && !e.hidden && e.x === x && e.y === y) || null;
  G.isFree = (x, y) => World.passable(G.map, x, y) && !G.entityAt(x, y);
  G.leader = () => G.party.find((p) => !p.dead && !p.downed) || G.party.find((p) => !p.dead) || G.party[0];
  G.refreshHud = () => { UI.refreshParty(); if (Combat.active) UI.refreshActionBar(); G.updateContext(); };
  G.bark = (ent, kind) => { if (!ent || ent.mon || !ent.personality || ent.dead) return; if (Math.random() > (kind === 'greet' || kind === 'levelUp' ? 1 : 0.35)) return; const p = NAMES.personalities.find((x) => x.id === ent.personality); const lines = p && p.barks[kind]; if (!lines) return; ent.speech = U.pick(lines); clearTimeout(ent._speechT); ent._speechT = setTimeout(() => { ent.speech = null; }, 2600); };

  // ---------- Init & loop ----------
  G.init = () => {
    Renderer.init(document.getElementById('game')); UI.init(); G.bindInput(); UI.showTitle();
    let last = performance.now(); const loop = (now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; G.update(dt); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  };
  G.update = (dt) => {
    if (!G.map) return; Renderer.update(dt, G.entities());
    G.moveTimer = (G.moveTimer || 0) + dt;
    if (G.path && G.path.length && !Combat.active && G.moveTimer > 0.13 && !UI.modalOpen()) { G.moveTimer = 0; const [nx, ny] = G.path.shift(); if (!G.stepLeader(nx, ny)) G.path = null; if (G.path && !G.path.length) { G.path = null; if (G.pendingInteract) { const p = G.pendingInteract; G.pendingInteract = null; G.tryInteract(p); } } }
    if (G.map.kind === 'overworld' || G.map.kind === 'interior') G.wanderNpcs(dt);
    G.state.highlightsView = G.state.highlights;
    Renderer.render({ map: G.map, entities: G.entities(), highlights: G.state.highlights, inCombat: Combat.active, cursor: G.cursor, night: false, lights: G.lights(), interact: G.nearInteract });
  };
  G.lights = () => { const m = G.map; if (!m) return []; const out = []; if (m.kind === 'dungeon') { for (const p of G.party) if (!p.dead) out.push({ x: p.x, y: p.y, r: Math.max(3.5, (p.lightRadius || 4)) }); } for (const p of m.props) { if (p.removed) continue; if (p.kind === 'brazier' || p.kind === 'campfire' && p.lit !== false || p.kind === 'fireplace') out.push({ x: p.x, y: p.y, r: 5 }); else if (p.kind === 'torch') out.push({ x: p.x, y: p.y + 0.4, r: 4 }); else if (p.kind === 'lamp') out.push({ x: p.x, y: p.y, r: 4 }); else if (p.kind === 'keg' && m.kind === 'interior') { /* none */ } } if (m.kind === 'interior') out.push({ x: 4, y: 2, r: 4 }); return out; };
  G.wanderNpcs = (dt) => { G.npcTimer = (G.npcTimer || 0) + dt; if (G.npcTimer < 1.2) return; G.npcTimer = 0; for (const n of G.map.npcs) { if (!n.wander || Math.random() < 0.6) continue; const dx = U.pick([-1, 0, 1]), dy = U.pick([-1, 0, 1]); const nx = n.x + dx, ny = n.y + dy; if (U.dist(nx, ny, n.home.x, n.home.y) > 2) continue; if (!G.isFree(nx, ny) || World.propAt(G.map, nx, ny)) continue; n.x = nx; n.y = ny; } };

  // ---------- New game / load / save ----------
  G.newState = (seed) => ({ seed: seed || Math.floor(Math.random() * 1e9), day: 1, flags: {}, gold: 15, inventory: [], party: [], quests: null, location: 'tavern', dungeonRuns: 0, questsDone: 0, highlights: [], kills: 0, guildRecruits: null });
  G.newGame = (draft) => {
    G.state = G.newState(); Quests.init(); const hero = Character.finalize(draft); hero.isPlayer = true; G.state.party = [hero]; for (const id of hero.pack) G.addItem(id, 1); delete hero.pack;
    G.addItem('rations', 2); G.addItem('torch', 1);
    UI.hideTitle(); G.enterTavern(true);
    UI.narration(STORY.intro, () => { log('You wake in the Rusty Flagon. Talk to Bosun Grell behind the bar.', 'story'); UI.toast('Tap to move · tap people to talk'); G.save(); }, 'Three days ago…');
  };
  G.serialize = () => { const s = U.deepClone({ seed: G.state.seed, day: G.state.day, flags: G.state.flags, gold: G.state.gold, inventory: G.state.inventory, quests: G.state.quests, location: (G.state.location === 'dungeon' || G.state.location === 'room') ? 'town' : G.state.location, dungeonRuns: G.state.dungeonRuns, questsDone: G.state.questsDone, kills: G.state.kills, guildRecruits: G.state.guildRecruits, guildRecruitDay: G.state.guildRecruitDay, pendingCompanion: G.state.pendingCompanion, pos: G.state.location === 'dungeon' ? null : G.state.location === 'room' ? (G.roomReturn || null) : (G.leader() ? { x: G.leader().x, y: G.leader().y } : null) }); s.party = G.party.map((p) => { const c = Object.assign({}, p); ['ax', 'ay', 'turn', 'activeTurn', 'speech', '_speechT', 'walking', 'bump', 'flash', 'concentration', 'lightRadius', 'facing', 'selected', 'fateNext'].forEach((k) => delete c[k]); return c; }); return s; };
  G.save = (manual) => { if (!G.state || !G.party.length) return; if (Save.write(G.serialize()) && manual) UI.toast('💾 Saved'); };
  G.load = () => {
    const s = Save.read(); if (!s) return; G.state = Object.assign(G.newState(), s); G.state.highlights = []; G.state.party = s.party.map((p) => Object.assign(p, { ax: p.x, ay: p.y, conditions: p.conditions || [], resources: p.resources || {}, isParty: true, team: 'party' }));
    if (!G.state.quests) Quests.init(); UI.hideTitle();
    if (G.state.location === 'tavern') G.enterTavern(false, s.pos); else G.enterTown(s.pos);
    log('Welcome back, ' + G.party[0].name + '.', 'story');
  };
  G.quitToTitle = () => { UI.cancelThrow(); G.save(); Combat.active = false; G.map = null; G.mode = 'title'; UI.showTitle(); UI.setContextActions([]); };

  // ---------- Inventory / gold / XP ----------
  G.addItem = (item, qty) => { qty = qty || 1; const it = getItem(item); if (!it) return; const key = typeof item === 'object' ? item.id : item; const stackable = typeof item !== 'object'; const ex = stackable ? G.state.inventory.find((e) => e.item === key) : null; if (ex) ex.qty += qty; else G.state.inventory.push({ item: typeof item === 'object' ? item : key, qty }); if (it.type === 'quest' && it.id === 'memoryVial') G.state.flags.hasMemoryVial = true; };
  G.removeItem = (item, qty) => { qty = qty || 1; const key = typeof item === 'object' ? item.id : item; const i = G.state.inventory.findIndex((e) => (typeof e.item === 'object' ? e.item.id : e.item) === key); if (i < 0) return false; G.state.inventory[i].qty -= qty; if (G.state.inventory[i].qty <= 0) G.state.inventory.splice(i, 1); return true; };
  G.hasItem = (id) => G.state.inventory.some((e) => (typeof e.item === 'object' ? e.item.id : e.item) === id);
  G.countItem = (id) => { const e = G.state.inventory.find((x) => (typeof x.item === 'object' ? x.item.id : x.item) === id); return e ? e.qty : 0; };
  G.addGold = (n) => { G.state.gold += n; if (n > 0) { AudioSys.play('coin'); } G.refreshHud(); };
  G.spendGold = (n) => { if (G.state.gold < n) { UI.toast('Not enough gold.'); return false; } G.state.gold -= n; return true; };
  G.sellItem = (entry) => { const it = getItem(entry.item); const price = Math.max(1, Math.floor(it.cost / 2)); G.removeItem(entry.item, 1); G.addGold(price); log('Sold ' + it.name + ' for ' + price + ' gp.', 'loot'); };
  G.awardXp = (xp, each) => { const alive = G.party.filter((p) => !p.dead); for (const p of alive) { const before = p.level; Rules.gainXp(p, xp); if (p.pendingLevel) G.levelQueue.push(p); } log('+' + xp + ' XP' + (each ? ' each' : '') + '.', 'xp'); G.processLevelQueue(); };
  G.levelQueue = [];
  G.processLevelQueue = () => { if (G.levelingNow || Combat.active) return; const ch = G.levelQueue.find((c) => c.pendingLevel > 0); if (!ch) { G.levelQueue = []; return; } G.levelingNow = true; const finish = (gained) => { G.levelingNow = false; log(ch.name + ' reaches level ' + ch.level + '! ' + (gained.features.length ? 'New: ' + gained.features.map((f) => f.name).join(', ') + '.' : ''), 'crit'); UI.toast('✨ ' + ch.name + ' is now level ' + ch.level + '!'); AudioSys.play('levelup'); G.bark(ch, 'levelUp'); G.refreshHud(); G.save(); G.processLevelQueue(); }; if (ch.isPlayer) UI.levelUp(ch, (choices) => finish(Rules.levelUp(ch, choices))); else finish(Rules.levelUp(ch, null, true)); };
  G.addCompanion = (ch) => { if (G.party.length >= 4) { UI.toast('Party is full (4).'); G.state.guildRecruits = (G.state.guildRecruits || []).concat([ch]); ch.rescued = true; return false; } ch.isParty = true; ch.team = 'party'; ch.conditions = []; const l = G.leader(); const [x, y] = World.findFloorNear(G.map, l.x, l.y, (xx, yy) => G.isFree(xx, yy)); ch.x = x; ch.y = y; ch.ax = x; ch.ay = y; G.party.push(ch); log(ch.name + ' the ' + CLASSES[ch.cls].name + ' joins the party!', 'loot'); G.bark(ch, 'greet'); G.refreshHud(); return true; };
  G.dismissCompanion = (ch) => { if (ch.isPlayer) return; G.state.party = G.party.filter((p) => p !== ch); ch.rescued = true; ch.hireCost = 0; G.state.guildRecruits = (G.state.guildRecruits || []).concat([ch]); log(ch.name + ' heads back to the Guild Hall.', 'story'); G.refreshHud(); };

  // ---------- Locations ----------
  G.placeParty = (x, y) => { const alive = G.party.filter((p) => !p.dead); let i = 0; for (const p of alive) { const [px, py] = i === 0 ? [x, y] : World.findFloorNear(G.map, x, y, (xx, yy) => !alive.some((o) => o.x === xx && o.y === yy && o !== p) && World.passable(G.map, xx, yy)); p.x = px; p.y = py; p.ax = px; p.ay = py; p.downed = false; if (p.hp <= 0) p.hp = 1; i++; } Renderer.cam.x = x; Renderer.cam.y = y; Renderer.camTarget = G.leader(); G.path = null; G.updateVisibility(); G.refreshHud(); };
  G.enterTavern = (wake, pos) => { G.map = World.buildInterior(WORLDMAP.tavernInterior); G.map.monsters = []; G.state.location = 'tavern'; G.mode = 'explore'; const sp = pos || (wake ? G.map.spawn : G.map.exit); G.placeParty(sp.x, sp.y); UI.setLocation('The Rusty Flagon'); AudioSys.music('tavern'); };
  G.exitTavern = () => { G.enterTown(); const tav = WORLDMAP.buildings.find((b) => b.id === 'tavern'); G.placeParty(tav.door, tav.y + tav.h + 1); };
  G.enterTown = (pos) => { G.map = World.buildOverworld(G.state.flags); G.map.monsters = []; G.state.location = 'town'; G.mode = 'explore'; const sp = pos || G.map.spawn; G.placeParty(sp.x, sp.y); UI.setLocation('Hollowmere'); AudioSys.music('town'); if (G.state.pendingCompanion) { G.state.pendingCompanion = false; const c = Character.randomCompanion(G.partyLevel(), Math.random, {}); c.rescued = true; c.hireCost = 0; G.state.guildRecruits = (G.state.guildRecruits || []).concat([c]); log('A freed prisoner, ' + c.name + ', waits for you at the Guild Hall.', 'story'); } };
  G.rebuildOverworld = () => { if (G.map && G.map.kind === 'overworld') { const l = G.leader(); G.enterTown({ x: l.x, y: l.y }); } };
  G.longRest = () => { for (const p of G.party) Rules.longRest(p); G.state.day++; G.state.flags.templeBlessing = G.state.flags.templeBlessing || false; for (const p of G.party) { p.blinkUsed = false; p.fateUsed = false; p.wandCharges = undefined; p.maxHp -= (p.maxHpBoost || 0); p.maxHpBoost = 0; p.hp = p.maxHp; } log('You sleep like a felled oak. Day ' + G.state.day + ' dawns. Everyone is fully rested.', 'heal'); UI.toast('🌅 Day ' + G.state.day); AudioSys.play('heal'); G.refreshHud(); G.save(); };

  // ---------- Dungeon lifecycle ----------
  G.enterDungeon = (site, quest) => {
    const params = Quests.dungeonParams(site, quest); G.state.dungeonRuns++;
    const m = Dungeon.generate(params); m.site = site; m.questId = quest ? quest.id : null; m.kills = 0; m.goldFound = 0; m.xpEarned = 0; m.roomsSeen = new Set(); m.secretsFound = 0; m.timeStart = Date.now();
    G.map = m; G.state.location = 'dungeon'; G.mode = 'explore'; G.prevTownPos = { x: site.x, y: site.y + 1 };
    for (const p of G.party) { p.lightRadius = G.hasItem('torch') || G.hasItem('lantern') ? 6 : 4; if (Rules.accBonus(p, 'light')) p.lightRadius = Math.max(p.lightRadius, 6 + Rules.accBonus(p, 'light')); p.blinkUsed = false; p.fateUsed = false; p.wandCharges = undefined; p.usedFreeRest = false; }
    if (G.state.flags.templeBlessing) { G.state.flags.templeBlessing = false; for (const p of G.party) if (!p.dead) Rules.addCondition(p, 'bless', 999); log('The temple blessing settles over the party.', 'heal'); }
    G.placeParty(m.spawn.x, m.spawn.y); UI.setLocation(m.name + ' · Lv ' + m.level); AudioSys.music('dungeon');
    log('You enter ' + m.name + '. ' + U.pick(m.flavor), 'story'); if (quest) log('Quest: ' + quest.title + ' — ' + quest.text, 'story');
    UI.toast(m.name); G.save(); G.updateVisibility();
  };
  G.leaveDungeon = () => {
    const m = G.map; const q = m.questId ? Quests.byId(m.questId) : null; const secs = Math.floor((Date.now() - m.timeStart) / 1000);
    const victory = !!(m.boss && m.boss.dead) || (m.bossSpared);
    const summary = { victory, name: m.name, seconds: secs, kills: m.kills, gold: m.goldFound, xp: m.xpEarned, rooms: m.roomsSeen.size + '/' + m.rooms.filter((r) => !r.secret).length, secrets: m.secretsFound + '/' + (m.secretRooms || 0), twist: q && q.twistRevealed ? q.twist : null, flavor: victory ? 'You climb back into daylight, heavier with loot and lighter on healing potions. A good day.' : 'You retreat for now. The dungeon will still be there. Unfortunately.' };
    for (const p of G.party) { Rules.clearCombatState(p); p.lightRadius = 0; if (p.downed) { p.downed = false; p.hp = 1; } }
    UI.dungeonSummary(summary, () => { G.enterTown(G.prevTownPos); if (victory) AudioSys.play('victory'); G.save(); });
  };
  G.partyWipe = () => {
    AudioSys.play('defeat'); log('The party has fallen…', 'warn');
    UI.gameOver(() => { const lost = Math.floor(G.state.gold * 0.25); G.state.gold -= lost; for (const p of G.party) { p.dead = false; p.downed = false; p.hp = Math.max(1, Math.floor(p.maxHp / 2)); p.deathSaves = { s: 0, f: 0 }; p.conditions = []; p.concentration = null; p.lightRadius = 0; } G.enterTavern(true); log('You lost ' + lost + ' gold to the healer. You are alive. Mostly.', 'warn'); G.refreshHud(); G.save(); });
  };

  // ---------- Visibility ----------
  G.updateVisibility = () => { if (!G.map || G.map.kind !== 'dungeon') return; World.computeVisibility(G.map, G.party.filter((p) => !p.dead), World.staticLights(G.map)); G.checkPerception(); if (!Combat.active) G.checkCombatStart(); const l = G.leader(); if (l) { const r = G.map.rooms.find((r) => l.x >= r.x && l.x < r.x + r.w && l.y >= r.y && l.y < r.y + r.h); if (r) { if (!G.map.roomsSeen.has(r.id)) { G.map.roomsSeen.add(r.id); if (r.secret) { G.map.secretsFound++; log('A secret room!', 'loot'); } if (r.role === 'boss' && !r.introDone) { r.introDone = true; G.bossRoomEntered(r); } if (Math.random() < 0.3 && G.map.flavor.length) log(U.pick(G.map.flavor), 'story'); } } } };
  G.checkPerception = () => { const alive = G.party.filter((p) => !p.dead); if (!alive.length) return; const bestPP = Math.max(...alive.map((p) => Rules.passivePerception(p))); const bestInv = Math.max(...alive.map((p) => 10 + Rules.skillBonus(p, 'investigation'))); const reveal = alive.some((p) => Rules.accBonus(p, 'revealSecrets'));
    for (const p of G.map.props) { if (p.removed) continue; const near = alive.some((a) => U.dist(a.x, a.y, p.x, p.y) <= 2); if (!near) continue;
      if (p.kind === 'trap' && p.trap.armed && !p.trap.spotted) { if (reveal || bestPP >= p.trap.spotDC) { p.trap.spotted = true; G.map.trapsRevealed[U.key(p.x, p.y)] = true; log('You spot a ' + p.trap.name.toLowerCase() + ' ahead! (Passive Perception ' + bestPP + ' vs DC ' + p.trap.spotDC + ')', 'warn'); AudioSys.play('alert'); } }
      if (p.kind === 'secretDoor' && !p.revealed && alive.some((a) => U.dist(a.x, a.y, p.x, p.y) <= 1)) { if (reveal || bestInv >= p.dc) G.revealSecret(p, 'You notice a draft: a secret door! (Passive Investigation ' + bestInv + ' vs DC ' + p.dc + ')'); } } };
  G.revealSecret = (p, text) => { p.revealed = true; World.set(G.map, p.x, p.y, T.DOORWAY); log(text || 'A secret door is revealed!', 'loot'); AudioSys.play('unlock'); G.updateVisibility(); };
  G.checkCombatStart = () => { if (Combat.active || G.map.kind !== 'dungeon') return; const seen = G.monsters.filter((m) => !m.dead && !m.escaped && !m.hidden && G.map.vis[m.y * G.map.w + m.x] && G.party.some((p) => !p.dead && U.dist(p.x, p.y, m.x, m.y) <= 9)); if (!seen.length) return;
    // stealth: if every party member beats the monsters' passive perception, party gets surprise (monsters lose first turn)
    const sneaking = G.party.filter((p) => !p.dead).every((p) => Rules.has(p, 'hidden') || Rules.has(p, 'passWithoutTrace'));
    if (sneaking) seen.forEach((m) => { m.surprisedBy = true; }); G.path = null; G.startCombatWith(seen); };
  G.startCombatWith = (monsters) => { G.path = null; G.pendingInteract = null; UI.closeAll(); Combat.start(monsters); };

  // ---------- Combat hooks ----------
  G.onMonsterDied = (m, killer) => { if (m.xpAwarded) return; m.xpAwarded = true; m.dead = true; AudioSys.play('monsterDeath'); log(m.name + ' is slain!', 'crit'); G.state.kills++; if (G.map.kills !== undefined) G.map.kills++; const alive = G.party.filter((p) => !p.dead).length; const xp = Math.max(1, Math.floor((m.xp || 10) / Math.max(1, alive))); for (const p of G.party) if (!p.dead) Rules.gainXp(p, xp); if (G.map.xpEarned !== undefined) G.map.xpEarned += xp; log('+' + xp + ' XP each.', 'xp'); for (const p of G.party) if (p.pendingLevel) G.levelQueue.push(p);
    if (m.isBoss) G.onBossDefeated(m);
    // loot drop for bosses and some monsters
    if (m.isBoss || Math.random() < 0.15) { const rng = RNG(RNG.hash(m.id)); const loot = Dungeon.rollLoot(G.map.level + (m.isBoss ? 1 : 0), rng, m.isBoss, !m.isBoss); const [x, y] = [m.x, m.y]; setTimeout(() => { if (!World.propAt(G.map, x, y)) World.addProp(G.map, { kind: 'chest', x, y, solid: true, open: false, locked: false, loot, label: m.isBoss ? "Boss's hoard" : 'Dropped loot', color: m.isBoss ? '#c0a030' : '#6a5a4a', noMimic: true }); }, 50); }
    for (const p of G.party) if (m.isBoss || Math.random() < 0.25) { const c = Rules.cond(p, 'marked'); } };
  G.onCharacterDied = (ch) => { log(ch.name + ' has died.', 'warn'); UI.toast('✝ ' + ch.name + ' has fallen'); G.refreshHud(); };
  G.onCombatEnd = (victory) => { G.state.highlights = []; G.refreshHud(); if (victory) { log('Victory! The party catches its breath.', 'crit'); AudioSys.music(G.map.kind === 'dungeon' ? 'dungeon' : 'town'); for (const p of G.party) if (p.downed) { /* remain downed until healed */ } setTimeout(() => G.processLevelQueue(), 400); if (G.map.kind === 'dungeon' && G.map.boss && G.map.boss.dead && G.map.questId) { const q = Quests.byId(G.map.questId); if (q) Quests.onEvent(q, 'bossKilled'); } else if (G.map.kind === 'dungeon' && G.map.boss && G.map.boss.dead) { /* free delve */ } } else { G.partyWipe(); } };
  G.onBossDefeated = (m) => { log('The ' + m.name + ' falls! The dungeon is yours.', 'crit'); Renderer.shake = 8; };
  G.bossRoomEntered = (room) => {
    const q = G.map.questId ? Quests.byId(G.map.questId) : null; const boss = G.map.boss; if (!boss || boss.dead) return;
    if (q && q.story) { const intro = q.bossIntro.replace('{name}', G.party[0].name); G.path = null; q.twistRevealed = true;
      const proceed = () => { if (q.bossChoice) G.bossChoice(q, boss); else G.startCombatWith([boss]); };
      UI.dialogue(boss.name, boss, intro, [{ text: 'Continue', fn: proceed }], { noClose: true }); return; }
    if (q && !q.story) { q.twistRevealed = true; UI.dialogue('Twist!', boss, q.twist + '<br><br><i>' + boss.name + (boss.modifier ? ' (' + NAMES.bossModifiers.find((b) => b.id === boss.modifier).name + ': ' + NAMES.bossModifiers.find((b) => b.id === boss.modifier).desc + ')' : '') + ' blocks your way.</i>', [{ text: 'Roll initiative!', fn: () => G.startCombatWith([boss]) }], { noClose: true }); return; }
    UI.dialogue(boss.name, boss, MONSTERS[boss.mon].desc + (boss.modifier ? '<br><i>' + NAMES.bossModifiers.find((b) => b.id === boss.modifier).name + ': ' + NAMES.bossModifiers.find((b) => b.id === boss.modifier).desc + '</i>' : ''), [{ text: 'Roll initiative!', fn: () => G.startCombatWith([boss]) }], { noClose: true });
  };
  G.bossChoice = (q, boss) => {
    const bc = q.bossChoice; const hero = G.party[0];
    UI.dialogue(boss.name, boss, bc.text, bc.options.filter((o) => !o.req || G.state.flags[o.req]).map((o) => ({ text: o.text, check: o.check ? o.check : o.save ? { skill: o.save, dc: o.dc } : null, fn: async () => {
      let ok = true, text = o.pass || '';
      if (o.check) { await UI.awaitThrow(SKILLS[o.check.skill].name + ' check'); const rec = Rules.skillCheck(hero, o.check.skill, o.check.dc); ok = rec.success; log(hero.name + ' ' + SKILLS[o.check.skill].name + ': ' + Dice.fmt(rec) + (ok ? ' — success!' : ' — failure.'), ok ? 'heal' : 'warn'); text = ok ? o.pass : o.fail; }
      else if (o.save) { await UI.awaitThrow(ABILITY_NAMES[o.save] + ' save'); const rec = Rules.savingThrow(hero, o.save, o.dc, { magic: true, vsCharm: true }); ok = rec.success; log(hero.name + ' ' + ABILITY_NAMES[o.save] + ' save: ' + Dice.fmt(rec) + (ok ? ' — success!' : ' — failure.'), ok ? 'heal' : 'warn'); text = ok ? o.pass : o.fail; if (!ok) for (const p of G.party) p.disadvInit = true; }
      const spare = ok && o.spare && !o.fight; const fight = o.fight || !ok || !o.spare;
      UI.outcome(text || (fight ? 'Steel is drawn.' : ''), () => {
        if (spare) { for (const m of G.monsters) if (m.room === G.map.bossRoom.id || m.groupId === 'boss') { m.escaped = true; m.hidden = true; } G.map.bossSpared = true; if (o.extraGold) G.addGold(o.extraGold); G.addGold(50 + 20 * q.level); Quests.onEvent(q, 'bossSpared'); log('The boss room is yours without bloodshed. The hoard is not.', 'loot'); AudioSys.play('quest'); const rng = RNG(RNG.hash('spare' + q.id)); World.addProp(G.map, { kind: 'chest', x: boss.x, y: boss.y, solid: true, open: false, locked: false, loot: Dungeon.rollLoot(G.map.level + 1, rng, true), label: 'Abandoned hoard', color: '#c0a030', noMimic: true }); G.updateVisibility(); G.refreshHud(); }
        else { if (o.weakenBoss) { boss.hp = Math.floor(boss.hp / 2); boss.legendaryResist = 0; log(boss.name + ' is reeling: half HP and no legendary resistance!', 'crit'); } G.startCombatWith([boss]); }
      });
    } })), { noClose: true });
  };

  // ---------- Input ----------
  G.bindInput = () => {
    const c = document.getElementById('game'); let downAt = null;
    // pinch to zoom (two pointers) and wheel zoom; a pinch never counts as a tap
    const touches = new Map(); let pinch = null;
    c.addEventListener('pointerdown', (e) => { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: Renderer.zoom }; downAt = null; return; } downAt = { x: e.clientX, y: e.clientY, t: Date.now() }; AudioSys.init(); });
    c.addEventListener('pointermove', (e) => { if (!touches.has(e.pointerId)) return; touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch.d0 > 10) Renderer.setZoom(pinch.z0 * Math.pow(d / pinch.d0, 0.8)); } });
    const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2 && pinch) { pinch = null; downAt = null; } };
    c.addEventListener('pointerup', endTouch); c.addEventListener('pointercancel', endTouch);
    c.addEventListener('wheel', (e) => { e.preventDefault(); Renderer.setZoom(Renderer.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    c.addEventListener('pointermove', (e) => { if (Combat.isPlayerTurn()) { const t = Renderer.pickTile(e.clientX, e.clientY); G.cursor = t; } });
    c.addEventListener('pointerup', (e) => { if (!downAt) return; const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y; const moved = Math.hypot(dx, dy); downAt = null; if (moved > 12) return; if (UI.modalOpen()) return; G.tap(e.clientX, e.clientY); });
    document.querySelectorAll('#dpad button').forEach((b) => { b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AudioSys.init(); const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[b.dataset.dir]; const w = Renderer.screenToWorldDir(d[0], d[1]); G.moveDir(w[0], w[1]); }); });
    document.getElementById('rot-left').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AudioSys.init(); AudioSys.play('click'); Renderer.rotate(-1); });
    document.getElementById('rot-right').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AudioSys.init(); AudioSys.play('click'); Renderer.rotate(1); });
    window.addEventListener('keydown', (e) => { if (UI.throwPending && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); UI.doThrow(); return; } if (UI.modalOpen() || G.mode === 'title') { if (e.key === 'Escape') UI.closeModal(); return; } const map = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] }; if (map[e.key]) { e.preventDefault(); const w = Renderer.screenToWorldDir(map[e.key][0], map[e.key][1]); G.moveDir(w[0], w[1]); } if (e.key === 'q' || e.key === 'Q') Renderer.rotate(-1); if (e.key === 'e' || e.key === 'E') Renderer.rotate(1); if (e.key === '+' || e.key === '=') Renderer.setZoom(Renderer.zoom * 1.15); if (e.key === '-' || e.key === '_') Renderer.setZoom(Renderer.zoom / 1.15); if (e.key === '<' || e.key === ',') G.transit('out'); if (e.key === '>' || e.key === '.') G.transit('in'); if (e.key === ' ' && Combat.isPlayerTurn()) { e.preventDefault(); Combat.endTurn(); } if (e.key === 'i' || e.key === 'I') UI.inventory(); if (e.key === 'c' && !Combat.active) UI.characterSheet(G.party[0]); if (e.key === 'j' || e.key === 'J') UI.questLog(); if (e.key === 'l' || e.key === 'L') UI.logPanel(); if (e.key === 'Escape') UI.menu(); if (e.key === 'f' || e.key === 'F') { G.fast = !G.fast; UI.toast(G.fast ? '⏩ Fast animations' : '▶ Normal animations'); } });
  };
  G.moveDir = (dx, dy) => {
    if (!G.map || UI.modalOpen() || UI.throwPending) return; const l = G.leader(); if (!l) return;
    if (Combat.active) { if (!Combat.isPlayerTurn()) return; const e = Combat.current(); const nx = e.x + dx, ny = e.y + dy; if (Combat.movementLeft(e) <= 0) { UI.toast('No movement left'); return; } if (!G.isFree(nx, ny)) { const ent = G.entityAt(nx, ny); if (ent && ent.hostile) { Combat.playerAttack(e, ent); return; } return; } Combat.moveAlong(e, [[nx, ny]]).then(() => { G.updateHighlights(); UI.refreshActionBar(); }); return; }
    // Walking into a person or an object never activates it — you have to tap it (or use its context button).
    G.path = null; const nx = l.x + dx, ny = l.y + dy; if (!G.stepLeader(nx, ny)) AudioSys.play('bump');
  };
  G.tap = (px, py) => {
    if (UI.throwPending) return; // the dice are in your hand: throw them (or press the button) before doing anything else
    if (!G.map || G.mode !== 'explore') return; const tile = Renderer.pickTile(px, py); const ent = Renderer.pickEntity(px, py, G.entities());
    if (Combat.active) { if (!Combat.isPlayerTurn()) return; G.combatTap(tile, ent); return; }
    if (ent && ent.npc) { G.goInteract(ent.x, ent.y, () => G.talkTo(ent), ent.counter ? 2 : 1); return; }
    if (ent && ent.isParty) { UI.characterSheet(ent); return; }
    const props = World.propsAt(G.map, tile.x, tile.y).filter((p) => !p.invisible || p.kind === 'doorTrigger' || p.kind === 'exitTrigger' || p.kind === 'searchSpot'); const prop = props.find((p) => p.kind !== 'doorTrigger' && p.kind !== 'exitTrigger') || props[0];
    if (prop && G.isInteractable(prop)) { G.goInteract(prop.x, prop.y, () => G.tryInteract(prop)); return; }
    if (G.map.kind === 'dungeon' && !G.map.seen[tile.y * G.map.w + tile.x]) return;
    const l = G.leader(); const path = U.astar(l.x, l.y, tile.x, tile.y, (x, y) => World.passable(G.map, x, y) && !(G.entityAt(x, y) && !G.entityAt(x, y).isParty), 200);
    if (path && path.length) { G.path = path.slice(0, 40); G.pendingInteract = null; } else AudioSys.play('bump');
  };
  // Walk to the nearest tile within `reach` of (x,y), then run fn. Shopkeepers stand behind a counter, so reach 2.
  G.goInteract = (x, y, fn, reach) => {
    reach = reach || 1; const l = G.leader();
    if (U.dist(l.x, l.y, x, y) <= reach) { fn(); return; }
    const pass = (xx, yy) => World.passable(G.map, xx, yy) && !(G.entityAt(xx, yy) && !G.entityAt(xx, yy).isParty);
    const spots = [];
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) { if (!dx && !dy) continue; const sx = x + dx, sy = y + dy; if (pass(sx, sy)) spots.push([sx, sy]); }
    spots.sort((a, b) => U.dist(a[0], a[1], l.x, l.y) - U.dist(b[0], b[1], l.x, l.y));
    for (const [sx, sy] of spots) { const path = U.astar(l.x, l.y, sx, sy, pass, 200); if (path) { G.path = path; G.pendingInteract = { fn }; return; } }
    AudioSys.play('bump');
  };
  G.tryInteract = (p) => { if (p && p.fn) { p.fn(); return; } G.interact(p); };
  G.stepLeader = (nx, ny) => {
    const l = G.leader(); if (!l) return false; if (!World.passable(G.map, nx, ny)) return false; const occ = G.entityAt(nx, ny); if (occ && !occ.isParty) return false;
    const prev = { x: l.x, y: l.y }; l.x = nx; l.y = ny; l.facing = nx - ny > prev.x - prev.y ? 'r' : 'l';
    // followers trail
    let last = prev; for (const f of G.party.filter((p) => !p.dead && p !== l)) { if (U.dist(f.x, f.y, l.x, l.y) <= 1 && !(f.x === l.x && f.y === l.y)) { continue; } const fp = { x: f.x, y: f.y }; if (G.isFree(last.x, last.y) || (last.x === prev.x && last.y === prev.y)) { f.x = last.x; f.y = last.y; last = fp; } else { const path = U.astar(f.x, f.y, l.x, l.y, (x, y) => World.passable(G.map, x, y) && !(G.entityAt(x, y) && !G.entityAt(x, y).isParty), 30); if (path && path.length > 1) { const [sx, sy] = path[0]; if (!G.entityAt(sx, sy)) { f.x = sx; f.y = sy; } } } }
    AudioSys.play('step'); G.stepOn(l, nx, ny); G.updateVisibility(); G.updateContext();
    // triggers
    for (const p of World.propsAt(G.map, nx, ny)) { if (p.kind === 'doorTrigger') { G.path = null; G.enterBuilding(p.building); return true; } if (p.kind === 'exitTrigger') { G.path = null; G.leaveInterior(); return true; } }
    if (G.map.kind === 'dungeon') { G.updateVisibility(); if (Combat.active) return true; }
    return true;
  };
  // Stepping on a tile: traps, runes, hazards
  G.stepOn = (ent, x, y) => {
    const m = G.map; if (m.kind !== 'dungeon') return;
    for (const p of World.propsAt(m, x, y)) if (p.kind === 'trap' && p.trap.armed) { const t = p.trap; p.trap.armed = false; if (t.alarm) { log('CLANG! An alarm echoes through the dungeon. Something is coming.', 'warn'); AudioSys.play('alert'); for (const mo of G.monsters) if (!mo.dead && U.dist(mo.x, mo.y, x, y) <= 14) { mo.alerted = true; const path = U.astar(mo.x, mo.y, x, y, (xx, yy) => World.passable(m, xx, yy) && !G.entityAt(xx, yy), 60); if (path) { const steps = path.slice(0, Math.max(1, Math.min(path.length - 2, 5))); if (steps.length) { const [sx, sy] = steps[steps.length - 1]; mo.x = sx; mo.y = sy; } } } G.updateVisibility(); continue; }
      log(ent.name + ' triggers a ' + t.name.toLowerCase() + '!', 'warn'); AudioSys.play('trap'); Renderer.burst(x, y, t.dtype === 'fire' ? '#ff7020' : t.dtype === 'poison' ? '#60c040' : '#c0c0c0', 1); (async () => { await UI.awaitThrow(t.name + ': ' + ABILITY_NAMES[t.save] + ' save'); const s = Rules.savingThrow(ent, t.save, t.dc, { trapOrSpell: true, vsPoison: t.dtype === 'poison', label: t.name + ' (' + t.save.toUpperCase() + ' save)' }); const r = Dice.roll(t.dmg, { label: t.name, kind: 'dmg' }); let dmg = s.success ? Math.floor(r.total / 2) : r.total; if (s.success && ent.cls === 'rogue' && ent.level >= 7) dmg = 0; const res = Rules.applyDamage(ent, dmg, t.dtype, { log }); log(ent.name + ' ' + ABILITY_NAMES[t.save] + ' save: ' + Dice.fmt(s) + (s.success ? ' — half damage.' : ' — full damage!') + ' Takes ' + res.taken + ' ' + t.dtype + '.', 'hit'); Renderer.floatText(x, y, '-' + res.taken, '#ff8060'); if (t.prone) Rules.addCondition(ent, 'prone', 1); if (t.status && !s.success) Rules.addCondition(ent, t.status, 10); if (res.downed) log(ent.name + ' collapses!', 'warn'); if (res.killed) G.onCharacterDied(ent); World.set(m, x, y, T.FLOOR); World.removeProp(m, p); G.refreshHud(); if (G.party.every((pp) => pp.dead || pp.downed)) G.partyWipe(); })(); }
    const rune = m.runes[U.key(x, y)]; if (rune && !rune.puzzle.solved && !ent.mon) { const pz = rune.puzzle; const expect = pz.order[pz.stepped.length]; if (rune.idx === expect) { rune.lit = true; pz.stepped.push(rune.idx); log('The ' + rune.name + ' rune lights up. (' + pz.stepped.length + '/' + pz.order.length + ')', 'story'); AudioSys.play('unlock'); if (pz.stepped.length === pz.order.length) { pz.solved = true; log('The runes blaze in sequence! A click echoes from the sealed chest.', 'loot'); if (pz.chest) { pz.chest.sealed = false; pz.chest.locked = false; } G.awardXp(25 * m.level, true); } } else if (!rune.lit && !pz.stepped.includes(rune.idx)) { const r = Dice.roll('1d6', { label: 'Rune shock', kind: 'dmg' }); const res = Rules.applyDamage(ent, r.total, 'lightning', { log }); log('Wrong rune! ' + ent.name + ' is shocked for ' + res.taken + '. The sequence resets.', 'warn'); Renderer.floatText(x, y, '-' + res.taken, '#ffff60'); AudioSys.play('trap'); for (const k in m.runes) if (m.runes[k].puzzle === pz) m.runes[k].lit = false; pz.stepped = []; } }
    for (const h of (m.hazards || [])) if (!Combat.active && h.cells.some(([hx, hy]) => hx === x && hy === y) && h.casterTeam !== ent.team) { const r = Dice.roll(h.damage, { label: h.name, kind: 'dmg' }); const res = Rules.applyDamage(ent, r.total, h.dtype, { log }); log(ent.name + ' takes ' + res.taken + ' from ' + h.name + '.', 'hit'); }
  };
  G.enterBuilding = (b) => {
    if (b.locked && !G.state.flags[b.locked]) return;
    const kind = b.enter.split(':')[0];
    if (kind === 'interior') { G.enterTavern(false); return; }
    G.enterRoom(b); // every other building is a walk-in room: shop, temple, guild hall or cottage
  };
  // Shops, temples, the guild hall and the cottages: a real room you walk into, with someone to talk to inside.
  G.enterRoom = (b) => {
    G.roomReturn = { x: b.door, y: b.y + b.h + 1 };
    G.map = World.buildRoom(b); G.map.monsters = [];
    G.state.location = 'room'; G.state.roomId = b.id; G.mode = 'explore';
    G.placeParty(G.map.spawn.x, G.map.spawn.y);
    UI.setLocation(b.name); AudioSys.music(b.id === 'btavern' ? 'tavern' : 'town');
  };
  G.leaveInterior = () => { if (G.state.location === 'room') { const back = G.roomReturn; G.enterTown(back); G.roomReturn = null; } else G.exitTavern(); };
  G.openShopUi = (id) => { if (id === 'smith' || id === 'merchant' || id === 'bmerchant') UI.shop(id); else if (id === 'temple') UI.temple(); else if (id === 'guild') UI.guild(); else if (id === 'btavern') G.bogTavern(); };
  G.bogTavern = () => { UI.dialogue('The Soggy Boot', null, 'A tavern on stilts. The floor squelches. The ale is, against all odds, excellent.', [{ text: 'Rest for the night (long rest)', fn: () => G.longRest() }, { text: 'Hire a local guide (recruit)', fn: () => UI.guild() }, { text: 'Leave', fn: () => {} }]); };

  // ---------- Context actions ----------
  G.isInteractable = (p) => !!(p && !p.removed && (p.kind === 'chest' || p.kind === 'door' || (p.kind === 'secretDoor' && p.revealed) || p.kind === 'lever' || p.kind === 'cage' || p.kind === 'pedestal' || p.kind === 'campfire' || p.kind === 'stairs' || p.kind === 'trapdoor' || p.kind === 'entrance' || p.kind === 'questBoard' || p.kind === 'signpost' || p.kind === 'statue' || p.kind === 'altar' || p.kind === 'well' || p.searchable || p.event || (p.kind === 'trap' && p.trap.spotted && p.trap.armed) || p.kind === 'doorTrigger' || p.kind === 'exitTrigger'));
  G.updateContext = () => {
    if (!G.map || Combat.active) { UI.setContextActions([]); return; } const l = G.leader(); if (!l) return; const acts = []; const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { for (const p of World.propsAt(G.map, l.x + dx, l.y + dy)) { if (p.removed || seen.has(p.id)) continue; seen.add(p.id); const a = G.contextFor(p); if (a) acts.push(...(Array.isArray(a) ? a : [a])); } }
    for (const e of G.npcsInReach()) acts.push({ label: '💬 ' + e.name.split(' ')[0], fn: () => G.talkTo(e) });
    if (G.map.kind === 'dungeon') { if (G.bestUntried(G.map, 'search:' + U.key(l.x, l.y), 'investigation')) acts.push({ label: '🔍 Search', fn: () => G.searchArea() }); if (G.party.some((p) => CLASSES[p.cls].spellcasting && !p.dead)) acts.push({ label: '✨ Cast', fn: () => G.castOutOfCombat() }); if (G.party.some((p) => p.downed || (p.hp < p.maxHp && !p.dead))) acts.push({ label: '🧪 Use item', fn: () => UI.inventory() }); }
    // one button per label (two tables next to you = one 'Search table'); tap the other one on the map instead
    const labels = new Set(); const uniq = acts.filter((a) => { if (labels.has(a.label)) return false; labels.add(a.label); return true; });
    G.nearInteract = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const x = l.x + dx, y = l.y + dy; if (World.propsAt(G.map, x, y).some((p) => G.isInteractable(p) && !p.invisible)) G.nearInteract.push({ x, y }); }
    for (const e of G.npcsInReach()) G.nearInteract.push({ x: e.x, y: e.y });
    UI.setContextActions(uniq.slice(0, 5));
  };
  // NPCs you can speak to from where you stand: adjacent, or across a shop counter.
  G.npcsInReach = () => {
    const l = G.leader(); if (!l || !G.map) return [];
    const out = [];
    for (const e of G.map.npcs || []) { const r = e.counter ? 2 : 1; if (U.dist(l.x, l.y, e.x, e.y) <= r && !(e.x === l.x && e.y === l.y)) out.push(e); }
    return out;
  };
  // Roguelike door keys: '<' walks out through the nearest door, '>' walks in through it (or down into a dungeon).
  G.transit = (dir) => {
    if (!G.map || G.mode !== 'explore' || Combat.active || UI.modalOpen() || UI.throwPending) return;
    const l = G.leader(); if (!l) return;
    const wants = (p) => !p.removed && (dir === 'out'
      ? (p.kind === 'exitTrigger' || (p.kind === 'stairs' && p.entrance))
      : (p.kind === 'doorTrigger' || p.kind === 'trapdoor' || p.kind === 'entrance' || (p.kind === 'stairs' && !p.entrance)));
    const fire = (p) => { G.path = null; if (p.kind === 'doorTrigger') G.enterBuilding(p.building); else if (p.kind === 'exitTrigger') G.leaveInterior(); else G.interact(p); };
    let best = null, bd = 99;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const p of World.propsAt(G.map, l.x + dx, l.y + dy)) { if (!wants(p)) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); if (d < bd) { bd = d; best = p; } }
    G.path = null; G.pendingInteract = null;
    if (best) { if (bd > 0 && World.passable(G.map, best.x, best.y)) { G.stepLeader(best.x, best.y); if (best.kind === 'doorTrigger' || best.kind === 'exitTrigger') return; } fire(best); return; }
    // nothing next to us: walk to the nearest door we know about and use it
    const far = (G.map.props || []).filter((p) => wants(p) && U.dist(p.x, p.y, l.x, l.y) <= 14 && (G.map.kind !== 'dungeon' || G.map.seen[p.y * G.map.w + p.x])).sort((a, b) => U.dist(a.x, a.y, l.x, l.y) - U.dist(b.x, b.y, l.x, l.y));
    if (!far.length) { AudioSys.play('bump'); UI.toast(dir === 'out' ? 'No door out from here.' : 'Nothing to step into here.'); return; }
    G.goInteract(far[0].x, far[0].y, () => fire(far[0]));
  };
  G.contextFor = (p) => {
    switch (p.kind) {
      case 'chest': return p.open ? null : { label: p.locked ? '🔒 ' + (p.sealed ? 'Sealed chest' : 'Locked chest') : '📦 Open chest', fn: () => G.interact(p) };
      case 'door': return p.open ? null : { label: p.locked ? '🔒 ' + (p.riddle ? 'Riddle door' : p.needsKey ? 'Locked (key)' : 'Locked door') : '🚪 Open door', fn: () => G.interact(p) };
      case 'secretDoor': return p.revealed && !p.open ? { label: '🚪 Secret door', fn: () => G.interact(p) } : null;
      case 'lever': return { label: '🎚 ' + (p.label || 'Pull lever'), fn: () => G.interact(p) };
      case 'cage': return p.event && !p.open ? { label: '⛓ Prisoner', fn: () => G.interact(p) } : null;
      case 'pedestal': return p.keyPedestal && !p.taken ? { label: '🗝 Take key', fn: () => G.interact(p) } : p.event && !p.taken ? { label: '👁 Idol', fn: () => G.interact(p) } : null;
      case 'campfire': return p.rest ? { label: '🔥 Short rest' + (p.usesLeft ? '' : ' (used)'), fn: () => G.interact(p) } : null;
      case 'stairs': return { label: p.entrance ? '🚪 Leave dungeon' : '⬇ Finish & leave', fn: () => G.interact(p) };
      case 'trapdoor': return { label: '🪜 Cellar', fn: () => G.interact(p) };
      case 'entrance': return { label: '🏰 ' + p.site.name, fn: () => G.interact(p) };
      case 'doorTrigger': return p.building && p.building.locked && !G.state.flags[p.building.locked] ? null : { label: '🚪 Enter ' + p.building.name, fn: () => G.enterBuilding(p.building) };
      case 'exitTrigger': return { label: '🚪 Step outside', fn: () => G.leaveInterior() };
      case 'questBoard': return { label: '📋 Quest board', fn: () => UI.questBoard() };
      case 'signpost': return { label: '🪧 Read sign', fn: () => UI.dialogue('Signpost', null, p.text.replace(/\n/g, '<br>'), []) };
      case 'trap': return p.trap.spotted && p.trap.armed ? { label: '⚠ Disarm trap', fn: () => G.disarmTrap(p) } : null;
      default: if (p.event) return { label: '❗ Investigate', fn: () => G.interact(p) }; if (p.searchable && !p.searched) return { label: '🔎 Search ' + (p.kind === 'searchSpot' ? 'here' : p.kind), fn: () => G.interact(p) }; return null;
    }
  };
  // One attempt each: a character who has already tried a given lock, search or riddle cannot roll it again.
  // Somebody else can step up, and when the whole party has had a go that approach is spent. Stops a check
  // being re-rolled until it passes — which was free gold on anything guarding loot.
  G.triedBy = (holder, key) => (holder._tried && holder._tried[key]) || [];
  G.markTried = (holder, key, ch) => { holder._tried = holder._tried || {}; (holder._tried[key] = holder._tried[key] || []).push(ch.id); };
  G.bestUntried = (holder, key, skill) => { const done = G.triedBy(holder, key); return G.party.filter((c) => !c.dead && !c.downed && !done.includes(c.id)).sort((a, b) => Rules.skillBonus(b, skill) - Rules.skillBonus(a, skill))[0] || null; };
  G.spentLabel = (base) => base + ' — everyone has tried';

  G.searchArea = async () => { const l = G.leader(); const spot = 'search:' + U.key(l.x, l.y); const best = G.bestUntried(G.map, spot, 'investigation'); if (!best) { log('You have been over this spot already. Try somewhere else.', 'miss'); return; } G.markTried(G.map, spot, best); await UI.awaitThrow('Search: Investigation', Rules.d20Spec(best, 'investigation')); const rec = Rules.skillCheck(best, 'investigation', 12, { label: 'Search the area' }); log(best.name + ' searches: ' + Dice.fmt(rec), 'roll'); let found = 0; for (const p of G.map.props) { if (p.removed || U.dist(p.x, p.y, l.x, l.y) > 4) continue; if (p.kind === 'secretDoor' && !p.revealed && rec.total >= p.dc - 2) { G.revealSecret(p); found++; } if (p.kind === 'trap' && p.trap.armed && !p.trap.spotted && rec.total >= p.trap.spotDC - 2) { p.trap.spotted = true; G.map.trapsRevealed[U.key(p.x, p.y)] = true; log('You find a ' + p.trap.name.toLowerCase() + '.', 'warn'); found++; } } if (!found) log(rec.total >= 15 ? 'Nothing hidden nearby. You are quite sure.' : 'You find dust, and a strong feeling of being watched.', 'miss'); G.updateContext(); };
  G.disarmTrap = async (p) => { const best = G.party.filter((pp) => !pp.dead).sort((a, b) => Rules.skillBonus(b, 'sleightOfHand') - Rules.skillBonus(a, 'sleightOfHand'))[0]; const tools = G.hasItem('thievesTools'); await UI.awaitThrow('Disarm trap: Sleight of Hand', Rules.d20Spec(best, 'sleightOfHand', { adv: best.cls === 'rogue' && tools })); const rec = Rules.skillCheck(best, 'sleightOfHand', p.trap.disarmDC, { label: 'Disarm ' + p.trap.name, bonus: tools ? (best.cls === 'rogue' ? 0 : 2) : -2, adv: best.cls === 'rogue' && tools }); log(best.name + ' disarms the trap: ' + Dice.fmt(rec) + (rec.success ? ' — disarmed!' : ' — snap!'), rec.success ? 'heal' : 'warn'); if (rec.success) { p.trap.armed = false; World.set(G.map, p.x, p.y, T.FLOOR); World.removeProp(G.map, p); AudioSys.play('unlock'); G.awardXp(10 * G.map.level, true); } else { const l = G.leader(); const px = l.x, py = l.y; l.x = p.x; l.y = p.y; G.stepOn(l, p.x, p.y); l.x = px; l.y = py; } G.updateContext(); };

  // ---------- Interactions ----------
  G.interact = (p) => {
    if (!p || p.removed) return; const l = G.leader(); const m = G.map;     switch (p.kind) {
      case 'trapdoor': G.offerDungeon({ id: 'cellar', name: 'The Flagon Cellar', theme: 'cellar', kind: 'cellar' }); return;
      case 'entrance': if (!p.site.available) { UI.dialogue(p.site.name, null, 'The way is sealed by black water and a spiral of runes. You are not ready. Yet.', []); return; } G.offerDungeon(p.site); return;
      case 'stairs': if (p.entrance) { UI.confirm('Leave the dungeon now? ' + (m.boss && m.boss.dead ? 'The boss is defeated; you will complete the run.' : 'The quest will not be complete.'), () => G.leaveDungeon(), 'Leave'); } else { UI.confirm(m.boss && (m.boss.dead || m.bossSpared) ? 'Descend the stairs and head home with your loot?' : 'The boss still lurks here. Leave anyway?', () => G.leaveDungeon(), 'Leave'); } return;
      case 'door': case 'secretDoor': {
        if (p.open) return;
        if (p.riddle && !p.riddle.solved) { UI.dialogue('Riddle door', null, 'The door has no handle. Carved above it: "Answer the statue, or break me."', [{ text: 'Force it open', check: { skill: 'athletics', dc: p.dc }, fn: () => G.forceDoor(p) }, { text: 'Leave it', fn: () => {} }]); return; }
        if (p.locked) { if (p.needsKey) { if (G.hasItem('dungeonKey')) { G.removeItem('dungeonKey', 1); p.locked = false; p.open = true; log('The rusty key turns. The door groans open.', 'loot'); AudioSys.play('unlock'); G.updateVisibility(); G.updateContext(); return; } UI.dialogue('Locked door', null, 'A heavy lock. You will need a key from somewhere in this dungeon, or a lot of muscle.', [{ text: 'Force it open', check: { skill: 'athletics', dc: 20 }, fn: () => G.forceDoor(p, 20) }, { text: 'Leave it', fn: () => {} }]); return; }
          const rogue = G.bestUntried(p, 'pick', 'sleightOfHand'), brute = G.bestUntried(p, 'force', 'athletics');
          const choices = [];
          choices.push(rogue ? { text: 'Pick the lock (' + rogue.name + ')' + (G.hasItem('thievesTools') ? '' : ' — no tools: -2'), check: { skill: 'sleightOfHand', dc: p.dc }, fn: async () => { G.markTried(p, 'pick', rogue); await UI.awaitThrow('Pick lock: Sleight of Hand', Rules.d20Spec(rogue, 'sleightOfHand')); const rec = Rules.skillCheck(rogue, 'sleightOfHand', p.dc, { label: 'Pick lock', bonus: G.hasItem('thievesTools') ? 0 : -2 }); log(rogue.name + ' picks the lock: ' + Dice.fmt(rec) + (rec.success ? ' — click!' : ' — the pick slips, and the tumbler jams for good.'), rec.success ? 'heal' : 'warn'); if (rec.success) { p.locked = false; p.open = true; AudioSys.play('unlock'); G.awardXp(10 * m.level, true); G.updateVisibility(); } G.updateContext(); } } : { text: G.spentLabel('Pick the lock'), disabled: true, fn: () => {} });
          choices.push(brute ? { text: 'Force it open, loudly (' + brute.name + ')', check: { skill: 'athletics', dc: 15 }, fn: () => G.forceDoor(p, 15) } : { text: 'Batter it down (very loud — this always works)', fn: () => G.batterDoor(p) });
          choices.push({ text: 'Leave it', fn: () => {} });
          UI.dialogue('Locked door', null, 'Locked. Each of you gets one honest attempt at it; after that the lock has seen your tricks.', choices); return; }
        p.open = true; AudioSys.play('door'); G.updateVisibility(); G.updateContext(); return; }
      case 'chest': {
        if (p.open) return;
        if (p.mimic) { p.removed = true; World.removeProp(m, p); const mm = Rules.spawnMonster('mimic', { x: p.x, y: p.y }); mm.room = p.room; m.monsters.push(mm); log('The chest opens its eyes. IT IS NOT A CHEST.', 'warn'); AudioSys.play('alert'); G.updateVisibility(); G.startCombatWith([mm]); return; }
        if (p.sealed) { UI.dialogue('Sealed chest', null, 'The lid is fused shut by glowing runes. Something in this room must release it.', []); return; }
        if (p.locked) {
          const rogue = G.bestUntried(p, 'pick', 'sleightOfHand'), brute = G.bestUntried(p, 'smash', 'athletics');
          const choices = [];
          choices.push(rogue ? { text: 'Pick the lock (' + rogue.name + ')' + (G.hasItem('thievesTools') ? '' : ' — no tools: -2'), check: { skill: 'sleightOfHand', dc: p.dc }, fn: async () => { G.markTried(p, 'pick', rogue); await UI.awaitThrow('Pick lock: Sleight of Hand', Rules.d20Spec(rogue, 'sleightOfHand')); const rec = Rules.skillCheck(rogue, 'sleightOfHand', p.dc, { label: 'Pick lock', bonus: G.hasItem('thievesTools') ? 0 : -2 }); log(rogue.name + ' works the lock: ' + Dice.fmt(rec) + (rec.success ? ' — open!' : ' — the pick snaps off in the lock.'), rec.success ? 'heal' : 'warn'); if (rec.success) { p.locked = false; G.awardXp(10 * m.level, true); G.openChest(p); } G.updateContext(); } } : { text: G.spentLabel('Pick the lock'), disabled: true, fn: () => {} });
          choices.push(brute ? { text: 'Smash it open (' + brute.name + ')', check: { skill: 'athletics', dc: 13 }, fn: async () => { G.markTried(p, 'smash', brute); await UI.awaitThrow('Smash chest: Athletics', Rules.d20Spec(brute, 'athletics')); const rec = Rules.skillCheck(brute, 'athletics', 13, { label: 'Smash chest' }); log(brute.name + ' smashes the chest: ' + Dice.fmt(rec) + (rec.success ? ' — CRACK!' : ' — ow. The lid holds.'), rec.success ? 'heal' : 'warn'); if (rec.success) { p.locked = false; if (Math.random() < 0.3 && p.loot.items.length) { const broke = p.loot.items.pop(); log('Something inside shattered: ' + getItem(broke.item).name + ' is ruined.', 'warn'); } G.openChest(p); } else G.makeNoise(p.x, p.y); G.updateContext(); } } : { text: G.spentLabel('Smash it open'), disabled: true, fn: () => {} });
          const spent = !rogue && !brute;
          if (spent) choices.push({ text: 'Pry it open with a blade (ruins some of the contents)', fn: () => G.pryChest(p) });
          choices.push({ text: 'Leave it', fn: () => {} });
          UI.dialogue('Locked chest', null, spent ? 'The lock has beaten all of you. There is one way left, and it is not a delicate one.' : 'A sturdy lock guards the loot. Each of you gets one attempt — pick it or break it.', choices); return; }
        G.openChest(p); return; }
      case 'lever': { const pz = p.puzzle; if (pz.solved) { log('The lever is stuck in place.', 'miss'); return; } AudioSys.play('lever'); p.on = !p.on; const expect = pz.order[pz.pulled.length]; if (p.lever === expect) { pz.pulled.push(p.lever); log('Click. (' + pz.pulled.length + '/' + pz.order.length + ')', 'story'); if (pz.pulled.length === pz.order.length) { pz.solved = true; log('A deep rumble: the sealed chest unlocks!', 'loot'); if (pz.chest) { pz.chest.sealed = false; pz.chest.locked = false; } G.awardXp(25 * m.level, true); } } else { const r = Dice.roll('1d6', { label: 'Lever shock', kind: 'dmg' }); const res = Rules.applyDamage(l, r.total, 'lightning', { log }); log('Wrong order! A jolt of lightning: ' + res.taken + ' damage. The levers reset.', 'warn'); Renderer.floatText(l.x, l.y, '-' + res.taken, '#ffff60'); pz.pulled = []; for (const lv of m.props) if (lv.kind === 'lever' && lv.puzzle === pz) lv.on = false; } G.refreshHud(); return; }
      case 'pedestal': { if (p.keyPedestal && !p.taken) { p.taken = true; G.addItem('dungeonKey', 1); log('You take the rusty key. Somewhere, a mechanism clicks.', 'loot'); AudioSys.play('chest'); G.updateContext(); return; } if (p.event) { G.runEvent(p); return; } return; }
      case 'campfire': { if (!p.rest) return; if (!p.usesLeft) { UI.dialogue('Campfire', null, 'The embers are cold. You have already rested here.', []); return; } const free = G.party.some((pp) => Rules.accBonus(pp, 'freeRest')); if (!free && !G.hasItem('rations')) { UI.dialogue('Campfire', null, 'You have no rations. A rest without food does nobody any good.', []); return; } UI.confirm('Take a short rest? Spend hit dice to heal, recover short-rest abilities. ' + (free ? '' : 'Consumes 1 rations. ') + 'There is a chance of wandering monsters.', () => { if (!free) G.removeItem('rations', 1); p.usesLeft--; for (const pp of G.party) Rules.shortRest(pp, log); log('The party rests by the fire.', 'heal'); AudioSys.play('heal'); G.refreshHud(); if (Math.random() < 0.25) { const enc = ENCOUNTERS[m.theme]; const list = enc[m.tier] || enc[1]; const n = 1 + Math.floor(Math.random() * 2); const spawned = []; for (let i = 0; i < n; i++) { const [x, y] = World.findFloorNear(m, l.x + 3, l.y + 3, (xx, yy) => G.isFree(xx, yy) && U.dist(xx, yy, l.x, l.y) >= 3); const mo = Rules.spawnMonster(U.pick(list), { x, y, groupId: 'wander' }); m.monsters.push(mo); spawned.push(mo); } log('Your fire draws unwanted company!', 'warn'); G.updateVisibility(); if (!Combat.active) G.startCombatWith(spawned); } }, 'Rest'); return; }
      case 'cage': { if (p.event && !p.open) { G.runEvent(p); return; } if (p.flavor) UI.dialogue('Cage', null, p.flavor, []); return; }
      case 'altar': { if (p.puzzleAltar) { if (p.used) { UI.dialogue('Ancient altar', null, 'The altar is quiet now.', []); return; } UI.dialogue('Ancient altar', null, 'An altar to a nameless power. Coins glint in a bowl; a dagger-shaped hollow waits beside it. You feel it wants something: an offering, or a desecration.', [{ text: 'Offer ' + p.cost + ' gold', cost: p.cost, disabled: G.state.gold < p.cost, fn: () => { G.spendGold(p.cost); p.used = true; for (const pp of G.party) if (!pp.dead) { Rules.addCondition(pp, 'bless', 999); Rules.heal(pp, Dice.roll('2d8', { label: 'Altar blessing', kind: 'heal' }).total); } log('Warm light fills the room. The party is blessed and restored.', 'heal'); AudioSys.play('heal'); G.refreshHud(); } }, { text: 'Desecrate it and take the coins', fn: () => { p.used = true; G.addGold(p.cost * 3); log('You scoop up ' + (p.cost * 3) + ' gold. The candles go out. Bones stir in the corners.', 'warn'); const enc = m.theme === 'crypt' || m.theme === 'temple' || m.theme === 'swamp' ? ['skeleton', 'zombie'] : ['skeleton']; const spawned = []; for (let i = 0; i < 2 + Math.floor(m.level / 3); i++) { const [x, y] = World.findFloorNear(m, p.x + (i % 2 ? 2 : -2), p.y + (i < 2 ? 1 : -1), (xx, yy) => G.isFree(xx, yy)); const mo = Rules.spawnMonster(U.pick(enc), { x, y, groupId: 'altar' }); m.monsters.push(mo); spawned.push(mo); } G.updateVisibility(); G.startCombatWith(spawned); } }, { text: 'Leave it', fn: () => {} }]); return; } if (p.event) { G.runEvent(p); return; } G.searchProp(p); return; }
      case 'statue': { if (p.riddleStatue) { if (p.riddleStatue.solved) { UI.dialogue('Statue', null, 'The statue is silent, and looks smug about it.', []); return; } UI.riddle(p.riddleStatue, (ok, idx) => { if (!ok && idx !== undefined) (p.riddleStatue.wrong = p.riddleStatue.wrong || []).push(idx); if (ok) { p.riddleStatue.solved = true; const door = m.props.find((d) => d.riddle === p.riddleStatue); if (door) { door.locked = false; door.open = true; } log('"Correct," grinds the statue. The riddle door swings open.', 'loot'); AudioSys.play('unlock'); G.awardXp(25 * m.level, true); G.updateVisibility(); } else { log('"WRONG," booms the statue. Its eyes flash. Everyone takes 1d4 psychic damage.', 'warn'); for (const pp of G.party) if (!pp.dead) { const r = Dice.roll('1d4', { silent: true }); Rules.applyDamage(pp, r.total, 'psychic', { log }); } G.refreshHud(); if (G.party.every((pp) => pp.dead || pp.downed)) G.partyWipe(); } G.updateContext(); }); return; } if (p.event) { G.runEvent(p); return; } G.searchProp(p); return; }
      case 'well': UI.dialogue('Town well', null, 'You peer in. Your reflection peers back, looking like it slept under a table for three days.', [{ text: 'Toss a coin (1 gp)', cost: 1, disabled: G.state.gold < 1, fn: async () => { G.spendGold(1); await UI.awaitThrow('Make a wish'); const r = Dice.roll('1d20', { label: 'Wish', kind: 'misc' }); if (r.total === 20) { log('The well glows! Your wish is granted: a potion floats up.', 'loot'); G.addItem('potionGreaterHealing', 1); } else log('Splash. Nothing happens. Probably.', 'miss'); } }, { text: 'Walk away', fn: () => {} }]); return;
      default: if (p.event) { G.runEvent(p); return; } if (p.searchable) { G.searchProp(p); return; }
    }
  };
  G.forceDoor = async (p, dc) => { const st = G.bestUntried(p, 'force', 'athletics'); if (!st) { G.batterDoor(p); return; } G.markTried(p, 'force', st); await UI.awaitThrow('Force door: Athletics', Rules.d20Spec(st, 'athletics')); const rec = Rules.skillCheck(st, 'athletics', dc || p.dc, { label: 'Force door' }); log(st.name + ' shoulders the door: ' + Dice.fmt(rec) + (rec.success ? ' — it splinters open!' : ' — it holds. Ow.'), rec.success ? 'heal' : 'warn'); if (rec.success) { p.locked = false; p.open = true; if (p.riddle) p.riddle.solved = true; AudioSys.play('door'); G.updateVisibility(); } G.makeNoise(p.x, p.y); G.updateContext(); };
  // Last resort once everyone has failed the chest: it opens, but the crowbar treatment costs you part of the haul.
  G.pryChest = (p) => { p.locked = false; if (p.loot && p.loot.items.length) { const lost = p.loot.items.splice(0, Math.ceil(p.loot.items.length / 2)); for (const e of lost) log('Ruined levering the lid: ' + getItem(e.item).name + '.', 'warn'); } if (p.loot) p.loot.gold = Math.floor((p.loot.gold || 0) * 0.7); log('You lever the chest open. It is not pretty, and neither is what is left inside.', 'warn'); G.makeNoise(p.x, p.y); G.openChest(p); };
  // Last resort once everyone has failed the door: it always opens, and everything nearby hears it.
  G.batterDoor = (p) => { p.locked = false; p.open = true; if (p.riddle) p.riddle.solved = true; AudioSys.play('door'); log('You give up on finesse and batter the door off its hinges. Every ear in the place heard that.', 'warn'); G.updateVisibility(); G.makeNoise(p.x, p.y); G.makeNoise(p.x, p.y); G.updateContext(); };
  G.makeNoise = (x, y) => { let n = 0; for (const mo of G.monsters) if (!mo.dead && !mo.alerted && U.dist(mo.x, mo.y, x, y) <= 8 && Math.random() < 0.5) { mo.alerted = true; const path = U.astar(mo.x, mo.y, x, y, (xx, yy) => World.passable(G.map, xx, yy) && !G.entityAt(xx, yy), 40); if (path && path.length > 2) { const [sx, sy] = path[Math.min(path.length - 2, 3)]; mo.x = sx; mo.y = sy; n++; } } if (n) log('The noise draws attention…', 'warn'); G.updateVisibility(); };
  G.openChest = (p) => { p.open = true; AudioSys.play('chest'); const loot = p.loot || { gold: 0, items: [] }; const lines = []; if (loot.gold) { G.addGold(loot.gold); G.map.goldFound += loot.gold; lines.push(loot.gold + ' gold'); } for (const e of loot.items) { G.addItem(e.item, e.qty); lines.push(getItem(e.item).name + (e.qty > 1 ? ' ×' + e.qty : '')); } log('Chest: ' + (lines.length ? lines.join(', ') : 'empty. Someone got here first.'), 'loot'); UI.toast('💰 ' + (lines.length ? lines.join(', ') : 'Empty chest')); G.bark(G.leader(), 'loot'); Renderer.burst(p.x, p.y, '#ffe080', 0.8); G.updateContext(); };
  G.searchProp = async (p) => {
    if (p.searched) { log('Already searched.', 'miss'); return; } p.searched = true; const l = G.leader(); const best = G.party.filter((pp) => !pp.dead).sort((a, b) => Rules.skillBonus(b, 'investigation') - Rules.skillBonus(a, 'investigation'))[0];
    if (p.search) { const s = p.search; if (s.dc) { await UI.awaitThrow('Search: ' + SKILLS[s.dc.skill].name, Rules.d20Spec(best, s.dc.skill)); const rec = Rules.skillCheck(best, s.dc.skill, s.dc.dc, { label: 'Search' }); log(best.name + ' searches: ' + Dice.fmt(rec), 'roll'); if (!rec.success) { log('Nothing but dust.', 'miss'); return; } } log(s.text, 'story'); if (s.gold) { G.addGold(s.gold); } if (s.item) { G.addItem(s.item, 1); UI.toast('Found ' + ITEMS[s.item].name); } return; }
    if (p.grave && !p.disturbed) { p.disturbed = true; const roll = Dice.die(10); if (roll <= 4) { const rng = RNG(RNG.hash(p.id)); const loot = Dungeon.rollLoot(G.map.level, rng, false, true); G.addGold(loot.gold); for (const e of loot.items) G.addItem(e.item, e.qty); log('Among the bones: ' + loot.gold + ' gold' + (loot.items.length ? ' and ' + loot.items.map((e) => getItem(e.item).name).join(', ') : '') + '.', 'loot'); } else if (roll <= 7) log('Dust, bones, and a faint smell of regret.', 'miss'); else { p.open = true; const mo = Rules.spawnMonster(G.map.level >= 3 && Math.random() < 0.4 ? 'ghoul' : U.pick(['skeleton', 'zombie']), { x: p.x, y: p.y }); World.removeProp(G.map, p); G.map.monsters.push(mo); log('The grave was occupied. Its occupant objects.', 'warn'); G.updateVisibility(); G.startCombatWith([mo]); } return; }
    if (p.shelf) { await UI.awaitThrow('Search shelves: Investigation', Rules.d20Spec(best, 'investigation')); const rec = Rules.skillCheck(best, 'investigation', 12, { label: 'Search shelves' }); log(best.name + ' searches the shelves: ' + Dice.fmt(rec), 'roll'); if (rec.success) { const r = Math.random(); if (r < 0.5) { const scrolls = Object.values(ITEMS).filter((it) => it.type === 'scroll' && it.tier <= Math.ceil(G.map.level / 2)); const sc = U.pick(scrolls); G.addItem(sc.id, 1); log('Behind a false book: ' + sc.name + '!', 'loot'); } else { const g = Dice.roll('2d6', { silent: true }).total * G.map.level; G.addGold(g); log('A hollowed-out tome holds ' + g + ' gold.', 'loot'); } } else log('Mouldering books. One is titled "So You\'ve Woken Up In A Tavern".', 'miss'); return; }
    if (p.container) { if (p.loot) { G.addGold(p.loot.gold); for (const e of p.loot.items) G.addItem(e.item, e.qty); log('You find ' + (p.loot.gold ? p.loot.gold + ' gold' : '') + (p.loot.items.length ? (p.loot.gold ? ' and ' : '') + p.loot.items.map((e) => getItem(e.item).name).join(', ') : '') + '.', 'loot'); AudioSys.play('coin'); } else log(U.pick(['Empty.', 'Rotten food. Very rotten.', 'Rats. Just rats. They leave.', 'Someone\'s laundry. You put it back.']), 'miss'); return; }
    if (p.tableLoot) { G.addGold(p.tableLoot); log('Coins scattered across the table: ' + p.tableLoot + ' gold.', 'loot'); return; }
    if (p.hiddenGold) { await UI.awaitThrow('Examine statue: Perception', Rules.d20Spec(best, 'perception')); const rec = Rules.skillCheck(best, 'perception', 12, { label: 'Examine statue' }); log(best.name + ' examines the statue: ' + Dice.fmt(rec), 'roll'); if (rec.success) { G.addGold(p.hiddenGold); log('A hidden compartment! ' + p.hiddenGold + ' gold.', 'loot'); } else log(p.flavor || 'Just a statue.', 'story'); return; }
    if (p.flavor) { log(p.flavor, 'story'); return; }
    log(U.pick(['Nothing of interest.', 'Dust. So much dust.', 'You find a very old sandwich. You leave it.']), 'miss');
  };
  G.runEvent = (p) => {
    const ev = STORY.events.find((e) => e.id === p.event); if (!ev) return; const hero = G.party[0];
    UI.event(ev, async (c) => {
      let out = c.pass, ok = true;
      const rollFor = (skill) => G.party.filter((pp) => !pp.dead).sort((a, b) => Rules.skillBonus(b, skill) - Rules.skillBonus(a, skill))[0];
      if (c.cost) { if (!G.spendGold(c.cost)) return; }
      if (c.check) { const who = rollFor(c.check.skill); await UI.awaitThrow(SKILLS[c.check.skill].name + ' check'); const rec = Rules.skillCheck(who, c.check.skill, c.check.dc, { label: SKILLS[c.check.skill].name, bonus: c.check.tools && G.hasItem('thievesTools') ? 2 : 0 }); ok = rec.success; log(who.name + ' ' + SKILLS[c.check.skill].name + ': ' + Dice.fmt(rec) + (ok ? ' — success!' : ' — failure.'), ok ? 'heal' : 'warn'); out = ok ? c.pass : c.fail; }
      else if (c.save) { await UI.awaitThrow(ABILITY_NAMES[c.save] + ' save'); const rec = Rules.savingThrow(hero, c.save, c.dc, { magic: true }); ok = rec.success; log(hero.name + ' ' + ABILITY_NAMES[c.save] + ' save: ' + Dice.fmt(rec) + (ok ? ' — success!' : ' — failure.'), ok ? 'heal' : 'warn'); out = ok ? c.pass : c.fail; }
      else if (c.contest) { await UI.awaitThrow('Roll against the skeleton'); const mine = Dice.roll('1d20', { label: 'Your roll', kind: 'misc' }).total, theirs = Dice.roll('1d20', { label: 'Skeleton roll', kind: 'misc' }).total; ok = mine > theirs; log('You roll ' + mine + ', the skeleton rolls ' + theirs + '.', 'roll'); out = ok ? c.pass : c.fail; }
      out = out || {}; G.resolveOutcome(out, p, ev);
    });
  };
  G.resolveOutcome = (o, p, ev) => {
    const l = G.leader(); const lines = [o.text || '']; const rewards = [];
    if (o.gold) { G.addGold(o.gold); G.map.goldFound += o.gold; rewards.push('💰 +' + o.gold + ' gold'); }
    if (o.xp) { G.awardXp(o.xp, true); rewards.push('✨ +' + o.xp + ' XP'); }
    if (o.item) { let id = o.item; if (id === 'random:potion') id = U.pick(['potionHealing', 'potionGreaterHealing', 'antitoxin', 'potionHeroism']); if (id === 'random:scroll') { const scrolls = Object.values(ITEMS).filter((it) => it.type === 'scroll' && it.tier <= Math.ceil(G.map.level / 2) + 1); id = U.pick(scrolls).id; } G.addItem(id, 1); rewards.push('🎁 ' + ITEMS[id].name); }
    if (o.damage) { Rules.applyDamage(l, o.damage, 'bludgeoning', { log }); rewards.push({ text: '💔 ' + l.name + ' -' + o.damage + ' HP', bad: true }); }
    if (o.damageRoll) { const r = Dice.roll(o.damageRoll, { label: 'Damage', kind: 'dmg' }); const res = Rules.applyDamage(l, r.total, 'psychic', { log }); rewards.push({ text: '💔 ' + l.name + ' -' + res.taken + ' HP', bad: true }); }
    if (o.status) { Rules.addCondition(l, o.status, 999); rewards.push({ text: '☠ ' + l.name + ' is ' + o.status, bad: true }); }
    if (o.partyStatus) { for (const pp of G.party) if (!pp.dead) Rules.addCondition(pp, o.partyStatus, 999); rewards.push('🙏 Party blessed'); }
    if (o.healParty) { const r = Dice.roll(o.healParty, { label: 'Restoration', kind: 'heal' }); for (const pp of G.party) if (!pp.dead) Rules.heal(pp, r.total); rewards.push('💚 Everyone +' + r.total + ' HP'); AudioSys.play('heal'); }
    if (o.revealSecret) { for (const sp of G.map.props) if (sp.kind === 'secretDoor' && !sp.revealed) { G.revealSecret(sp, 'The goblin\'s tip pays off: a secret door is revealed!'); break; } }
    if (o.alert) G.makeNoise(l.x, l.y);
    if (o.companion) { p.open = true; const c = Character.randomCompanion(Math.max(1, G.partyLevel()), Math.random, {}); c.rescued = true; c.hireCost = 0; const q = G.map.questId ? Quests.byId(G.map.questId) : null; if (q) Quests.onEvent(q, 'rescued'); lines.push(c.name + ' the ' + RACES[c.race].name + ' ' + CLASSES[c.cls].name + ' is free!'); if (G.party.length < 4) { UI.outcome(lines.join(' ') + ' "Room for one more?"', () => UI.confirm(c.name + ' offers to join your party.', () => { G.addCompanion(c); G.refreshHud(); }, 'Welcome aboard'), rewards); p.event = null; G.refreshHud(); G.updateContext(); return; } else { G.state.guildRecruits = (G.state.guildRecruits || []).concat([c]); lines.push('They will wait for you at the Guild Hall.'); } }
    if (o.retry) { UI.outcome(lines.join(' '), () => {}, rewards); return; }
    p.event = null; if (p.kind === 'pedestal') p.taken = true; if (p.kind === 'bones' || p.kind === 'cart') { World.removeProp(G.map, p); } if (p.kind === 'table' || p.kind === 'bookshelf' || p.kind === 'altar') p.searched = true;
    const q = G.map.questId ? Quests.byId(G.map.questId) : null; if (q && q.objective === 'clue') Quests.onEvent(q, 'clue');
    G.refreshHud(); G.updateContext(); UI.outcome(lines.filter(Boolean).join(' '), () => { if (G.party.every((pp) => pp.dead || pp.downed)) G.partyWipe(); }, rewards);
  };
  G.castOutOfCombat = () => { const casters = G.party.filter((p) => !p.dead && !p.downed && CLASSES[p.cls].spellcasting && (p.spells.known.length || p.spells.cantrips.length)); if (!casters.length) return; const pick = (caster) => UI.spellPicker(caster, (spellId, slot) => { const s = SPELLS[spellId]; if (s.target === 'ally' || s.target === 'creature') { UI.modal({ title: 'Target', body: (b) => { for (const t of G.party.filter((p) => !p.dead || s.special === 'revive')) b.appendChild(el('div', { class: 'item-row' }, [el('div', { class: 'nm' }, [el('b', { text: t.name }), el('div', { class: 'meta', text: 'HP ' + t.hp + '/' + t.maxHp + (t.dead ? ' (dead)' : '') })]), el('button', { class: 'btn small primary', text: 'Cast', onclick: () => { UI.closeModal(); Combat.castSpell(caster, spellId, t, { slot }); } })])); } }); } else Combat.castSpell(caster, spellId, caster, { slot }); }, true); if (casters.length === 1) pick(casters[0]); else UI.modal({ title: 'Who casts?', body: (b) => { for (const c of casters) b.appendChild(el('button', { class: 'btn', style: 'display:block;width:100%;margin:4px 0', text: c.name + ' (' + CLASSES[c.cls].name + ')', onclick: () => { UI.closeModal(); pick(c); } })); } }); };
  const el = U.el;
  G.useItemFlow = (who, item) => { const it = getItem(item); if (!it) return; const needsTarget = (it.type === 'consumable' && (it.effect.heal || it.effect.cure || it.effect.throwDamage)) || (it.type === 'scroll' && ['ally', 'enemy', 'creature'].includes(SPELLS[it.spell].target)); if (!needsTarget) { Combat.useItem(who, item, who); return; } if (Combat.active && (it.effect && it.effect.throwDamage || (it.type === 'scroll' && SPELLS[it.spell].target === 'enemy'))) { G.pendingTarget = { kind: 'item', item, who }; Combat.selectedAction = 'target'; G.state.highlights = G.monsters.filter((m) => !m.dead && !m.escaped && G.map.vis[m.y * G.map.w + m.x]).map((m) => ({ x: m.x, y: m.y, color: '#ff8060', alpha: 0.5 })); UI.toast('Tap a target'); return; } UI.modal({ title: 'Use ' + it.name + ' on…', body: (b) => { for (const t of G.party.filter((p) => !p.dead || (it.type === 'scroll' && SPELLS[it.spell].special === 'revive'))) b.appendChild(el('div', { class: 'item-row' }, [el('div', { class: 'nm' }, [el('b', { text: t.name }), el('div', { class: 'meta', text: 'HP ' + t.hp + '/' + t.maxHp + (t.dead ? ' (dead)' : t.downed ? ' (unconscious)' : '') + (t.conditions.length ? ' · ' + t.conditions.map((c) => c.id).join(', ') : '') })]), el('button', { class: 'btn small primary', text: 'Use', onclick: () => { UI.closeModal(); Combat.useItem(who, item, t).then(() => { G.refreshHud(); if (Combat.active) UI.refreshActionBar(); }); } })])); } }); };

  // ---------- Combat input ----------
  G.selectAction = (a) => {
    const e = Combat.current(); if (!e) return;
    if (a.id === 'end') { Combat.endTurn(); return; }
    if (a.id === 'cast' || a.id === 'wand') { if (a.id === 'wand') { const sp = SPELLS[Rules.accBonus(e, 'wandSpell')]; G.beginTargeting(e, { kind: 'wand', spell: sp }); return; } UI.spellPicker(e, (spellId, slot) => { const s = SPELLS[spellId]; if (s.target === 'self' || s.target === 'enemies' || (s.target === 'allies' && s.range === 0)) { Combat.castSpell(e, spellId, e, { slot }).then(() => { G.state.highlights = []; UI.refreshActionBar(); G.refreshHud(); }); } else G.beginTargeting(e, { kind: 'spell', spellId, slot, spell: s }); }); return; }
    if (a.id === 'item') { UI.inventory(e, true); return; }
    if (a.id === 'attack') { G.beginTargeting(e, { kind: 'attack' }); return; }
    if (['frenzy', 'offhand', 'warPriest', 'spiritStrike', 'intimidate'].includes(a.id)) { G.beginTargeting(e, { kind: 'action', action: a.id, melee: a.id !== 'spiritStrike' && a.id !== 'intimidate' }); return; }
    if (a.id === 'breath' || a.id === 'blink') { G.beginTargeting(e, { kind: 'point', action: a.id }); return; }
    if (a.id === 'cunning') { UI.modal({ title: 'Cunning Action', body: (b) => { ['dash', 'disengage', 'hide'].forEach((s) => b.appendChild(el('button', { class: 'btn', style: 'display:block;width:100%;margin:4px 0', text: U.cap(s), onclick: () => { UI.closeModal(); Combat.doAction(e, 'cunning', s).then(() => { G.updateHighlights(); UI.refreshActionBar(); }); } }))); } }); return; }
    Combat.doAction(e, a.id).then(() => { G.updateHighlights(); UI.refreshActionBar(); G.refreshHud(); });
  };
  G.beginTargeting = (e, t) => {
    G.pendingTarget = t; Combat.selectedAction = 'target'; const hl = [];
    if (t.kind === 'attack' || (t.kind === 'action' && t.melee)) { const w = t.kind === 'attack' ? Rules.weapon(e) : null; for (const m of G.monsters) if (!m.dead && !m.escaped && G.map.vis[m.y * G.map.w + m.x] && (t.kind === 'attack' ? Combat.canAttack(e, m, w) : U.dist(e.x, e.y, m.x, m.y) <= 1)) hl.push({ x: m.x, y: m.y, color: '#ff6060', alpha: 0.55 }); if (!hl.length) { UI.toast('No target in range. Move closer.'); Combat.selectedAction = 'move'; G.pendingTarget = null; G.updateHighlights(); UI.refreshActionBar(); return; } }
    else if (t.kind === 'spell' || t.kind === 'wand') { const s = t.spell; const r = Math.max(1, Math.floor(s.range / 5)); if (s.target === 'enemy' || s.target === 'creature' || s.target === 'point') for (const m of G.monsters) if (!m.dead && !m.escaped && G.map.vis[m.y * G.map.w + m.x] && U.dist(e.x, e.y, m.x, m.y) <= r) hl.push({ x: m.x, y: m.y, color: '#c080ff', alpha: 0.55 }); if (s.target === 'ally' || s.target === 'creature' || s.target === 'allies') for (const p of G.party) if ((!p.dead || s.special === 'revive') && U.dist(e.x, e.y, p.x, p.y) <= Math.max(1, r)) hl.push({ x: p.x, y: p.y, color: '#80ff80', alpha: 0.55 }); if (s.target === 'point' || s.special === 'teleport') UI.toast('Tap a target tile'); else UI.toast('Tap a target'); }
    else if (t.kind === 'point') { UI.toast(t.action === 'blink' ? 'Tap a tile within 3' : 'Tap a direction'); }
    else if (t.kind === 'action') { for (const m of G.monsters) if (!m.dead && !m.escaped && G.map.vis[m.y * G.map.w + m.x] && U.dist(e.x, e.y, m.x, m.y) <= 12) hl.push({ x: m.x, y: m.y, color: '#ff6060', alpha: 0.55 }); }
    G.state.highlights = hl; UI.refreshActionBar();
  };
  G.updateHighlights = () => { const e = Combat.current(); if (!e || !Combat.isPlayerTurn()) { G.state.highlights = []; return; } if (Combat.selectedAction === 'target') return; const reach = Combat.reachable(e); const hl = []; for (const [k, d] of reach) { const [x, y] = k.split(',').map(Number); if (d > 0) hl.push({ x, y, color: '#80c0ff', alpha: 0.22 }); } G.state.highlights = hl; };
  G.combatTap = async (tile, ent) => {
    const e = Combat.current(); if (!e || !e.turn) return;
    if (Combat.selectedAction === 'target' && G.pendingTarget) {
      const t = G.pendingTarget; const target = ent && !ent.dead ? ent : G.entityAt(tile.x, tile.y);
      const done = () => { G.pendingTarget = null; Combat.selectedAction = 'move'; G.state.highlights = []; G.updateHighlights(); UI.refreshActionBar(); G.refreshHud(); };
      if (t.kind === 'attack') { if (target && target.hostile) { if (!Combat.canAttack(e, target, Rules.weapon(e))) { UI.toast('Out of range'); return; } await Combat.playerAttack(e, target); if (e.turn && e.turn.attacksLeft > 0 && e.turn.actionStarted) { G.beginTargeting(e, { kind: 'attack' }); G.refreshHud(); return; } done(); return; } if (target && target.isParty) { done(); return; } }
      else if (t.kind === 'spell') { const s = t.spell; if (s.target === 'point' || s.special === 'teleport') { if (U.dist(e.x, e.y, tile.x, tile.y) > Math.max(1, Math.floor(s.range / 5)) && s.range > 0) { UI.toast('Out of range'); return; } await Combat.castSpell(e, t.spellId, { x: tile.x, y: tile.y }, { slot: t.slot }); done(); return; } if (target) { if (U.dist(e.x, e.y, target.x, target.y) > Math.max(1, Math.floor(s.range / 5))) { UI.toast('Out of range'); return; } if (s.target === 'enemy' && !target.hostile) { UI.toast('Pick an enemy'); return; } if (s.target === 'ally' && target.hostile) { UI.toast('Pick an ally'); return; } await Combat.castSpell(e, t.spellId, target, { slot: t.slot }); done(); return; } }
      else if (t.kind === 'wand') { if (target && target.hostile) { await Combat.doAction(e, 'wand', target); done(); return; } }
      else if (t.kind === 'item') { if (target) { await Combat.useItem(t.who, t.item, target); done(); return; } }
      else if (t.kind === 'action') { if (target && target.hostile) { if (t.melee && U.dist(e.x, e.y, target.x, target.y) > 1) { UI.toast('Not adjacent'); return; } await Combat.doAction(e, t.action, target); done(); return; } }
      else if (t.kind === 'point') { await Combat.doAction(e, t.action, { x: tile.x, y: tile.y }); done(); return; }
      // tapped elsewhere: cancel targeting
      done(); return;
    }
    // Move mode: tap enemy adjacent → attack shortcut; tap reachable tile → move
    if (ent && ent.hostile && !ent.dead) { if (Combat.canAttack(e, ent, Rules.weapon(e)) && (!e.turn.action || e.turn.attacksLeft > 0 || e.turn.extraActions > 0)) { await Combat.playerAttack(e, ent); if (e.turn && e.turn.attacksLeft > 0 && e.turn.actionStarted) G.beginTargeting(e, { kind: 'attack' }); else { Combat.selectedAction = 'move'; G.updateHighlights(); } UI.refreshActionBar(); G.refreshHud(); } else UI.toast(e.turn.action ? 'Action already used' : 'Out of reach'); return; }
    if (ent && ent.isParty && ent !== e) { UI.characterSheet(ent); return; }
    const reach = Combat.reachable(e); const k = U.key(tile.x, tile.y); if (!reach.has(k) || k === U.key(e.x, e.y)) { if (World.passable(G.map, tile.x, tile.y) && G.map.seen[tile.y * G.map.w + tile.x]) UI.toast('Too far'); return; }
    const path = U.astar(e.x, e.y, tile.x, tile.y, Combat.passableFor(e), 40); if (!path) return; await Combat.moveAlong(e, path); G.updateHighlights(); UI.refreshActionBar(); G.refreshHud();
  };

  // ---------- Dialogue ----------
  G.talkTo = (npc) => { G.path = null; const l = G.leader(); npc.facing = npc.x - npc.y > l.x - l.y ? 'l' : 'r'; if (npc.shopUi) { G.openShopUi(npc.shopUi); return; } if (!npc.dialog) { UI.dialogue(npc.name, npc, 'They nod at you, and go back to what they were doing.', []); return; } if (npc.dialog === 'grell') { G.grellDialog(npc); return; } if (npc.dialog === 'wren') { G.wrenDialog(npc); return; } const first = !G.state.flags['talked_' + npc.id]; G.state.flags['talked_' + npc.id] = true; G.runDialog(npc.dialog, npc, first ? 'start' : (STORY.dialogs[npc.dialog] && STORY.dialogs[npc.dialog].idle ? 'idle' : 'start')); };
  G.grellDialog = (npc) => { const ready = Quests.active().find((q) => q.status === 'readyToTurnIn' && q.giver === 'Bosun Grell'); if (ready) { G.turnInQuest(ready, npc); return; } if (!G.state.flags.grellIntro) { G.state.flags.grellIntro = true; G.runDialog('grell', npc, 'start'); return; } if (!Quests.byId('act1') && !Quests.isDone('act1')) { G.runDialog('grell', npc, 'work'); return; } G.runDialog('grell', npc, 'idle'); };
  G.wrenDialog = (npc) => { const ready = Quests.active().find((q) => q.status === 'readyToTurnIn' && q.giver === 'Wren Ashby'); if (ready) { G.turnInQuest(ready, npc); return; } const story = Quests.storyAvailable(); if (story && story.giver === 'Wren Ashby') { G.offerStoryQuest(story, npc); return; } if (!G.state.flags.wrenIntro) { G.state.flags.wrenIntro = true; G.runDialog('wren', npc, 'start'); return; } G.runDialog('wren', npc, 'idle'); };
  G.runDialog = (id, npc, nodeId) => {
    const d = STORY.dialogs[id]; if (!d) return; const node = d[nodeId || 'start']; if (!node) return; const hero = G.party[0];
    const fmt = (t) => t.replace('{name}', hero.name).replace('{gossip}', U.pick(NAMES.tavernGossip)).replace('{class}', CLASSES[hero.cls].name).replace('{race}', RACES[hero.race].name);
    // a node that hands something over shows it as reward pills in the dialogue itself, not as a toast that beats the explanation
    const rewards = node.action ? G.dialogAction(node.action, true) : null;
    const choices = (node.choices || []).filter((c) => !c.req || G.state.flags[c.req.flag]).map((c) => ({ text: c.text.replace(/^\[[^\]]+\]\s*/, ''), check: c.check, fn: async () => {
      if (c.set) Object.assign(G.state.flags, c.set); if (c.action) { if (G.dialogAction(c.action) === 'stop') return; }
      if (c.check) { await UI.awaitThrow(SKILLS[c.check.skill].name + ' check'); const rec = Rules.skillCheck(hero, c.check.skill, c.check.dc, { label: SKILLS[c.check.skill].name }); log(hero.name + ' ' + SKILLS[c.check.skill].name + ': ' + Dice.fmt(rec) + (rec.success ? ' — success!' : ' — failure.'), rec.success ? 'heal' : 'warn'); const nx = rec.success ? c.pass : c.fail; if (nx) G.runDialog(id, npc, nx); return; }
      if (c.next) G.runDialog(id, npc, c.next);
    } }));
    UI.dialogue(node.speaker, npc, fmt(node.text), choices, { rewards: rewards || undefined });
  };
  // Returns reward labels when the action hands something over; quiet suppresses the toast (the dialogue shows the pills).
  G.dialogAction = (action, quiet) => {
    const [kind, arg] = action.split(':'); const got = [];
    switch (kind) {
      case 'acceptQuest': Quests.startAct(arg); break;
      case 'giveItem': G.addItem(arg, 1); got.push('🎁 ' + ITEMS[arg].name); if (!quiet) UI.toast('Received ' + ITEMS[arg].name); break;
      case 'giveGold': G.addGold(parseInt(arg, 10)); got.push('💰 +' + arg + ' gold'); if (!quiet) UI.toast('+' + arg + ' gold'); break;
      case 'giveSigilCoinEarly': if (!G.hasItem('sigilCoin')) { G.addItem('sigilCoin', 1); G.addGold(1); got.push('🎁 Sigil-Stamped Coin'); if (!quiet) UI.toast('Received Sigil-Stamped Coin'); } break;
      case 'longRest': G.longRest(); break;
      case 'buyRound': if (G.spendGold(5)) { for (const p of G.party) if (!p.dead) { p.tempHp = Math.max(p.tempHp || 0, 3); } log('You buy a round. Everyone gains 3 temporary HP and a warm feeling.', 'heal'); for (const p of G.party) G.bark(p, 'greet'); G.refreshHud(); } break;
      default: break;
    }
    return got.length ? got : null;
  };
  G.offerStoryQuest = (def, npc) => { const hero = G.party[0]; const speaker = def.giver; const text = def.summary + '<br><br><i>Recommended level ' + def.level + '. ' + def.rooms + ' rooms. Location: ' + (WORLDMAP.dungeons.find((d) => d.id === def.dungeon) || { name: 'the cellar' }).name + '.</i>'; UI.dialogue(speaker, npc, text, [{ text: 'Accept: ' + def.title, fn: () => Quests.startAct(def.id) }, { text: 'Not yet.', fn: () => {} }]); };
  G.turnInQuest = (q, npc) => { const text = (q.completeText || 'Well done.').replace('{name}', G.party[0].name); UI.dialogue(q.completeSpeaker || q.giver, npc, text, [{ text: 'Collect reward', fn: () => { Quests.turnIn(q); G.refreshHud(); const nx = Quests.storyAvailable(); if (nx) UI.toast('New lead: talk to ' + nx.giver); if (q.id === 'act5') setTimeout(() => G.ending(), 600); } }], { noClose: true }); };
  G.ending = () => { UI.narration(['The Spiral Eye is broken. Hollowmere sleeps soundly for the first time in a season.', 'Your memories return in pieces: a road, a warning, a promise you made to someone you have not met yet. Enough to know you chose this life, and would again.', 'The Rusty Flagon has a table with your name carved under it. Grell says it is not a compliment. Wren says it is.', 'The quest board is full again by morning. Twenty minutes at a time, the world needs saving.', 'Thank you for playing Pocket Dungeons. Endless adventures await on the quest board.'], () => { AudioSys.music('town'); }, 'The Sleeper Wakes'); };
  G.offerDungeon = (site) => {
    const q = Quests.forSite(site.id) || Quests.forSite(site.id === 'cellar' ? 'cellar' : null); const lvl = G.partyLevel();
    const body = q ? '<b>Quest: ' + q.title + '</b><br>' + q.text + '<br><br><i>Recommended level ' + q.level + ' · ' + q.rooms + ' rooms · about ' + (10 + q.rooms * 2) + ' minutes.</i>' : 'No active quest here. You can still delve for loot and experience.<br><br><i>Level ' + lvl + ' · ' + (5 + Math.min(4, Math.floor(lvl / 2))) + ' rooms.</i>';
    const choices = []; if (q) choices.push({ text: '⚔ Begin: ' + q.title, fn: () => G.enterDungeon(site, q) }); choices.push({ text: q ? 'Free delve instead (no quest progress)' : '⚔ Delve for loot', fn: () => G.enterDungeon(site, null) }); choices.push({ text: 'Not now', fn: () => {} });
    if (site.id === 'cellar' && !q && !Quests.isDone('act1')) { UI.dialogue('Cellar trapdoor', null, 'Grell would prefer you talk to him before wandering into his cellar. (He is watching you.)', [{ text: 'Fine.', fn: () => {} }]); return; }
    UI.dialogue(site.name, null, body, choices);
  };
  window.Game = G;
  window.addEventListener('DOMContentLoaded', () => G.init());
})();
