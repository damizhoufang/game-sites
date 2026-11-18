/* ============ 启动 ============ */
(function () {
  const fit = () => {
    const el = document.getElementById('stage');
    const w = el.clientWidth, h = el.clientHeight;
    const f = PLATFORM.id === 'mobile' ? (Math.min(w, h * 0.6) / 100) * 4.1 : Math.min(w / 160, h / 90) * 1.9;
    el.style.setProperty('--f', clamp(f, 13, 26).toFixed(2) + 'px');
  };
  window.addEventListener('resize', fit);
  const go = () => {
    fit(); boot();
    /* 调试入口：地址后加 ?debug 才会暴露，供自动化测试使用 */
    if (/[?&]debug/.test(location.search)) window.__HC = { G, P, Game, Save, UI, pickup, stumble, world: () => W, renderer: () => R, sim: (dt) => update(dt), draw: () => render(), advance: (sec) => { for (let t = 0; t < sec - 1e-9; t += 1 / 60) update(1 / 60); render(); } };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  /* 手机版：注册 Service Worker，装到主屏幕后断网也能玩 */
  if (PLATFORM.id === 'mobile' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
