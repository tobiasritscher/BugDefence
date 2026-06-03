# Audio (Musik & SFX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural Web Audio sound effects and a shuffled background-music playlist (3 user-provided MP3s) to Bug Defence, with a fixed mute/volume control on all screens.

**Architecture:** A new self-contained module `js/audio.js` (global `AUDIO`) owns one `AudioContext`, synthesizes all SFX, plays music through a `MediaElementAudioSourceNode`, injects its own control UI, and subscribes to `GAME` events. The engine stays decoupled — it only `emit()`s events and never references `AUDIO`. The engine's single-listener `emit`/`on` is upgraded to multi-listener so `UI` and `AUDIO` can share events.

**Tech Stack:** Vanilla JS (no build step), Web Audio API, `<audio>` element, `localStorage`. No test framework exists in this project, so verification is **manual in the browser** (DevTools console + listening). This is intentional — adding a test toolchain to a zero-build game contradicts the project's nature.

**How to run the game:** open `Bug Defence.html` directly in a browser (`open "Bug Defence.html"` on macOS), or serve the folder (e.g. `npx wrangler pages dev .`). The music files live in `music/` and are served as static assets.

---

### Task 1: Engine — multi-listener events + SFX emit hooks

**Files:**
- Modify: `js/engine.js`

- [ ] **Step 1: Upgrade `on`/`emit` to support multiple listeners**

In `js/engine.js`, replace the current callback block (around lines 22-24):

```js
  const cb = {}; // ui callbacks: onSprintComplete, onGameOver, onChange, hit
  function on(name, fn) { cb[name] = fn; }
  function emit(name, ...a) { if (cb[name]) cb[name](...a); }
```

with a multi-listener version (so both `UI` and `AUDIO` can subscribe to the same event):

```js
  const cb = {}; // ui/audio listeners (arrays): onSprintComplete, onGameOver, onChange, hit, fire, kill, shield, place, upgrade, sell, cast, sprintStart
  function on(name, fn) { (cb[name] || (cb[name] = [])).push(fn); }
  function emit(name, ...a) { const l = cb[name]; if (l) for (const fn of l) fn(...a); }
```

- [ ] **Step 2: Emit `fire` when a tower attacks**

In `fireTowers(dt)`:

In the `gc` branch, inside `if (swept)` add the emit. Change:

```js
          if (swept) S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.4, max: 0.4, col: '#9ece6a' });
```
to:
```js
          if (swept) { S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.4, max: 0.4, col: '#9ece6a' }); emit('fire', 'gc'); }
```

In the `burn` branch, change:
```js
          if (hit) S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.3, max: 0.3, col: '#ff9e64' });
```
to:
```js
          if (hit) { S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.3, max: 0.3, col: '#ff9e64' }); emit('fire', 'burn'); }
```

In the `melee` branch, after the splash loop, change:
```js
        S.effects.push({ kind: 'slap', x: t.x, y: t.y, r: L.splash, life: 0.22, max: 0.22, col: '#fff' });
        for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - t.x, e.y - t.y) <= L.splash) damage(e, L.dmg, 'melee');
```
to (add the emit after the loop):
```js
        S.effects.push({ kind: 'slap', x: t.x, y: t.y, r: L.splash, life: 0.22, max: 0.22, col: '#fff' });
        for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - t.x, e.y - t.y) <= L.splash) damage(e, L.dmg, 'melee');
        emit('fire', 'melee');
```

In the projectile `else` branch, after `S.projectiles.push(proj);` add `emit('fire', k);`:
```js
        S.projectiles.push(proj);
        emit('fire', k);
```

- [ ] **Step 3: Emit `kill`, `shield`, `place`, `upgrade`, `sell`, `cast`, `sprintStart`**

In `kill(e)`, at the very end of the function body (after the fork-bomb split block, before the closing `}`):
```js
    emit('kill', e);
  }
```

In `damage(e, amt, kind)`, the shield-break line. Change:
```js
      if (e.shield <= 0) S.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 8, life: 0.3, max: 0.3, col: '#7dcfff' });
```
to:
```js
      if (e.shield <= 0) { S.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 8, life: 0.3, max: 0.3, col: '#7dcfff' }); emit('shield'); }
```

In `place(...)`, change the success tail:
```js
    S.towers.push({ id: nextId++, type, def, col, row, x: ctr.x, y: ctr.y, lvl: 0, cd: 0, ang: -Math.PI / 2, invested: def.cost });
    emit('onChange');
    return true;
```
to:
```js
    S.towers.push({ id: nextId++, type, def, col, row, x: ctr.x, y: ctr.y, lvl: 0, cd: 0, ang: -Math.PI / 2, invested: def.cost });
    emit('onChange'); emit('place');
    return true;
```

In `upgrade(t)`, change:
```js
    S.commits -= cost; t.invested += cost; t.lvl++; emit('onChange'); return true;
```
to:
```js
    S.commits -= cost; t.invested += cost; t.lvl++; emit('onChange'); emit('upgrade'); return true;
```

In `sell(t)`, change:
```js
    S.floaters.push({ x: t.x, y: t.y, text: '+' + refund, life: 0.9, max: 0.9, col: THEME.commits });
    emit('onChange');
  }
```
to:
```js
    S.floaters.push({ x: t.x, y: t.y, text: '+' + refund, life: 0.9, max: 0.9, col: THEME.commits });
    emit('onChange'); emit('sell');
  }
```

In `cast(name, x, y)`, change the success tail:
```js
    S.castSpell = null; emit('onChange'); return true;
```
to:
```js
    S.castSpell = null; emit('cast', name); emit('onChange'); return true;
```

In `runSprint()`, change:
```js
    S.waveTime = 0; S.spawnedTotal = 0; S.waveActive = true;
    emit('onChange');
```
to:
```js
    S.waveTime = 0; S.spawnedTotal = 0; S.waveActive = true;
    emit('onChange'); emit('sprintStart');
```

(`hit`, `onSprintComplete`, `onGameOver` are already emitted — no change.)

- [ ] **Step 4: Verify the engine still loads and multi-listener works**

Open `Bug Defence.html` in the browser. Open DevTools console and run:
```js
let n = 0; GAME.on('place', () => n++); GAME.on('place', () => n++);
```
Then in the game: start a map and place a tower. Expected: no console errors; the existing UI (HUD, overlays, sprint-complete screen) still works exactly as before. The two extra `place` listeners are harmless — this just confirms `on()` accepts multiple listeners.

- [ ] **Step 5: Commit**

```bash
git add js/engine.js
git commit -m "feat(engine): multi-listener events + SFX emit hooks"
```

---

### Task 2: Audio module `js/audio.js`

**Files:**
- Create: `js/audio.js`
- Modify: `Bug Defence.html` (add script tag)
- Modify: `js/main.js` (call `AUDIO.init()`)
- Modify: `css/style.css` (control button + popover)

- [ ] **Step 1: Create `js/audio.js`**

Create `js/audio.js` with this complete content:

```js
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
  let audioEl = null, playlist = [], trackIdx = 0, musicStarted = false, unlocked = false;
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
    audioEl.addEventListener('error', () => { if (playlist.length) nextTrack(); }); // skip broken/missing track
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
  function seq(freqs, gap, dur, opt) { freqs.forEach((f, i) => setTimeout(() => tone(f, dur, opt), i * gap)); }

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
```

- [ ] **Step 2: Load the module in `Bug Defence.html`**

In `Bug Defence.html`, add the `audio.js` script tag after `ui.js` and before `tweaks.js`/`main.js`. Change:
```html
  <script src="js/ui.js"></script>
  <script src="js/tweaks.js"></script>
  <script src="js/main.js"></script>
```
to:
```html
  <script src="js/ui.js"></script>
  <script src="js/audio.js"></script>
  <script src="js/tweaks.js"></script>
  <script src="js/main.js"></script>
```

- [ ] **Step 3: Initialize audio on boot in `js/main.js`**

In `js/main.js`, in the `DOMContentLoaded` handler, change:
```js
  window.addEventListener('DOMContentLoaded', () => {
    TWEAKS.init();
    UI.init();
    requestAnimationFrame(loop);
  });
```
to:
```js
  window.addEventListener('DOMContentLoaded', () => {
    TWEAKS.init();
    UI.init();
    AUDIO.init();
    requestAnimationFrame(loop);
  });
```

- [ ] **Step 4: Style the control in `css/style.css`**

Append to the end of `css/style.css`:
```css
/* ---------- audio control ---------- */
#audio-ctrl { position: fixed; top: 12px; right: 14px; z-index: 50; }
#audio-ctrl .ic-btn { width: 38px; height: 38px; border-radius: 7px; border: 1px solid var(--panel-edge); background: var(--panel); color: var(--muted); font-size: 16px; transition: .12s; }
#audio-ctrl .ic-btn:hover { color: var(--text); border-color: var(--accent); }
#audio-pop {
  position: absolute; top: 46px; right: 0; display: none; flex-direction: column; gap: 12px;
  width: 188px; padding: 14px; background: var(--panel); border: 1px solid var(--panel-edge);
  border-radius: var(--r); box-shadow: 0 18px 50px -18px #000;
}
#audio-pop.on { display: flex; }
#audio-pop label { display: flex; flex-direction: column; gap: 6px; font-size: 10px; letter-spacing: .14em; color: var(--muted); font-weight: 700; }
#audio-pop input[type=range] { width: 100%; accent-color: var(--health); cursor: pointer; }
#audio-pop #audio-mute { width: 100%; padding: 8px; font-size: 12px; font-weight: 600; }
```

- [ ] **Step 5: Verify load + control UI**

Open `Bug Defence.html`. Expected:
- No console errors.
- A 🔊 button is fixed in the top-right corner on the menu, level select, and game screens.
- Clicking it opens a popover with two sliders (Musik, SFX) and a "Stumm" button. Clicking elsewhere closes it.
- `AUDIO.state` in the console returns `{ muted: false, music: 0.5, sfx: 0.7 }`.

- [ ] **Step 6: Verify music (shuffle-loop + fallback)**

- Click "▶ Defend production" (first interaction). Expected: within ~1s one of the 3 tracks starts playing. Reload and repeat a few times — the starting track varies (shuffle).
- Let a track finish (or in console run `AUDIO` is internal; instead seek near end via the page's audio element is not exposed — just confirm playback continues over time and loops). Expected: continuous playback; no gap-of-silence longer than a track transition.
- **Fallback:** in a terminal run `mv music music_off`, reload the page, click to start. Expected: game plays fully, SFX work, **no uncaught errors** in console (only benign network 404s). Restore with `mv music_off music`.

- [ ] **Step 7: Verify SFX in-game**

Start a map and confirm each sound fires:
- Place a tower → place sound; select it and Upgrade → ascending phrase; Sell → descending.
- Run a sprint → start alert; towers firing → shot blips (with many towers, **no machine-gun spam** — throttled); bugs dying → pops; a boss dying → bigger sound.
- Cast Q/W/E spells → distinct freeze/explosion/poison sounds.
- Let a bug leak to production → warning tone.
- Clear a sprint → 3-note jingle; win/lose a game → triumphant / failure phrase.

- [ ] **Step 8: Verify controls + persistence**

- Drag the Musik slider → music volume changes live. Drag SFX slider → trigger an SFX, volume changes.
- Click "Stumm" (or the 🔊 button → "Stumm") → all audio silences, icon becomes 🔇. Click again → audio returns.
- Reload the page. Expected: the muted state and both slider positions are restored (`localStorage` key `bugdef.audio`).

- [ ] **Step 9: Commit**

```bash
git add js/audio.js "Bug Defence.html" js/main.js css/style.css
git commit -m "feat(audio): procedural SFX + shuffled music playlist + controls"
```

---

### Task 3: Document the music folder in README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add an Audio section to the README**

Append to `README.md`:
```markdown
## Audio

Sound effects are synthesized at runtime via the Web Audio API (no asset files).
Background music is played from `music/` — drop in `.mp3` files there. The current
tracks are referenced in `js/audio.js` (`MUSIC_FILES`); on each game start the list
is shuffled and looped. A mute toggle and Musik/SFX volume sliders live in the
fixed top-right control on every screen, and the settings persist via `localStorage`.
To swap tracks, replace the files in `music/` and update the `MUSIC_FILES` array.
```

- [ ] **Step 2: Verify**

Open `README.md` and confirm the Audio section renders and the filenames/paths match what's in `music/` and `js/audio.js`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document audio (music folder + controls)"
```

---

## Notes on the music files

The three tracks already in `music/` contain a space and an umlaut in one filename
(`Musik für Hacker-Tower-Defense.mp3`). `playTrack()` wraps the path in `encodeURI(...)`,
which produces the correct percent-encoding (`Musik%20f%C3%BCr%20...`) for both
local file access and the Cloudflare Pages static server. No renaming is required.
Each file is ~3.5 MB; they should be committed so the deployed site can serve them.
