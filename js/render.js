/* ============================================================
   BUG DEFENCE — render.js
   Draws the board each frame from GAME.S into the canvas ctx.
   ============================================================ */

const RENDER = (() => {
  function clear(ctx) {
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  }

  function grid(ctx, t) {
    ctx.strokeStyle = THEME.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= GRID.COLS; c++) { ctx.moveTo(c * GRID.CELL, 0); ctx.lineTo(c * GRID.CELL, BOARD_H); }
    for (let r = 0; r <= GRID.ROWS; r++) { ctx.moveTo(0, r * GRID.CELL); ctx.lineTo(BOARD_W, r * GRID.CELL); }
    ctx.stroke();
    // circuit nodes on non-path intersections
    ctx.fillStyle = THEME.gridGlow;
    for (let c = 1; c < GRID.COLS; c += 2) for (let r = 1; r < GRID.ROWS; r += 2) {
      if (pathCells.has(c + ',' + r)) continue;
      ctx.beginPath(); ctx.arc(c * GRID.CELL, r * GRID.CELL, 1.6, 0, 7); ctx.fill();
    }
  }

  function path(ctx, t) {
    const pts = PATH_PTS;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // glow underlay
    ctx.strokeStyle = THEME.path; ctx.lineWidth = GRID.CELL * 0.86;
    line(ctx, pts); 
    // inner fill
    ctx.strokeStyle = THEME.bg; ctx.lineWidth = GRID.CELL * 0.7;
    line(ctx, pts);
    // edge rails
    ctx.strokeStyle = THEME.pathEdge; ctx.lineWidth = 2;
    railOffset(ctx, pts, GRID.CELL * 0.35); railOffset(ctx, pts, -GRID.CELL * 0.35);
    // flowing dashed centre (data flow)
    ctx.save();
    ctx.strokeStyle = THEME.pathGlow; ctx.globalAlpha = 0.5; ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 60;
    line(ctx, pts); ctx.restore();
  }
  function line(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); }
  function railOffset(ctx, pts, off) {
    // crude parallel rails by offsetting each segment perpendicular
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      const ox = Math.cos(ang) * off, oy = Math.sin(ang) * off;
      ctx.moveTo(a.x + ox, a.y + oy); ctx.lineTo(b.x + ox, b.y + oy);
    }
    ctx.stroke();
  }

  function spawnPortal(ctx, t) {
    const p = PATH_PTS[0];
    ctx.save(); ctx.translate(p.x + 14, p.y);
    ctx.strokeStyle = THEME.danger; ctx.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) { ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 8 + ((t * 30 + i * 14) % 42), 22, 0, 0, 7); ctx.stroke(); }
    ctx.restore();
  }

  function core(ctx, t) {
    const c = cellCenter(CORE_CELL[0], CORE_CELL[1]);
    const up = Math.max(0, GAME.S.uptime) / START_UPTIME;
    ctx.save(); ctx.translate(c.x, c.y);
    // glow
    const pulse = 0.5 + Math.sin(t * 2) * 0.1;
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
    g.addColorStop(0, hexA(THEME.coreGlow, 0.5 * pulse)); g.addColorStop(1, hexA(THEME.coreGlow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 64, 0, 7); ctx.fill();
    // server stack
    for (let i = 1; i >= -1; i--) {
      ctx.fillStyle = i === 0 ? THEME.core : THEME.panel;
      ART.roundRect(ctx, -22, i * 16 - 11, 44, 22, 4); ctx.fill();
      ctx.fillStyle = i === 0 ? '#fff' : THEME.muted;
      ctx.beginPath(); ctx.arc(-14, i * 16, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = THEME.health;
      for (let j = 0; j < 3; j++) { ctx.fillRect(-6 + j * 5, i * 16 - 1.5, 3, 3); }
    }
    // uptime ring
    ctx.lineWidth = 4; ctx.strokeStyle = THEME.panelEdge;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.stroke();
    ctx.strokeStyle = up > 0.3 ? THEME.health : THEME.danger;
    ctx.beginPath(); ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + up * Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function buildOverlay(ctx) {
    if (!GAME.S.placing) return;
    ctx.save(); ctx.globalAlpha = 0.10;
    for (let c = 0; c < GRID.COLS; c++) for (let r = 0; r < GRID.ROWS; r++) {
      if (GAME.canBuild(c, r)) { ctx.fillStyle = THEME.buildOk; ctx.fillRect(c * GRID.CELL + 2, r * GRID.CELL + 2, GRID.CELL - 4, GRID.CELL - 4); }
    }
    ctx.restore();
  }

  function rangeCircle(ctx, x, y, rng, ok) {
    ctx.save();
    ctx.fillStyle = hexA(ok ? THEME.buildOk : THEME.buildBad, 0.08);
    ctx.strokeStyle = hexA(ok ? THEME.buildOk : THEME.buildBad, 0.6);
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(x, y, rng, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function effects(ctx, t) {
    for (const e of GAME.S.effects) {
      const f = e.life / e.max;
      if (e.kind === 'spark') { ctx.globalAlpha = f; ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(e.x, e.y, 2.5, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      else if (e.kind === 'ring' || e.kind === 'slap') { ctx.globalAlpha = f; ctx.strokeStyle = e.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 - f) + (e.kind === 'slap' ? 8 : 0), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      else if (e.kind === 'freeze') { ctx.fillStyle = hexA('#7dcfff', 0.12 * f + 0.05); ctx.strokeStyle = hexA('#7dcfff', 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); ctx.stroke(); }
      else if (e.kind === 'cloud') { ctx.fillStyle = hexA('#9ece6a', 0.10 + 0.05 * Math.sin(t * 4)); ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill(); }
      else if (e.kind === 'nuke') { ctx.globalAlpha = f; const rg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r); rg.addColorStop(0, '#fff'); rg.addColorStop(0.5, '#ff9e64'); rg.addColorStop(1, hexA('#ff5d7a', 0)); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1.2 - f), 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
  }

  function trail(ctx) {
    for (const tr of GAME.S.trail) {
      ctx.fillStyle = hexA('#9d7cd8', 0.18 * (tr.life / tr.max));
      ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, 7); ctx.fill();
    }
  }

  function enemies(ctx, t) {
    // deadlock links
    const byLink = {};
    for (const e of GAME.S.enemies) if (e.linkId && !e.linkBroken) (byLink[e.linkId] ||= []).push(e);
    for (const k in byLink) if (byLink[k].length === 2) {
      const [a, b] = byLink[k];
      ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 3; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const e of GAME.S.enemies) {
      // status under-ring
      if (e.freezeT > 0) underRing(ctx, e, '#7dcfff');
      else if (e.slowT > 0) underRing(ctx, e, '#7aa2f7');
      const wob = Math.sin(t * 6 + e.wob) * 1.5;
      ART.drawCreature(ctx, e.type, e.x, e.y + wob, e.r, t, e);
      // shield bubble (buffer overflow) — fades as it's chipped away
      if (e.shield > 0 && e.maxShield > 0) {
        const sf = e.shield / e.maxShield;
        ctx.strokeStyle = hexA('#7dcfff', 0.35 + 0.4 * sf); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 7); ctx.stroke();
        ctx.fillStyle = hexA('#7dcfff', 0.07 * sf); ctx.fill();
      }
      if (e.burnT > 0) { ctx.fillStyle = hexA('#ff9e64', 0.5); ctx.beginPath(); ctx.arc(e.x, e.y - e.r - 2, 2, 0, 7); ctx.fill(); }
      // health bar
      if (e.hp < e.maxHp && !e.cloaked) {
        const w = Math.max(20, e.r * 2), hpf = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w, 4);
        ctx.fillStyle = hpf > 0.5 ? THEME.health : hpf > 0.25 ? '#e0af68' : THEME.danger;
        ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w * hpf, 4);
      }
    }
  }
  function underRing(ctx, e, col) { ctx.fillStyle = hexA(col, 0.18); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, 7); ctx.fill(); }

  function towers(ctx, t) {
    for (const tw of GAME.S.towers) {
      const sel = GAME.S.selected === tw;
      if (sel) rangeCircle(ctx, tw.x, tw.y, GAME.lvlData(tw).range || GAME.lvlData(tw).splash || 60, true);
      ART.drawTower(ctx, tw.type, tw.x, tw.y, GRID.CELL * 0.86, t, tw.lvl, towerColor(tw.type));
      if (sel) { ctx.strokeStyle = THEME.core; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tw.x, tw.y + 8, GRID.CELL * 0.46, 0, 7); ctx.stroke(); }
    }
  }
  function towerColor(type) {
    return ({ swatter: '#e0af68', linter: '#7dcfff', firewall: '#ff9e64', antivirus: '#9ece6a', debugger: '#bb9af7', gc: '#73daca', unittest: '#7aa2f7' })[type] || '#fff';
  }

  function projectiles(ctx) {
    for (const p of GAME.S.projectiles) {
      ctx.save();
      if (p.kind === 'shooter') { // red squiggle
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        const ang = Math.atan2(p.vy, p.vx); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.beginPath(); for (let i = 0; i <= 8; i++) { const x = -8 + i * 2.2; const y = Math.sin(i + p.x * 0.3) * 2.4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      } else if (p.kind === 'pierce') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; const ang = Math.atan2(p.vy, p.vx); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'sniper' ? 4 : 3.5, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(p.x - p.vx * 0.01, p.y - p.vy * 0.01, 2, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  function floaters(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of GAME.S.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / f.max * 1.5);
      ctx.fillStyle = f.col; ctx.font = `700 13px "JetBrains Mono", monospace`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function ghost(ctx, t) {
    const h = GAME.S.hover; if (!h) return;
    if (GAME.S.placing) {
      const col = Math.floor(h.x / GRID.CELL), row = Math.floor(h.y / GRID.CELL);
      const ok = GAME.canBuild(col, row) && GAME.S.commits >= TOWERS[GAME.S.placing].cost;
      const ctr = cellCenter(col, row);
      rangeCircle(ctx, ctr.x, ctr.y, GAME.lvlData({ def: TOWERS[GAME.S.placing], lvl: 0 }).range || TOWERS[GAME.S.placing].levels[0].splash || 60, ok);
      ctx.globalAlpha = 0.7;
      ART.drawTower(ctx, GAME.S.placing, ctr.x, ctr.y, GRID.CELL * 0.86, t, 0, towerColor(GAME.S.placing));
      ctx.globalAlpha = 1;
      if (!ok) { ctx.strokeStyle = THEME.buildBad; ctx.lineWidth = 2; ctx.strokeRect(col * GRID.CELL + 3, row * GRID.CELL + 3, GRID.CELL - 6, GRID.CELL - 6); }
    } else if (GAME.S.castSpell) {
      const sp = SPELLS[GAME.S.castSpell];
      ctx.fillStyle = hexA(THEME.accent, 0.12); ctx.strokeStyle = hexA(THEME.accent, 0.7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, sp.radius, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  function frame(ctx, t) {
    clear(ctx); grid(ctx, t); trail(ctx); path(ctx, t); spawnPortal(ctx, t); core(ctx, t);
    buildOverlay(ctx); effects(ctx, t); enemies(ctx, t); towers(ctx, t); projectiles(ctx); ghost(ctx, t); floaters(ctx);
  }

  function hexA(hex, a) {
    if (hex.startsWith('rgb')) return hex;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // expose for art lighten usage
  ART.lighten = ART.lighten || ((c) => c);

  return { frame, towerColor };
})();
