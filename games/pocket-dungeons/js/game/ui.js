/* DOM UI: title, HUD, dice tray, log, action bar, modals (dialogue, creator, sheet, inventory, spells, quests, shops, level up, events). */
(function () {
  const UI = {}; const $ = (id) => document.getElementById(id); const el = U.el;
  let modalStack = [];
  UI.init = () => {
    $('btn-new').onclick = () => { AudioSys.init(); AudioSys.play('click'); UI.characterCreator((d) => Game.newGame(d)); };
    $('btn-continue').onclick = () => { AudioSys.init(); AudioSys.play('click'); Game.load(); };
    $('btn-howto').onclick = () => { AudioSys.init(); UI.howToPlay(); };
    $('btn-menu').onclick = () => UI.menu(); $('btn-sheet').onclick = () => UI.characterSheet(Game.party[0]); $('btn-bag').onclick = () => UI.inventory(); $('btn-quests').onclick = () => UI.questLog(); $('btn-log').onclick = () => UI.logPanel();
    $('btn-continue').disabled = !Save.exists();
    Dice.on((rec) => { if (rec.type === 'd20' || rec.kind === 'dmg' || rec.kind === 'heal' || rec.kind === 'misc') UI.showRoll(rec); });
    Dice3D.init($('dice-tray')); UI.applySpeed(); window.addEventListener('resize', UI._placeTray);
    $('roll-prompt').onclick = () => UI.doThrow(); // the tray itself handles press-drag-release; this is the 'just throw them' shortcut
  };
  // ---- Manual dice: the player throws. Game code awaits UI.awaitThrow(label) before rolling its own dice. ----
  UI.manualDice = () => Save.settings().manualDice !== false;
  UI.throwPending = null;
  // spec: {n, sides, kind}. Defaults to one d20 — if the roll turns out to need more dice (advantage, a damage
  // expression), the tray adds them at bind time with the same force you threw with.
  UI.awaitThrow = (label, spec) => {
    if (!UI.manualDice() || Game.fast) return Promise.resolve();
    if (UI.throwPending) return UI.throwPending.promise;
    let resolve; const promise = new Promise((r) => { resolve = r; }); UI.throwPending = { resolve, promise, label };
    spec = Object.assign({ n: 1, sides: 20 }, spec || {}); spec.label = label || 'Roll';
    Dice3D.onAllThrown = () => UI.doThrow();
    Dice3D.ready(spec);
    const p = $('roll-prompt'); p.textContent = spec.n > 1 ? '🎲 Throw all ' + spec.n : '🎲 Throw the dice';
    p.classList.remove('hidden'); $('dice-tray').classList.add('armed'); AudioSys.play('click');
    return promise;
  };
  // Resolve the pending throw. Anything still sitting on the felt is tossed with the same force as your last throw.
  UI.doThrow = () => {
    const t = UI.throwPending; if (!t) return false;
    UI.throwPending = null; Dice3D.onAllThrown = null;
    if (!Dice3D.allThrown()) Dice3D.throwRest();
    $('roll-prompt').classList.add('hidden'); $('dice-tray').classList.remove('armed');
    UI.logHoldUntil = performance.now() + 300; // the log then waits for the table to be still (see UI.log)
    t.resolve(); return true;
  };
  // Dice for an expression like '2d6+3', so the tray puts the right dice in your hand.
  UI.diceSpec = (expr, kind) => { const m = /(\d*)d(\d+)/.exec(String(expr || '')); return m ? { n: Math.max(1, Math.min(8, parseInt(m[1] || '1', 10))), sides: parseInt(m[2], 10), kind } : { n: 1, sides: 20, kind }; };
  UI.cancelThrow = () => { if (UI.throwPending) UI.doThrow(); };
  UI.showTitle = () => { $('title').classList.remove('hidden'); $('hud').classList.add('hidden'); $('btn-continue').disabled = !Save.exists(); AudioSys.music('title'); };
  UI.hideTitle = () => { $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); };
  UI.toast = (text, cls) => UI.afterDice(() => { const t = el('div', { class: 'toast ' + (cls || '') + (UI.modalOpen() ? ' low' : ''), html: text }); $('app').appendChild(t); setTimeout(() => t.remove(), 2500); });
  // Log lines are held back briefly after a throw so the dice land before the result text appears
  UI.logHoldUntil = 0; UI._logQ = []; UI._logT = null;
  UI._logHistory = []; // {text, kind}: kept for the log panel, nothing is drawn over the map
  UI._appendLog = (text, kind) => {
    UI._logHistory.push({ text, kind: kind || '' }); while (UI._logHistory.length > 60) UI._logHistory.shift();
    if (UI._logRefresh) UI._logRefresh();
    UI._flash(text, kind);
  };
  // A new line appears on screen, holds for a few seconds, then fades away — the 📖 log keeps it.
  UI.FLASH_HOLD = 4200;
  UI._flash = (text, kind) => {
    const box = $('log-flash'); if (!box) return;
    const e = el('div', { class: 'entry ' + (kind || ''), html: text });
    box.appendChild(e);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { e.classList.add('out'); setTimeout(() => e.remove(), 700); }, UI.FLASH_HOLD);
  };
  UI.isRoll = (e) => /d20\(/.test(e.text);
  // Adventure log: hidden by default, opened from the 📖 button or L
  UI.logPanel = () => {
    if (UI._logOpen) { UI.closeModal(UI._logOpen); return; }
    let tab = 'rolls';
    const m = UI.modal({ title: 'Adventure Log', sub: 'What just happened, most recent first.', body: () => {}, onClose: () => { UI._logOpen = null; UI._logRefresh = null; } });
    UI._logOpen = m; const body = m.querySelector('.body');
    const render = () => {
      body.innerHTML = '';
      const tabs = el('div', { class: 'tabs' }); [['rolls', '🎲 Rolls'], ['all', 'Everything']].forEach(([id, nm]) => tabs.appendChild(el('button', { class: tab === id ? 'sel' : '', text: nm, onclick: () => { tab = id; render(); } }))); body.appendChild(tabs);
      const list = UI._logHistory.filter((e) => tab === 'all' || UI.isRoll(e)).slice(-(tab === 'all' ? 40 : 20)).reverse();
      if (!list.length) { body.appendChild(el('p', { class: 'muted', text: tab === 'rolls' ? 'No dice rolled yet.' : 'Nothing has happened yet.' })); return; }
      const wrap = el('div', { class: 'log-list' }); for (const e of list) wrap.appendChild(el('div', { class: 'entry ' + e.kind, html: e.text })); body.appendChild(wrap);
    };
    UI._logRefresh = () => { if (UI._logOpen) render(); };
    render();
  };
  // Nothing is reported while dice are still moving: lines wait until the table is still, then land in order.
  UI._pumpLog = () => { UI._logT = null; if (UI.diceBusy() || performance.now() < UI.logHoldUntil) { UI._logT = setTimeout(UI._pumpLog, 60); return; } while (UI._logQ.length) { const [t, k] = UI._logQ.shift(); UI._appendLog(t, k); } };
  UI.log = (text, kind) => { UI._logQ.push([text, kind]); if (!UI._logT) UI._pumpLog(); };
  // Run fn once the dice have come to a complete stop and read out (at once if nothing is rolling).
  UI.afterDice = (fn) => { if (!UI.diceBusy()) { fn(); return; } const tick = () => { if (UI.diceBusy()) { setTimeout(tick, 60); return; } fn(); }; setTimeout(tick, 60); };
  // Combat speed: Slow stretches the dice read-out and the pauses between actions, Fast hurries both.
  UI.SPEEDS = { slow: { name: 'Slow', f: 0.7 }, normal: { name: 'Normal', f: 1 }, fast: { name: 'Fast', f: 1.8 } };
  UI.speed = () => { const s = Save.settings().speed; return UI.SPEEDS[s] ? s : 'normal'; };
  UI.speedFactor = () => UI.SPEEDS[UI.speed()].f;
  UI.applySpeed = () => { Dice3D.speed = UI.speedFactor(); };
  UI.setLocation = (t) => { $('location-label').textContent = t; };
  UI.turnBanner = (t) => { const b = $('turn-banner'); if (!t) b.classList.add('hidden'); else { b.textContent = t; b.classList.remove('hidden'); } };
  // Dice tray: animate the dice of a roll record
  // If the player threw the dice themselves, give those dice their numbers; otherwise the house throws.
  UI._rollQ = []; UI._rollT = null;
  // One roll on the table at a time: a roll that arrives while another is still reading out waits its turn.
  UI.showRoll = (rec) => {
    if (rec.type !== 'd20' && !rec.rolls.length) return;
    if (Dice3D.phase === 'throw' && !Dice3D.rec) { Dice3D.bind(rec); return; }
    if (!Game.fast && (Dice3D.busy() || UI._rollQ.length)) { UI._rollQ.push(rec); if (!UI._rollT) UI._rollT = setTimeout(UI._nextRoll, 60); return; }
    Dice3D.roll(rec); AudioSys.play('dice'); UI.logHoldUntil = Math.max(UI.logHoldUntil, performance.now() + 1100); // the text lands after the dice do
  };
  UI._nextRoll = () => { UI._rollT = null; if (!UI._rollQ.length) return; if (Dice3D.busy()) { UI._rollT = setTimeout(UI._nextRoll, 60); return; } const rec = UI._rollQ.shift(); Dice3D.roll(rec); AudioSys.play('dice'); UI.logHoldUntil = Math.max(UI.logHoldUntil, performance.now() + 1100); if (UI._rollQ.length) UI._rollT = setTimeout(UI._nextRoll, 60); };
  // Party cards
  UI.refreshParty = () => {
    const bar = $('party-bar'); bar.innerHTML = '';
    for (const p of Game.party) {
      const card = el('div', { class: 'pc-card' + (p.activeTurn ? ' active-turn' : '') + (p.downed || p.dead ? ' downed' : ''), onclick: () => UI.characterSheet(p) });
      card.appendChild(Sprites.portraitEl(p)); const info = el('div', { class: 'info' });
      info.appendChild(el('div', { class: 'name', text: p.name + (p.dead ? ' ✝' : p.downed ? ' (down)' : '') })); info.appendChild(el('div', { class: 'small muted', text: CLASSES[p.cls].name + ' ' + p.level + ' · AC ' + Rules.ac(p) }));
      const bar1 = el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.round(100 * U.clamp(p.hp / p.maxHp, 0, 1)) + '%' })); info.appendChild(bar1);
      info.appendChild(el('div', { class: 'small', text: 'HP ' + p.hp + '/' + p.maxHp + (p.tempHp ? ' +' + p.tempHp : '') }));
      const slots = Object.keys(p.spells.slots || {}); if (slots.length) { const s = el('div', { class: 'slots' }); slots.forEach((l) => { for (let i = 0; i < p.spells.slots[l].max; i++) s.appendChild(el('span', { class: 'slot' + (i < p.spells.slots[l].used ? ' used' : ''), title: U.ordinal(+l) })); }); info.appendChild(s); }
      if (p.conditions.length) info.appendChild(el('div', { class: 'conds', text: p.conditions.map((c) => c.id).join(' · ') }));
      card.appendChild(info); bar.appendChild(card);
    }
  };
  UI.setContextActions = (acts) => { const c = $('context-actions'); c.innerHTML = ''; for (const a of acts) c.appendChild(el('button', { text: a.label, onclick: (ev) => { ev.stopPropagation(); AudioSys.play('click'); a.fn(); } })); };
  // ---- Combat action bar ----
  UI.showActionBar = (ent) => { UI.actionEnt = ent; $('action-bar').classList.remove('hidden'); $('dpad').classList.add('hidden'); UI.refreshActionBar(); };
  UI.hideActionBar = () => { $('action-bar').classList.add('hidden'); $('dpad').classList.remove('hidden'); UI.actionEnt = null; };
  UI.refreshActionBar = () => {
    const e = UI.actionEnt; if (!e || !Combat.active) return; const bar = $('action-bar'); bar.innerHTML = '';
    const t = e.turn || {}; const moveLeft = Combat.movementLeft(e);
    bar.appendChild(el('button', { class: 'move' + (Combat.selectedAction === 'move' || !Combat.selectedAction ? ' selected' : ''), html: 'Move<span class="res">' + moveLeft + ' tiles</span>', onclick: () => { Combat.selectedAction = 'move'; Game.updateHighlights(); UI.refreshActionBar(); } }));
    for (const a of Combat.actions(e)) {
      const b = el('button', { class: a.kind + (Combat.selectedAction === a.id ? ' selected' : ''), html: a.name + (a.res ? '<span class="res">' + a.res + '</span>' : a.kind === 'act' && t.action && !(t.extraActions > 0) && a.id !== 'attack' ? '<span class="res">action used</span>' : ''), title: a.desc });
      b.disabled = !a.enabled; b.onclick = () => { AudioSys.play('click'); Game.selectAction(a); }; bar.appendChild(b);
    }
  };
  // ---- Modal framework ----
  // Dialogs never interrupt a roll: a modal opened while dice are tumbling stays hidden until they land.
  UI.diceBusy = () => !Game.fast && (Dice3D.busy() || UI._rollQ.length > 0);
  // Resolves once the tray has come to rest, so nothing rolls over a result you have not read.
  UI.waitForDice = () => new Promise((res) => { const tick = () => { if (!UI.diceBusy()) { res(); return; } setTimeout(tick, 60); }; tick(); });
  UI._syncLayer = () => {
    const layer = $('modal-layer'); const shown = modalStack.filter((x) => !x.classList.contains('await-dice'));
    if (shown.length) layer.classList.remove('hidden'); else layer.classList.add('hidden');
    // Dialog after a roll: keep the dice on screen, slide the tray up and seat the dialog under it, centred as a group
    const withDice = shown.some((x) => x.classList.contains('with-dice')) && Dice3D.pin();
    const tray = $('dice-tray'); let slot = layer.querySelector('.dice-slot');
    if (withDice) { layer.classList.add('with-dice'); tray.classList.add('over-modal'); if (!slot) { slot = el('div', { class: 'dice-slot' }); layer.insertBefore(slot, layer.firstChild); } slot.style.height = (Dice3D.trayRect().h + 14) + 'px'; UI._placeTray(); }
    else { layer.classList.remove('with-dice'); if (slot) slot.remove(); tray.classList.remove('over-modal'); Dice3D.setTop(null); Dice3D.unpin(); }
  };
  UI._placeTray = () => { const slot = $('modal-layer').querySelector('.dice-slot'); if (!slot) return; requestAnimationFrame(() => { const r = slot.getBoundingClientRect(); if (r.height) Dice3D.setTop(Math.round(r.top)); }); };
  UI._revealTimer = null;
  UI._revealWhenDiceDone = () => { UI._revealTimer = null; if (UI.diceBusy()) { UI._revealTimer = setTimeout(UI._revealWhenDiceDone, 80); return; } for (const x of modalStack) x.classList.remove('await-dice'); UI._syncLayer(); };
  UI.modal = (opts) => {
    const layer = $('modal-layer');
    const afterRoll = !Game.fast && Game.mode !== 'title' && Dice3D.showing();
    const m = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (afterRoll ? ' with-dice' : '') + (UI.diceBusy() ? ' await-dice' : '') });
    if (opts.title !== undefined) { const h = el('header'); h.appendChild(el('div', {}, [el('h2', { text: opts.title }), opts.sub ? el('div', { class: 'sub', html: opts.sub }) : null])); if (!opts.noClose) h.appendChild(el('button', { class: 'close-x', text: '✕', onclick: () => UI.closeModal(m) })); m.appendChild(h); }
    const body = el('div', { class: 'body' }); if (typeof opts.body === 'function') opts.body(body); else if (opts.body) body.appendChild(typeof opts.body === 'string' ? el('div', { html: opts.body }) : opts.body); m.appendChild(body);
    if (opts.buttons && opts.buttons.length) { const f = el('footer'); for (const b of opts.buttons) { const btn = el('button', { class: 'big ' + (b.cls || ''), text: b.label, onclick: () => { AudioSys.play('click'); if (!b.keep) UI.closeModal(m); if (b.fn) b.fn(); } }); if (b.disabled) btn.disabled = true; f.appendChild(btn); } m.appendChild(f); }
    m._onClose = opts.onClose; layer.appendChild(m); modalStack.push(m); UI._syncLayer(); if (m.classList.contains('await-dice') && !UI._revealTimer) UI._revealTimer = setTimeout(UI._revealWhenDiceDone, 80); return m;
  };
  UI.closeModal = (m) => { m = m || modalStack[modalStack.length - 1]; if (!m) return; modalStack = modalStack.filter((x) => x !== m); m.remove(); UI._syncLayer(); if (m._onClose) m._onClose(); };
  UI.closeAll = () => { while (modalStack.length) UI.closeModal(); };
  UI.modalOpen = () => modalStack.length > 0;
  UI.confirm = (text, onYes, yesLabel) => UI.modal({ title: 'Are you sure?', body: text, buttons: [{ label: 'Cancel' }, { label: yesLabel || 'Yes', cls: 'primary', fn: onYes }] });
  UI.narration = (lines, onDone, title) => { let i = 0; const m = UI.modal({ title: title || '', noClose: true, body: (b) => { b.appendChild(el('p', { class: 'narr', text: lines[0] })); }, buttons: [{ label: 'Continue', cls: 'primary', keep: true, fn: () => { i++; if (i >= lines.length) { UI.closeModal(m); if (onDone) onDone(); } else { m.querySelector('.body').innerHTML = ''; m.querySelector('.body').appendChild(el('p', { class: 'narr', text: lines[i] })); } } }] }); };
  // Dialogue with optional portrait and choices
  UI.dialogue = (speaker, portraitEnt, text, choices, opts) => {
    opts = opts || {};
    const m = UI.modal({ noClose: !!opts.noClose, title: undefined, body: (b) => {
      const d = el('div', { class: 'dialogue' }); if (portraitEnt) { const c = Sprites.portraitEl(portraitEnt, 64); c.className = 'portrait'; d.appendChild(c); }
      d.appendChild(el('div', {}, [el('div', { class: 'speaker', text: speaker }), el('div', { class: 'text', html: text })])); b.appendChild(d);
      const ch = el('div', { class: 'choices' });
      for (const c of choices) { const btn = el('button', { html: U.esc(c.text) + (c.check ? '<span class="check">(' + (SKILLS[c.check.skill] ? SKILLS[c.check.skill].name : ABILITY_NAMES[c.check.skill] || c.check.skill) + ' DC ' + c.check.dc + ')</span>' : '') + (c.cost ? '<span class="check">(' + c.cost + ' gp)</span>' : '') }); if (c.disabled) btn.disabled = true; btn.onclick = () => { AudioSys.play('click'); UI.closeModal(m); c.fn && c.fn(); }; ch.appendChild(btn); }
      b.appendChild(ch);
    } });
    if (!choices.length) m.querySelector('.body').appendChild(el('div', { class: 'choices' }, el('button', { text: 'Continue', onclick: () => { UI.closeModal(m); opts.onDone && opts.onDone(); } })));
    // what you gained (or lost) as pills above the choices, so the reward arrives with its explanation
    if (opts.rewards && opts.rewards.length) { const row = el('div', { class: 'rewards' }); for (const r of opts.rewards) row.appendChild(el('span', { class: r.bad ? 'bad' : '', text: r.text || r })); const ch = m.querySelector('.choices'); ch.parentNode.insertBefore(row, ch); }
    return m;
  };

  // ---- Character creator ----
  UI.characterCreator = (onDone) => {
    const d = Character.newDraft(); d.isPlayer = true; d.skills = Character.defaultSkills(d.cls, d.race); let step = 0; let classPicked = false;
    const m = UI.modal({ title: 'Create your Hero', wide: true, noClose: true, body: () => {}, buttons: [] });
    m.classList.add('creator-modal');
    const body = m.querySelector('.body'); body.classList.add('creator');
    const side = el('div', { class: 'creator-side' }), main = el('div', { class: 'creator-main' }); body.appendChild(side); body.appendChild(main);
    const footer = el('footer'); m.appendChild(footer);
    // Live preview: plain clothes until a class is chosen, then the class kit
    const previewEnt = () => { const base = { skin: d.skin, hairColor: d.hairColor, hairStyle: d.hairStyle, clothesColor: d.clothesColor, sex: d.sex, race: d.race, level: 1 }; if (!classPicked) return Object.assign(base, { cls: null, sprite: {} }); return Object.assign(base, { cls: d.cls, equipment: { mainHand: d.choices.weapon || CLASSES[d.cls].startChoices[0].options[0], armor: CLASSES[d.cls].startEquip.find((i) => ITEMS[i] && ITEMS[i].type === 'armor'), offHand: CLASSES[d.cls].startEquip.includes('shield') ? 'shield' : null } }); };
    const refreshSide = () => {
      side.innerHTML = ''; const w = el('div', { class: 'preview-wrap' }); const spr = Sprites.actor(previewEnt(), 0); const pc = document.createElement('canvas'); pc.width = 40; pc.height = 44; const pg = pc.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(spr.c, 20 - spr.ox, 43 - spr.oy); w.appendChild(pc); side.appendChild(w);
      const info = el('div', { class: 'preview-info' }); side.appendChild(info);
      info.appendChild(el('div', { class: 'preview-name', text: d.name || '(unnamed)' }));
      info.appendChild(el('div', { class: 'small muted', text: (d.sex === 'f' ? 'Female' : 'Male') + ' ' + RACES[d.race].name }));
      if (classPicked) info.appendChild(el('div', { class: 'small muted', text: CLASSES[d.cls].name + (d.choices.weapon && ITEMS[d.choices.weapon] ? ' · ' + ITEMS[d.choices.weapon].name : '') }));
    };
    const ensureChoices = () => { const cl = CLASSES[d.cls]; d.skills = d.skills.filter((s) => cl.skills.includes(s)); while (d.skills.length < cl.skillCount) { const nx = cl.skills.find((s) => !d.skills.includes(s)); if (!nx) break; d.skills.push(nx); } d.skills = d.skills.slice(0, cl.skillCount); for (const c of cl.startChoices) { if (c.type === 'weapon' && !c.options.includes(d.choices.weapon)) d.choices.weapon = c.options[0]; if (c.type === 'pick' && !c.options.some((o) => o.id === d.choices[c.id])) d.choices[c.id] = c.options[0].id; if (c.type === 'spells') { const list = spellList(d.cls, c.level).map((s) => s.id); d.choices[c.id] = (d.choices[c.id] || []).filter((s) => list.includes(s)); while (d.choices[c.id].length < c.count) { const nx = list.find((s) => !d.choices[c.id].includes(s)); if (!nx) break; d.choices[c.id].push(nx); } } if (c.type === 'expertise') { d.choices.expertise = (d.choices.expertise || []).filter((s) => d.skills.includes(s)); while (d.choices.expertise.length < c.count) { const nx = d.skills.find((s) => !d.choices.expertise.includes(s)); if (!nx) break; d.choices.expertise.push(nx); } } } if (d.method === 'recommended') d.base = Character.recommendedBase(d.cls); };
    const steps = [
      { title: 'Appearance', render: (b) => {
        b.appendChild(el('p', { class: 'small muted', text: 'Build what your hero looks like. You will choose what they can do next.' }));
        b.appendChild(el('label', { class: 'field', text: 'Name' })); const inp = el('input', { type: 'text', maxlength: 16, placeholder: NAMES.random(d.race, d.sex) }); inp.value = d.name; inp.oninput = () => { d.name = inp.value; refreshSide(); }; b.appendChild(inp);
        b.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn small', text: '🎲 Random name', onclick: () => { d.name = NAMES.random(d.race, d.sex); render(); } })]));
        b.appendChild(el('h3', { text: 'Body' }));
        b.appendChild(el('div', { class: 'row' }, ['m', 'f'].map((s) => el('button', { class: 'btn small' + (d.sex === s ? ' primary' : ''), text: s === 'm' ? 'Male' : 'Female', onclick: () => { d.sex = s; d.hairStyle = s === 'f' ? 'long' : 'short'; render(); } }))));
        b.appendChild(el('h3', { text: 'Race' })); const g = el('div', { class: 'grid2' });
        for (const r of Object.values(RACES)) g.appendChild(el('div', { class: 'opt' + (d.race === r.id ? ' sel' : ''), onclick: () => { d.race = r.id; d.skin = r.skinTones[0]; render(); } }, [el('h4', { text: r.name }), el('p', { text: r.desc }), el('div', { class: 'small', html: ABILITIES.filter((a) => r.bonus[a]).map((a) => '<span class="pill good">' + a.toUpperCase() + ' +' + r.bonus[a] + '</span>').join('') + r.traits.map((t) => '<span class="pill">' + t.name + '</span>').join('') })]));
        b.appendChild(g);
        b.appendChild(el('h3', { text: 'Looks' }));
        const sw = (label, colors, key) => { b.appendChild(el('div', { class: 'small muted', text: label })); const s = el('div', { class: 'swatches' }); for (const c of colors) s.appendChild(el('div', { class: 'swatch' + (d[key] === c ? ' sel' : ''), style: 'background:' + c, onclick: () => { d[key] = c; render(); } })); b.appendChild(s); };
        sw('Skin', RACES[d.race].skinTones, 'skin'); sw('Hair color', Character.hairColors, 'hairColor'); sw('Clothing color', Character.clothColors, 'clothesColor');
        b.appendChild(el('div', { class: 'small muted', text: 'Hair style' })); b.appendChild(el('div', { class: 'row' }, Character.hairStyles.map((h) => el('button', { class: 'btn small' + (d.hairStyle === h ? ' primary' : ''), text: h, onclick: () => { d.hairStyle = h; render(); } }))));
      } },
      { title: 'Class', render: (b) => {
        b.appendChild(el('p', { class: 'small muted', text: 'Now choose what your hero can do.' }));
        const g = el('div', { class: 'grid2' });
        for (const c of Object.values(CLASSES)) g.appendChild(el('div', { class: 'opt' + (classPicked && d.cls === c.id ? ' sel' : ''), onclick: () => { d.cls = c.id; classPicked = true; d.choices = {}; d.skills = Character.defaultSkills(c.id, d.race); ensureChoices(); render(); } }, [el('h4', { text: c.name, style: 'color:' + c.color }), el('p', { text: c.desc }), el('div', { class: 'small', html: '<span class="pill">d' + c.hitDie + ' hit die</span><span class="pill">' + c.primary.map((a) => a.toUpperCase()).join('/') + '</span>' + (c.spellcasting ? '<span class="pill good">Spellcaster</span>' : '') + (c.features[1] || []).map((f) => '<span class="pill">' + f.name + '</span>').join('') })]));
        b.appendChild(g);
      } },
      { title: 'Abilities & Skills', render: (b) => {
        ensureChoices(); const cl = CLASSES[d.cls];
        b.appendChild(el('div', { class: 'row' }, [el('button', { class: 'btn small' + (d.method === 'recommended' ? ' primary' : ''), text: 'Recommended', onclick: () => { d.method = 'recommended'; d.base = Character.recommendedBase(d.cls); render(); } }), el('button', { class: 'btn small' + (d.method === 'array' ? ' primary' : ''), text: 'Standard array', onclick: () => { d.method = 'array'; d.pool = Character.standardArray.slice(); d.base = {}; render(); } }), el('button', { class: 'btn small' + (d.method === 'roll' ? ' primary' : ''), text: '🎲 Roll 4d6', onclick: () => { d.method = 'roll'; d.pool = Character.rollAbilities(); d.base = {}; render(); } })]));
        const final = Character.applyRace(d.base || {}, d.race); const grid = el('div', { class: 'abil-grid' });
        for (const a of ABILITIES) { const sc = final[a]; const box = el('div', { class: 'abil' + ((d.method !== 'recommended') ? ' clickable' : '') }, [el('div', { class: 'nm', text: a.toUpperCase() }), el('div', { class: 'sc', text: d.base && d.base[a] !== undefined ? sc : '—' }), el('div', { class: 'md', text: d.base && d.base[a] !== undefined ? U.fmtMod(Rules.mod(sc)) + (RACES[d.race].bonus[a] ? ' (race +' + RACES[d.race].bonus[a] + ')' : '') : 'assign' })]); if (d.method !== 'recommended') box.onclick = () => { if (!d.pool) return; if (d.base[a] !== undefined) { d.pool.push(d.base[a]); delete d.base[a]; } else if (d.pool.length) { d.base[a] = d.pool.shift(); } render(); }; grid.appendChild(box); }
        b.appendChild(grid);
        if (d.method !== 'recommended') b.appendChild(el('div', { class: 'small muted', style: 'margin-top:6px', text: 'Pool: ' + (d.pool && d.pool.length ? d.pool.join(', ') : 'empty') + ' — tap an ability to assign the next value (tap again to unassign). Assign highest to ' + cl.primary.map((a) => a.toUpperCase()).join(' and ') + ' for a strong build.' }));
        b.appendChild(el('h3', { text: 'Skills (' + cl.skillCount + ')' })); const sk = el('div', { class: 'row' });
        for (const s of cl.skills) sk.appendChild(el('button', { class: 'btn small' + (d.skills.includes(s) ? ' primary' : ''), text: SKILLS[s].name, onclick: () => { if (d.skills.includes(s)) d.skills = d.skills.filter((x) => x !== s); else if (d.skills.length < cl.skillCount) d.skills.push(s); render(); } })); b.appendChild(sk);
        if (RACES[d.race].feats.skillProf) b.appendChild(el('div', { class: 'small muted', text: 'Racial: ' + RACES[d.race].feats.skillProf.map((s) => SKILLS[s].name).join(', ') }));
      } },
      { title: 'Class Choices', render: (b) => {
        ensureChoices(); const cl = CLASSES[d.cls];
        for (const c of cl.startChoices) {
          b.appendChild(el('h3', { text: c.label }));
          if (c.type === 'weapon') { const g = el('div', { class: 'grid3' }); for (const w of c.options) { const it = ITEMS[w]; g.appendChild(el('div', { class: 'opt' + (d.choices.weapon === w ? ' sel' : ''), onclick: () => { d.choices.weapon = w; render(); } }, [el('div', { class: 'flex' }, [Sprites.iconEl(it.icon, null, 24), el('h4', { text: it.name })]), el('p', { text: it.dmg + ' ' + it.dtype + (it.props.length ? ' · ' + it.props.join(', ') : '') })])); } b.appendChild(g); }
          if (c.type === 'pick') { const g = el('div', { class: 'grid2' }); for (const o of c.options) g.appendChild(el('div', { class: 'opt' + (d.choices[c.id] === o.id ? ' sel' : ''), onclick: () => { d.choices[c.id] = o.id; render(); } }, [el('h4', { text: o.name }), el('p', { text: o.desc })])); b.appendChild(g); }
          if (c.type === 'spells') { const list = spellList(d.cls, c.level); const g = el('div', { class: 'grid2' }); for (const s of list) { const sel = d.choices[c.id].includes(s.id); g.appendChild(el('div', { class: 'opt' + (sel ? ' sel' : ''), onclick: () => { if (sel) d.choices[c.id] = d.choices[c.id].filter((x) => x !== s.id); else if (d.choices[c.id].length < c.count) d.choices[c.id].push(s.id); else { d.choices[c.id].shift(); d.choices[c.id].push(s.id); } render(); } }, [el('h4', { text: s.name }), el('p', { text: s.desc })])); } b.appendChild(g); }
          if (c.type === 'expertise') { const g = el('div', { class: 'row' }); for (const s of d.skills) g.appendChild(el('button', { class: 'btn small' + (d.choices.expertise.includes(s) ? ' primary' : ''), text: SKILLS[s].name, onclick: () => { if (d.choices.expertise.includes(s)) d.choices.expertise = d.choices.expertise.filter((x) => x !== s); else if (d.choices.expertise.length < c.count) d.choices.expertise.push(s); render(); } })); b.appendChild(g); }
        }
        b.appendChild(el('h3', { text: 'Starting kit' })); b.appendChild(el('div', { class: 'small', html: cl.startEquip.map((i) => ITEMS[i] ? '<span class="pill">' + ITEMS[i].name + '</span>' : '').join('') }));
      } },
    ];
    const render = () => {
      const keepScroll = main.scrollTop; main.innerHTML = ''; m.querySelector('h2').textContent = steps[step].title + ' (' + (step + 1) + '/' + steps.length + ')'; steps[step].render(main); refreshSide();
      footer.innerHTML = ''; footer.appendChild(el('button', { class: 'big', text: step === 0 ? 'Cancel' : '← Back', onclick: () => { if (step === 0) UI.closeModal(m); else { step--; render(); main.scrollTop = 0; } } }));
      const nextLabel = step === steps.length - 1 ? 'Begin Adventure ⚔' : 'Next →';
      footer.appendChild(el('button', { class: 'big primary', text: nextLabel, onclick: () => { if (step === 1 && !classPicked) { UI.toast('Pick a class first.'); return; } if (step === 2 && d.method !== 'recommended' && ABILITIES.some((a) => d.base[a] === undefined)) { UI.toast('Assign all six abilities first.'); return; } if (step < steps.length - 1) { step++; render(); main.scrollTop = 0; } else { ensureChoices(); if (!d.name) d.name = NAMES.random(d.race, d.sex); UI.closeModal(m); onDone(d); } } }));
      main.scrollTop = keepScroll;
    };
    render();
  };

  // ---- Character sheet ----
  UI.characterSheet = (ch) => {
    let tab = 'stats';
    const m = UI.modal({ title: ch.name, sub: Character.summary(ch) + (ch.personality ? ' · ' + NAMES.personalities.find((p) => p.id === ch.personality).name : ''), wide: true, body: () => {} });
    const body = m.querySelector('.body');
    const render = () => {
      body.innerHTML = ''; const tabs = el('div', { class: 'tabs' }); [['stats', 'Stats'], ['skills', 'Skills'], ['features', 'Features'], ['spells', 'Spells'], ['gear', 'Gear']].forEach(([id, nm]) => { if (id === 'spells' && !CLASSES[ch.cls].spellcasting) return; tabs.appendChild(el('button', { class: tab === id ? 'sel' : '', text: nm, onclick: () => { tab = id; render(); } })); }); body.appendChild(tabs);
      const top = el('div', { class: 'flex', style: 'align-items:flex-start' }); top.appendChild(Sprites.spriteEl(ch, 4));
      const t = el('table', { class: 'stat-table', style: 'flex:1' }); const row = (k, v) => t.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { html: String(v) })]));
      row('Hit Points', ch.hp + ' / ' + ch.maxHp + (ch.tempHp ? ' (+' + ch.tempHp + ' temp)' : '')); row('Armor Class', Rules.ac(ch)); row('Speed', Rules.speedFt(ch) + ' ft'); row('Proficiency', '+' + Rules.prof(ch)); row('Initiative', U.fmtMod(Rules.initiativeMod(ch))); row('XP', ch.xp + ' / ' + (Rules.xpToNext(ch) === Infinity ? 'MAX' : Rules.xpToNext(ch)));
      const w = Rules.weapon(ch); row('Weapon', w ? w.name + ' ' + U.fmtMod(Rules.attackBonus(ch, w)) + ' · ' + Rules.weaponDie(ch, w) + U.fmtMod(Rules.abMod(ch, Rules.attackAbility(ch, w))) : 'Unarmed');
      if (CLASSES[ch.cls].spellcasting) row('Spell DC / Attack', Rules.spellDC(ch) + ' / ' + U.fmtMod(Rules.spellAttack(ch)));
      top.appendChild(t); body.appendChild(top);
      if (tab === 'stats') { const grid = el('div', { class: 'abil-grid', style: 'margin-top:8px' }); for (const a of ABILITIES) grid.appendChild(el('div', { class: 'abil' }, [el('div', { class: 'nm', text: a.toUpperCase() }), el('div', { class: 'sc', text: ch.abilities[a] }), el('div', { class: 'md', text: U.fmtMod(Rules.abMod(ch, a)) + (CLASSES[ch.cls].saves.includes(a) ? ' ★save' : '') })])); body.appendChild(grid); body.appendChild(el('h3', { text: 'Saving throws' })); body.appendChild(el('div', { html: ABILITIES.map((a) => '<span class="pill">' + a.toUpperCase() + ' ' + U.fmtMod(Rules.saveBonus(ch, a)) + '</span>').join('') })); if (ch.conditions.length) { body.appendChild(el('h3', { text: 'Conditions' })); body.appendChild(el('div', { html: ch.conditions.map((c) => '<span class="pill bad">' + c.id + (c.rounds < 900 ? ' (' + c.rounds + ')' : '') + '</span>').join('') })); } body.appendChild(el('h3', { text: 'Resources' })); const rs = Object.entries(ch.resources).map(([k, v]) => '<span class="pill">' + k + ' ' + (v.max - v.used) + '/' + v.max + '</span>').join(''); body.appendChild(el('div', { html: rs || '<span class="muted small">None</span>' })); body.appendChild(el('div', { class: 'small muted', style: 'margin-top:6px', text: 'Hit dice: ' + (ch.level - ch.hitDice.used) + '/' + ch.level + ' · Death saves: ' + ch.deathSaves.s + ' ✓ ' + ch.deathSaves.f + ' ✗' })); if (ch.quirk) body.appendChild(el('p', { class: 'small narr', text: ch.name + ' ' + ch.quirk + '.' })); }
      if (tab === 'skills') { const t2 = el('table', { class: 'stat-table' }); for (const s of Object.keys(SKILLS)) { const prof = ch.expertise.includes(s) ? '★★' : ch.skillProf.includes(s) ? '★' : ''; t2.appendChild(el('tr', {}, [el('td', { text: SKILLS[s].name + ' (' + SKILLS[s].ab.toUpperCase() + ') ' + prof }), el('td', { text: U.fmtMod(Rules.skillBonus(ch, s)) })])); } body.appendChild(t2); body.appendChild(el('div', { class: 'small muted', text: 'Passive Perception ' + Rules.passivePerception(ch) })); }
      if (tab === 'features') { const cl = CLASSES[ch.cls]; for (let l = 1; l <= ch.level; l++) for (const f of (cl.features[l] || [])) body.appendChild(el('div', { class: 'quest-card' }, [el('h4', { text: f.name + ' (level ' + l + ')' }), el('div', { class: 'small', text: f.desc })])); body.appendChild(el('h3', { text: RACES[ch.race].name + ' traits' })); for (const tr of RACES[ch.race].traits) body.appendChild(el('div', { class: 'quest-card' }, [el('h4', { text: tr.name }), el('div', { class: 'small', text: tr.desc })])); if (ch.choices.style) body.appendChild(el('div', { class: 'small muted', text: 'Fighting style: ' + ch.choices.style })); if (ch.choices.domain) body.appendChild(el('div', { class: 'small muted', text: 'Domain: ' + ch.choices.domain })); if (ch.choices.favoredEnemy) body.appendChild(el('div', { class: 'small muted', text: 'Favored enemy: ' + ch.choices.favoredEnemy })); }
      if (tab === 'spells') { const sl = el('div', { class: 'row' }); for (const l in ch.spells.slots) { const s = ch.spells.slots[l]; sl.appendChild(el('span', { class: 'pill', text: U.ordinal(+l) + ': ' + (s.max - s.used) + '/' + s.max })); } body.appendChild(sl); body.appendChild(el('h3', { text: 'Cantrips' })); for (const id of ch.spells.cantrips) body.appendChild(UI.spellRow(SPELLS[id])); body.appendChild(el('h3', { text: 'Spells' })); for (const id of ch.spells.known.slice().sort((a, b) => SPELLS[a].level - SPELLS[b].level)) body.appendChild(UI.spellRow(SPELLS[id])); }
      if (tab === 'gear') { const slots = [['mainHand', 'Main hand'], ['offHand', 'Off hand'], ['armor', 'Armor'], ['accessory', 'Accessory']]; for (const [k, nm] of slots) { const it = getItem(ch.equipment[k]); const r = el('div', { class: 'item-row' }); r.appendChild(Sprites.iconEl(it ? it.icon : 'bag', null, 28)); r.appendChild(el('div', { class: 'nm ' + (it && it.rarity ? it.rarity : '') }, [el('b', { text: it ? it.name : '— empty —' }), el('div', { class: 'meta', text: nm + (it ? ' · ' + UI.itemMeta(it) : '') })])); if (it) r.appendChild(el('button', { class: 'btn small', text: 'Unequip', onclick: () => { const old = Rules.unequip(ch, k); if (old) Game.addItem(old, 1); render(); Game.refreshHud(); } })); body.appendChild(r); } body.appendChild(el('div', { class: 'row', style: 'margin-top:8px' }, [el('button', { class: 'btn small', text: 'Open inventory', onclick: () => { UI.closeModal(m); UI.inventory(ch); } })])); if (!ch.isPlayer) body.appendChild(el('button', { class: 'btn small danger', style: 'margin-top:8px', text: 'Dismiss companion', onclick: () => UI.confirm(ch.name + ' will return to the Guild Hall. You can recruit them again later.', () => { UI.closeModal(m); Game.dismissCompanion(ch); }) })); }
    };
    render();
  };
  UI.spellRow = (s, extra) => { const r = el('div', { class: 'spell-row' }); r.appendChild(el('div', { class: 'nm' }, [el('b', { text: s.name }), el('span', { class: 'muted small', text: ' · ' + (s.level ? U.ordinal(s.level) + ' level' : 'cantrip') + ' · ' + s.time + (s.range ? ' · ' + s.range + ' ft' : '') + (s.conc ? ' · concentration' : '') }), el('div', { class: 'small', text: s.desc })])); if (extra) r.appendChild(extra); return r; };
  UI.itemMeta = (it) => { if (it.type === 'weapon') return it.dmg + ' ' + it.dtype + (it.props.length ? ' · ' + it.props.join(', ') : '') + (it.desc ? ' · ' + it.desc : ''); if (it.type === 'armor') return 'AC ' + it.ac + ' (' + it.cat + ')' + (it.strReq ? ' · Str ' + it.strReq : '') + (it.stealthDis ? ' · stealth disadvantage' : '') + (it.desc ? ' · ' + it.desc : ''); if (it.type === 'shield') return '+2 AC'; return it.desc || ''; };
  // ---- Inventory ----
  UI.inventory = (forChar, useMode) => {
    let who = forChar || Game.party[0]; let filter = 'all';
    const m = UI.modal({ title: 'Inventory', sub: '💰 ' + Game.state.gold + ' gold', wide: true, body: () => {} }); const body = m.querySelector('.body');
    const render = () => {
      body.innerHTML = ''; m.querySelector('.sub').textContent = '💰 ' + Game.state.gold + ' gold';
      const who2 = el('div', { class: 'row' }, [el('span', { class: 'small muted', text: 'For:' }), ...Game.party.filter((p) => !p.dead).map((p) => el('button', { class: 'btn small' + (who === p ? ' primary' : ''), text: p.name, onclick: () => { who = p; render(); } }))]); body.appendChild(who2);
      const tabs = el('div', { class: 'tabs' }); [['all', 'All'], ['weapon', 'Weapons'], ['armor', 'Armor'], ['consumable', 'Consumables'], ['accessory', 'Accessories'], ['quest', 'Quest']].forEach(([id, nm]) => tabs.appendChild(el('button', { class: filter === id ? 'sel' : '', text: nm, onclick: () => { filter = id; render(); } }))); body.appendChild(tabs);
      const inv = Game.state.inventory.filter((e) => { const it = getItem(e.item); if (!it) return false; if (filter === 'all') return true; if (filter === 'armor') return it.type === 'armor' || it.type === 'shield'; if (filter === 'consumable') return it.type === 'consumable' || it.type === 'scroll' || it.type === 'tool'; return it.type === filter; });
      if (!inv.length) body.appendChild(el('p', { class: 'muted', text: 'Nothing here but lint.' }));
      for (const e of inv) {
        const it = getItem(e.item); const r = el('div', { class: 'item-row' }); r.appendChild(Sprites.iconEl(it.icon, null, 28));
        r.appendChild(el('div', { class: 'nm ' + (it.rarity || '') }, [el('b', { text: it.name + (e.qty > 1 ? ' ×' + e.qty : '') }), el('div', { class: 'meta', text: UI.itemMeta(it) })]));
        if (it.type === 'weapon' || it.type === 'armor' || it.type === 'shield' || it.type === 'accessory') { const can = Rules.canEquip(who, it); r.appendChild(el('button', { class: 'btn small' + (can ? ' primary' : ''), text: can ? 'Equip' : 'No prof.', disabled: !can, onclick: () => { if (!can) return; const old = Rules.equip(who, e.item); if (old === false) { UI.toast('Cannot equip that (two-handed weapon in use?)'); return; } Game.removeItem(e.item, 1); for (const o of old) Game.addItem(o, 1); AudioSys.play('click'); render(); Game.refreshHud(); } })); }
        if (it.type === 'consumable' || it.type === 'scroll') { const usable = !Combat.active || (Combat.isPlayerTurn() && Combat.current() === who && who.turn && (!who.turn.action || !who.turn.bonus)); r.appendChild(el('button', { class: 'btn small primary', text: 'Use', disabled: !usable, onclick: () => { UI.closeModal(m); Game.useItemFlow(who, e.item); } })); }
        if (it.type !== 'quest' && !Combat.active && Game.state.location !== 'dungeon') r.appendChild(el('button', { class: 'btn small', text: 'Sell ' + Math.floor(it.cost / 2), onclick: () => { Game.sellItem(e); render(); } }));
        body.appendChild(r);
      }
    };
    render();
  };
  // ---- Spell picker ----
  UI.spellPicker = (caster, onPick, outOfCombat) => {
    const m = UI.modal({ title: 'Cast a spell', sub: caster.name + ' · DC ' + Rules.spellDC(caster) + ' · ' + U.fmtMod(Rules.spellAttack(caster)) + ' spell attack', body: (b) => {
      const t = caster.turn || {};
      const list = caster.spells.cantrips.map((id) => SPELLS[id]).concat(caster.spells.known.map((id) => SPELLS[id]).sort((a, b) => a.level - b.level));
      for (const s of list) {
        if (!s) continue; const slot = s.level === 0 ? 0 : Rules.lowestSlot(caster, s.level);
        let ok = s.level === 0 || slot > 0; let why = ok ? '' : 'no slot';
        if (Combat.active) { if (s.time === 'bonus' && t.bonus) { ok = false; why = 'bonus used'; } if (s.time === 'action' && t.action && !(t.extraActions > 0)) { ok = false; why = 'action used'; } if (s.time === 'reaction') { ok = false; why = 'automatic'; } if (s.outOfCombatOnly) { ok = false; why = 'out of combat only'; } }
        else if (outOfCombat && !(s.heal || s.special === 'revive' || s.special === 'cure' || s.special === 'goodberry' || s.special === 'aid' || s.id === 'mageArmor' || s.id === 'passWithoutTrace' || s.id === 'guidance' || s.id === 'shieldOfFaith')) { ok = false; why = 'combat spell'; }
        const btn = el('button', { class: 'btn small' + (ok ? ' primary' : ''), text: ok ? (s.level ? 'Cast (' + U.ordinal(slot) + ')' : 'Cast') : why, disabled: !ok, onclick: () => { UI.closeModal(m); onPick(s.id, slot); } });
        const row = UI.spellRow(s, btn);
        if (ok && s.level > 0) { const higher = []; for (let l = slot + 1; l <= 5; l++) if (Rules.hasSlot(caster, l) && (s.slotScale || s.special)) higher.push(l); if (higher.length) row.appendChild(el('button', { class: 'btn small', text: '↑' + U.ordinal(higher[0]), title: 'Upcast', onclick: () => { UI.closeModal(m); onPick(s.id, higher[0]); } })); }
        b.appendChild(row);
      }
    } });
  };
  // ---- Quest log & board ----
  UI.questLog = () => { UI.modal({ title: 'Quest Journal', body: (b) => { const act = Quests.active(); if (!act.length) b.appendChild(el('p', { class: 'muted', text: 'No active quests. Ask around town or check the quest board.' })); for (const q of act) b.appendChild(el('div', { class: 'quest-card' + (q.status === 'readyToTurnIn' ? ' done' : '') }, [el('h4', { text: (q.story ? 'Act ' + q.act + ': ' : '') + q.title }), el('div', { text: q.text }), el('div', { class: 'small muted', text: 'Location: ' + (WORLDMAP.dungeons.find((d) => d.id === q.siteId) || { name: 'the tavern cellar' }).name + ' · Level ' + q.level + ' · From ' + q.giver }), q.twistRevealed ? el('div', { class: 'small narr', text: 'Twist: ' + q.twist }) : null, el('div', { class: 'reward', text: q.status === 'readyToTurnIn' ? '✓ Complete! Return to ' + q.giver : 'Reward: ' + (q.reward.gold || 0) + ' gp, ' + (q.reward.xp || 0) + ' XP' + (q.reward.item ? ', ' + getItem(q.reward.item).name : '') }), !q.story ? el('button', { class: 'btn small danger', text: 'Abandon', onclick: () => { Quests.abandon(q); UI.closeModal(); UI.questLog(); } }) : null])); const done = Quests.state().completed; if (done.length) b.appendChild(el('p', { class: 'small muted', text: 'Completed: ' + done.length + ' quest' + (done.length === 1 ? '' : 's') + '.' })); } }); };
  UI.questBoard = () => { if (Quests.state().boardDay !== Game.state.day || !Quests.state().board.length) Quests.generateBoard(); UI.modal({ title: 'Quest Board', sub: 'Notices pinned with rusty nails and, in one case, a fork.', body: (b) => { const board = Quests.state().board; if (!board.length) b.appendChild(el('p', { class: 'muted', text: 'Nothing new today. Rest at the inn and check back tomorrow.' })); for (const o of board) b.appendChild(el('div', { class: 'quest-card' }, [el('h4', { text: o.title }), el('div', { text: o.text }), el('div', { class: 'small muted', text: o.siteName + ' · Recommended level ' + o.level + ' · ' + o.rooms + ' rooms' }), el('div', { class: 'reward', text: 'Reward: ' + o.reward.gold + ' gp, ' + o.reward.xp + ' XP' + (o.reward.item ? ', ' + getItem(o.reward.item).name : '') }), el('button', { class: 'btn small primary', text: 'Accept', onclick: () => { if (Quests.accept(o)) { UI.closeModal(); UI.questBoard(); } } })])); } }); };
  // ---- Shops ----
  UI.shop = (kind) => {
    const stocks = { smith: ['dagger', 'handaxe', 'mace', 'spear', 'shortsword', 'longsword', 'battleaxe', 'warhammer', 'rapier', 'scimitar', 'greataxe', 'greatsword', 'maul', 'glaive', 'shortbow', 'longbow', 'lightCrossbow', 'handCrossbow', 'leatherArmor', 'studdedLeather', 'hideArmor', 'chainShirt', 'scaleMail', 'breastplate', 'ringMail', 'chainMail', 'splintArmor', 'shield'], merchant: ['potionHealing', 'potionGreaterHealing', 'antitoxin', 'rations', 'torch', 'lantern', 'thievesTools', 'holyWater', 'alchemistFire', 'scroll_cureWounds', 'scroll_bless', 'scroll_magicMissile', 'scroll_burningHands', 'scroll_shield', 'scroll_sleep'], bmerchant: ['potionGreaterHealing', 'potionHeroism', 'potionFireBreath', 'antitoxin', 'rations', 'scroll_holdPerson', 'scroll_scorchingRay', 'scroll_shatter', 'scroll_mistyStep', 'scroll_revivify', 'cloakElvenkind', 'ringFireResist'] };
    const names = { smith: 'Ironbelly Smithy', merchant: "Quill's Curiosities", bmerchant: 'Bog Goods' }; const lvl = Game.partyLevel();
    let stock = stocks[kind].map((id) => ITEMS[id]).filter(Boolean);
    if (kind === 'smith' && lvl >= 3) { const rng = RNG(RNG.hash('smith' + Game.state.day + Game.state.seed)); stock = stock.concat([makeMagicWeapon(rng.pick(['longsword', 'battleaxe', 'rapier', 'longbow', 'warhammer', 'greataxe']), { bonus: 1 })]); if (lvl >= 5) stock.push(makeMagicArmor(rng.pick(['chainShirt', 'breastplate', 'studdedLeather']), 1)); }
    if (kind === 'merchant' && lvl >= 3) { stock.push(ITEMS.potionSuperiorHealing, ITEMS.scroll_fireball, ITEMS.wandMagicMissiles); if (lvl >= 5) stock.push(ITEMS.scroll_revivify, ITEMS.potionSpeed, ITEMS.periaptWoundClosure); }
    let tab = 'buy'; const m = UI.modal({ title: names[kind], sub: '💰 ' + Game.state.gold + ' gold', wide: true, body: () => {} }); const body = m.querySelector('.body');
    const render = () => { body.innerHTML = ''; m.querySelector('.sub').textContent = '💰 ' + Game.state.gold + ' gold'; const tabs = el('div', { class: 'tabs' }); tabs.appendChild(el('button', { class: tab === 'buy' ? 'sel' : '', text: 'Buy', onclick: () => { tab = 'buy'; render(); } })); tabs.appendChild(el('button', { class: tab === 'sell' ? 'sel' : '', text: 'Sell', onclick: () => { tab = 'sell'; render(); } })); body.appendChild(tabs);
      if (tab === 'buy') { for (const it of stock) { const price = it.cost; const r = el('div', { class: 'item-row' }); r.appendChild(Sprites.iconEl(it.icon, null, 28)); r.appendChild(el('div', { class: 'nm ' + (it.rarity || '') }, [el('b', { text: it.name }), el('div', { class: 'meta', text: UI.itemMeta(it) })])); r.appendChild(el('button', { class: 'btn small' + (Game.state.gold >= price ? ' primary' : ''), text: price + ' gp', disabled: Game.state.gold < price, onclick: () => { if (Game.spendGold(price)) { Game.addItem(it.type === 'weapon' && it.magic ? it : (it.magicBonus ? it : it.id), 1); AudioSys.play('coin'); UI.toast('Bought ' + it.name); render(); } } })); body.appendChild(r); } }
      else { const inv = Game.state.inventory.filter((e) => getItem(e.item) && getItem(e.item).type !== 'quest'); if (!inv.length) body.appendChild(el('p', { class: 'muted', text: 'Nothing to sell.' })); for (const e of inv) { const it = getItem(e.item); const r = el('div', { class: 'item-row' }); r.appendChild(Sprites.iconEl(it.icon, null, 28)); r.appendChild(el('div', { class: 'nm ' + (it.rarity || '') }, [el('b', { text: it.name + (e.qty > 1 ? ' ×' + e.qty : '') }), el('div', { class: 'meta', text: UI.itemMeta(it) })])); r.appendChild(el('button', { class: 'btn small', text: 'Sell ' + Math.max(1, Math.floor(it.cost / 2)) + ' gp', onclick: () => { Game.sellItem(e); render(); } })); body.appendChild(r); } } };
    render();
  };
  UI.temple = () => {
    const m = UI.modal({ title: 'Temple of the Dawn', sub: 'Sister Odile, direct as promised.', body: () => {} }); const body = m.querySelector('.body');
    const render = () => { body.innerHTML = ''; body.appendChild(el('p', { class: 'narr', text: 'Candles, incense, and a very tidy altar. Sister Odile looks you over like a cart with a wobbly wheel.' }));
      const story = Quests.storyAvailable(); const ready = Quests.active().find((q) => q.status === 'readyToTurnIn' && q.giver === 'Sister Odile');
      if (ready) body.appendChild(el('button', { class: 'btn primary', style: 'width:100%;margin:6px 0', text: '✓ Report: ' + ready.title, onclick: () => { UI.closeModal(m); Game.turnInQuest(ready); } }));
      if (story && story.giver === 'Sister Odile' && !ready) body.appendChild(el('button', { class: 'btn primary', style: 'width:100%;margin:6px 0', text: '📜 ' + story.title, onclick: () => { UI.closeModal(m); Game.offerStoryQuest(story); } }));
      const hurt = Game.party.filter((p) => !p.dead && (p.hp < p.maxHp || p.conditions.some((c) => ['poisoned', 'cursed', 'weakened'].includes(c.id)))); const dead = Game.party.filter((p) => p.dead);
      body.appendChild(el('div', { class: 'item-row' }, [el('div', { class: 'nm' }, [el('b', { text: 'Healing prayer' }), el('div', { class: 'meta', text: 'Fully heal and cleanse the party. ' + (hurt.length ? '' : 'Nobody needs it right now.') })]), el('button', { class: 'btn small primary', text: (10 * Game.partyLevel()) + ' gp', disabled: !hurt.length || Game.state.gold < 10 * Game.partyLevel(), onclick: () => { if (Game.spendGold(10 * Game.partyLevel())) { for (const p of hurt) { p.hp = p.maxHp; p.conditions = []; } AudioSys.play('heal'); Game.log('Sister Odile heals the party.', 'heal'); Game.refreshHud(); render(); } } })]));
      for (const p of dead) body.appendChild(el('div', { class: 'item-row' }, [el('div', { class: 'nm' }, [el('b', { text: 'Raise ' + p.name }), el('div', { class: 'meta', text: 'Return them to life at full health.' })]), el('button', { class: 'btn small primary', text: (Game.state.flags.freeRaiseUsed ? 100 * p.level : 0) + ' gp', disabled: Game.state.gold < (Game.state.flags.freeRaiseUsed ? 100 * p.level : 0), onclick: () => { const cost = Game.state.flags.freeRaiseUsed ? 100 * p.level : 0; if (Game.spendGold(cost)) { Game.state.flags.freeRaiseUsed = true; p.dead = false; p.downed = false; p.hp = p.maxHp; p.deathSaves = { s: 0, f: 0 }; AudioSys.play('levelup'); Game.log(p.name + ' returns to life! ' + (cost === 0 ? '"First one\'s free," says Odile. "Don\'t make a habit of it."' : ''), 'crit'); Game.refreshHud(); render(); } } })]));
      body.appendChild(el('div', { class: 'item-row' }, [el('div', { class: 'nm' }, [el('b', { text: 'Donate 5 gp' }), el('div', { class: 'meta', text: 'Good for the soul. Blesses the party for the next dungeon.' })]), el('button', { class: 'btn small', text: '5 gp', disabled: Game.state.gold < 5, onclick: () => { if (Game.spendGold(5)) { Game.state.flags.templeBlessing = true; UI.toast('The party feels blessed.'); render(); } } })]));
    }; render();
  };
  UI.guild = () => {
    const st = Game.state; if (!st.guildRecruits || st.guildRecruitDay !== st.day) { const rng = RNG(RNG.hash('guild' + st.day + st.seed)); st.guildRecruits = (st.guildRecruits || []).filter((r) => r.rescued).concat([Character.randomCompanion(Math.max(1, Game.partyLevel() - 1), rng), Character.randomCompanion(Game.partyLevel(), rng)]); st.guildRecruitDay = st.day; }
    const m = UI.modal({ title: "Adventurers' Guild", sub: 'Party ' + Game.party.length + '/4 · 💰 ' + st.gold, wide: true, body: () => {} }); const body = m.querySelector('.body');
    const render = () => { body.innerHTML = ''; m.querySelector('.sub').textContent = 'Party ' + Game.party.length + '/4 · 💰 ' + st.gold; body.appendChild(el('p', { class: 'narr', text: 'A hall full of maps, trophies, and people who need the money. Big Roderic waves from a chair with a cushion where his knee should be.' }));
      body.appendChild(el('h3', { text: 'Recruits' })); if (!st.guildRecruits.length) body.appendChild(el('p', { class: 'muted', text: 'Nobody looking for work today.' }));
      for (const r of st.guildRecruits) { const row = el('div', { class: 'item-row' }); row.appendChild(Sprites.portraitEl(r, 40)); const pers = NAMES.personalities.find((p) => p.id === r.personality); row.appendChild(el('div', { class: 'nm' }, [el('b', { text: r.name }), el('div', { class: 'meta', text: Character.summary(r) + ' · ' + pers.name + ' · HP ' + r.maxHp + ' AC ' + Rules.ac(r) + (r.rescued ? ' · owes you a favour' : '') })])); row.appendChild(el('button', { class: 'btn small', text: 'Sheet', onclick: () => UI.characterSheet(r) })); const cost = (r.rescued || !st.flags.firstRecruitUsed) ? 0 : r.hireCost; row.appendChild(el('button', { class: 'btn small primary', text: cost ? cost + ' gp' : (st.flags.firstRecruitUsed ? 'Join' : 'Join (Roderic vouches: free)'), disabled: Game.party.length >= 4 || st.gold < cost, onclick: () => { if (Game.spendGold(cost)) { st.flags.firstRecruitUsed = true; st.guildRecruits = st.guildRecruits.filter((x) => x !== r); Game.addCompanion(r); render(); } } })); body.appendChild(row); }
      body.appendChild(el('h3', { text: 'Your party' })); for (const p of Game.party) { const row = el('div', { class: 'item-row' }); row.appendChild(Sprites.portraitEl(p, 40)); row.appendChild(el('div', { class: 'nm' }, [el('b', { text: p.name + (p.isPlayer ? ' (you)' : '') }), el('div', { class: 'meta', text: Character.summary(p) + (p.dead ? ' · DEAD (see the temple)' : '') })])); if (!p.isPlayer) row.appendChild(el('button', { class: 'btn small danger', text: 'Dismiss', onclick: () => { Game.dismissCompanion(p); render(); } })); body.appendChild(row); }
    }; render();
  };
  // ---- Level up ----
  UI.levelUp = (ch, onDone) => {
    const cl = CLASSES[ch.cls]; const next = ch.level + 1; const feats = cl.features[next] || []; const choices = {}; const hasASI = feats.some((f) => f.id === 'asi'); const sc = cl.spellcasting;
    let spellsToPick = 0, cantripPick = feats.some((f) => f.id === 'cantrip');
    if (sc && !sc.knowsAll) { const tmp = Object.assign({}, ch, { level: next }); const want = Character.spellsKnownCount(tmp); spellsToPick = Math.max(0, want - ch.spells.known.length); }
    const maxLvl = sc ? (SLOT_TABLE[sc.type][next] || []).length : 0; choices.spells = []; choices.asi = null;
    const m = UI.modal({ title: '✨ Level ' + next + '!', sub: ch.name + ' the ' + cl.name, noClose: true, body: () => {}, buttons: [] }); const body = m.querySelector('.body'); const footer = el('footer'); m.appendChild(footer);
    const render = () => { body.innerHTML = ''; body.appendChild(el('div', { class: 'center levelup', text: 'LEVEL UP' })); body.appendChild(el('p', { class: 'small', text: 'HP +' + Math.max(1, Math.floor(cl.hitDie / 2) + 1 + Rules.abMod(ch, 'con') + (RACES[ch.race].feats.hpPerLevel || 0)) + ' · Proficiency ' + U.fmtMod(2 + Math.floor((next - 1) / 4)) }));
      for (const f of feats) if (f.id !== 'asi' && f.id !== 'cantrip') body.appendChild(el('div', { class: 'quest-card' }, [el('h4', { text: f.name }), el('div', { class: 'small', text: f.desc })]));
      if (hasASI) { body.appendChild(el('h3', { text: 'Ability Score Improvement' })); body.appendChild(el('div', { class: 'small muted', text: 'Choose +2 to one ability, or +1 to two.' })); const g = el('div', { class: 'abil-grid' }); const picked = choices.asi || {}; for (const a of ABILITIES) { const box = el('div', { class: 'abil clickable' + (picked[a] ? ' picked' : '') }, [el('div', { class: 'nm', text: a.toUpperCase() }), el('div', { class: 'sc', text: ch.abilities[a] + (picked[a] ? '+' + picked[a] : '') })]); box.onclick = () => { const p = choices.asi || {}; const total = Object.values(p).reduce((s, v) => s + v, 0); if (p[a]) delete p[a]; else if (total < 2 && ch.abilities[a] + (total ? 1 : 2) <= 20) { if (total === 0) p[a] = 2; else { for (const k in p) p[k] = 1; p[a] = 1; } } else if (total === 2 && Object.keys(p).length === 1) { const k = Object.keys(p)[0]; p[k] = 1; p[a] = 1; } choices.asi = Object.keys(p).length ? p : null; render(); }; g.appendChild(box); } body.appendChild(g); }
      if (spellsToPick > 0) { body.appendChild(el('h3', { text: 'Learn ' + spellsToPick + ' new spell' + (spellsToPick > 1 ? 's' : '') })); const pool = spellList(ch.cls).filter((s) => s.level >= 1 && s.level <= maxLvl && !ch.spells.known.includes(s.id)); for (const s of pool) { const sel = choices.spells.includes(s.id); body.appendChild(UI.spellRow(s, el('button', { class: 'btn small' + (sel ? ' primary' : ''), text: sel ? '✓' : 'Learn', onclick: () => { if (sel) choices.spells = choices.spells.filter((x) => x !== s.id); else if (choices.spells.length < spellsToPick) choices.spells.push(s.id); else { choices.spells.shift(); choices.spells.push(s.id); } render(); } }))); } }
      if (cantripPick && sc) { body.appendChild(el('h3', { text: 'Learn a cantrip' })); for (const s of spellList(ch.cls, 0).filter((s) => !ch.spells.cantrips.includes(s.id))) body.appendChild(UI.spellRow(s, el('button', { class: 'btn small' + (choices.cantrip === s.id ? ' primary' : ''), text: choices.cantrip === s.id ? '✓' : 'Learn', onclick: () => { choices.cantrip = s.id; render(); } }))); }
      footer.innerHTML = ''; const ok = (!hasASI || (choices.asi && Object.values(choices.asi).reduce((s, v) => s + v, 0) === 2)) && choices.spells.length >= Math.min(spellsToPick, 99) && (!cantripPick || !sc || choices.cantrip); footer.appendChild(el('button', { class: 'big primary', text: 'Confirm', disabled: !ok, onclick: () => { UI.closeModal(m); onDone(choices); } }));
    }; render(); AudioSys.play('levelup');
  };
  // ---- Events / riddles ----
  UI.event = (ev, onChoice) => { UI.dialogue('Event', null, ev.text, ev.choices.map((c) => ({ text: c.text, check: c.check ? { skill: c.check.skill, dc: c.check.dc } : (c.save ? { skill: c.save, dc: c.dc } : null), cost: c.cost, disabled: (c.cost && Game.state.gold < c.cost) || (c.req && !Game.state.flags[c.req]), fn: () => onChoice(c) })), { noClose: true }); };
  // Outcome dialog: narrative text, then gains and losses as a row of pills along the bottom
  UI.outcome = (text, onDone, rewards) => UI.dialogue('Outcome', null, text, [{ text: 'Continue', fn: onDone }], { noClose: true, rewards });
  // Answers you have already tried are struck off, so a riddle cannot be brute-forced by reopening it.
  UI.riddle = (puzzle, onAnswer) => { const r = puzzle.riddle; const wrong = puzzle.wrong || []; const opts = r.options.map((o, i) => ({ text: o, i })).filter((o) => !wrong.includes(o.i)); UI.dialogue('The statue speaks', null, '"' + r.q + '"' + (wrong.length ? '<br><br><i>Already tried: ' + wrong.map((i) => r.options[i]).join(', ') + '.</i>' : ''), opts.map((o) => ({ text: o.text, fn: () => onAnswer(o.i === r.correct, o.i) }))); };
  UI.dungeonSummary = (s, onDone) => { UI.modal({ title: s.victory ? '🏆 Dungeon Complete' : 'Retreat', sub: s.name, noClose: true, body: (b) => { b.appendChild(el('p', { class: 'narr', text: s.flavor })); const t = el('table', { class: 'stat-table' }); const row = (k, v) => t.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { text: String(v) })])); row('Time', Math.floor(s.seconds / 60) + 'm ' + (s.seconds % 60) + 's'); row('Monsters defeated', s.kills); row('Gold found', s.gold); row('XP earned', s.xp); row('Rooms explored', s.rooms); row('Secrets found', s.secrets); if (s.twist) t.appendChild(el('tr', {}, [el('td', { text: 'Twist' }), el('td', { text: s.twist, style: 'text-align:left;color:#d9c4ff;font-weight:400' })])); b.appendChild(t); }, buttons: [{ label: 'Return to town', cls: 'primary', fn: onDone }] }); };
  UI.gameOver = (onDone) => { UI.modal({ title: 'Darkness…', noClose: true, body: (b) => { b.appendChild(el('p', { class: 'narr', text: 'The last thing you see is the ceiling. The next thing you see is the ceiling of the Rusty Flagon, and Wren Ashby\'s unimpressed face. "You owe me for the cart," she says. "And a quarter of your purse went to the healer. Try not to die again before lunch."' })); }, buttons: [{ label: 'Wake up', cls: 'primary', fn: onDone }] }); };
  UI.menu = () => { UI.modal({ title: 'Menu', body: (b) => { b.appendChild(el('div', { class: 'choices' }, [el('button', { text: (AudioSys.muted ? '🔇 Unmute' : '🔊 Mute') + ' sound', onclick: () => { AudioSys.init(); AudioSys.setMuted(!AudioSys.muted); UI.closeModal(); UI.menu(); } }), el('button', { text: '🎲 Manual dice rolls: ' + (UI.manualDice() ? 'On' : 'Off'), onclick: () => { Save.setSetting('manualDice', !UI.manualDice()); UI.closeModal(); UI.menu(); } }), el('button', { text: '⏱ Combat speed: ' + UI.SPEEDS[UI.speed()].name, onclick: () => { const order = ['slow', 'normal', 'fast']; Save.setSetting('speed', order[(order.indexOf(UI.speed()) + 1) % 3]); UI.applySpeed(); UI.closeModal(); UI.menu(); } }), el('button', { text: '🎲 Dice set: ' + Dice3D.skin().name, onclick: () => { UI.closeModal(); UI.dicePicker(); } }), el('button', { text: '📖 How to play', onclick: () => { UI.closeModal(); UI.howToPlay(); } }), el('button', { text: '💾 Save game' + (Game.state.location === 'dungeon' ? ' (returns you to town on reload)' : ''), onclick: () => { Game.save(true); UI.closeModal(); } }), el('button', { text: '🏠 Quit to title', onclick: () => UI.confirm('Progress is saved when you rest, finish a dungeon, or use Save. Quit now?', () => { UI.closeAll(); Game.quitToTitle(); }) })])); } }); };
  // Pick a dice set: a still of each set, the current one highlighted.
  UI.dicePicker = () => {
    const cur = Save.settings().diceSkin || 'gilded';
    const m = UI.modal({ title: 'Your dice', sub: 'Every roll in the game uses the set you pick.', wide: true, body: (b) => {
      const g = el('div', { class: 'grid3' });
      for (const [id, sk] of Object.entries(Dice3D.SKINS)) { const c = document.createElement('canvas'); c.width = 112; c.height = 96; Dice3D.preview(c, id); g.appendChild(el('div', { class: 'opt dice-opt' + (id === cur ? ' sel' : ''), onclick: () => { Save.setSetting('diceSkin', id); AudioSys.play('click'); UI.closeModal(m); UI.dicePicker(); } }, [c, el('h4', { text: sk.name }), el('p', { text: sk.desc })])); }
      b.appendChild(g);
    } });
  };
  UI.howToPlay = () => { UI.modal({ title: 'How to Play', body: `<p><b>Goal:</b> Wake up, find out who robbed you of three days, and roll a lot of dice doing it. Each dungeon is a complete 15–20 minute adventure.</p>
<h3>Moving</h3><p>Tap or click a tile to walk there. Use the arrow pad or <kbd>WASD</kbd>/arrow keys for single steps. Pinch, scroll, or press <kbd>+</kbd>/<kbd>-</kbd> to zoom; <kbd>Q</kbd>/<kbd>E</kbd> or the ⟲⟳ buttons rotate the view.</p>
<h3>Interacting</h3><p>Nothing happens by accident: bumping into a chest, a lever or a person does nothing. <b>Tap the thing itself</b> and your party walks over and uses it. Anything you can use from where you stand glows gold and gets a button bottom-left. Doors are the exception — walk into an open doorway and you go through it. <kbd>&lt;</kbd> steps out through the nearest door, <kbd>&gt;</kbd> steps in (or down into a dungeon).</p>
<h3>Town</h3><p>Every building can be walked into. Shops, the temple and the guild hall are rooms with someone behind the counter — tap them across the counter to trade, pray or hire. Cottages have people in them too, and they have opinions.</p>
<h3>Dice</h3><p>Everything is a roll: <b>d20 + modifier vs. a target number</b>. A natural 20 is a critical hit (double damage dice); a natural 1 is a fumble. Skill checks and saving throws work the same way against a Difficulty Class (DC).</p>
<h3>Throwing them</h3><p>You throw the dice yourself: <b>press a die, drag it anywhere, and flick</b>. It leaves your hand with the speed of your drag and really does tumble across the screen until it stops — throw hard and it rattles off the edges. When a roll needs more than one die (advantage, a fistful of damage dice) you can throw each one separately, or hit <b>Throw all</b> to send them together.</p><p>Each die stamps its number as it lands and adds itself to your running total. Then your modifier flies in, and finally your total (green) and the number you had to beat (red) collide into <b>PASS</b>, <b>FAIL</b>, <b>CRITICAL!</b> or <b>FUMBLE!</b>. Once you have read the result, <b>tap anywhere</b> (or press <kbd>Space</kbd>) to move on. Nothing else happens until the dice have stopped dead: no text, no damage, no next turn. The menu lets you pick a <b>dice set</b> (dragon, fire, ice, acid and more) and a <b>combat speed</b>: Slow, Normal or Fast. Prefer it done for you? Turn <i>Manual dice rolls</i> off in the menu, or press <kbd>F</kbd> for fast animations.</p>
<h3>One thing at a time</h3><p>In combat every roll plays out before the next thing happens: the dice land, the number reads out, and only then does the hit, the damage or the save follow. The banner at the top names whose turn it is, monsters included, and the log keeps the full order of events.</p>
<h3>One attempt each</h3><p>You do not get to re-roll a check until it passes. A locked chest, a stuck door, a search of one spot, a riddle: <b>each character gets one try</b>, and the next one has to step up. When the whole party has failed, that approach is spent — but you are never stuck: a door can be battered down and a chest levered open, both loudly and at a cost.</p>
<h3>Combat</h3><p>When monsters spot you, everyone rolls <b>initiative</b> (d20 + Dex). On your turn you get <b>Movement</b> (speed ÷ 5 tiles), one <b>Action</b> (Attack, Cast, Dash, Dodge, Disengage, Item…) and one <b>Bonus Action</b> (class features like Rage, Second Wind, Cunning Action, Healing Word). Leaving an enemy's reach provokes an <b>opportunity attack</b> unless you Disengage. Tap <b>Attack</b> then tap an enemy; tap <b>Move</b> then a highlighted tile.</p>
<h3>Getting hurt</h3><p>At 0 HP you fall unconscious and roll <b>death saves</b> each turn (10+ succeeds; three failures and you die; a natural 20 gets you up). Healing wakes you. If the whole party falls, Wren drags you back to the tavern, minus a quarter of your gold.</p>
<h3>Resting</h3><p><b>Short rest</b> at a campfire in a dungeon (spend hit dice, recover Second Wind and the like; costs rations). <b>Long rest</b> at the Rusty Flagon restores everything and starts a new day (new quests, new stock).</p>
<h3>Log</h3><p>What just happened flashes on screen for a few seconds and then fades. Tap 📖 (or press <kbd>L</kbd>) to bring it all back: the last 20 dice rolls, or everything.</p>
<h3>Party</h3><p>Recruit companions at the Guild Hall or rescue them in dungeons. Up to four adventurers. Tap a portrait for their sheet; equip gear from the inventory.</p>
<h3>Saving</h3><p>Progress saves automatically in town and after each dungeon. If you reload while inside a dungeon you restart it from the entrance.</p>` }); };
  window.UI = UI;
})();
