/* =====================================================================
 * COMBATE — aplicación de daño en ambas direcciones y resolución del
 * zarpazo sangriento. El "cuándo" atacar lo deciden el tigre y la IA;
 * aquí solo se resuelve el golpe.
 * ===================================================================== */
const Combat = {
  // Golpe del tigre a un animal. Devuelve true si lo mata.
  tigerStrike(tiger, animal, amount, opts = {}) {
    if (!animal.alive) return false;
    const ang = angleBetween(tiger, animal);
    const killed = animal.takeDamage(amount, tiger);
    Effects.floatText(animal.x, animal.y - animal.radius - 6, String(Math.round(amount)), {
      color: opts.special ? '#ff7a6e' : '#fff3d6',
      size: opts.special ? 27 : 22,
    });
    Effects.hitSparks(animal.x, animal.y, ang);
    return killed;
  },

  // Golpe de un animal al tigre, con empujón opcional.
  animalStrike(animal, tiger, amount, knockback = 0, direction = null) {
    if (!tiger.alive) return;
    if (knockback > 0) {
      const ang = direction === null ? angleBetween(animal, tiger) : direction;
      tiger.applyKnockback(Math.cos(ang) * knockback, Math.sin(ang) * knockback);
    }
    tiger.takeDamage(amount, animal);
  },

  // ¿Está el animal dentro del arco frente al tigre?
  inArc(tiger, animal, angle, range, halfArc) {
    const d = dist(tiger, animal);
    if (d - animal.radius > range) return false;
    if (d < 1) return true;
    const tolerance = Math.asin(Math.min(1, animal.radius / d));
    return Math.abs(wrapAngle(angleBetween(tiger, animal) - angle)) <= halfArc + tolerance;
  },

  // Zarpazo sangriento: daño en arco hacia la dirección indicada.
  bloodyClaw(tiger, angle, animals) {
    const cfg = CONFIG.special;
    const half = cfg.arcDegrees * Math.PI / 360;
    const hits = animals.filter(a => a.alive && this.inArc(tiger, a, angle, cfg.range, half));
    Effects.specialArc(tiger.x, tiger.y, angle, cfg.range, half * 2);
    for (const a of hits) {
      this.tigerStrike(tiger, a, cfg.damage, { special: true });
      Effects.slash(a.x, a.y, angle, 1.3);
    }
    return hits.length;
  },
};
