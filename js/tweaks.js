/* ============================================================
   BUG DEFENCE — tweaks.js
   Vanilla Tweaks panel + host protocol + theme application.
   ============================================================ */

const TWEAKS = (() => {
  const DEFAULTS = /*EDITMODE-BEGIN*/{
    "artDirection": "infested",
    "hudLayout": "dock",
    "screenShake": true
  }/*EDITMODE-END*/;

  let values = { ...DEFAULTS };
  let panel, open = false;

  // map THEME object → CSS custom properties used by the DOM
  function applyTheme() {
    setThemeName(values.artDirection);
    const r = document.documentElement.style;
    r.setProperty('--bg', THEME.bg);
    r.setProperty('--panel', THEME.panel);
    r.setProperty('--panel-edge', THEME.panelEdge);
    r.setProperty('--text', THEME.text);
    r.setProperty('--muted', THEME.muted);
    r.setProperty('--health', THEME.health);
    r.setProperty('--commits', THEME.commits);
    r.setProperty('--danger', THEME.danger);
    r.setProperty('--accent', THEME.accent);
    r.setProperty('--core', THEME.core);
    r.setProperty('--overlay-tint', THEME.overlay);
    document.body.dataset.art = values.artDirection;
  }

  function apply() {
    applyTheme();
    document.body.dataset.layout = values.hudLayout;
    if (window.UI && UI.resize) UI.resize();
    if (window.UI && UI.refreshTheme) UI.refreshTheme();
  }

  function set(key, val) {
    values[key] = val;
    apply();
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
    renderControls();
  }

  // ---------- panel ----------
  function build() {
    panel = document.createElement('div');
    panel.id = 'tweaks';
    panel.innerHTML = `
      <div class="tw-hd"><b>Tweaks</b><button class="tw-x">✕</button></div>
      <div class="tw-body"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.tw-x').onclick = dismiss;
    renderControls();
  }

  function seg(label, key, opts) {
    const wrap = document.createElement('div'); wrap.className = 'tw-row';
    wrap.innerHTML = `<div class="tw-lbl">${label}</div>`;
    const s = document.createElement('div'); s.className = 'tw-seg';
    opts.forEach(([v, t]) => {
      const b = document.createElement('button');
      b.textContent = t; b.className = values[key] === v ? 'on' : '';
      b.onclick = () => set(key, v);
      s.appendChild(b);
    });
    wrap.appendChild(s); return wrap;
  }
  function toggle(label, key) {
    const wrap = document.createElement('div'); wrap.className = 'tw-row tw-row-h';
    wrap.innerHTML = `<div class="tw-lbl">${label}</div>`;
    const b = document.createElement('button');
    b.className = 'tw-toggle' + (values[key] ? ' on' : '');
    b.innerHTML = '<span></span>';
    b.onclick = () => set(key, !values[key]);
    wrap.appendChild(b); return wrap;
  }

  function renderControls() {
    if (!panel) return;
    const body = panel.querySelector('.tw-body');
    body.innerHTML = '<div class="tw-sect">World</div>';
    body.appendChild(seg('Art direction', 'artDirection', [['infested', 'Infested'], ['reclaimed', 'Reclaimed']]));
    body.appendChild(document.createElement('div')).className = 'tw-note';
    body.querySelector('.tw-note').textContent = values.artDirection === 'infested'
      ? 'A clean codebase being overrun — corruption red.'
      : 'Order being restored — healthy teal-green.';
    const s = document.createElement('div'); s.className = 'tw-sect'; s.textContent = 'Interface'; body.appendChild(s);
    body.appendChild(seg('HUD layout', 'hudLayout', [['dock', 'Bottom dock'], ['rail', 'Side rail']]));
    body.appendChild(toggle('Hit feedback', 'screenShake'));
  }

  function dismiss() { open = false; panel.classList.remove('on'); window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); }

  function init() {
    build(); apply();
    window.addEventListener('message', e => {
      const t = e && e.data && e.data.type;
      if (t === '__activate_edit_mode') { open = true; panel.classList.add('on'); }
      else if (t === '__deactivate_edit_mode') { open = false; panel.classList.remove('on'); }
    });
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  }

  return { init, get: () => values };
})();
