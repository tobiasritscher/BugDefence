/* ============================================================
   BUG DEFENCE — ui.js
   DOM screens, HUD, palette, spell bar, roster, bestiary,
   overlays, canvas input. Wires into GAME.
   ============================================================ */

const UI = (() => {
  let canvas, ctx, boardWrap, scale = 1;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  function iconCanvas(drawFn, w, h) {
    const c = el('canvas'); c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px';
    const x = c.getContext('2d'); x.scale(2, 2); drawFn(x, w, h); return c;
  }

  // ---------- screens ----------
  function show(name) {
    GAME.S.screen = name === 'game' ? 'play' : name;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 'screen-' + name));
    if (name === 'game') { resize(); }
  }

  // ---------- board sizing ----------
  function resize() {
    if (!boardWrap) return;
    const pad = 8;
    const w = boardWrap.clientWidth - pad * 2, h = boardWrap.clientHeight - pad * 2;
    scale = Math.min(w / BOARD_W, h / BOARD_H);
    scale = Math.max(0.1, scale);
    canvas.style.width = BOARD_W * scale + 'px';
    canvas.style.height = BOARD_H * scale + 'px';
  }

  function evtPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  // ---------- HUD ----------
  function buildHUD() {
    const top = $('#hud-top');
    top.innerHTML = `
      <div class="hud-brand"><span class="logo-dot"></span>BUG&nbsp;DEFENCE</div>
      <div class="hud-stat" id="st-uptime">
        <div class="hud-k">UPTIME</div>
        <div class="hud-bar"><span id="uptime-fill"></span></div>
        <div class="hud-v" id="uptime-val">100%</div>
      </div>
      <div class="hud-stat"><div class="hud-k">COMMITS</div><div class="hud-v big" id="commits-val">0</div></div>
      <div class="hud-stat"><div class="hud-k" id="sprint-k">SPRINT</div><div class="hud-v big" id="sprint-val">1 / 10</div></div>
      <div class="hud-stat grow"><div class="hud-k">INCOMING</div><div class="hud-bar wide"><span id="wave-fill"></span></div><div class="hud-v" id="bugs-val">—</div></div>
      <div class="hud-ctrls">
        <button class="ic-btn" id="btn-pause" title="Pause (Space)">❚❚</button>
        <button class="ic-btn spd" data-spd="1">1×</button>
        <button class="ic-btn spd" data-spd="2">2×</button>
        <button class="ic-btn" id="btn-menu" title="Menu">≡</button>
      </div>`;
    top.querySelector('#btn-pause').onclick = () => { GAME.togglePause(); syncCtrls(); };
    top.querySelectorAll('.spd').forEach(b => b.onclick = () => { GAME.setSpeed(+b.dataset.spd); GAME.S.paused = false; syncCtrls(); });
    top.querySelector('#btn-menu').onclick = () => { show('menu'); };
  }
  function syncCtrls() {
    $('#btn-pause').classList.toggle('active', GAME.S.paused);
    $('#btn-pause').textContent = GAME.S.paused ? '▶' : '❚❚';
    document.querySelectorAll('.spd').forEach(b => b.classList.toggle('active', !GAME.S.paused && +b.dataset.spd === GAME.S.speed));
  }

  // ---------- dock: tower palette + spells + selection ----------
  function buildDock() {
    const pal = $('#palette'); pal.innerHTML = '';
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const card = el('button', 'tw-card');
      card.dataset.type = type;
      const ic = iconCanvas((x, w, h) => ART.drawTower(x, type, w / 2, h / 2 + 6, 44, 0, 0, RENDER.towerColor(type)), 52, 52);
      card.appendChild(ic);
      card.appendChild(el('div', 'tw-name', def.name));
      card.appendChild(el('div', 'tw-cost', '◆ ' + def.cost));
      card.appendChild(el('div', 'tw-key', (i + 1) + ''));
      card.onclick = () => selectPlacing(type);
      card.onmouseenter = () => showTowerTip(type, card);
      card.onmouseleave = hideTip;
      pal.appendChild(card);
    });
    const sp = $('#spells'); sp.innerHTML = '';
    SPELL_ORDER.forEach(name => {
      const s = SPELLS[name];
      const b = el('button', 'sp-card'); b.dataset.spell = name;
      b.appendChild(el('div', 'sp-key', s.key));
      const ic = iconCanvas((x, w, h) => ART.drawSpell(x, name, w / 2, h / 2, 36, 0), 42, 42);
      ic.className = 'sp-ic';
      b.appendChild(ic);
      b.appendChild(el('div', 'sp-name', s.name));
      b.appendChild(el('div', 'sp-cost', '◆ ' + s.cost));
      const cd = el('div', 'sp-cd'); cd.appendChild(el('span')); b.appendChild(cd);
      b.onclick = () => selectSpell(name);
      b.onmouseenter = () => showSpellTip(name, b);
      b.onmouseleave = hideTip;
      sp.appendChild(b);
    });
  }

  // ---------- info tooltip (tower / spell details during play) ----------
  let tip;
  function ensureTip() { if (!tip) { tip = el('div', 'info-tip'); document.body.appendChild(tip); } return tip; }
  function statLine(L, def) {
    return [
      L.dmg ? `${L.dmg} dmg` : null, (L.rate && L.dmg) ? `${(1 / L.rate).toFixed(1)}/s` : null,
      L.splash ? `splash ${L.splash}` : null, L.range ? `rng ${L.range}` : null,
      L.slow ? `slow ${Math.round(L.slow * 100)}%` : null, L.burn ? `burn ${L.burn}/s` : null,
      L.stun ? `stun ${L.stun}s` : null, L.pierce ? `pierce ${L.pierce > 50 ? '∞' : L.pierce}` : null,
      L.refund ? `refund ◆${L.refund}` : null
    ].filter(Boolean).join(' · ');
  }
  function showTowerTip(type, anchor) {
    const def = TOWERS[type];
    const tiers = def.tiers.map((tn, i) => {
      const L = def.levels[i];
      const cost = i === 0 ? def.cost : L.upCost;
      return `<div class="tip-tier"><span class="tip-n">${i + 1}</span><div><div class="tip-tn">${tn}</div><div class="tip-ts">${statLine(L, def)}</div></div><span class="tip-tc">◆${cost}</span></div>`;
    }).join('');
    ensureTip().innerHTML = `<div class="tip-hd"><b>${def.name}</b><span>◆ ${def.cost}</span></div>
      <div class="tip-sub">${def.sub}</div>
      <p class="tip-blurb">${def.blurb}</p>
      <div class="tip-tree">${tiers}</div>`;
    placeTip(anchor);
  }
  function showSpellTip(name, anchor) {
    const s = SPELLS[name];
    const meta = [s.dmg ? `${s.dmg} dmg` : null, s.dps ? `${s.dps}/s` : null, s.dur ? `${s.dur}s` : null, `radius ${s.radius}`, `cooldown ${s.cd}s`].filter(Boolean).join(' · ');
    ensureTip().innerHTML = `<div class="tip-hd"><b>${s.name}</b><span>◆ ${s.cost} · ${s.key}</span></div>
      <p class="tip-blurb">${s.blurb}</p>
      <div class="tip-meta">${meta}</div>`;
    placeTip(anchor);
  }
  function placeTip(anchor) {
    tip.classList.add('on');
    const a = anchor.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let left = a.left + a.width / 2 - tr.width / 2;
    left = Math.max(10, Math.min(window.innerWidth - tr.width - 10, left));
    tip.style.left = left + 'px';
    tip.style.top = (a.top - tr.height - 10) + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('on'); }

  function selectPlacing(type) {
    if (GAME.S.commits < TOWERS[type].cost && !GAME.S.towers.length) {/*allow ghost*/}
    GAME.S.placing = GAME.S.placing === type ? null : type;
    GAME.S.castSpell = null; GAME.S.selected = null;
    syncDock();
  }
  function selectSpell(name) {
    if (!GAME.canCast(name)) return;
    GAME.S.castSpell = GAME.S.castSpell === name ? null : name;
    GAME.S.placing = null; GAME.S.selected = null;
    syncDock();
  }
  function syncDock() {
    document.querySelectorAll('.tw-card').forEach(c => {
      c.classList.toggle('sel', c.dataset.type === GAME.S.placing);
      c.classList.toggle('cant', GAME.S.commits < TOWERS[c.dataset.type].cost);
    });
    document.querySelectorAll('.sp-card').forEach(c => {
      c.classList.toggle('sel', c.dataset.spell === GAME.S.castSpell);
      c.classList.toggle('cant', !GAME.canCast(c.dataset.spell));
    });
    renderSelection();
  }

  // selKey tracks what's currently rendered so we DON'T rebuild the panel every
  // frame — rebuilding would destroy the upgrade/sell buttons mid-click.
  let selKey = null;
  function renderSelection(force) {
    const box = $('#sel-panel'); const t = GAME.S.selected;
    if (!t) { if (selKey !== null) { box.classList.remove('on'); selKey = null; } return; }
    const key = t.id + ':' + t.lvl;
    if (!force && key === selKey) {
      // cheap per-frame refresh: keep the upgrade button's affordability in sync
      const up = box.querySelector('#sel-up');
      if (up && t.lvl < 2) up.disabled = GAME.S.commits < t.def.levels[t.lvl + 1].upCost;
      return;
    }
    selKey = key;
    box.classList.add('on');
    const L = GAME.lvlData(t); const def = t.def;
    const canUp = t.lvl < 2;
    const upCost = canUp ? def.levels[t.lvl + 1].upCost : 0;
    box.innerHTML = `
      <div class="sel-hd"><b>${def.tiers[t.lvl]}</b><span>Lv ${t.lvl + 1}</span></div>
      <div class="sel-stats">
        ${L.dmg ? `<div><i>DMG</i>${L.dmg}</div>` : ''}
        ${L.rate ? `<div><i>RATE</i>${(1 / L.rate).toFixed(1)}/s</div>` : ''}
        <div><i>RANGE</i>${L.range || L.splash}</div>
        ${L.slow ? `<div><i>SLOW</i>${Math.round(L.slow * 100)}%</div>` : ''}
        ${L.burn ? `<div><i>BURN</i>${L.burn}/s</div>` : ''}
        ${L.pierce ? `<div><i>PIERCE</i>${L.pierce > 50 ? '∞' : L.pierce}</div>` : ''}
        ${L.refund ? `<div><i>REFUND</i>◆${L.refund}</div>` : ''}
      </div>
      <div class="sel-btns">
        <button id="sel-up" ${canUp && GAME.S.commits >= upCost ? '' : 'disabled'}>${canUp ? 'Upgrade ◆' + upCost : 'MAX'}</button>
        <button id="sel-sell" class="sell">Sell ◆${Math.round(t.invested * 0.7)}</button>
      </div>`;
    box.querySelector('#sel-up').onclick = () => { GAME.upgrade(t); renderSelection(true); };
    box.querySelector('#sel-sell').onclick = () => { GAME.sell(t); renderSelection(true); };
  }

  // ---------- run / wave control ----------
  function buildRunBar() {
    const r = $('#runbar');
    r.innerHTML = `<button id="run-btn">Run Sprint ▶</button><div id="run-hint">Place your toolkit, then ship the sprint.</div>`;
    r.querySelector('#run-btn').onclick = () => { GAME.runSprint(); };
  }

  // ---------- per-frame HUD sync ----------
  function tickHUD() {
    const S = GAME.S;
    const up = Math.max(0, S.uptime);
    $('#uptime-val').textContent = Math.round(up) + '%';
    const uf = $('#uptime-fill'); uf.style.width = up + '%';
    uf.style.background = up > 30 ? 'var(--health)' : 'var(--danger)';
    $('#commits-val').textContent = '◆ ' + Math.round(S.commits);
    const isFinal = S.sprint >= WAVES.length - 1;
    $('#sprint-k').textContent = isFinal ? 'FINAL' : 'SPRINT';
    $('#sprint-val').textContent = isFinal ? 'RELEASE' : (S.sprint + 1) + ' / ' + WAVES.length;
    // wave progress
    const total = waveTotal(S.sprint);
    if (S.waveActive) {
      const remaining = S.enemies.length + S.spawnQ.length;
      $('#bugs-val').textContent = remaining + ' bugs';
      $('#wave-fill').style.width = (100 * (1 - remaining / Math.max(1, total))) + '%';
    } else { $('#bugs-val').textContent = 'ready'; $('#wave-fill').style.width = '0%'; }
    // run bar
    const rb = $('#run-btn');
    if (rb) { rb.style.display = S.waveActive ? 'none' : ''; $('#run-hint').style.display = S.waveActive ? 'none' : ''; }
    // spell cooldown rings
    document.querySelectorAll('.sp-card').forEach(c => {
      const cd = S.spellCd[c.dataset.spell], max = SPELLS[c.dataset.spell].cd;
      c.querySelector('.sp-cd span').style.height = (cd > 0 ? (cd / max * 100) : 0) + '%';
    });
    syncDock();
    syncCtrls();
  }
  function waveTotal(idx) { const m = waveCountMult(idx); return WAVES[idx].groups.reduce((a, g) => a + Math.round(g.count * m) * (ENEMIES[g.type].pairs || ENEMIES[g.type].linked ? 2 : 1), 0); }

  // ---------- input ----------
  function bindCanvas() {
    canvas.addEventListener('mousemove', e => { GAME.S.hover = evtPos(e); });
    canvas.addEventListener('mouseleave', () => { GAME.S.hover = null; });
    canvas.addEventListener('click', e => {
      const p = evtPos(e); const S = GAME.S;
      if (S.placing) { if (GAME.place(S.placing, p.x, p.y)) { if (GAME.S.commits < TOWERS[S.placing].cost) S.placing = null; } syncDock(); return; }
      if (S.castSpell) { GAME.cast(S.castSpell, p.x, p.y); syncDock(); return; }
      const t = GAME.towerAt(p.x, p.y); S.selected = t || null; renderSelection();
    });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); cancelAll(); });
  }
  function cancelAll() { GAME.S.placing = null; GAME.S.castSpell = null; GAME.S.selected = null; syncDock(); }

  function bindKeys() {
    window.addEventListener('keydown', e => {
      if (GAME.S.screen !== 'play') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') return cancelAll();
      if (k === ' ') { e.preventDefault(); GAME.togglePause(); syncCtrls(); return; }
      if (k >= '1' && k <= '7') { selectPlacing(TOWER_ORDER[+k - 1]); return; }
      if (k === 'q') return selectSpell('breakpoint');
      if (k === 'w') return selectSpell('hotfix');
      if (k === 'e') return selectSpell('patch');
      if (k === 'enter') GAME.runSprint();
    });
  }

  // ---------- overlays ----------
  function sprintComplete(idx) {
    const o = $('#overlay'); o.className = 'overlay on';
    const next = idx + 1, isFinalNext = next >= WAVES.length - 1;
    o.innerHTML = `
      <div class="ov-card">
        <div class="ov-tag">BUILD GREEN</div>
        <h2>${WAVES[idx].label} shipped</h2>
        <p>Production survived. Commit the win and brace for the next push.</p>
        <div class="ov-row"><span>Uptime</span><b>${Math.round(GAME.S.uptime)}%</b></div>
        <div class="ov-row"><span>Bugs squashed</span><b>${GAME.S.stats.kills}</b></div>
        <div class="ov-row"><span>Sprint bonus</span><b class="bonus">+◆ ${GAME.S.lastBonus}</b></div>
        <div class="ov-row"><span>Commits banked</span><b>◆ ${Math.round(GAME.S.commits)}</b></div>
        <button id="ov-next">${isFinalNext ? 'Face the Release Deadline' : 'Start ' + WAVES[next].label} ▶</button>
      </div>`;
    o.querySelector('#ov-next').onclick = () => { GAME.nextSprint(); o.className = 'overlay'; };
  }

  function gameOver(win) {
    const o = $('#overlay'); o.className = 'overlay on ' + (win ? 'win' : 'lose');
    const mi = GAME.S.mapIndex, hasNext = win && mi < MAPS.length - 1;
    const nextBtn = hasNext ? `<button id="ov-next">Next map: ${MAPS[mi + 1].name} ▶</button>` : '';
    o.innerHTML = `
      <div class="ov-card big">
        <div class="ov-tag ${win ? 'g' : 'r'}">${win ? '✓ DEPLOYED' : '✗ PRODUCTION DOWN'}</div>
        <h2>${win ? MAPS[mi].name + ' shipped.' : 'Kernel Panic.'}</h2>
        <p>${win ? (hasNext ? 'Build is green. A tougher battlefield is waiting — keep the streak going.' : 'You cleared every map. The Production Server is yours. We Know How.') : 'The bugs reached Production and uptime hit zero. Roll back and try again.'}</p>
        <div class="ov-row"><span>Map</span><b>${MAPS[mi].name}</b></div>
        <div class="ov-row"><span>Sprints cleared</span><b>${win ? WAVES.length : GAME.S.sprint} / ${WAVES.length}</b></div>
        <div class="ov-row"><span>Bugs squashed</span><b>${GAME.S.stats.kills}</b></div>
        <div class="ov-row"><span>Bugs leaked</span><b>${GAME.S.stats.leaked}</b></div>
        <div class="ov-btns">${nextBtn}<button id="ov-retry" ${hasNext ? 'class="ghost"' : ''}>Replay map</button><button id="ov-menu" class="ghost">Level select</button></div>
      </div>`;
    if (hasNext) o.querySelector('#ov-next').onclick = () => { startGame(mi + 1); };
    o.querySelector('#ov-retry').onclick = () => { startGame(mi); };
    o.querySelector('#ov-menu').onclick = () => { $('#overlay').className = 'overlay'; show('levels'); };
  }

  // ---------- roster + bestiary ----------
  function buildRoster() {
    const g = $('#roster-grid'); g.innerHTML = '';
    TOWER_ORDER.forEach(type => {
      const def = TOWERS[type];
      const card = el('div', 'rcard');
      const head = el('div', 'rcard-hd');
      head.appendChild(iconCanvas((x, w, h) => ART.drawTower(x, type, w / 2, h / 2 + 8, 60, 0, 2, RENDER.towerColor(type)), 76, 76));
      head.appendChild(el('div', 'rcard-meta', `<div class="rname">${def.name}</div><div class="rsub">${def.sub}</div><div class="rcost">◆ ${def.cost}</div>`));
      card.appendChild(head);
      card.appendChild(el('p', 'rblurb', def.blurb));
      const tree = el('div', 'tree');
      def.tiers.forEach((tn, i) => {
        const L = def.levels[i];
        const step = el('div', 'tier');
        const stats = [
          L.dmg ? `${L.dmg} dmg` : null, L.rate && L.dmg ? `${(1 / L.rate).toFixed(1)}/s` : null,
          L.splash ? `splash ${L.splash}` : null, L.range ? `rng ${L.range}` : null,
          L.slow ? `slow ${Math.round(L.slow * 100)}%` : null, L.burn ? `burn ${L.burn}/s` : null,
          L.stun ? `stun ${L.stun}s` : null, L.pierce ? `pierce ${L.pierce > 50 ? '∞' : L.pierce}` : null,
          L.refund ? `refund ◆${L.refund}` : null
        ].filter(Boolean).join(' · ');
        step.innerHTML = `<div class="tier-n">${i + 1}</div><div><div class="tier-name">${tn}</div><div class="tier-stat">${stats}</div></div><div class="tier-cost">${i === 0 ? '◆' + def.cost : '◆' + L.upCost}</div>`;
        tree.appendChild(step);
      });
      card.appendChild(tree);
      g.appendChild(card);
    });
  }

  function buildBestiary() {
    const g = $('#bestiary-grid'); g.innerHTML = '';
    ENEMY_ORDER.forEach(type => {
      const def = ENEMIES[type];
      const card = el('div', 'bcard' + (def.boss ? ' boss' : ''));
      const head = el('div', 'bcard-hd');
      head.appendChild(iconCanvas((x, w, h) => ART.drawCreature(x, type, w / 2, h / 2, Math.min(w, h) * 0.32, 0.6, { hp: 1, maxHp: 1, stack: type === 'stackoverflow' ? 3 : 1, grow: type === 'memleak' ? 1.4 : 1 }), 88, 78));
      head.appendChild(el('div', 'bcard-meta', `<div class="bname">${def.name}</div><div class="btag">${def.tag}</div>`));
      card.appendChild(head);
      card.appendChild(el('p', 'bblurb', def.blurb));
      const stats = el('div', 'bstats');
      stats.innerHTML = `<div><i>HP</i>${def.hp}</div><div><i>SPEED</i>${def.speed}</div><div><i>REWARD</i>◆${def.reward}</div><div><i>UPTIME COST</i>${def.leak}%</div>`;
      card.appendChild(stats);
      const dots = '●'.repeat(def.threat) + '○'.repeat(6 - def.threat);
      card.appendChild(el('div', 'bthreat', `<span>THREAT</span><b>${dots}</b>`));
      g.appendChild(card);
    });
  }

  // ---------- level select ----------
  function drawMapPreview(x, w, h, map) {
    x.fillStyle = THEME.bg; x.fillRect(0, 0, w, h);
    const sx = w / BOARD_W, sy = h / BOARD_H;
    const pts = map.path.map(([c, r]) => ({ x: (c * GRID.CELL + GRID.CELL / 2) * sx, y: (r * GRID.CELL + GRID.CELL / 2) * sy }));
    // faint grid
    x.strokeStyle = THEME.grid; x.lineWidth = 1; x.globalAlpha = 0.5;
    for (let c = 0; c <= GRID.COLS; c += 2) { x.beginPath(); x.moveTo(c * GRID.CELL * sx, 0); x.lineTo(c * GRID.CELL * sx, h); x.stroke(); }
    for (let r = 0; r <= GRID.ROWS; r += 2) { x.beginPath(); x.moveTo(0, r * GRID.CELL * sy); x.lineTo(w, r * GRID.CELL * sy); x.stroke(); }
    x.globalAlpha = 1;
    // path
    x.lineJoin = x.lineCap = 'round';
    x.strokeStyle = THEME.path; x.lineWidth = 11;
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y); x.stroke();
    x.strokeStyle = THEME.pathGlow; x.globalAlpha = 0.7; x.lineWidth = 2;
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i].x, pts[i].y); x.stroke();
    x.globalAlpha = 1;
    // spawn + core markers
    x.fillStyle = THEME.danger; x.beginPath(); x.arc(pts[0].x, pts[0].y, 4, 0, 7); x.fill();
    const core = pts[pts.length - 1];
    x.fillStyle = THEME.core; x.beginPath(); x.arc(core.x, core.y, 5.5, 0, 7); x.fill();
    x.strokeStyle = THEME.health; x.lineWidth = 1.5; x.beginPath(); x.arc(core.x, core.y, 8, 0, 7); x.stroke();
  }

  function buildLevels() {
    const g = $('#levels-grid'); if (!g) return; g.innerHTML = '';
    MAPS.forEach((map, i) => {
      const card = el('div', 'lcard');
      const cv = iconCanvas((x, w, h) => drawMapPreview(x, w, h, map), 300, 180);
      cv.className = 'lprev';
      cv.style.width = '100%'; cv.style.height = 'auto';
      card.appendChild(cv);
      const body = el('div', 'lbody');
      body.innerHTML = `<div class="lhd"><div class="lname">${map.name}</div><div class="ldiff d${i}">${map.difficulty}</div></div>
        <p class="lsub">${map.sub}</p>`;
      const play = el('button', 'lplay', '▶ Defend this');
      play.onclick = () => startGame(i);
      body.appendChild(play);
      card.appendChild(body);
      g.appendChild(card);
    });
  }

  // ---------- start ----------
  function startGame(mapIndex) {
    const i = (mapIndex == null) ? GAME.S.mapIndex : mapIndex;
    $('#overlay').className = 'overlay';
    GAME.loadMap(i); GAME.reset(); show('game'); resize(); syncDock(); renderSelection();
  }

  function init() {
    canvas = $('#board'); ctx = canvas.getContext('2d');
    canvas.width = BOARD_W; canvas.height = BOARD_H;
    boardWrap = $('#board-wrap');
    buildHUD(); buildDock(); buildRunBar(); buildRoster(); buildBestiary(); buildLevels();
    bindCanvas(); bindKeys();
    window.addEventListener('resize', resize);
    // menu buttons
    $('#m-play').onclick = () => show('levels');
    $('#m-roster').onclick = () => show('roster');
    $('#m-bestiary').onclick = () => show('bestiary');
    document.querySelectorAll('.back-btn').forEach(b => b.onclick = () => show('menu'));
    // callbacks
    GAME.on('onSprintComplete', sprintComplete);
    GAME.on('onGameOver', gameOver);
    GAME.on('hit', () => {});
    show('menu');
  }

  function render(t) {
    if (GAME.S.screen === 'play') { RENDER.frame(ctx, t); tickHUD(); }
  }

  return { init, render, resize, refreshTheme() { buildDock(); buildRoster(); buildBestiary(); buildLevels(); } };
})();
