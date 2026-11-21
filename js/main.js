/* =====================================================================
 * ARRANQUE
 * ===================================================================== */
(function boot() {
  const start = () => Game.init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
