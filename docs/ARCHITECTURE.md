# Architecture

Bug Defence is a single-page, dependency-free game: **vanilla JavaScript +
HTML5 Canvas + CSS**. No build step, no framework, no bundler. ~2.4k lines of
JS across seven small modules. This document explains how the pieces fit and
how to extend the game.

---

## Design principles

1. **Config-driven.** All gameplay data — maps, towers, bugs, waves, balance
   numbers — lives in `js/config.js`. Adding content is editing data, not logic.
2. **Global namespaces, explicit load order.** Each module is an IIFE that
   exposes one global (`ART`, `GAME`, `RENDER`, `UI`, `TWEAKS`); `config.js`
   exposes plain globals. Scripts load in dependency order (see below) — no
   modules/imports, so it runs from `file://` or any static host.
3. **Separation of concerns.** Data (`config`) → simulation (`engine`) →
   drawing (`render`) and DOM/input (`ui`). The engine never touches the DOM;
   the renderer never mutates game state.

---

## Module map

Loaded in this order (see `Bug Defence.html`):

| # | File | Global | Responsibility |
|---|------|--------|----------------|
| 1 | `js/config.js` | *(plain globals)* | All data + path geometry. `GRID`, `THEMES`/`THEME`, `MAPS`, live geometry (`PATH_PTS`, `pathCells`, `segs`, `pathLen`, …), `setMap()`/`buildGeometry()`/`posAt()`, `TOWERS`, `ENEMIES`, `WAVES`, `SPELLS`, balance constants. |
| 2 | `js/art.js` | `ART` | Pure Canvas drawing of creatures, tower glyphs and spell glyphs. `drawCreature`, `drawTower`, `drawSpell`, `BUG` (per-bug palette). No state. |
| 3 | `js/engine.js` | `GAME` | The simulation: state (`GAME.S`), spawning, movement, combat, towers, projectiles, spells, economy, win/lose. DOM-free. |
| 4 | `js/render.js` | `RENDER` | `RENDER.frame(ctx, t)` paints the whole board from `GAME.S` each frame. Read-only over state. |
| 5 | `js/ui.js` | `UI` | All DOM: screens, HUD, dock/palette, spell bar, tooltips, selection panel, level select, roster, bestiary, overlays, and input handling. Wires DOM → `GAME`. |
| 6 | `js/tweaks.js` | `TWEAKS` | The in-game tweak panel (art direction / HUD layout) + theme→CSS-variable application + host message protocol. |
| 7 | `js/main.js` | *(boot)* | `DOMContentLoaded` → `TWEAKS.init()`, `UI.init()`, then starts the `requestAnimationFrame` loop. |

`css/style.css` holds the full dark-IDE visual system. Theme colors are CSS
custom properties that `tweaks.js` rewrites at runtime.

---

## The game loop

`js/main.js`:

```
requestAnimationFrame loop(now):
  dt   = clamp((now - last)/1000, max 0.05)   // cap so tab-switches don't teleport bugs
  sdt  = dt * GAME.S.speed                     // 1× / 2× speed control
  if screen === 'play': GAME.update(sdt)       // advance simulation
  UI.render(now/1000)                          // RENDER.frame + tickHUD (only while playing)
```

`GAME.update(dt)` runs the fixed pipeline: `processSpawns → moveEnemies →
filter dead → fireTowers → moveProjectiles → updateFx`, then checks
sprint-complete and lose conditions. Rendering is decoupled and time (`t`) is
wall-clock seconds, used for animation phase.

---

## State model — `GAME.S`

One plain object is the whole game state:

```
screen          'menu' | 'play' | 'levels' | 'roster' | 'bestiary'
mapIndex        which MAPS entry is loaded
uptime          health, starts 100, bug-leaks subtract
commits         currency
sprint          0-based wave index
waveActive      a sprint is currently spawning/alive
spawnQ          queued spawns [{type, t}] for the active sprint
enemies/towers/projectiles/effects/floaters/trail   live entity arrays
speed/paused/time
placing         tower type pending placement (or null)
castSpell       spell pending cast (or null)
selected        currently selected placed tower (or null)
hover           board cursor position
spellCd         per-spell cooldown timers
result          'win' | 'lose' | null
lastBonus       commits awarded by the last sprint clear (shown in overlay)
stats           { kills, leaked }
```

UI never stores game state of its own (with one exception: a `selKey` dirty-flag
so the selection panel isn't rebuilt every frame — see "Gotchas" below).

---

## Data flow

```
config.js  ──data──►  engine.js (GAME)  ──state(GAME.S)──►  render.js (RENDER) ──► <canvas>
    │                      ▲                                  ▲
    │                      │ DOM events (click/keys)          │ ART.draw*()
    └──data──►  ui.js (UI) ┘                                  art.js (ART)
                   │
                   └── builds DOM screens, reads GAME.S each frame in tickHUD
```

- **Towers/bugs/spells** are looked up by key from `TOWERS` / `ENEMIES` /
  `SPELLS`; the orders (`TOWER_ORDER`, `ENEMY_ORDER`, `SPELL_ORDER`) drive UI
  iteration and hotkeys.
- **Geometry is per-map and rebuilt on map load.** `setMap(i)` repoints
  `PATH_CELLS`/`CORE_CELL`, sets the difficulty multiplier `DIFFICULTY`, and
  calls `buildGeometry()`, which recomputes `PATH_PTS`, `segs`, `pathLen`, the
  loop-back points, and the buildable-cell set `pathCells` **in place** (so any
  references stay valid). `posAt(d)` maps a distance-along-path to an `{x,y,ang}`.

---

## Enemy behaviours

Behaviours are flags on the `ENEMIES` definition, handled in `engine.js`:

| Flag | Bug | Effect |
|------|-----|--------|
| `grows` | Memory Leak | radius/HP-visual grows over time, leaves a slow trail |
| `pairs` | Race Condition | spawns two at once |
| `loops` | Infinite Loop | jumps back along the path once at 60% |
| `cloaks` | Heisenbug | periodically untargetable (kill with splash/AoE) |
| `accelerates` | Timeout | `baseSpeed` ramps up while alive |
| `shield: N` | Buffer Overflow | flat damage soak before HP |
| `revives` | Zombie Process | on death, stands up once at 45% HP |
| `splits` | Fork Bomb | on death spawns two smaller copies |
| `linked` | Deadlock | chained pair, 70% damage reduction until link breaks |
| `armor: f` | Spaghetti | reduces shooter/sniper damage by fraction `f` |
| `boss` | Segfault/Legacy | gentler HP scaling, immune to GC sweep |

Tower behaviour is driven by `kind`: `melee` (splash), `shooter`, `burn` (AoE
DoT), `sniper` (homing + stun), `control` (slow field, no damage), `gc` (sweep
low-HP + refund), `pierce` (passes through a line).

---

## Balance model

Difficulty comes from three multipliers plus a reward, all in `engine.js`/`config.js`:

| Knob | Formula | Effect |
|------|---------|--------|
| Per-map difficulty | `DIFFICULTY` (per map, 1.0–1.36) | base HP/speed scale |
| HP ramp (quadratic) | `hpMult = DIFFICULTY · (1 + 0.014·s + 0.016·s²)` | early sprints gentle, late sprints spike (s = sprint index) |
| Speed ramp | `spdMult = 1 + (DIFFICULTY−1)·0.45` | harder maps slightly faster |
| Boss HP | `def.hp · (1 + (DIFFICULTY−1) + 0.04·s)` | bosses scale gently to stay killable |
| Wave count | `waveCountMult = 1 + max(0, s−5)·0.08` | late sprints spawn **more** bugs (only after sprint 5) |
| Sprint bonus | `commits += 25 + 10·s` on clear | scaling reward to fund the harder back half |

The quadratic HP ramp + count multiplier are what keep late sprints challenging:
player DPS compounds (more towers × upgrades × income), so enemy throughput must
accelerate to match. Early sprints (≤ 5) are deliberately untouched by the count
multiplier and only lightly by the HP ramp.

A `_headers`-free static site means no server logic — everything above runs in
the browser.

---

## How to extend

### Add a tower
1. Add an entry to `TOWERS` in `config.js` (with `kind`, `cost`, `tiers`,
   `levels[]`). Pick an existing `kind` or add new handling in `fireTowers()`.
2. Add it to `TOWER_ORDER` (controls palette slot + number hotkey).
3. Draw its glyph: add a `G.<key>` case in `art.js`'s `drawTower`, and a color
   in `render.js`'s `towerColor()`.

### Add a bug
1. Add an entry to `ENEMIES` in `config.js` (`hp`, `speed`, `reward`, `leak`,
   `r`, `blurb`, `threat`, + any behaviour flag).
2. Add it to `ENEMY_ORDER`.
3. Add a creature drawer `C.<key>` in `art.js` and a palette entry in `BUG`.
4. If it has a new behaviour flag, handle it in `engine.js`
   (`spawnEnemy`/`moveEnemies`/`damage`/`kill`).
5. Reference it in `WAVES` so it actually shows up.

### Add a map
1. Append to `MAPS` in `config.js`: `{ id, name, difficulty, diffMult, sub,
   path: [[c,r]…], core: [c,r] }`. Path segments must be axis-aligned; start
   off-screen (e.g. `[-1, r]`).
2. That's it — the level-select screen, mini-path preview, and per-map geometry
   rebuild all pick it up automatically.

### Add a spell
1. Add to `SPELLS` + `SPELL_ORDER` in `config.js`.
2. Handle it in `GAME.cast()` in `engine.js`.
3. Draw its glyph: add a `SPELL.<key>` case in `art.js`'s `drawSpell`.

### Retune balance
Edit the formulas/constants in `engine.js` (`hpMult`, `spdMult`, `sprintBonus`,
boss line) and `config.js` (`waveCountMult`, `START_COMMITS`, per-map `diffMult`,
the `WAVES` script, tower/enemy stats). The whole balance surface is data +
five small functions.

---

## Gotchas worth knowing

- **Don't rebuild DOM every frame.** `tickHUD` runs ~60×/s; the tower selection
  panel uses a `selKey` dirty-check so its buttons aren't recreated mid-click
  (recreating them swallows clicks → upgrade/sell appeared "broken").
- **Melee splash must exceed one cell.** A cell is 64px; splash radii are >64 so
  a tower placed beside the path can actually hit bugs on it.
- **Canvas vs. screenshot tools.** Large, continuously-redrawn canvases may not
  serialize in some headless screenshot tools even though they render fine in a
  real browser — verify by pixel-sampling, not by screenshot, if in doubt.
