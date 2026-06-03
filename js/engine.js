/* ============================================================
   BUG DEFENCE — engine.js
   Game state, spawning, movement, combat, towers, projectiles,
   spells, economy, win/lose. Path geometry lives in config.js
   (globals: segs, pathLen, posAt, pathCells, LOOP_AT, LOOP_BACK).
   Exposes a single global: GAME
   ============================================================ */

const GAME = (() => {
  // ---------- state ----------
  const S = {
    screen: 'menu', mapIndex: 0, uptime: START_UPTIME, commits: START_COMMITS,
    sprint: 0, waveActive: false, spawnQ: [], waveTime: 0, spawnedTotal: 0,
    enemies: [], towers: [], projectiles: [], effects: [], floaters: [], trail: [],
    speed: 1, paused: false, time: 0,
    placing: null, castSpell: null, selected: null, hover: null,
    spellCd: { breakpoint: 0, hotfix: 0, patch: 0 },
    result: null, lastBonus: 0, stats: { kills: 0, leaked: 0 }
  };
  let nextId = 1;

  const cb = {}; // ui/audio listeners (arrays): onSprintComplete, onGameOver, onChange, hit, fire, kill, shield, place, upgrade, sell, cast, sprintStart
  function on(name, fn) { (cb[name] || (cb[name] = [])).push(fn); }
  function emit(name, ...a) { const l = cb[name]; if (l) for (const fn of l) fn(...a); }

  // ---------- lifecycle ----------
  function loadMap(i) { S.mapIndex = i; setMap(i); }

  function reset() {
    Object.assign(S, {
      uptime: START_UPTIME, commits: START_COMMITS, sprint: 0, waveActive: false,
      spawnQ: [], waveTime: 0, spawnedTotal: 0, enemies: [], towers: [], projectiles: [],
      effects: [], floaters: [], trail: [], speed: 1, paused: false,
      placing: null, castSpell: null, selected: null, hover: null,
      spellCd: { breakpoint: 0, hotfix: 0, patch: 0 }, result: null, stats: { kills: 0, leaked: 0 }
    });
  }

  function buildSpawnQueue(idx) {
    const q = [];
    const mult = waveCountMult(idx);
    WAVES[idx].groups.forEach(g => {
      const n = Math.round(g.count * mult);
      for (let i = 0; i < n; i++) q.push({ type: g.type, t: g.start + i * g.gap });
    });
    q.sort((a, b) => a.t - b.t);
    return q;
  }

  function runSprint() {
    if (S.waveActive) return;
    S.spawnQ = buildSpawnQueue(S.sprint);
    S.waveTime = 0; S.spawnedTotal = 0; S.waveActive = true;
    emit('onChange'); emit('sprintStart');
  }

  function nextSprint() {
    if (S.sprint >= WAVES.length - 1) { return; }
    S.sprint++; S.waveActive = false;
    emit('onChange');
  }

  // ---------- spawning ----------
  // Difficulty: per-map multiplier × a per-sprint ramp (later sprints tougher).
  // Ramp is quadratic so early sprints stay gentle while late sprints spike hard
  // (player power + the sprint bonus compound, so enemy HP must accelerate to
  // out-pace the richer late economy or the back half goes trivial).
  // A late surge (from sprint 6, via `late`) sharpens the back half so a maxed board stops coasting.
  // sprint 0: ×1.0 · sprint 5: ×1.47 · sprint 7: ×2.04 · sprint 9: ×3.06 · sprint 11: ×4.53
  function hpMult() { const late = Math.max(0, S.sprint - 5); return DIFFICULTY * (1 + S.sprint * 0.014 + S.sprint * S.sprint * 0.016 + late * late * 0.040); }
  function spdMult() { return 1 + (DIFFICULTY - 1) * 0.45; }
  // Commits awarded for clearing a sprint — scales, but kept modest so it eases
  // the harder late waves without letting the player snowball past them.
  function sprintBonus() { return 25 + S.sprint * 10; }

  function spawnEnemy(type, linkId, opts) {
    const def = ENEMIES[type];
    const m = hpMult();
    const e = {
      id: nextId++, type, def, dead: false, reached: false,
      dist: -Math.random() * 8, r: def.r, scale: 1,
      slowT: 0, freezeT: 0, poison: null, burnT: 0, grow: 1, cloaked: false, cloakT: Math.random() * 1.2,
      stack: 1, looped: false, linkId: linkId || null, linkBroken: false, wob: Math.random() * 6,
      revived: false, isSplit: false
    };
    // bosses scale more gently so they stay killable but still threatening
    e.maxHp = def.hp * (def.boss ? (1 + (DIFFICULTY - 1) + S.sprint * 0.06) : m);
    e.hp = e.maxHp;
    e.baseSpeed = def.speed * spdMult();
    e.speed = e.baseSpeed;
    e.reward = def.reward;
    e.shield = def.shield ? def.shield * DIFFICULTY : 0;
    e.maxShield = e.shield;
    if (opts) Object.assign(e, opts);
    S.enemies.push(e);
    return e;
  }

  function processSpawns(dt) {
    if (!S.waveActive) return;
    S.waveTime += dt;
    while (S.spawnQ.length && S.spawnQ[0].t <= S.waveTime) {
      const item = S.spawnQ.shift();
      const def = ENEMIES[item.type];
      if (def.pairs) { spawnEnemy(item.type); const e2 = spawnEnemy(item.type); e2.dist = -18; }
      else if (def.linked) { const lid = nextId; const a = spawnEnemy(item.type, lid); const b = spawnEnemy(item.type, lid); b.dist = a.dist - 4; }
      else spawnEnemy(item.type);
      S.spawnedTotal++;
    }
  }

  // ---------- damage ----------
  function damage(e, amt, kind) {
    if (e.dead) return;
    let dmg = amt;
    const def = e.def;
    if (def.armor && (kind === 'shooter' || kind === 'sniper')) dmg *= (1 - def.armor);
    if (def.linked && !e.linkBroken) dmg *= 0.3;
    // shield soaks first
    if (e.shield > 0) {
      const soak = Math.min(e.shield, dmg);
      e.shield -= soak; dmg -= soak;
      if (e.shield <= 0) { S.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 8, life: 0.3, max: 0.3, col: '#7dcfff' }); emit('shield'); }
    }
    if (dmg <= 0) return;
    e.hp -= dmg;
    // deadlock: break link when either drops low
    if (def.linked && !e.linkBroken && e.hp / e.maxHp < 0.45) {
      S.enemies.forEach(o => { if (o.linkId === e.linkId) o.linkBroken = true; });
    }
    if (dmg > 0.5) S.floaters.push({ x: e.x, y: e.y - e.r, text: Math.round(dmg), life: 0.6, max: 0.6, col: '#fff' });
    if (e.hp <= 0) {
      // zombie: stand up once instead of dying
      if (def.revives && !e.revived) {
        e.revived = true; e.hp = e.maxHp * 0.45;
        S.effects.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 10, life: 0.5, max: 0.5, col: '#a3be5c' });
        S.floaters.push({ x: e.x, y: e.y - e.r, text: 'respawn', life: 0.9, max: 0.9, col: '#a3be5c' });
        return;
      }
      kill(e);
    }
  }

  function kill(e) {
    if (e.dead) return;
    e.dead = true; S.stats.kills++;
    S.commits += e.reward;
    S.floaters.push({ x: e.x, y: e.y - e.r, text: '+' + e.reward, life: 0.9, max: 0.9, col: THEME.commits });
    for (let i = 0; i < 8; i++) S.effects.push({ kind: 'spark', x: e.x, y: e.y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, life: 0.4, max: 0.4, col: ART.BUG[e.type].body });
    // fork bomb: split into two smaller copies
    if (e.def.splits && !e.isSplit) {
      for (let k = 0; k < 2; k++) {
        const c = spawnEnemy(e.type, null, { isSplit: true, scale: 0.66, r: e.def.r * 0.66 });
        c.maxHp = Math.max(14, e.maxHp * 0.42); c.hp = c.maxHp;
        c.reward = 3; c.dist = Math.max(0, e.dist + (k ? -12 : 8));
        c.baseSpeed = e.baseSpeed * 1.12; c.speed = c.baseSpeed;
      }
    }
    emit('kill', e);
  }

  // ---------- movement ----------
  function moveEnemies(dt) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      // status timers
      if (e.slowT > 0) e.slowT -= dt;
      if (e.freezeT > 0) e.freezeT -= dt;
      if (e.burnT > 0) { e.burnT -= dt; damage(e, e.burnDps * dt, 'burn'); }
      if (e.poison) { e.poison.t -= dt; damage(e, e.poison.dps * dt, 'poison'); if (e.poison.t <= 0) e.poison = null; }
      if (e.dead) continue;
      // memleak grows
      if (e.def.grows) { e.grow = Math.min(1.7, e.grow + dt * 0.05); e.r = e.def.r * e.grow; }
      // timeout accelerates while alive (unless held)
      if (e.def.accelerates && e.freezeT <= 0) e.baseSpeed = Math.min(e.def.speed * spdMult() * 2.4, e.baseSpeed + dt * 13);
      // heisenbug cloak cycle
      if (e.def.cloaks) { e.cloakT -= dt; if (e.cloakT <= 0) { e.cloaked = !e.cloaked; e.cloakT = e.cloaked ? 1.1 : 1.6; } }
      // speed
      let sp = e.baseSpeed;
      if (e.freezeT > 0) sp = 0;
      else if (e.slowT > 0) sp *= (1 - e.slowMul);
      e.dist += sp * dt;
      // infinite loop
      if (e.def.loops && !e.looped && e.dist >= LOOP_AT) { e.dist -= LOOP_BACK; e.looped = true; S.floaters.push({ x: e.x, y: e.y - e.r, text: 'goto', life: 0.8, max: 0.8, col: '#e0af68' }); }
      const p = posAt(e.dist);
      e.x = p.x; e.y = p.y; e.ang = p.ang;
      // memleak slime trail
      if (e.def.grows && Math.random() < 0.3) S.trail.push({ x: e.x, y: e.y, r: e.r * 0.8, life: 2.2, max: 2.2 });
      if (e.dist >= pathLen) { e.reached = true; e.dead = true; S.uptime -= e.def.leak; S.stats.leaked++; emit('hit'); }
    }
  }

  // ---------- towers ----------
  function place(type, cx, cy) {
    const col = Math.floor(cx / GRID.CELL), row = Math.floor(cy / GRID.CELL);
    if (!canBuild(col, row)) return false;
    const def = TOWERS[type];
    if (S.commits < def.cost) return false;
    S.commits -= def.cost;
    const ctr = cellCenter(col, row);
    S.towers.push({ id: nextId++, type, def, col, row, x: ctr.x, y: ctr.y, lvl: 0, cd: 0, ang: -Math.PI / 2, invested: def.cost });
    emit('onChange'); emit('place');
    return true;
  }
  function canBuild(col, row) {
    if (col < 0 || row < 0 || col >= GRID.COLS || row >= GRID.ROWS) return false;
    if (pathCells.has(col + ',' + row)) return false;
    return !S.towers.some(t => t.col === col && t.row === row);
  }
  function towerAt(cx, cy) {
    const col = Math.floor(cx / GRID.CELL), row = Math.floor(cy / GRID.CELL);
    return S.towers.find(t => t.col === col && t.row === row) || null;
  }
  function lvlData(t) { return t.def.levels[t.lvl]; }
  function upgrade(t) {
    if (t.lvl >= 2) return false;
    const cost = t.def.levels[t.lvl + 1].upCost;
    if (S.commits < cost) return false;
    S.commits -= cost; t.invested += cost; t.lvl++; emit('onChange'); emit('upgrade'); return true;
  }
  function sell(t) {
    const refund = Math.round(t.invested * 0.7);
    S.commits += refund;
    S.towers = S.towers.filter(x => x !== t);
    if (S.selected === t) S.selected = null;
    S.floaters.push({ x: t.x, y: t.y, text: '+' + refund, life: 0.9, max: 0.9, col: THEME.commits });
    emit('onChange'); emit('sell');
  }

  function targetable(e, allowCloak) {
    return !e.dead && !e.reached && (allowCloak || !e.cloaked);
  }
  function inRange(t, e, rng) { return Math.hypot(e.x - t.x, e.y - t.y) <= rng; }
  function bestTarget(t, rng) {
    let best = null, bd = -1;
    for (const e of S.enemies) {
      if (!targetable(e)) continue;
      if (!inRange(t, e, rng)) continue;
      if (e.dist > bd) { bd = e.dist; best = e; }
    }
    return best;
  }

  function fireTowers(dt) {
    for (const t of S.towers) {
      const L = lvlData(t);
      t.cd -= dt;
      const k = t.def.kind;
      if (k === 'control') {
        // continuous slow field
        for (const e of S.enemies) if (targetable(e, true) && inRange(t, e, L.range)) { e.slowT = 0.12; e.slowMul = L.slow; }
        continue;
      }
      if (k === 'gc') {
        if (t.cd <= 0) {
          t.cd = L.rate; let swept = false;
          for (const e of S.enemies) if (targetable(e, true) && inRange(t, e, L.range) && e.hp / e.maxHp <= L.threshold && !e.def.boss) {
            kill(e); S.commits += L.refund; swept = true;
          }
          if (swept) { S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.4, max: 0.4, col: '#9ece6a' }); emit('fire', 'gc'); }
        }
        continue;
      }
      if (k === 'burn') {
        if (t.cd <= 0) {
          t.cd = L.rate; let hit = false;
          for (const e of S.enemies) if (targetable(e, true) && inRange(t, e, L.range)) { damage(e, L.dmg, 'burn'); e.burnT = 1.2; e.burnDps = L.burn; hit = true; }
          if (hit) { S.effects.push({ kind: 'ring', x: t.x, y: t.y, r: L.range, life: 0.3, max: 0.3, col: '#ff9e64' }); emit('fire', 'burn'); }
        }
        continue;
      }
      // projectile towers: melee/shooter/sniper/pierce
      const tgt = bestTarget(t, L.range);
      if (tgt) t.ang = Math.atan2(tgt.y - t.y, tgt.x - t.x);
      if (t.cd > 0 || !tgt) continue;
      t.cd = L.rate;
      if (k === 'melee') {
        // instant splash slap around tower
        S.effects.push({ kind: 'slap', x: t.x, y: t.y, r: L.splash, life: 0.22, max: 0.22, col: '#fff' });
        for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - t.x, e.y - t.y) <= L.splash) damage(e, L.dmg, 'melee');
        emit('fire', 'melee');
      } else {
        const ang = t.ang;
        const proj = { id: nextId++, x: t.x, y: t.y - 8, vx: Math.cos(ang) * L.proj, vy: Math.sin(ang) * L.proj, dmg: L.dmg, kind: k, life: 1.4, color: projColor(k) };
        if (k === 'pierce') { proj.pierce = L.pierce; proj.hits = new Set(); proj.life = 1.0; }
        if (k === 'sniper') { proj.target = tgt; proj.stun = L.stun; proj.life = 1.0; }
        S.projectiles.push(proj);
        emit('fire', k);
      }
    }
  }
  function projColor(k) {
    if (k === 'shooter') return '#f7768e';
    if (k === 'sniper') return '#7dcfff';
    if (k === 'pierce') return '#9ece6a';
    return '#fff';
  }

  function moveProjectiles(dt) {
    for (const p of S.projectiles) {
      p.life -= dt; if (p.life <= 0) { p.dead = true; continue; }
      // light homing for sniper
      if (p.kind === 'sniper' && p.target && !p.target.dead) {
        const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -40 || p.x > BOARD_W + 40 || p.y < -40 || p.y > BOARD_H + 40) { p.dead = true; continue; }
      for (const e of S.enemies) {
        if (!targetable(e, true)) continue;
        if (p.kind === 'pierce' && p.hits.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.r + 6) {
          damage(e, p.dmg, p.kind);
          if (p.kind === 'sniper') { e.freezeT = Math.max(e.freezeT, p.stun); p.dead = true; break; }
          if (p.kind === 'pierce') { p.hits.add(e.id); if (p.hits.size >= p.pierce) { p.dead = true; break; } }
          else { p.dead = true; break; }
        }
      }
    }
    S.projectiles = S.projectiles.filter(p => !p.dead);
  }

  // ---------- spells ----------
  function canCast(name) { return S.spellCd[name] <= 0 && S.commits >= SPELLS[name].cost; }
  function cast(name, x, y) {
    if (!canCast(name)) return false;
    const sp = SPELLS[name];
    S.commits -= sp.cost; S.spellCd[name] = sp.cd;
    if (name === 'breakpoint') {
      S.effects.push({ kind: 'freeze', x, y, r: sp.radius, life: sp.dur, max: sp.dur, col: '#7dcfff' });
      for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - x, e.y - y) <= sp.radius) e.freezeT = Math.max(e.freezeT, sp.dur);
    } else if (name === 'hotfix') {
      S.effects.push({ kind: 'nuke', x, y, r: sp.radius, life: 0.5, max: 0.5, col: '#ff9e64' });
      for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - x, e.y - y) <= sp.radius) damage(e, sp.dmg, 'melee');
    } else if (name === 'patch') {
      S.effects.push({ kind: 'cloud', x, y, r: sp.radius, life: sp.dur, max: sp.dur, col: '#9ece6a' });
      for (const e of S.enemies) if (targetable(e, true) && Math.hypot(e.x - x, e.y - y) <= sp.radius) e.poison = { t: sp.dur, dps: sp.dps };
    }
    S.castSpell = null; emit('cast', name); emit('onChange'); return true;
  }

  // ---------- effects/floaters ----------
  function updateFx(dt) {
    for (const f of S.floaters) { f.life -= dt; f.y -= dt * 26; }
    S.floaters = S.floaters.filter(f => f.life > 0);
    for (const e of S.effects) {
      e.life -= dt;
      if (e.kind === 'spark') { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.92; e.vy *= 0.92; }
      if (e.kind === 'cloud') { // re-poison lingering
        for (const en of S.enemies) if (targetable(en, true) && Math.hypot(en.x - e.x, en.y - e.y) <= e.r && (!en.poison)) en.poison = { t: 1, dps: SPELLS.patch.dps };
      }
      if (e.kind === 'freeze') {
        for (const en of S.enemies) if (targetable(en, true) && Math.hypot(en.x - e.x, en.y - e.y) <= e.r) en.freezeT = Math.max(en.freezeT, 0.15);
      }
    }
    S.effects = S.effects.filter(e => e.life > 0);
    for (const tr of S.trail) tr.life -= dt;
    S.trail = S.trail.filter(t => t.life > 0);
    for (const k in S.spellCd) if (S.spellCd[k] > 0) S.spellCd[k] = Math.max(0, S.spellCd[k] - dt);
  }

  // ---------- main update ----------
  function update(dt) {
    if (S.screen !== 'play' || S.paused) return;
    S.time += dt;
    processSpawns(dt);
    moveEnemies(dt);
    S.enemies = S.enemies.filter(e => !e.dead);
    fireTowers(dt);
    moveProjectiles(dt);
    updateFx(dt);
    // sprint complete?
    if (S.waveActive && S.spawnQ.length === 0 && S.enemies.length === 0) {
      S.waveActive = false;
      if (S.sprint >= WAVES.length - 1) { gameOver(true); }
      else {
        S.lastBonus = sprintBonus();
        S.commits += S.lastBonus;
        emit('onSprintComplete', S.sprint);
      }
    }
    if (S.uptime <= 0 && !S.result) { S.uptime = 0; gameOver(false); }
  }

  function gameOver(win) {
    S.result = win ? 'win' : 'lose';
    S.waveActive = false;
    emit('onGameOver', win);
  }

  // ---------- expose ----------
  return {
    S, on, reset, loadMap, runSprint, nextSprint, update,
    place, canBuild, towerAt, upgrade, sell, lvlData, cast, canCast,
    setSpeed(v) { S.speed = v; }, togglePause() { S.paused = !S.paused; }
  };
})();
