/* ============================================================
   BUG DEFENCE — audio.js
   Procedural SFX (Web Audio) + shuffled background-music playlist.
   Self-contained: owns its AudioContext, control UI, persistence,
   and subscribes to GAME events. The engine does NOT know about AUDIO.
   Exposes a single global: AUDIO
   ============================================================ */
const AUDIO = (() => {
  // ---------- config ----------
  const MUSIC_FILES = [
    'music/Hacker-Tower-Defense-Hintergrundmusik.mp3',
    'music/Hacker-Tower-Defense-Hintergrundmusik-2.mp3',
    'music/Musik für Hacker-Tower-Defense.mp3'
  ];
  const LS_KEY = 'bugdef.audio';
  const MAX_VOICES = 12;            // concurrent sfx voices cap
  const DEFAULTS = { muted: false, music: 0.5, sfx: 0.7 };
  const THROTTLE = { fire: 0.045, ui: 0.05 }; // min seconds between same-key sounds

  // ---------- state ----------
  let ctx = null, master, musicGain, sfxGain;
  let audioEl = null, playlist = [], trackIdx = 0, musicStarted = false, unlocked = false, errorCount = 0;
  let voices = 0;
  const lastPlay = {};
  let st = { ...DEFAULTS };

  // ---------- persistence ----------
  function load() { try { const v = JSON.parse(localStorage.getItem(LS_KEY)); if (v) st = { ...DEFAULTS, ...v }; } catch (e) {} }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }

  // ---------- audio graph ----------
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); musicGain = ctx.createGain(); sfxGain = ctx.createGain();
    musicGain.connect(master); sfxGain.connect(master); master.connect(ctx.destination);
    applyVol();
    return ctx;
  }
  function applyVol() {
    if (!ctx) return;
    master.gain.value = st.muted ? 0 : 1;
    musicGain.gain.value = st.music;
    sfxGain.gain.value = st.sfx;
  }

  // ---------- music ----------
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  function setupMusic() {
    if (audioEl) return;
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.addEventListener('ended', nextTrack);
    audioEl.addEventListener('playing', () => { errorCount = 0; });
    audioEl.addEventListener('error', () => { if (++errorCount >= playlist.length) return; nextTrack(); }); // skip broken track; give up once all have failed
    try { ctx.createMediaElementSource(audioEl).connect(musicGain); } catch (e) {}
  }
  function startMusic() {
    if (musicStarted || !ctx) return;
    musicStarted = true;
    setupMusic();
    playlist = shuffle(MUSIC_FILES);
    trackIdx = 0;
    playTrack();
  }
  function playTrack() {
    if (!audioEl || !playlist.length) return;
    audioEl.src = encodeURI(playlist[trackIdx]);
    const p = audioEl.play();
    if (p && p.catch) p.catch(() => {});
  }
  function nextTrack() {
    if (!playlist.length) return;
    trackIdx = (trackIdx + 1) % playlist.length;
    playTrack();
  }

  // ---------- unlock (browser autoplay policy) ----------
  function unlock() {
    if (unlocked) return;
    if (!ensureCtx()) return;
    unlocked = true;
    if (ctx.state === 'suspended') ctx.resume();
    startMusic();
  }

  // ---------- sfx synthesis ----------
  function tone(freq, dur, opt = {}) {
    if (!ctx) return;
    const { type = 'square', attack = 0.005, decay = dur, vol = 0.3, slideTo = null } = opt;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.01, decay));
    o.connect(g); g.connect(sfxGain);
    voices++;
    o.start(t); o.stop(t + dur + 0.02);
    o.onended = () => { voices--; o.disconnect(); g.disconnect(); };
  }
  function noise(dur, opt = {}) {
    if (!ctx) return;
    const { vol = 0.3, filterFreq = 1800 } = opt;
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(), t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    voices++;
    src.start(t);
    src.onended = () => { voices--; src.disconnect(); f.disconnect(); g.disconnect(); };
  }
  function throttled(key) {
    const now = ctx ? ctx.currentTime : 0, last = lastPlay[key] || -1;
    if (now - last < (THROTTLE[key] || 0)) return false;
    lastPlay[key] = now; return true;
  }
  function seq(freqs, gap, dur, opt) { freqs.forEach((f, i) => setTimeout(() => { if (voices < MAX_VOICES) tone(f, dur, opt); }, i * gap)); }

  // ---------- sfx catalog ----------
  function play(name) {
    if (!ctx || st.muted) return;
    if (voices >= MAX_VOICES) return;
    switch (name) {
      case 'fire-shooter': if (!throttled('fire')) return; tone(620, 0.08, { type: 'square', vol: 0.12, slideTo: 380 }); break;
      case 'fire-sniper':  if (!throttled('fire')) return; tone(1200, 0.14, { type: 'sawtooth', vol: 0.12, slideTo: 300 }); break;
      case 'fire-pierce':  if (!throttled('fire')) return; tone(820, 0.12, { type: 'sawtooth', vol: 0.10, slideTo: 1400 }); break;
      case 'fire-melee':   if (!throttled('fire')) return; noise(0.09, { vol: 0.18, filterFreq: 900 }); break;
      case 'fire-gc':      if (!throttled('fire')) return; tone(300, 0.18, { type: 'sine', vol: 0.12, slideTo: 120 }); break;
      case 'fire-burn':    if (!throttled('fire')) return; noise(0.12, { vol: 0.08, filterFreq: 2600 }); break;
      case 'kill':         tone(440, 0.10, { type: 'triangle', vol: 0.16, slideTo: 160 }); break;
      case 'kill-boss':    tone(220, 0.30, { type: 'sawtooth', vol: 0.22, slideTo: 70 }); noise(0.30, { vol: 0.15, filterFreq: 700 }); break;
      case 'shield':       tone(1600, 0.12, { type: 'sine', vol: 0.14, slideTo: 2200 }); break;
      case 'place':        tone(180, 0.06, { type: 'square', vol: 0.18 }); tone(360, 0.09, { type: 'square', vol: 0.12 }); break;
      case 'upgrade':      seq([440, 600, 760], 0, 0.10, { type: 'square', vol: 0.14, attack: 0.01 }); break;
      case 'sell':         tone(520, 0.12, { type: 'triangle', vol: 0.14, slideTo: 200 }); break;
      case 'cast-breakpoint': tone(900, 0.40, { type: 'sine', vol: 0.18, slideTo: 200 }); break;
      case 'cast-hotfix':  noise(0.40, { vol: 0.30, filterFreq: 1200 }); tone(120, 0.40, { type: 'sawtooth', vol: 0.20, slideTo: 50 }); break;
      case 'cast-patch':   tone(300, 0.30, { type: 'sine', vol: 0.14, slideTo: 600 }); break;
      case 'sprint-start': tone(660, 0.12, { type: 'square', vol: 0.16 }); tone(990, 0.14, { type: 'square', vol: 0.14 }); break;
      case 'sprint-done':  seq([523, 659, 784], 110, 0.16, { type: 'square', vol: 0.16 }); break;
      case 'win':          seq([523, 659, 784, 1047], 140, 0.22, { type: 'square', vol: 0.18 }); break;
      case 'lose':         seq([392, 330, 262, 196], 160, 0.26, { type: 'sawtooth', vol: 0.18 }); break;
      case 'leak':         tone(160, 0.25, { type: 'sawtooth', vol: 0.20, slideTo: 90 }); break;
      case 'ui':           if (!throttled('ui')) return; tone(540, 0.03, { type: 'square', vol: 0.06 }); break;
    }
  }

  // ---------- control UI ----------
  function buildUI() {
    const wrap = document.createElement('div');
    wrap.id = 'audio-ctrl';
    wrap.innerHTML = `
      <button id="audio-btn" class="ic-btn" title="Sound" aria-label="Sound settings">${st.muted ? '🔇' : '🔊'}</button>
      <div id="audio-pop">
        <label>Musik<input type="range" id="vol-music" min="0" max="100" value="${Math.round(st.music * 100)}"></label>
        <label>SFX<input type="range" id="vol-sfx" min="0" max="100" value="${Math.round(st.sfx * 100)}"></label>
        <button id="audio-mute" class="ic-btn">${st.muted ? 'Ton an' : 'Stumm'}</button>
      </div>`;
    document.body.appendChild(wrap);
    const pop = wrap.querySelector('#audio-pop');
    wrap.querySelector('#audio-btn').onclick = e => { e.stopPropagation(); pop.classList.toggle('on'); };
    pop.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => pop.classList.remove('on'));
    wrap.querySelector('#vol-music').oninput = e => { st.music = e.target.value / 100; applyVol(); save(); };
    wrap.querySelector('#vol-sfx').oninput = e => { st.sfx = e.target.value / 100; applyVol(); save(); };
    wrap.querySelector('#audio-mute').onclick = () => setMuted(!st.muted);
  }
  function refreshUI() {
    const b = document.querySelector('#audio-btn'); if (b) b.textContent = st.muted ? '🔇' : '🔊';
    const m = document.querySelector('#audio-mute'); if (m) m.textContent = st.muted ? 'Ton an' : 'Stumm';
  }
  function setMuted(v) { st.muted = v; applyVol(); save(); refreshUI(); }

  // ---------- wiring ----------
  function bindEvents() {
    GAME.on('fire', kind => play('fire-' + kind));
    GAME.on('kill', e => play(e && e.def && e.def.boss ? 'kill-boss' : 'kill'));
    GAME.on('shield', () => play('shield'));
    GAME.on('place', () => play('place'));
    GAME.on('upgrade', () => play('upgrade'));
    GAME.on('sell', () => play('sell'));
    GAME.on('cast', name => play('cast-' + name));
    GAME.on('sprintStart', () => play('sprint-start'));
    GAME.on('hit', () => play('leak'));
    GAME.on('onSprintComplete', () => play('sprint-done'));
    GAME.on('onGameOver', win => play(win ? 'win' : 'lose'));
  }
  function bindUnlock() {
    const fn = () => { unlock(); window.removeEventListener('pointerdown', fn); window.removeEventListener('keydown', fn); };
    window.addEventListener('pointerdown', fn);
    window.addEventListener('keydown', fn);
  }
  function bindUiClicks() {
    document.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.id === 'audio-btn' || b.id === 'audio-mute') return;
      play('ui');
    });
  }

  function init() { load(); buildUI(); bindEvents(); bindUnlock(); bindUiClicks(); }

  return { init, play, unlock, setMuted, get state() { return { ...st }; } };
})();
