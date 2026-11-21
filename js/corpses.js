/* =====================================================================
 * CADÁVERES — mecánica central de recogida.
 * Al morir, cada animal deja un cadáver. El tigre lo devora al pasar por
 * encima (sin detenerse): gana su sangre y recupera vida. Si nadie lo
 * recoge, se desvanece y desaparece.
 * ===================================================================== */
class Corpse {
  constructor(animal) {
    this.kind = animal.kind;
    this.x = animal.x;
    this.y = animal.y;
    this.radius = animal.radius;
    this.angle = animal.angle + rand(-0.5, 0.5);
    this.blood = animal.def.blood;
    this.age = 0;
    this.duration = CONFIG.corpse.duration;
    this.seed = rand(0, TAU);
    this.eaten = false;
  }

  get remaining() { return this.duration - this.age; }
}

const Corpses = {
  list: [],

  init() {
    Events.on('animalKilled', ({ animal }) => this.spawnFrom(animal));
  },

  reset() { this.list = []; },

  spawnFrom(animal) {
    this.list.push(new Corpse(animal));
    Effects.burst(animal.x, animal.y, { count: 12, color: '#a3121c', speedMin: 30, speedMax: 110, life: 0.5, layer: 'ground' });
  },

  update(dt, tiger) {
    const cfg = CONFIG.corpse;
    for (const c of this.list) c.age += dt;

    if (tiger.alive) {
      for (const c of this.list) {
        if (c.age >= cfg.settleTime && c.remaining > 0 && dist(c, tiger) <= cfg.pickupRadius) this.devour(c, tiger);
      }
    }
    for (const c of this.list) {
      if (!c.eaten && c.remaining <= 0) Effects.dust(c.x, c.y);
    }
    this.list = this.list.filter(c => !c.eaten && c.remaining > 0);
  },

  devour(c, tiger) {
    c.eaten = true;
    Economy.addBlood(c.blood);
    Economy.registerDevoured();
    const healed = tiger.heal(tiger.stats.maxHp * tiger.stats.healPercent);
    Effects.devour(c.x, c.y, c.blood, UI.bloodTarget());
    Effects.floatText(c.x, c.y - 14, `+${c.blood} sangre`, { color: '#ff5c66', size: 25, life: 1.1 });
    if (healed > 0) {
      Effects.floatText(c.x, c.y + 4, `+${Math.round(healed)} vida`, { color: '#8be27a', size: 19, life: 1.0, delay: 0.12, rise: 26 });
    }
    Events.emit('corpseDevoured', { corpse: c, healed });
  },

  draw(ctx, time) {
    const cfg = CONFIG.corpse;
    for (const c of this.list) {
      const left = c.remaining;
      let alpha = 1;
      if (left < cfg.fadeStart) alpha = 0.25 + 0.75 * (left / cfg.fadeStart);
      if (left < 3) alpha *= 0.55 + 0.45 * Math.abs(Math.sin(time * 7));
      const settle = Math.min(1, c.age / 0.25);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);

      // Charco de sangre
      ctx.fillStyle = 'rgba(110, 8, 16, 0.6)';
      ell(ctx, 0, 0, c.radius * 1.6 * settle, c.radius * 1.15 * settle, c.angle);

      // Brillo pulsante: indica que se puede recoger
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + c.seed);
      ctx.strokeStyle = `rgba(255, 90, 90, ${0.22 + 0.28 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius + 7 + pulse * 2, 0, TAU);
      ctx.stroke();

      // Silueta del animal, oscurecida y tumbada
      ctx.save();
      ctx.rotate(c.angle);
      ctx.scale(0.95, 0.85);
      AnimalArt[c.kind](ctx, null, COLOR_CORPSE);
      ctx.restore();

      // Cuenta atrás: arco que se vacía
      ctx.strokeStyle = 'rgba(245, 225, 200, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius + 13, -Math.PI / 2, -Math.PI / 2 + TAU * (left / c.duration));
      ctx.stroke();
      ctx.restore();
    }
  },
};
