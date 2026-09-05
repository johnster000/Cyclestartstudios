/* WebAudio synth: sound effects + a tiny procedural music box. Nothing external is loaded. */
(function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null, muted = false, musicMode = null, musicTimer = null, step = 0;
  const A = {
    get muted() { return muted; },
    init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      if (musicMode) A.music(musicMode, true);
    },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; try { localStorage.setItem('pd_muted', m ? '1' : '0'); } catch (e) {} },
    tone(freq, dur, type, vol, dest, slide) {
      if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(dest || sfxGain); o.start(); o.stop(ctx.currentTime + dur + 0.02);
    },
    noise(dur, vol, hp) {
      if (!ctx) return; const n = ctx.sampleRate * dur, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ctx.createBufferSource(); s.buffer = buf; const g = ctx.createGain(); g.gain.value = vol || 0.2;
      const f = ctx.createBiquadFilter(); f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900;
      s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
    },
    play(name) {
      if (!ctx || muted) return;
      const t = (f, d, ty, v, sl, delay) => setTimeout(() => A.tone(f, d, ty, v, null, sl), (delay || 0) * 1000);
      switch (name) {
        case 'dice': for (let i = 0; i < 5; i++) setTimeout(() => { A.noise(0.03, 0.25, 2000); A.tone(600 + Math.random() * 800, 0.03, 'square', 0.05); }, i * 70 + Math.random() * 30); break;
        case 'hit': A.noise(0.08, 0.35); t(180, 0.12, 'triangle', 0.3, 60); break;
        case 'miss': A.noise(0.12, 0.15, 1500); t(500, 0.15, 'sine', 0.08, 200); break;
        case 'crit': A.noise(0.1, 0.4); t(200, 0.15, 'sawtooth', 0.25, 50); t(880, 0.2, 'square', 0.12, null, 0.05); t(1320, 0.25, 'square', 0.1, null, 0.12); break;
        case 'fumble': t(300, 0.3, 'sawtooth', 0.15, 80); break;
        case 'heal': [523, 659, 784, 1046].forEach((f, i) => t(f, 0.25, 'sine', 0.15, null, i * 0.07)); break;
        case 'spell': t(400, 0.3, 'sine', 0.15, 1600); A.noise(0.2, 0.1, 3000); break;
        case 'fire': A.noise(0.35, 0.35); t(120, 0.3, 'sawtooth', 0.15, 40); break;
        case 'step': A.noise(0.03, 0.06); break;
        case 'door': t(90, 0.25, 'sawtooth', 0.1, 140); A.noise(0.15, 0.1); break;
        case 'chest': [660, 880, 1100, 1320].forEach((f, i) => t(f, 0.15, 'square', 0.08, null, i * 0.06)); break;
        case 'coin': t(1200, 0.08, 'square', 0.1); t(1800, 0.15, 'square', 0.08, null, 0.06); break;
        case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => t(f, 0.35, 'square', 0.12, null, i * 0.1)); break;
        case 'click': t(900, 0.04, 'square', 0.06); break;
        case 'death': t(200, 0.6, 'sawtooth', 0.2, 40); A.noise(0.3, 0.2); break;
        case 'monsterDeath': A.noise(0.25, 0.25); t(150, 0.4, 'square', 0.12, 40); break;
        case 'alert': t(700, 0.1, 'square', 0.12); t(700, 0.1, 'square', 0.12, null, 0.15); break;
        case 'trap': A.noise(0.2, 0.3, 200); t(100, 0.3, 'square', 0.2, 30); break;
        case 'unlock': t(1000, 0.05, 'square', 0.1); t(1400, 0.1, 'square', 0.1, null, 0.08); break;
        case 'lever': t(250, 0.1, 'square', 0.12, 120); A.noise(0.1, 0.15); break;
        case 'quest': [784, 988, 1175].forEach((f, i) => t(f, 0.3, 'triangle', 0.15, null, i * 0.12)); break;
        case 'victory': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => t(f, 0.3, 'square', 0.12, null, i * 0.12)); break;
        case 'defeat': [400, 350, 300, 200].forEach((f, i) => t(f, 0.5, 'sawtooth', 0.12, null, i * 0.25)); break;
        case 'bump': t(120, 0.06, 'square', 0.08); break;
        default: break;
      }
    },
    // Music: a gentle generative loop. Modes change scale, tempo and instrument.
    music(mode, force) {
      if (mode === musicMode && !force) return; musicMode = mode; if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      if (!ctx || !mode) return;
      const modes = {
        title: { scale: [0, 2, 4, 7, 9, 12, 14], root: 220, bpm: 70, type: 'triangle', pad: true },
        tavern: { scale: [0, 2, 4, 5, 7, 9, 11, 12], root: 196, bpm: 96, type: 'triangle', pad: true, bounce: true },
        town: { scale: [0, 2, 4, 7, 9, 12], root: 262, bpm: 84, type: 'triangle', pad: true },
        dungeon: { scale: [0, 2, 3, 5, 7, 8, 10, 12], root: 110, bpm: 60, type: 'sine', pad: true, dark: true },
        combat: { scale: [0, 2, 3, 5, 7, 8, 11, 12], root: 147, bpm: 132, type: 'square', drums: true },
        boss: { scale: [0, 1, 3, 5, 6, 8, 11, 12], root: 123, bpm: 140, type: 'sawtooth', drums: true },
        victory: { scale: [0, 4, 7, 12, 16], root: 262, bpm: 110, type: 'square', pad: true },
      };
      const m = modes[mode] || modes.town; const beat = 60 / m.bpm; step = 0;
      const prog = [0, 3, 4, 3]; // scale degree roots of chords per bar
      musicTimer = setInterval(() => {
        if (muted) { step++; return; }
        const bar = Math.floor(step / 8) % prog.length, sub = step % 8;
        const chordRoot = prog[bar];
        const deg = (i) => m.scale[(i) % m.scale.length] + 12 * Math.floor(i / m.scale.length);
        const freq = (semi) => m.root * Math.pow(2, semi / 12);
        if (m.pad && sub === 0) { [0, 2, 4].forEach((k) => A.tone(freq(deg(chordRoot + k)) / 2, beat * 7.5, 'sine', 0.05, musicGain)); }
        // melody: arpeggio with some randomness
        const idx = chordRoot + [0, 2, 4, 7, 4, 2, 0, 2][sub] + (Math.random() < 0.15 ? 1 : 0);
        if (!(m.dark && sub % 2 === 1 && Math.random() < 0.6)) A.tone(freq(deg(idx)), beat * (m.bounce ? 0.5 : 0.9), m.type, m.type === 'sawtooth' ? 0.035 : 0.06, musicGain);
        if (m.drums) { if (sub % 2 === 0) A.tone(60, 0.12, 'sine', 0.35, musicGain, 30); if (sub % 4 === 2) A.noise(0.05, 0.12, 3000); }
        step++;
      }, beat * 1000);
    },
  };
  try { muted = localStorage.getItem('pd_muted') === '1'; } catch (e) {}
  window.AudioSys = A;
})();
