# 🐛 Bug Defence

> A tower defence for the perpetually on-call.

**▶ Play it live: [ritscher.ch](https://ritscher.ch)**

Software bugs. Or actual creepy-crawlies. Nobody ever decides — because they're
the same thing. A **Null Pointer** is a literal hole-faced beetle. A **Memory
Leak** is a slug that grows fatter and slimier the longer it lives. Defend the
**Production Server** down the call stack with your debugging toolkit before the
**Release Deadline** ships every last bug to prod.

Built with **vanilla JavaScript + HTML5 Canvas** — no frameworks, no build step.
Just open it and play.

---

## ▶ Play

**Online:** [ritscher.ch](https://ritscher.ch)

**Locally:** serve the folder (recommended — avoids `file://` quirks) and open it:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/Bug%20Defence.html
```

Opening `Bug Defence.html` directly via `file://` mostly works too, but a local
server matches how it runs in production (entry served as `index.html`).

---

## 🎮 How to play

You place towers on a circuit-board-meets-codebase grid. Bugs march down the
**call stack** toward your Production Server. Each bug that reaches prod costs
you **Uptime** (your health). Killing bugs earns **Commits** (your currency).
Survive all **12 sprints** — the last one is the **Release Deadline**.

| Resource | Meaning |
| --- | --- |
| **Uptime** | Your health. Starts at 100%, drops when a bug reaches Production. Hit 0% → Kernel Panic. |
| **Commits** | Your currency. Spent on towers, upgrades and spells; earned from kills + a sprint-clear bonus. |
| **Sprint** | The wave counter (1–12). Clear each sprint, brace for the next. |

### Controls

| Key | Action |
| --- | --- |
| `1`–`7` | Select a tower to place |
| `Q` / `W` / `E` | Cast Breakpoint / Hotfix / Patch |
| `Space` | Pause |
| `Esc` | Cancel placement / selection |
| `Enter` | Run the next sprint |
| Click a placed tower | Open its panel to **upgrade** or **sell** |
| Hover a tower in the dock | See its full stats & upgrade tree |

### Touch (phones & tablets)

The game is fully playable on touch devices — the layout adapts to portrait
and landscape, and the board scales to fit:

| Gesture | Action |
| --- | --- |
| Tap a tool, then tap the board | Place a tower (drag on the board to preview first) |
| Tap a spell, then tap the board | Cast it there |
| Tap a placed tower | Open its panel to **upgrade** or **sell** |
| Long-press the board | Cancel placement / selection |

---

## 🗺️ Maps

Four battlefields, same bug taxonomy, very different fights:

| Map | Difficulty | Twist |
| --- | --- | --- |
| **The Call Stack** | Onboarding | Gentle serpentine, lots of build space. |
| **The Data Pipeline** | Junior | Four long lanes — bugs take the scenic route. |
| **The Recursion Spiral** | Senior | A tightening spiral; central towers cover many lanes. |
| **The Hot Path** | On-call hell | Short, brutal, near-direct. Barely any reaction time. |

---

## 🧰 The toolkit (towers)

Every real dev tool, weaponised. Each upgrades twice.

- **Swatter** (Fliegenklatsche) — cheap melee splash, slaps everything adjacent.
- **Linter** — fast, weak ranged shooter that fires red squiggly underlines.
- **Firewall** — a literal wall of fire that burns everything in range.
- **Antivirus** — single-target sniper, huge damage, quarantines (stuns) on hit.
- **Debugger** — doesn't kill; freezes bugs in a step-through breakpoint field.
- **Garbage Collector** — sweeps low-health bugs and refunds Commits.
- **Unit Test** — piercing shot through a whole line of bugs.

### Spells

- **Breakpoint** — freezes all execution in an area.
- **Hotfix** (`kill -9`) — a burst nuke.
- **Patch** — a deprecating damage-over-time cloud.

---

## 🪲 The bug taxonomy (enemies)

Fourteen bugs crawling toward prod — each a debugging in-joke with real behaviour:

Null Pointer · Memory Leak (grows) · Race Condition (spawns in pairs) ·
Infinite Loop (loops back on the path) · Heisenbug (cloaks when targeted) ·
Timeout (accelerates over time) · Buffer Overflow (shielded) ·
Zombie Process (revives once) · Fork Bomb (splits on death) ·
Deadlock (chained pair) · Spaghetti (armored) · Stack Overflow (swarm) ·
**Segfault** (mini-boss) · **Legacy Code** (the final boss).

---

## 🎨 Tweaks

A small in-game tweak panel lets you flip the **art direction** between
*Infested* (a clean codebase being overrun — corruption red) and *Reclaimed*
(order being restored — healthy teal-green), plus the HUD layout.

---

## 🛠️ Tech & structure

Plain HTML/CSS/JS, Canvas-rendered, no dependencies.

```
Bug Defence.html   — entry point
css/style.css      — dark-IDE visual system
js/config.js       — all gameplay data: maps, towers, bugs, waves, balance
js/art.js          — iconographic Canvas creatures, tower & spell glyphs
js/engine.js       — game state, pathing, combat, economy, win/lose
js/render.js       — per-frame board renderer
js/ui.js           — screens, HUD, dock, level select, roster, bestiary
js/tweaks.js       — art-direction / layout tweak panel
js/main.js         — boot + requestAnimationFrame loop
```

---

## 🚀 Deployment

Hosted on **Cloudflare Pages** (free tier), auto-deployed on every push to `main`
via GitHub Actions. The workflow copies the entry file to `index.html`, then
`wrangler pages deploy`s the result.

- **Live:** [ritscher.ch](https://ritscher.ch) · [bug-defence.pages.dev](https://bug-defence.pages.dev)
- **Workflow:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
- **Full setup & how to reproduce it:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## 📚 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code is structured, the
  game loop, data flow, and **how to add a new tower, bug, map, or spell**.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — the Cloudflare Pages + GitHub
  Actions pipeline, step by step (incl. the gotchas hit while setting it up).

---

## 📄 License

[MIT](LICENSE) © 2026 Tobias Ritscher

🤖 Built with [Claude Code](https://claude.com/claude-code)

## Audio

Sound effects are synthesized at runtime via the Web Audio API (no asset files).
Background music is played from `music/` — drop in `.mp3` files there. The current
tracks are referenced in `js/audio.js` (`MUSIC_FILES`); on each game start the list
is shuffled and looped. A mute toggle and Musik/SFX volume sliders live in the
fixed top-right control on every screen, and the settings persist via `localStorage`.
To swap tracks, replace the files in `music/` and update the `MUSIC_FILES` array.
