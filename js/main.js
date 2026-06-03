/* ============================================================
   BUG DEFENCE — main.js  (boot + game loop)
   ============================================================ */
(function () {
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    dt = Math.min(dt, 0.05);
    const sdt = dt * GAME.S.speed;
    if (GAME.S.screen === 'play') GAME.update(sdt);
    UI.render(now / 1000);
    requestAnimationFrame(loop);
  }
  window.addEventListener('DOMContentLoaded', () => {
    TWEAKS.init();
    UI.init();
    requestAnimationFrame(loop);
  });
})();
