/* ============================================================
   BUG DEFENCE — art.js
   Iconographic canvas creatures + tower glyphs + board tiles.
   Bugs keep their own syntax-palette identity; the board/HUD
   recolors with the art-direction tweak.
   ============================================================ */

const ART = (() => {
  // Fixed "syntax highlight" identity colors for each bug.
  const BUG = {
    nullptr:       { body: '#f7768e', dark: '#b3445b', eye: '#1a1320' },
    memleak:       { body: '#9d7cd8', dark: '#6b50a0', eye: '#e7dcff' },
    timeout:       { body: '#b4f9f8', dark: '#4a9ea0', eye: '#04282a' },
    bufferoverflow:{ body: '#c0caf5', dark: '#6b7394', eye: '#1a1f33' },
    zombie:        { body: '#a3be5c', dark: '#5e7330', eye: '#101a06' },
    forkbomb:      { body: '#e06c9f', dark: '#8a3a63', eye: '#1a0f16', spark: '#ffd479' },
    race:          { body: '#7dcfff', dark: '#3f86b8', eye: '#0b2233' },
    infloop:       { body: '#e0af68', dark: '#a87d36', eye: '#2a1d05' },
    heisenbug:     { body: '#9bb6ff', dark: '#5a78c8', eye: '#ffffff' },
    deadlock:      { body: '#ff9e64', dark: '#b96532', eye: '#2a1305' },
    spaghetti:     { body: '#e8c878', dark: '#b08a3a', eye: '#7a3b22', sauce: '#d6453f' },
    stackoverflow: { body: '#9ece6a', dark: '#5e8a3a', eye: '#16240a' },
    segfault:      { body: '#ff5d7a', dark: '#9c1f3a', eye: '#fff0f3' },
    legacy:        { body: '#6b7394', dark: '#3a4060', eye: '#9ece6a', moss: '#7bbf52' }
  };

  function legs(ctx, r, t, count, color) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.13);
    ctx.lineCap = 'round';
    const span = count / 2;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < span; i++) {
        const ph = Math.sin(t * 9 + i * 1.4 + (s > 0 ? 0 : Math.PI)) * 0.32;
        const bx = (i - (span - 1) / 2) * r * 0.55;
        const by = s * r * 0.42;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + ph * r * 0.5, by + s * r * 0.85);
        ctx.stroke();
      }
    }
  }

  function blob(ctx, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Each creature drawn centered at origin; "r" ≈ body radius.
  const C = {
    nullptr(ctx, r, t) {
      const c = BUG.nullptr;
      legs(ctx, r, t, 6, c.dark);
      blob(ctx, r * 1.05, r * 0.82, c.dark);
      blob(ctx, r * 0.95, r * 0.72, c.body);
      // wing seam
      ctx.strokeStyle = c.dark; ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.7); ctx.stroke();
      // the void face
      ctx.fillStyle = c.eye;
      ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c.body; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.42, 0, Math.PI * 2); ctx.stroke();
    },
    memleak(ctx, r, t, hp, e) {
      const c = BUG.memleak;
      const grow = e && e.grow ? e.grow : 1;
      const w = r * 1.25 * grow, h = r * 0.78 * grow;
      // drips
      ctx.fillStyle = c.dark;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(i * w * 0.5, h * 0.7 + Math.sin(t * 3 + i) * 2, w * 0.18, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      blob(ctx, w, h, c.dark);
      ctx.save(); ctx.translate(0, -h * 0.12); blob(ctx, w * 0.92, h * 0.78, c.body); ctx.restore();
      // gloss
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(-w * 0.3, -h * 0.4, w * 0.3, h * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
      // antennae + eyes
      ctx.strokeStyle = c.dark; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.5, -h * 0.5); ctx.lineTo(w * 0.78, -h * 1.1);
      ctx.moveTo(w * 0.7, -h * 0.5); ctx.lineTo(w * 0.98, -h * 1.0); ctx.stroke();
      ctx.fillStyle = c.eye;
      ctx.beginPath(); ctx.arc(w * 0.78, -h * 1.15, r * 0.12, 0, 7); ctx.arc(w * 0.98, -h * 1.05, r * 0.12, 0, 7); ctx.fill();
    },
    timeout(ctx, r, t) {
      const c = BUG.timeout;
      // motion streaks behind (it's racing the clock)
      ctx.strokeStyle = c.body; ctx.globalAlpha = 0.4; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.95 - i * r * 0.35, -r * 0.3 + i * r * 0.3); ctx.lineTo(-r * 0.45 - i * r * 0.35, -r * 0.3 + i * r * 0.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
      legs(ctx, r, t, 4, c.dark);
      // clock body
      blob(ctx, r * 0.95, r * 0.95, c.dark);
      blob(ctx, r * 0.8, r * 0.8, c.body);
      // tick marks
      ctx.strokeStyle = c.eye; ctx.lineWidth = r * 0.06;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); ctx.lineTo(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74); ctx.stroke(); }
      // fast-spinning hands
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 7) * r * 0.5, Math.sin(t * 7) * r * 0.5); ctx.stroke();
      ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t * 2.5) * r * 0.4, Math.sin(t * 2.5) * r * 0.4); ctx.stroke();
      ctx.fillStyle = c.eye; ctx.beginPath(); ctx.arc(0, 0, r * 0.08, 0, 7); ctx.fill();
    },
    bufferoverflow(ctx, r, t) {
      const c = BUG.bufferoverflow;
      legs(ctx, r, t, 4, c.dark);
      // blocks overflowing out the top
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? c.dark : c.body; const yy = -r * 0.72 - i * r * 0.34 - Math.sin(t * 3 + i) * 2; roundRect(ctx, -r * 0.4 + (i - 1) * r * 0.16, yy, r * 0.8, r * 0.3, r * 0.06); ctx.fill(); }
      // container
      ctx.fillStyle = c.dark; roundRect(ctx, -r * 0.85, -r * 0.5, r * 1.7, r * 1.05, r * 0.12); ctx.fill();
      ctx.fillStyle = c.body; roundRect(ctx, -r * 0.72, -r * 0.38, r * 1.44, r * 0.82, r * 0.1); ctx.fill();
      // bracket "face"
      ctx.strokeStyle = c.eye; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.18, -r * 0.18); ctx.lineTo(-r * 0.42, -r * 0.18); ctx.lineTo(-r * 0.42, r * 0.2); ctx.lineTo(-r * 0.18, r * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.18, -r * 0.18); ctx.lineTo(r * 0.42, -r * 0.18); ctx.lineTo(r * 0.42, r * 0.2); ctx.lineTo(r * 0.18, r * 0.2); ctx.stroke();
      ctx.fillStyle = c.eye; ctx.beginPath(); ctx.arc(0, 0, r * 0.07, 0, 7); ctx.fill();
    },
    zombie(ctx, r, t) {
      const c = BUG.zombie;
      legs(ctx, r, t, 6, c.dark);
      blob(ctx, r * 1.02, r * 0.8, c.dark);
      blob(ctx, r * 0.9, r * 0.68, c.body);
      // rot patches
      ctx.fillStyle = c.dark;
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.28, r * 0.22, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.4, r * 0.22, r * 0.16, 0, 7); ctx.fill();
      // dead X eyes
      ctx.strokeStyle = c.eye; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) { const ex = s * r * 0.28, ey = -r * 0.05, d = r * 0.13; ctx.beginPath(); ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d); ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d); ctx.stroke(); }
      // drool
      ctx.strokeStyle = c.body; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.moveTo(0, r * 0.3); ctx.lineTo(0, r * 0.55 + Math.sin(t * 4) * 2); ctx.stroke();
    },
    forkbomb(ctx, r, t) {
      const c = BUG.forkbomb;
      legs(ctx, r, t, 4, c.dark);
      // bomb body
      blob(ctx, r * 0.92, r * 0.92, c.dark);
      blob(ctx, r * 0.78, r * 0.78, c.body);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.3, r * 0.22, r * 0.14, -0.4, 0, 7); ctx.fill();
      // forking fuse
      ctx.strokeStyle = c.dark; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, -r * 1.0);
      ctx.moveTo(0, -r * 1.0); ctx.lineTo(-r * 0.4, -r * 1.3);
      ctx.moveTo(0, -r * 1.0); ctx.lineTo(r * 0.4, -r * 1.3); ctx.stroke();
      // sparks
      ctx.fillStyle = c.spark; ctx.globalAlpha = 0.6 + Math.sin(t * 14) * 0.4;
      ctx.beginPath(); ctx.arc(-r * 0.4, -r * 1.3, r * 0.14, 0, 7); ctx.arc(r * 0.4, -r * 1.3, r * 0.14, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      // eyes
      ctx.fillStyle = c.eye; ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.1, 0, 7); ctx.arc(r * 0.2, 0, r * 0.1, 0, 7); ctx.fill();
    },
    race(ctx, r, t) {
      const c = BUG.race;
      // a flickering twin dart
      for (let s = -1; s <= 1; s += 2) {
        ctx.save();
        ctx.translate(s * r * 0.28, s * r * 0.18);
        const flick = (Math.floor(t * 12) % 2 === 0) === (s > 0) ? 1 : 0.55;
        ctx.globalAlpha = flick;
        ctx.fillStyle = s > 0 ? c.body : c.dark;
        ctx.beginPath();
        ctx.moveTo(r * 0.85, 0); ctx.lineTo(-r * 0.6, -r * 0.5); ctx.lineTo(-r * 0.3, 0);
        ctx.lineTo(-r * 0.6, r * 0.5); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // motion lines
      ctx.strokeStyle = c.body; ctx.lineWidth = r * 0.09; ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.9 - i * r * 0.3, -r * 0.3 + i * r * 0.3); ctx.lineTo(-r * 0.5 - i * r * 0.3, -r * 0.3 + i * r * 0.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    infloop(ctx, r, t) {
      const c = BUG.infloop;
      legs(ctx, r, t, 4, c.dark);
      // ring body (the loop)
      ctx.strokeStyle = c.body; ctx.lineWidth = r * 0.42;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0.5, Math.PI * 2 + 0.1); ctx.stroke();
      // arrowhead chasing tail
      const a = Math.PI * 2 + 0.1;
      const ax = Math.cos(a) * r * 0.66, ay = Math.sin(a) * r * 0.66;
      ctx.fillStyle = c.body;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.34); ctx.lineTo(r * 0.34, r * 0.2); ctx.lineTo(-r * 0.34, r * 0.2); ctx.closePath(); ctx.fill();
      ctx.restore();
      // eyes in centre
      ctx.fillStyle = c.eye;
      ctx.beginPath(); ctx.arc(-r * 0.16, 0, r * 0.13, 0, 7); ctx.arc(r * 0.16, 0, r * 0.13, 0, 7); ctx.fill();
    },
    heisenbug(ctx, r, t, hp, e) {
      const c = BUG.heisenbug;
      ctx.globalAlpha = (e && e.cloaked) ? 0.16 : 0.85;
      // moth wings
      ctx.fillStyle = c.body;
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.ellipse(s * r * 0.55, 0, r * 0.55, r * 0.85, s * 0.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = c.dark;
      blob(ctx, r * 0.34, r * 0.78, c.dark);
      // question mark glyph
      ctx.globalAlpha = (e && e.cloaked) ? 0.3 : 1;
      ctx.fillStyle = c.eye; ctx.font = `bold ${r * 1.0}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
      ctx.globalAlpha = 1;
    },
    deadlock(ctx, r, t, hp, e) {
      const c = BUG.deadlock;
      const broken = e && e.linkBroken;
      // chain link in middle
      if (!broken) {
        ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, 7); ctx.stroke();
      }
      for (let s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(s * r * 0.7, 0);
        ctx.fillStyle = broken ? c.dark : c.body;
        roundRect(ctx, -r * 0.5, -r * 0.5, r, r, r * 0.16); ctx.fill();
        ctx.fillStyle = c.eye;
        ctx.beginPath(); ctx.arc(-r * 0.14, -r * 0.05, r * 0.1, 0, 7); ctx.arc(r * 0.14, -r * 0.05, r * 0.1, 0, 7); ctx.fill();
        ctx.restore();
      }
    },
    spaghetti(ctx, r, t) {
      const c = BUG.spaghetti;
      legs(ctx, r, t, 6, c.dark);
      blob(ctx, r * 1.05, r * 0.95, c.dark);
      // tangled noodles
      ctx.strokeStyle = c.body; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const a0 = i * 1.1 + t * 0.3;
        ctx.moveTo(Math.cos(a0) * r * 0.2, Math.sin(a0) * r * 0.2);
        ctx.bezierCurveTo(
          Math.cos(a0 + 1) * r, Math.sin(a0 + 1) * r,
          Math.cos(a0 + 2) * r * 0.6, Math.sin(a0 + 2) * r * 0.6,
          Math.cos(a0 + 3) * r * 0.9, Math.sin(a0 + 3) * r * 0.9);
        ctx.stroke();
      }
      // sauce blobs (armor plates)
      ctx.fillStyle = c.sauce;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2) * r * 0.4, Math.sin(i * 2) * r * 0.4, r * 0.22, 0, 7); ctx.fill(); }
      ctx.fillStyle = c.eye;
      ctx.beginPath(); ctx.arc(-r * 0.18, 0, r * 0.11, 0, 7); ctx.arc(r * 0.18, 0, r * 0.11, 0, 7); ctx.fill();
    },
    stackoverflow(ctx, r, t, hp, e) {
      const c = BUG.stackoverflow;
      const n = e && e.stack ? e.stack : 1;
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.translate(Math.sin(i * 1.7) * r * 0.2, -i * r * 0.7);
        ctx.fillStyle = i % 2 ? c.dark : c.body;
        roundRect(ctx, -r * 0.6, -r * 0.45, r * 1.2, r * 0.9, r * 0.14); ctx.fill();
        ctx.fillStyle = c.eye;
        ctx.beginPath(); ctx.arc(-r * 0.16, 0, r * 0.09, 0, 7); ctx.arc(r * 0.16, 0, r * 0.09, 0, 7); ctx.fill();
        ctx.restore();
      }
    },
    segfault(ctx, r, t) {
      const c = BUG.segfault;
      // jagged crystalline shards
      ctx.fillStyle = c.dark;
      jagged(ctx, r * 1.15, 11, t * 0.4);
      ctx.fillStyle = c.body;
      jagged(ctx, r * 0.92, 9, -t * 0.6);
      // glitch eye
      ctx.fillStyle = c.eye;
      ctx.fillRect(-r * 0.4, -r * 0.12, r * 0.8, r * 0.24);
      ctx.fillStyle = c.dark;
      ctx.fillRect(-r * 0.1, -r * 0.12, r * 0.2, r * 0.24);
    },
    legacy(ctx, r, t) {
      const c = BUG.legacy;
      // ancient mainframe shell
      ctx.fillStyle = c.dark;
      roundRect(ctx, -r, -r * 0.85, r * 2, r * 1.7, r * 0.18); ctx.fill();
      ctx.fillStyle = c.body;
      roundRect(ctx, -r * 0.86, -r * 0.7, r * 1.72, r * 1.4, r * 0.14); ctx.fill();
      // tape reels
      ctx.fillStyle = c.dark;
      for (let s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.arc(s * r * 0.42, -r * 0.18, r * 0.3, 0, 7); ctx.fill(); }
      ctx.fillStyle = c.eye;
      for (let s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(s * r * 0.42, -r * 0.18); ctx.rotate(t * 1.5);
        ctx.fillRect(-r * 0.05, -r * 0.22, r * 0.1, r * 0.44); ctx.restore();
      }
      // moss creeping
      ctx.fillStyle = c.moss;
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-r + i * r * 0.33, r * 0.55 + Math.sin(i) * 3, r * 0.13, 0, 7); ctx.fill(); }
      // status lights
      ctx.fillStyle = '#f7768e';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * 0.6 + i * r * 0.3, r * 0.4, r * 0.07, 0, 7); ctx.fill(); }
    }
  };

  function jagged(ctx, r, spikes, rot) {
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2 + rot;
      const rad = i % 2 ? r * 0.55 : r;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCreature(ctx, type, cx, cy, r, t, e) {
    ctx.save();
    ctx.translate(cx, cy);
    (C[type] || C.nullptr)(ctx, r, t, e ? e.hp / e.maxHp : 1, e);
    ctx.restore();
  }

  // ---- Tower glyphs (centered) ----------------------------------------------
  function drawTower(ctx, type, cx, cy, size, t, lvl, col) {
    ctx.save();
    ctx.translate(cx, cy);
    const r = size * 0.5;
    // base pad
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.95, r * 0.4, 0, 0, 7); ctx.fill();
    hexPad(ctx, r * 0.92, col);
    // level pips
    const G = {
      swatter() {
        ctx.fillStyle = col; roundRect(ctx, -r * 0.12, -r * 0.9, r * 0.24, r * 1.1, r * 0.06); ctx.fill();
        ctx.fillStyle = lighten(col); roundRect(ctx, -r * 0.5, -r * 1.2, r, r * 0.5, r * 0.1); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let i = -1; i <= 1; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(i * r * 0.25, -r * 1.1 + j * r * 0.22, r * 0.06, 0, 7); ctx.fill(); }
      },
      linter() {
        ctx.fillStyle = col; roundRect(ctx, -r * 0.5, -r * 0.4, r, r * 0.7, r * 0.1); ctx.fill();
        ctx.strokeStyle = '#f7768e'; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const x = -r * 0.1 + i * r * 0.09; const y = -r * 0.55 + Math.sin(i + t * 4) * r * 0.12; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      },
      firewall() {
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = i === 0 ? '#ff9e64' : col;
          const hh = r * (1.0 - Math.abs(i) * 0.2) + Math.sin(t * 6 + i) * r * 0.1;
          ctx.beginPath();
          ctx.moveTo(i * r * 0.5 - r * 0.22, r * 0.3);
          ctx.quadraticCurveTo(i * r * 0.5, -hh, i * r * 0.5 + r * 0.22, r * 0.3);
          ctx.fill();
        }
      },
      antivirus() {
        ctx.fillStyle = col; roundRect(ctx, -r * 0.3, -r * 0.3, r * 0.6, r * 0.7, r * 0.08); ctx.fill();
        ctx.strokeStyle = lighten(col); ctx.lineWidth = r * 0.18;
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, -r * 1.15); ctx.stroke();
        ctx.fillStyle = '#f7768e'; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#f7768e'; ctx.lineWidth = r * 0.05;
        ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.3, 0, 7); ctx.stroke();
      },
      debugger() {
        ctx.strokeStyle = col; ctx.lineWidth = r * 0.16;
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.5, 0, 7); ctx.stroke();
        ctx.fillStyle = '#f7768e'; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.2, 0, 7); ctx.fill();
        // pause bars
        ctx.fillStyle = lighten(col);
        ctx.fillRect(-r * 0.12, -r * 0.2, r * 0.08, r * 0.2); ctx.fillRect(r * 0.04, -r * 0.2, r * 0.08, r * 0.2);
      },
      gc() {
        ctx.fillStyle = col;
        roundRect(ctx, -r * 0.45, -r * 0.5, r * 0.9, r * 0.8, r * 0.1); ctx.fill();
        ctx.fillStyle = lighten(col);
        roundRect(ctx, -r * 0.45, -r * 0.5, r * 0.9, r * 0.2, r * 0.06); ctx.fill();
        // sweep arc
        ctx.strokeStyle = '#9ece6a'; ctx.lineWidth = r * 0.1;
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.7, Math.PI + t % (Math.PI * 2), Math.PI * 1.6 + t % (Math.PI * 2)); ctx.stroke();
      },
      unittest() {
        ctx.fillStyle = col; roundRect(ctx, -r * 0.45, -r * 0.55, r * 0.9, r * 0.9, r * 0.1); ctx.fill();
        ctx.strokeStyle = '#9ece6a'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r * 0.22, -r * 0.1); ctx.lineTo(-r * 0.02, r * 0.12); ctx.lineTo(r * 0.28, -r * 0.28); ctx.stroke();
      }
    };
    (G[type] || G.swatter)();
    // level pips
    ctx.fillStyle = '#fff';
    for (let i = 0; i <= lvl; i++) { ctx.beginPath(); ctx.arc(-r * 0.3 + i * r * 0.3, r * 0.7, r * 0.08, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function hexPad(ctx, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.66; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
  }

  function lighten(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + 40, g = ((n >> 8) & 255) + 40, b = (n & 255) + 40;
    r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
    return `rgb(${r},${g},${b})`;
  }

  // ---- Spell glyphs (centered) ----------------------------------------------
  const SPELL = {
    breakpoint(ctx, r, t) {
      const col = '#7dcfff';
      // ice crystal rays (freeze)
      ctx.strokeStyle = col; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); ctx.stroke();
        const bx = Math.cos(a) * r * 0.56, by = Math.sin(a) * r * 0.56;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * r * 0.22, by + Math.sin(a + 0.7) * r * 0.22);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * r * 0.22, by + Math.sin(a - 0.7) * r * 0.22);
        ctx.stroke();
      }
      // center breakpoint dot + pause bars
      ctx.fillStyle = '#f7768e'; ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.fillRect(-r * 0.15, -r * 0.16, r * 0.1, r * 0.32); ctx.fillRect(r * 0.05, -r * 0.16, r * 0.1, r * 0.32);
    },
    hotfix(ctx, r, t) {
      // explosion burst (kill -9 nuke)
      const sp = 10;
      ctx.fillStyle = '#ff9e64';
      ctx.beginPath();
      for (let i = 0; i < sp; i++) { const a = i / sp * Math.PI * 2 - Math.PI / 2; const rad = i % 2 ? r * 0.45 : r * 0.96; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd479';
      ctx.beginPath();
      for (let i = 0; i < sp; i++) { const a = i / sp * Math.PI * 2 - Math.PI / 2; const rad = i % 2 ? r * 0.28 : r * 0.62; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 7); ctx.fill();
    },
    patch(ctx, r, t) {
      // bandage / plaster (patch the build)
      const col = '#9ece6a';
      ctx.save(); ctx.rotate(-0.5);
      ctx.fillStyle = col; roundRect(ctx, -r * 0.9, -r * 0.34, r * 1.8, r * 0.68, r * 0.16); ctx.fill();
      ctx.fillStyle = '#dff0c0'; roundRect(ctx, -r * 0.32, -r * 0.32, r * 0.64, r * 0.64, r * 0.1); ctx.fill();
      ctx.fillStyle = col;
      for (let s = -1; s <= 1; s += 2) for (let j = -1; j <= 1; j += 2) { ctx.beginPath(); ctx.arc(s * r * 0.62, j * r * 0.15, r * 0.05, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  };
  function drawSpell(ctx, name, cx, cy, size, t) {
    ctx.save();
    ctx.translate(cx, cy);
    (SPELL[name] || SPELL.hotfix)(ctx, size * 0.5, t);
    ctx.restore();
  }

  return { drawCreature, drawTower, drawSpell, BUG, roundRect, hexPad };
})();
