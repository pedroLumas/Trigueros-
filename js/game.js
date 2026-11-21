/* =====================================================================
 * JUEGO — estado del mundo, bucle principal, colisiones y renderizado.
 * Orquesta los sistemas; la lógica concreta vive en cada módulo.
 * ===================================================================== */
const Game = {
  world: { tiger: null, animals: [] },
  time: 0,
  quality: 1,
  lastTs: 0,
  hoverAnimal: null,

  init() {
    this.viewport = document.getElementById('viewport');
    this.stage = document.getElementById('stage');
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');

    Arena.init();
    Corpses.init();
    UI.init();
    Debug.init();
    Input.init(this.stage, this.canvas);

    window.addEventListener('resize', () => this.fit());
    this.fit();
    this.reset();
    requestAnimationFrame(ts => this.frame(ts));
  },

  // Reinicia la partida desde cero.
  reset() {
    this.time = 0;
    Effects.reset();
    Corpses.reset();
    const b = Arena.bounds;
    this.world.tiger = new Tiger(b.cx, b.cy);
    this.world.animals = [];
    Upgrades.reset();
    Upgrades.applyTo(this.world.tiger);
    Economy.reset();
    Spawner.reset(this.world);
    UI.onReset();
  },

  // Escala el escenario de 1280 × 720 para que quepa en la ventana.
  fit() {
    const W = CONFIG.view.width, H = CONFIG.view.height;
    const cs = getComputedStyle(this.viewport);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    const availW = Math.max(1, this.viewport.clientWidth - padL - padR);
    const availH = Math.max(1, this.viewport.clientHeight);
    const s = Math.min(availW / W, availH / H);
    this.stage.style.transform = `scale(${s})`;
    this.stage.style.left = `${padL + (availW - W * s) / 2}px`;
    this.stage.style.top = `${(availH - H * s) / 2}px`;

    // Resolución interna del canvas según la densidad de píxeles.
    const q = clamp(Math.round(s * (window.devicePixelRatio || 1) * 4) / 4, 1, 2);
    if (q !== this.quality || this.canvas.width !== Math.round(W * q)) {
      this.quality = q;
      this.canvas.width = Math.round(W * q);
      this.canvas.height = Math.round(H * q);
    }
    Arena.ensureBackground(q);
    UI.updateOrientationHint();
  },

  get paused() {
    return UI.upgradesOpen && CONFIG.ui.pauseWhileUpgrading;
  },

  acceptsCommands() {
    return !this.paused && this.world.tiger.alive;
  },

  frame(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - (this.lastTs || ts)) / 1000));
    this.lastTs = ts;
    if (!this.paused) this.update(dt);
    Effects.update(dt);   // los efectos siguen animándose en pausa
    Arena.update(dt);
    UI.update(dt);
    this.render();
    requestAnimationFrame(t => this.frame(t));
  },

  update(dt) {
    const w = this.world;
    if (w.tiger.alive) this.time += dt;
    w.tiger.update(dt, w);
    for (const a of w.animals) a.update(dt, w);
    this.resolveCollisions();
    w.animals = w.animals.filter(a => a.alive);
    Corpses.update(dt, w.tiger);
    Spawner.update(dt, w);
  },

  // Separación simple de círculos ponderada por masa.
  resolveCollisions() {
    const w = this.world;
    const bodies = w.animals.filter(a => a.alive);
    if (w.tiger.alive) bodies.push(w.tiger);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d >= min) continue;
        if (d < 0.001) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
        const ia = a.unstoppable ? 0 : 1 / a.mass;
        const ib = b.unstoppable ? 0 : 1 / b.mass;
        const total = ia + ib;
        if (total === 0) continue;
        const overlap = min - d, nx = dx / d, ny = dy / d;
        a.x -= nx * overlap * (ia / total);
        a.y -= ny * overlap * (ia / total);
        b.x += nx * overlap * (ib / total);
        b.y += ny * overlap * (ib / total);
      }
    }
    for (const body of bodies) Arena.clampEntity(body);
  },

  // Animal bajo el cursor (con un margen generoso para que sea fácil acertar).
  animalAt(x, y, margin = 10) {
    let best = null, bestD = Infinity;
    for (const a of this.world.animals) {
      if (!a.alive) continue;
      const d = distXY(x, y, a.x, a.y);
      if (d <= a.radius + margin && d < bestD) { best = a; bestD = d; }
    }
    return best;
  },

  // angle === null: apuntado automático (botón de la interfaz o pantalla táctil).
  trySpecial(angle) {
    if (!this.acceptsCommands()) return;
    const tiger = this.world.tiger;
    if (angle === null) {
      let best = null, bestD = CONFIG.special.range * 1.6;
      for (const a of this.world.animals) {
        const d = dist(tiger, a) - a.radius;
        if (d < bestD) { best = a; bestD = d; }
      }
      angle = best ? angleBetween(tiger, best) : tiger.angle;
    }
    if (!tiger.useSpecial(angle, this.world.animals)) UI.specialDenied();
  },

  // ---------- Renderizado ----------
  render() {
    const ctx = this.ctx, w = this.world, tiger = w.tiger;
    const time = Arena.time;
    ctx.setTransform(this.quality, 0, 0, this.quality, 0, 0);

    Arena.draw(ctx);
    Corpses.draw(ctx, time);
    Effects.draw(ctx, 'ground');
    Debug.draw(ctx, tiger);
    this.updateHover();
    this.drawOrderHints(ctx);
    for (const a of w.animals) a.drawTelegraph(ctx);

    const sorted = w.animals.slice().sort((a, b) => a.y - b.y);
    for (const a of sorted) a.draw(ctx);
    tiger.draw(ctx);

    this.drawSpecialPreview(ctx);
    for (const a of sorted) a.drawOverlay(ctx, time);
    tiger.drawOverlay(ctx);
    Effects.draw(ctx, 'top');
    Arena.drawAmbient(ctx);

    if (this.paused) this.drawPauseVeil(ctx);
  },

  updateHover() {
    const m = Input.mouse;
    const hover = m.inside && this.world.tiger.alive ? this.animalAt(m.x, m.y) : null;
    if (hover !== this.hoverAnimal) {
      this.hoverAnimal = hover;
      this.canvas.classList.toggle('over-prey', !!hover);
    }
  },

  // Objetivo actual, animal bajo el cursor y destino de la orden de movimiento.
  drawOrderHints(ctx) {
    const tiger = this.world.tiger;
    ctx.save();
    const hover = this.hoverAnimal;
    if (hover && hover !== tiger.target) {
      ctx.strokeStyle = 'rgba(255, 245, 230, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, hover.radius + 6, 0, TAU);
      ctx.stroke();
    }
    if (tiger.alive && tiger.target && tiger.target.alive) {
      const t = tiger.target;
      ctx.strokeStyle = tiger.targetExplicit ? 'rgba(255, 70, 55, 0.95)' : 'rgba(255, 130, 90, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash(tiger.targetExplicit ? [] : [5, 4]);
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius + 6, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (tiger.alive && tiger.order && tiger.order.type === 'move') {
      const o = tiger.order;
      ctx.strokeStyle = 'rgba(150, 240, 125, 0.18)';
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1.5;
      line(ctx, tiger.x, tiger.y, o.x, o.y);
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(150, 240, 125, 0.6)';
      ctx.lineWidth = 2;
      line(ctx, o.x - 4, o.y - 4, o.x + 4, o.y + 4);
      line(ctx, o.x - 4, o.y + 4, o.x + 4, o.y - 4);
    }
    ctx.restore();
  },

  // Contorno tenue del zarpazo hacia el cursor cuando está listo.
  drawSpecialPreview(ctx) {
    const tiger = this.world.tiger, m = Input.mouse;
    if (!tiger.alive || tiger.specialCooldown > 0 || !m.inside || this.paused) return;
    const ang = Math.atan2(m.y - tiger.y, m.x - tiger.x);
    const half = CONFIG.special.arcDegrees * Math.PI / 360;
    ctx.save();
    ctx.fillStyle = 'rgba(220, 40, 40, 0.07)';
    ctx.strokeStyle = 'rgba(240, 90, 80, 0.3)';
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tiger.x, tiger.y);
    ctx.arc(tiger.x, tiger.y, CONFIG.special.range, ang - half, ang + half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawPauseVeil(ctx) {
    const a = CONFIG.arena;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 6, 0.42)';
    ctx.fillRect(a.x, a.y, a.size, a.size);
    ctx.font = `600 40px ${FONT_NUM}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(241, 232, 210, 0.85)';
    ctx.fillText('PAUSA', a.x + a.size / 2, a.y + 84);
    ctx.font = `500 16px "Barlow Semi Condensed", sans-serif`;
    ctx.fillStyle = 'rgba(241, 232, 210, 0.6)';
    ctx.fillText('Mejoras abiertas · T o Esc para volver a cazar', a.x + a.size / 2, a.y + 112);
    ctx.restore();
  },
};
