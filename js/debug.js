/* =====================================================================
 * DEPURACIÓN (F1) — atajos para probar mecánicas rápidamente.
 * ===================================================================== */
const Debug = {
  open: false,
  showDetection: false,
  showAttackRange: false,

  init() {
    this.panel = document.getElementById('debug-panel');
    this.help = document.getElementById('hud-help');
    const detection = document.getElementById('dbg-detection');
    const range = document.getElementById('dbg-range');

    this.panel.addEventListener('click', e => {
      const btn = e.target.closest('button[data-dbg]');
      if (btn) this.run(btn.dataset.dbg, btn.dataset.kind);
    });
    detection.addEventListener('change', () => { this.showDetection = detection.checked; });
    range.addEventListener('change', () => { this.showAttackRange = range.checked; });
  },

  toggle() {
    this.open = !this.open;
    this.panel.hidden = !this.open;
    this.help.hidden = this.open;
  },

  run(action, kind) {
    const w = Game.world;
    switch (action) {
      case 'blood':
        Economy.addBlood(100, true);
        Effects.floatText(w.tiger.x, w.tiger.y - 40, '+100 sangre', { color: '#ff5c66', size: 24 });
        break;
      case 'heal':
        if (w.tiger.alive) {
          w.tiger.heal(w.tiger.stats.maxHp);
          Effects.ring(w.tiger.x, w.tiger.y, { follow: w.tiger, color: '140, 230, 120', from: 16, to: 44, life: 0.6, width: 3 });
        }
        break;
      case 'spawn':
        Spawner.spawn(kind, w);
        break;
      case 'reset':
        Game.reset();
        break;
    }
  },

  draw(ctx, tiger) {
    if (!tiger.alive) return;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    if (this.showDetection) {
      ctx.fillStyle = 'rgba(255, 220, 90, 0.05)';
      ctx.strokeStyle = 'rgba(255, 220, 90, 0.75)';
      ctx.beginPath();
      ctx.arc(tiger.x, tiger.y, tiger.stats.detectionRadius, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    if (this.showAttackRange) {
      // El alcance se mide hasta el borde del animal.
      ctx.fillStyle = 'rgba(255, 80, 70, 0.08)';
      ctx.strokeStyle = 'rgba(255, 90, 80, 0.9)';
      ctx.beginPath();
      ctx.arc(tiger.x, tiger.y, tiger.stats.attackRange, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  },
};
