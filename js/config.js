/* ============================================================
   BUG DEFENCE — config.js
   Grid, maps (path geometry), themes, towers, enemies, waves.
   All gameplay numbers live here. Geometry is rebuilt per-map.
   ============================================================ */

const GRID = { COLS: 15, ROWS: 9, CELL: 64 };
const BOARD_W = GRID.COLS * GRID.CELL;   // 960
const BOARD_H = GRID.ROWS * GRID.CELL;   // 576

// Convert a cell to its pixel center
function cellCenter(c, r) {
  return { x: c * GRID.CELL + GRID.CELL / 2, y: r * GRID.CELL + GRID.CELL / 2 };
}

// ---- Themes (the art-direction tweak switches between these) ----------------
const THEMES = {
  infested: {
    bg: '#13131d', grid: '#1d2030', gridGlow: '#252a40',
    panel: '#171823', panelEdge: '#2a2e44',
    path: '#20233a', pathEdge: '#39406a', pathGlow: '#4a5cff',
    buildOk: '#9ece6a', buildBad: '#f7768e', cell: '#191b28',
    core: '#7aa2f7', coreGlow: '#bb9af7',
    text: '#c7d0f0', muted: '#6b7394',
    health: '#9ece6a', commits: '#e0af68', danger: '#f7768e',
    bug: '#f7768e', bugDark: '#a13a4c', accent: '#bb9af7',
    moss: '#3d2b3a', overlay: 'rgba(247,118,142,0.06)'
  },
  reclaimed: {
    bg: '#0c1a17', grid: '#143027', gridGlow: '#1b4034',
    panel: '#0f1f1a', panelEdge: '#1f4538',
    path: '#11352b', pathEdge: '#246b53', pathGlow: '#2ee6a6',
    buildOk: '#7ee8b0', buildBad: '#ff9e64', cell: '#0e251f',
    core: '#2ee6a6', coreGlow: '#7dcfff',
    text: '#d3f3e6', muted: '#5d8a78',
    health: '#7ee8b0', commits: '#ffd479', danger: '#ff9e64',
    bug: '#ff9e64', bugDark: '#a85a2e', accent: '#7dcfff',
    moss: '#1f4d3a', overlay: 'rgba(46,230,166,0.05)'
  }
};

// Mutable pointer to the current theme; tweaks.js rebinds it.
let THEME = THEMES.infested;
function setThemeName(name) { THEME = THEMES[name] || THEMES.infested; }

// ---- Maps -------------------------------------------------------------------
// Each map has its own serpentine path (cell coords) ending at the core, plus a
// difficulty multiplier applied to enemy HP/speed. Paths must be axis-aligned.
const MAPS = [
  {
    id: 'callstack', name: 'The Call Stack', difficulty: 'Onboarding', diffMult: 1.0,
    sub: 'A gentle serpentine descent. Lots of room to build — learn the toolkit here.',
    path: [[-1, 1], [13, 1], [13, 4], [1, 4], [1, 7], [14, 7]], core: [14, 7]
  },
  {
    id: 'pipeline', name: 'The Data Pipeline', difficulty: 'Junior', diffMult: 1.2,
    sub: 'Four long lanes back and forth. Bugs take the scenic route — make them pay for it.',
    path: [[-1, 1], [13, 1], [13, 3], [1, 3], [1, 5], [13, 5], [13, 7], [1, 7]], core: [1, 7]
  },
  {
    id: 'spiral', name: 'The Recursion Spiral', difficulty: 'Senior', diffMult: 1.36,
    sub: 'A tightening spiral into the core. Central towers cover many lanes at once.',
    path: [[-1, 0], [13, 0], [13, 8], [1, 8], [1, 2], [11, 2], [11, 6], [3, 6], [3, 4], [8, 4]], core: [8, 4]
  },
  {
    id: 'hotpath', name: 'The Hot Path', difficulty: 'On-call hell', diffMult: 1.3,
    sub: 'Short, brutal, almost direct. Barely any time to react — bring raw DPS and spells.',
    path: [[-1, 4], [7, 4], [7, 7], [14, 7]], core: [14, 7]
  }
];

// ---- Live geometry (rebuilt by setMap → buildGeometry) ----------------------
let CURRENT_MAP = 0;
let DIFFICULTY = 1.0;
let PATH_CELLS = MAPS[0].path;
let CORE_CELL = MAPS[0].core;
let PATH_PTS = [];
let segs = [];
let pathLen = 0;
let LOOP_AT = 0, LOOP_BACK = 0;
const pathCells = new Set();   // mutated in place so references stay valid

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - a.x) * dx + (py - a.y) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
}

function buildGeometry() {
  PATH_PTS = PATH_CELLS.map(([c, r]) => cellCenter(c, r));
  segs.length = 0; pathLen = 0;
  for (let i = 0; i < PATH_PTS.length - 1; i++) {
    const a = PATH_PTS[i], b = PATH_PTS[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, len, start: pathLen });
    pathLen += len;
  }
  LOOP_AT = pathLen * 0.6; LOOP_BACK = pathLen * 0.28;
  pathCells.clear();
  for (let c = 0; c < GRID.COLS; c++) for (let r = 0; r < GRID.ROWS; r++) {
    const ctr = cellCenter(c, r);
    for (const s of segs) if (distToSeg(ctr.x, ctr.y, s.a, s.b) < GRID.CELL * 0.62) { pathCells.add(c + ',' + r); break; }
  }
}

function posAt(d) {
  if (d <= 0) { const s = segs[0]; return { x: s.a.x, y: s.a.y, ang: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) }; }
  for (const s of segs) {
    if (d <= s.start + s.len) {
      const f = (d - s.start) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f, ang: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) };
    }
  }
  const s = segs[segs.length - 1];
  return { x: s.b.x, y: s.b.y, ang: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) };
}

function setMap(i) {
  CURRENT_MAP = Math.max(0, Math.min(MAPS.length - 1, i));
  const m = MAPS[CURRENT_MAP];
  PATH_CELLS = m.path; CORE_CELL = m.core; DIFFICULTY = m.diffMult;
  buildGeometry();
}
buildGeometry(); // initial

// ---- Tower definitions ------------------------------------------------------
// kind: melee | shooter | burn | sniper | control | gc | pierce
const TOWERS = {
  swatter: {
    name: 'Swatter', sub: 'Fliegenklatsche', kind: 'melee', cost: 65,
    blurb: 'Cheap melee splash. Slaps everything adjacent. Your starter.',
    tiers: ['Swatter', 'Mechanical Swatter', 'Robo-Klatsche'],
    levels: [
      // splash must exceed one cell (64px) to reach bugs on an adjacent lane
      { dmg: 16, rate: 0.85, range: 84, splash: 78 },
      { dmg: 28, rate: 0.70, range: 96, splash: 90, upCost: 75 },
      { dmg: 50, rate: 0.55, range: 112, splash: 104, upCost: 140 }
    ]
  },
  linter: {
    name: 'Linter', sub: 'red squiggle gun', kind: 'shooter', cost: 85,
    blurb: 'Fast, weak ranged bug-shooter. Fires red squiggly underlines.',
    tiers: ['Linter', 'Linter --strict', 'Linter --pedantic'],
    levels: [
      { dmg: 9, rate: 0.32, range: 165, proj: 460 },
      { dmg: 15, rate: 0.26, range: 180, proj: 500, upCost: 85 },
      { dmg: 24, rate: 0.20, range: 200, proj: 540, upCost: 150 }
    ]
  },
  firewall: {
    name: 'Firewall', sub: 'wall of fire', kind: 'burn', cost: 125,
    blurb: 'A literal wall of fire. Burns everything that walks through range.',
    tiers: ['Firewall', 'Hardened Firewall', 'WAF'],
    levels: [
      { dmg: 8, rate: 0.5, range: 96, burn: 10 },
      { dmg: 14, rate: 0.45, range: 108, burn: 18, upCost: 115 },
      { dmg: 22, rate: 0.4, range: 122, burn: 30, upCost: 190 }
    ]
  },
  antivirus: {
    name: 'Antivirus', sub: 'quarantine sniper', kind: 'sniper', cost: 165,
    blurb: 'Single-target sniper. Huge damage, slow rate. Quarantines (stuns) on hit.',
    tiers: ['Antivirus', 'Heuristic Scanner', 'Zero-Day Hunter'],
    levels: [
      { dmg: 90, rate: 2.3, range: 260, proj: 900, stun: 0.5 },
      { dmg: 165, rate: 2.0, range: 290, proj: 1000, stun: 0.8, upCost: 160 },
      { dmg: 310, rate: 1.7, range: 330, proj: 1100, stun: 1.2, upCost: 260 }
    ]
  },
  debugger: {
    name: 'Debugger', sub: 'breakpoint field', kind: 'control', cost: 115,
    blurb: "Doesn't kill — freezes bugs in a step-through field so others finish them.",
    tiers: ['Debugger', 'Step-Through', 'Time-Travel Debugger'],
    levels: [
      { dmg: 0, rate: 1, range: 115, slow: 0.5 },
      { dmg: 0, rate: 1, range: 130, slow: 0.65, upCost: 95 },
      { dmg: 0, rate: 1, range: 150, slow: 0.8, upCost: 160 }
    ]
  },
  gc: {
    name: 'Garbage Collector', sub: 'sweep + refund', kind: 'gc', cost: 145,
    blurb: 'Periodically sweeps dead/low-health bugs in range and refunds Commits.',
    tiers: ['Garbage Collector', 'Generational GC', 'Stop-the-World GC'],
    levels: [
      { dmg: 0, rate: 3.6, range: 120, threshold: 0.16, refund: 3 },
      { dmg: 0, rate: 3.1, range: 135, threshold: 0.23, refund: 5, upCost: 125 },
      { dmg: 0, rate: 2.6, range: 150, threshold: 0.30, refund: 7, upCost: 200 }
    ]
  },
  unittest: {
    name: 'Unit Test', sub: 'piercing coverage', kind: 'pierce', cost: 135,
    blurb: 'Piercing shot through a whole line of bugs. Bonus vs the type it covers.',
    tiers: ['Unit Test', 'Integration Test', 'E2E Suite'],
    levels: [
      { dmg: 30, rate: 1.6, range: 210, proj: 620, pierce: 4 },
      { dmg: 52, rate: 1.4, range: 230, proj: 680, pierce: 6, upCost: 115 },
      { dmg: 86, rate: 1.2, range: 250, proj: 740, pierce: 99, upCost: 190 }
    ]
  }
};
const TOWER_ORDER = ['swatter', 'linter', 'firewall', 'antivirus', 'debugger', 'gc', 'unittest'];

// ---- Enemy (bug) definitions ------------------------------------------------
const ENEMIES = {
  nullptr: {
    name: 'Null Pointer', tag: 'NullPointerException', hp: 50, speed: 62, reward: 7, leak: 3, r: 17,
    blurb: 'Basic grunt. A beetle with a void where its face should be.', threat: 1
  },
  memleak: {
    name: 'Memory Leak', tag: 'OutOfMemoryError', hp: 215, speed: 32, reward: 15, leak: 4, r: 20,
    blurb: 'Slow tank that grows fatter the longer it lives. Kill it fast.', threat: 3,
    grows: true
  },
  race: {
    name: 'Race Condition', tag: 'non-deterministic', hp: 34, speed: 118, reward: 6, leak: 2, r: 14,
    blurb: 'Fast, always spawns in pairs. Which one is ahead keeps flickering.', threat: 2,
    pairs: true
  },
  infloop: {
    name: 'Infinite Loop', tag: 'while(true){}', hp: 98, speed: 72, reward: 11, leak: 3, r: 17,
    blurb: 'Runs partway, then loops back to an earlier point on the path. Maddening.', threat: 2,
    loops: true
  },
  heisenbug: {
    name: 'Heisenbug', tag: 'cannot reproduce', hp: 74, speed: 86, reward: 17, leak: 3, r: 16,
    blurb: 'Turns invisible whenever a tower targets it. Kill it with splash.', threat: 3,
    cloaks: true
  },
  timeout: {
    name: 'Timeout', tag: 'ETIMEDOUT', hp: 92, speed: 56, reward: 14, leak: 3, r: 16,
    blurb: 'Starts slow, then accelerates the longer it survives. Stop it early.', threat: 3,
    accelerates: true
  },
  bufferoverflow: {
    name: 'Buffer Overflow', tag: 'stack smashing detected', hp: 120, speed: 50, reward: 18, leak: 4, r: 19,
    blurb: 'Carries a shield that soaks the first burst. Chip it down, then finish.', threat: 4,
    shield: 90
  },
  zombie: {
    name: 'Zombie Process', tag: '<defunct>', hp: 112, speed: 54, reward: 16, leak: 3, r: 18,
    blurb: 'Refuses to die — stands back up once at half health. Kill it twice.', threat: 3,
    revives: true
  },
  forkbomb: {
    name: 'Fork Bomb', tag: ':(){ :|:& };:', hp: 72, speed: 64, reward: 9, leak: 3, r: 16,
    blurb: 'Splits into two smaller copies when it dies. Splash or it multiplies on you.', threat: 4,
    splits: true
  },
  deadlock: {
    name: 'Deadlock', tag: 'circular wait', hp: 165, speed: 48, reward: 22, leak: 4, r: 18,
    blurb: 'Two bugs chained together — both shrug off damage until you break the link.', threat: 3,
    linked: true
  },
  spaghetti: {
    name: 'Spaghetti', tag: 'goto considered harmful', hp: 300, speed: 44, reward: 24, leak: 5, r: 21,
    blurb: 'Armored, tangled, resistant to single-target fire. Bring splash & pierce.', threat: 4,
    armor: 0.55
  },
  stackoverflow: {
    name: 'Stack Overflow', tag: 'RecursionError', hp: 24, speed: 80, reward: 4, leak: 2, r: 12,
    blurb: 'A swarm that piles on top of itself. Numbers are the danger.', threat: 2,
    swarm: true
  },
  segfault: {
    name: 'Segfault', tag: 'SIGSEGV — mini-boss', hp: 950, speed: 40, reward: 90, leak: 14, r: 26,
    blurb: 'Mini-boss. A jagged crash of broken memory. Shrugs off small hits.', threat: 5,
    boss: true
  },
  legacy: {
    name: 'Legacy Code', tag: 'do not touch — boss', hp: 3600, speed: 26, reward: 340, leak: 35, r: 34,
    blurb: 'The ancient, absurdly tanky boss nobody wants to refactor. The Release Deadline.', threat: 6,
    boss: true
  }
};
const ENEMY_ORDER = ['nullptr', 'memleak', 'race', 'infloop', 'heisenbug', 'timeout',
  'bufferoverflow', 'zombie', 'forkbomb', 'deadlock', 'spaghetti', 'stackoverflow',
  'segfault', 'legacy'];

// ---- Wave script: 12 sprints. Final sprint = the Release Deadline -----------
// group: { type, count, gap (s between), start (s offset) }
// Applied to every map; per-map diffMult + a per-sprint ramp scale the bugs.
const WAVES = [
  { label: 'Sprint 1', groups: [
    { type: 'nullptr', count: 9, gap: 0.95, start: 0 } ] },
  { label: 'Sprint 2', groups: [
    { type: 'nullptr', count: 7, gap: 0.85, start: 0 },
    { type: 'race', count: 8, gap: 0.6, start: 5 } ] },
  { label: 'Sprint 3', groups: [
    { type: 'nullptr', count: 6, gap: 0.7, start: 0 },
    { type: 'memleak', count: 3, gap: 2.2, start: 3 },
    { type: 'stackoverflow', count: 12, gap: 0.28, start: 9 } ] },
  { label: 'Sprint 4', groups: [
    { type: 'race', count: 12, gap: 0.45, start: 0 },
    { type: 'timeout', count: 4, gap: 1.5, start: 4 },
    { type: 'infloop', count: 4, gap: 1.5, start: 6 } ] },
  { label: 'Sprint 5', groups: [
    { type: 'memleak', count: 4, gap: 1.7, start: 0 },
    { type: 'heisenbug', count: 5, gap: 1.3, start: 4 },
    { type: 'nullptr', count: 10, gap: 0.5, start: 6 } ] },
  { label: 'Sprint 6', groups: [
    { type: 'bufferoverflow', count: 4, gap: 1.8, start: 0 },
    { type: 'deadlock', count: 4, gap: 2.0, start: 4 },
    { type: 'stackoverflow', count: 18, gap: 0.2, start: 8 } ] },
  { label: 'Sprint 7', groups: [
    { type: 'zombie', count: 6, gap: 1.2, start: 0 },
    { type: 'heisenbug', count: 6, gap: 1.0, start: 3 },
    { type: 'infloop', count: 6, gap: 1.1, start: 7 } ] },
  { label: 'Sprint 8', groups: [
    { type: 'forkbomb', count: 6, gap: 1.1, start: 0 },
    { type: 'race', count: 14, gap: 0.35, start: 4 },
    { type: 'spaghetti', count: 4, gap: 1.6, start: 8 } ] },
  { label: 'Sprint 9', groups: [
    { type: 'spaghetti', count: 5, gap: 1.6, start: 0 },
    { type: 'deadlock', count: 5, gap: 1.8, start: 4 },
    { type: 'timeout', count: 8, gap: 0.8, start: 8 },
    { type: 'segfault', count: 1, gap: 1, start: 14 } ] },
  { label: 'Sprint 10', groups: [
    { type: 'memleak', count: 6, gap: 1.1, start: 0 },
    { type: 'bufferoverflow', count: 6, gap: 1.2, start: 3 },
    { type: 'heisenbug', count: 8, gap: 0.9, start: 6 },
    { type: 'segfault', count: 2, gap: 5, start: 14 } ] },
  { label: 'Sprint 11', groups: [
    { type: 'zombie', count: 8, gap: 0.9, start: 0 },
    { type: 'forkbomb', count: 8, gap: 0.9, start: 3 },
    { type: 'spaghetti', count: 6, gap: 1.3, start: 7 },
    { type: 'segfault', count: 2, gap: 6, start: 16 } ] },
  { label: 'Release Deadline', groups: [
    { type: 'stackoverflow', count: 28, gap: 0.16, start: 0 },
    { type: 'race', count: 18, gap: 0.3, start: 4 },
    { type: 'forkbomb', count: 8, gap: 0.9, start: 8 },
    { type: 'spaghetti', count: 7, gap: 1.1, start: 12 },
    { type: 'segfault', count: 3, gap: 4.5, start: 18 },
    { type: 'legacy', count: 1, gap: 1, start: 34 } ] }
];

const START_COMMITS = 175;
const START_UPTIME = 100;

// Late sprints spawn MORE bugs (not just tankier ones) so concentrated late-game
// DPS gets overwhelmed. Kicks in only after sprint 5 — early waves stay as-authored.
// sprint idx 0-5: ×1.0 · sprint 8: ×1.24 · sprint 11: ×1.48
function waveCountMult(idx) { return 1 + Math.max(0, idx - 5) * 0.08; }

// ---- Spells -----------------------------------------------------------------
const SPELLS = {
  breakpoint: { name: 'Breakpoint', key: 'Q', cost: 40, cd: 12, radius: 110, dur: 3.2,
    blurb: 'Pauses all execution in an area (freeze).' },
  hotfix: { name: 'Hotfix', key: 'W', cost: 70, cd: 18, radius: 95, dmg: 280,
    blurb: 'kill -9. A burst nuke that deletes bugs in range.' },
  patch: { name: 'Patch', key: 'E', cost: 55, cd: 15, radius: 100, dur: 5, dps: 38,
    blurb: 'Deprecating cloud — damage over time (poison).' }
};
const SPELL_ORDER = ['breakpoint', 'hotfix', 'patch'];
