/* Quests: the five-act main story plus random board quests with twists. */
(function () {
  const Q = {};
  Q.state = () => Game.state.quests;
  Q.init = () => { Game.state.quests = { active: [], completed: [], board: [], boardDay: 0, storyUnlocked: 'act1', started: {} }; };
  Q.actDef = (id) => STORY.acts.find((a) => a.id === id);
  Q.active = () => Q.state().active;
  Q.byId = (id) => Q.active().find((q) => q.id === id);
  Q.isDone = (id) => Q.state().completed.includes(id);
  Q.forSite = (siteId) => Q.active().find((q) => q.siteId === siteId && q.status === 'active');
  Q.storyAvailable = () => { const st = Q.state(); const next = st.storyUnlocked; if (!next || next === 'endless') return null; if (Q.isDone(next) || Q.byId(next)) return null; return Q.actDef(next); };

  Q.startAct = (id) => {
    const def = Q.actDef(id); if (!def || Q.byId(id) || Q.isDone(id)) return null;
    const q = { id, story: true, act: def.act, title: def.title, text: def.summary, giver: def.giver, theme: def.theme, siteId: def.dungeon, level: def.level, rooms: def.rooms, objective: def.objective.type, item: def.objective.item, rescue: !!def.objective.rescue, twist: def.twist, bossIntro: def.bossIntro, bossChoice: def.bossChoice || null, status: 'active', progress: {}, reward: def.complete.reward, completeText: def.complete.text, completeSpeaker: def.complete.speaker, unlockTown: def.complete.unlockTown || null, unlocks: def.unlocks };
    if (id === 'act5') { q.bossId = 'voskar'; q.bossMinions = 'cultFanatic'; }
    if (id === 'act4') q.bossId = 'banditCaptain'; if (id === 'act3') q.bossId = 'cultFanatic'; if (id === 'act2') q.bossId = 'goblinBoss'; if (id === 'act1') q.bossId = 'ratKing';
    Q.active().push(q); Game.log('New quest: ' + q.title, 'loot'); AudioSys.play('quest'); UI.toast('📜 Quest accepted: ' + q.title);
    if (id === 'act5') { Game.state.flags.act5 = true; Game.rebuildOverworld(); }
    Game.save(); return q;
  };
  // Random quests for the board. Picks unlocked sites (not the tavern cellar).
  Q.generateBoard = () => {
    const st = Q.state(); const lvl = Game.partyLevel(); const rng = RNG(RNG.hash('board' + Game.state.day + Game.state.seed));
    const sites = WORLDMAP.dungeons.filter((d) => d.id !== 'temple' || Game.state.flags.act5); const offers = [];
    const tpls = rng.shuffle(STORY.randomQuests).slice(0, 3);
    tpls.forEach((t, i) => { const site = rng.pick(sites); const qLevel = Math.max(1, Math.min(MAX_LEVEL, lvl + (i === 0 ? 0 : i === 1 ? 1 : rng.int(-1, 2)))); const twist = rng.pick(t.twists);
      offers.push({ id: 'rq_' + Game.state.day + '_' + i, story: false, title: t.title, text: t.text.replace('{dungeon}', site.name), giver: 'Quest Board', theme: site.theme, siteId: site.id, siteName: site.name, level: qLevel, rooms: 5 + Math.min(4, Math.floor(qLevel / 2)) + rng.int(0, 1), objective: t.objective, item: t.item || null, rescue: t.objective === 'rescue', twist, status: 'offered', progress: {}, reward: { gold: 30 * qLevel + rng.int(0, 20), xp: 100 * qLevel, item: rng.chance(0.5) ? Q.randomRewardItem(qLevel, rng) : null }, tpl: t.id, escort: !!t.escort }); });
    st.board = offers; st.boardDay = Game.state.day;
  };
  Q.randomRewardItem = (lvl, rng) => { const pool = Object.values(ITEMS).filter((it) => (it.type === 'accessory' && !it.legendary && it.tier <= Math.ceil(lvl / 2) + 1) || (it.type === 'scroll' && it.tier <= Math.ceil(lvl / 2)) || it.id === 'potionGreaterHealing'); return rng.pick(pool).id; };
  Q.accept = (offer) => { if (Q.active().filter((q) => !q.story).length >= 2) { UI.toast('You can only track two side quests at a time.'); return false; } offer.status = 'active'; Q.active().push(offer); Q.state().board = Q.state().board.filter((o) => o !== offer); Game.log('New quest: ' + offer.title, 'loot'); AudioSys.play('quest'); UI.toast('📜 Quest accepted: ' + offer.title); Game.save(); return true; };
  Q.abandon = (q) => { Q.state().active = Q.active().filter((x) => x !== q); Game.log('Abandoned quest: ' + q.title, 'warn'); };

  // Called by the dungeon when things happen. Returns true if quest objective now complete.
  Q.onEvent = (q, type, data) => {
    if (!q || q.status !== 'active') return false;
    if (type === 'bossKilled') { q.progress.boss = true; if (q.item) { Game.addItem(q.item, 1); Game.log('You find the ' + ITEMS[q.item].name + '!', 'loot'); q.progress.item = true; } }
    if (type === 'bossSpared') { q.progress.boss = true; if (q.item) { Game.addItem(q.item, 1); Game.log('You receive the ' + ITEMS[q.item].name + '.', 'loot'); q.progress.item = true; } }
    if (type === 'rescued') q.progress.rescued = true;
    if (type === 'clue') q.progress.clue = true;
    if (type === 'twist') q.twistRevealed = true;
    let done = false;
    switch (q.objective) {
      case 'boss': done = !!q.progress.boss && (!q.rescue || q.progress.rescued || q.progress.boss); break;
      case 'item': done = !!q.progress.boss; break;
      case 'rescue': done = !!q.progress.rescued || !!q.progress.boss; break;
      case 'clue': done = !!q.progress.boss || !!q.progress.clue; break;
      default: done = !!q.progress.boss;
    }
    if (done && q.status === 'active') { q.status = 'readyToTurnIn'; Game.log('Quest objective complete: ' + q.title + '. Return to ' + q.giver + '.', 'loot'); UI.toast('✓ Objective complete! Return to ' + q.giver); AudioSys.play('quest'); }
    return done;
  };
  Q.turnIn = (q) => {
    if (q.status !== 'readyToTurnIn') return false;
    q.status = 'done'; Q.state().active = Q.active().filter((x) => x !== q); Q.state().completed.push(q.id);
    const r = q.reward || {}; const lines = [];
    if (r.gold) { Game.addGold(r.gold); lines.push(r.gold + ' gold'); }
    if (r.item) { Game.addItem(r.item, 1); lines.push(getItem(r.item).name); }
    if (r.xp) { Game.awardXp(r.xp, true); lines.push(r.xp + ' XP each'); }
    if (q.item && Game.hasItem(q.item)) Game.removeItem(q.item, 1);
    if (r.companion) Game.state.pendingCompanion = true;
    if (q.unlockTown) { Game.state.flags[q.unlockTown] = true; Game.log('The road to Brackenmoor is open.', 'story'); Game.rebuildOverworld(); }
    if (q.unlocks) Q.state().storyUnlocked = q.unlocks;
    if (q.id === 'act5') Game.state.flags.storyComplete = true;
    Game.log('Quest complete: ' + q.title + '. Reward: ' + lines.join(', ') + '.', 'loot'); AudioSys.play('victory'); Game.state.questsDone = (Game.state.questsDone || 0) + 1; Game.save();
    return true;
  };
  // For dungeon generation
  Q.dungeonParams = (site, q) => {
    const lvl = q ? q.level : Math.max(1, Game.partyLevel()); const rooms = q ? q.rooms : 5 + Math.min(4, Math.floor(lvl / 2));
    return { theme: site.theme, level: lvl, rooms, seed: RNG.hash((q ? q.id : 'free') + site.id + Game.state.seed + (Game.state.dungeonRuns || 0)), quest: q ? { id: q.id, objective: q.objective, bossId: q.bossId || null, bossMinions: q.bossMinions || null, rescue: q.rescue } : null, partySize: Game.party.filter((p) => !p.dead).length, name: q && q.story && q.id === 'act1' ? 'The Flagon Cellar' : site.name };
  };
  window.Quests = Q;
})();
