/* =====================================================================
 * TIGRE — controlador estilo RTS (Warcraft III).
 *
 *  Órdenes:
 *   - move:   camina hasta un punto. Si ve una presa delante, se desvía,
 *             la caza y después continúa hacia el destino original.
 *   - attack: persigue y ataca a un animal concreto hasta matarlo.
 *   - (nada): se queda quieto y ataca lo que entre en su radio.
 *
 *  Una orden nueva cancela la anterior. El ataque es automático mientras
 *  haya un objetivo válido.
 * ===================================================================== */
class Tiger {
  constructor(x, y) {
    const c = CONFIG.tiger;
    this.x = x; this.y = y;
    this.radius = c.radius;
    this.mass = c.mass;
    this.angle = -Math.PI / 2;

    // Estadísticas actuales (las recalcula Upgrades.applyTo).
    this.stats = {
      maxHp: c.maxHp,
      damage: c.damage,
      attacksPerSecond: c.attacksPerSecond,
      moveSpeed: c.moveSpeed,
      attackRange: c.attackRange,
      detectionRadius: c.detectionRadius,
      maxChaseDistance: c.maxChaseDistance,
      healPercent: CONFIG.corpse.healPercent,
    };
    this.hp = c.maxHp;
    this.alive = true;

    this.order = null;          // { type: 'move', x, y } | { type: 'attack', target }
    this.target = null;         // animal con el que está peleando
    this.targetExplicit = false;
    this.engageOrigin = null;   // dónde empezó la persecución (para la correa)
    this.engageTimer = 0;       // tiempo persiguiendo sin golpear
    this.ignored = new Map();   // animal -> segundos ignorado tras rendirse

    this.attackCooldown = 0;
    this.attackAnim = 0;
    this.attackSide = 1;
    this.specialCooldown = 0;
    this.hurtFlash = 0;
    this.knockX = 0; this.knockY = 0;

    this.moving = false;
    this.walkPhase = 0;
    this.time = 0;
    this.stuckTimer = 0;
    this.lastOrderDist = Infinity;
  }

  // =================== Órdenes del jugador ===================
  orderMove(x, y) {
    if (!this.alive) return;
    this.order = { type: 'move', x, y };
    this.clearTarget();
  }

  orderAttack(animal) {
    if (!this.alive || !animal || !animal.alive) return;
    this.order = { type: 'attack', target: animal };
    this.ignored.delete(animal);
    this.engage(animal, true);
  }

  engage(animal, explicit) {
    this.target = animal;
    this.targetExplicit = explicit;
    this.engageOrigin = { x: this.x, y: this.y };
    this.engageTimer = 0;
  }

  clearTarget() {
    this.target = null;
    this.targetExplicit = false;
    this.engageOrigin = null;
    this.engageTimer = 0;
    this.stuckTimer = 0;
    this.lastOrderDist = Infinity;
  }

  // =================== Bucle ===================
  update(dt, world) {
    this.time += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (!this.alive) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.updateIgnored(dt);
    this.moving = false;

    // 1. Validar objetivo y orden
    if (this.target && !this.target.alive) this.clearTarget();
    if (this.order && this.order.type === 'attack' && !this.order.target.alive) this.order = null;

    // 2. Sin objetivo: buscar presa en el radio de detección
    if (!this.target) {
      const prey = this.findNearbyPrey(world.animals);
      if (prey) this.engage(prey, false);
    }

    // 3. Correa: no perseguir indefinidamente. Se mide desde el último golpe
    //    acertado y nunca se abandona a una presa que está al alcance.
    if (this.target) {
      this.engageTimer += dt;
      const inRange = dist(this, this.target) - this.target.radius <= this.stats.attackRange;
      if (inRange) {
        // persecución productiva: no cuenta para la correa
      } else if (this.targetExplicit) {
        if (this.engageTimer > CONFIG.tiger.explicitChaseTimeout) {
          this.order = null;
          this.giveUpTarget();
        }
      } else {
        const chased = dist(this.engageOrigin, this);
        if (chased > this.stats.maxChaseDistance || this.engageTimer > CONFIG.tiger.autoChaseTimeout) {
          this.giveUpTarget();
        }
      }
    }

    // 4. Actuar
    if (this.target) {
      this.updateEngagement(dt);
    } else if (this.order && this.order.type === 'move') {
      this.updateMoveOrder(dt);
    }

    // 5. Empujones recibidos
    if (this.knockX || this.knockY) {
      this.x += this.knockX * dt;
      this.y += this.knockY * dt;
      const decay = Math.exp(-CONFIG.tiger.knockbackDecay * dt);
      this.knockX *= decay; this.knockY *= decay;
      if (Math.abs(this.knockX) + Math.abs(this.knockY) < 5) { this.knockX = 0; this.knockY = 0; }
    }
    Arena.clampEntity(this);
    if (this.moving) this.walkPhase += dt * 11;
  }

  updateIgnored(dt) {
    for (const [animal, time] of this.ignored) {
      const left = time - dt;
      if (left <= 0 || !animal.alive) this.ignored.delete(animal);
      else this.ignored.set(animal, left);
    }
  }

  giveUpTarget() {
    if (this.target) this.ignored.set(this.target, CONFIG.tiger.ignoreAfterGiveUp);
    this.clearTarget();
  }

  // Presa más cercana dentro del radio. Al caminar, solo las que tiene delante.
  findNearbyPrey(animals) {
    const moving = this.order && this.order.type === 'move';
    const halfCone = CONFIG.tiger.moveAcquireConeDegrees * Math.PI / 360;
    const moveAngle = moving ? Math.atan2(this.order.y - this.y, this.order.x - this.x) : 0;
    let best = null, bestScore = Infinity;
    for (const a of animals) {
      if (!a.alive || this.ignored.has(a)) continue;
      const d = dist(this, a) - a.radius;
      if (d > this.stats.detectionRadius) continue;
      if (moving && halfCone < Math.PI && Math.abs(wrapAngle(angleBetween(this, a) - moveAngle)) > halfCone) continue;
      const score = d - (a.isHostile ? 60 : 0); // prioriza a quien le está atacando
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  updateEngagement(dt) {
    const t = this.target;
    const range = this.stats.attackRange;
    const edge = dist(this, t) - t.radius;
    const ang = angleBetween(this, t);
    if (edge <= range) {
      this.faceAngle(ang, dt);
      if (this.attackCooldown <= 0) {
        this.strike(t);
      } else if (t.isMoving && edge > range * 0.5) {
        // Se mantiene pegado a las presas que huyen entre golpe y golpe.
        this.moveTowards(t.x, t.y, dt, t.radius + range * 0.5);
      }
    } else {
      // Persecución con una pequeña anticipación del movimiento de la presa.
      const lead = Math.min(0.35, edge / this.stats.moveSpeed);
      const p = Arena.clampPoint(t.x + t.vx * lead, t.y + t.vy * lead, t.radius);
      this.moveTowards(p.x, p.y, dt);
    }
  }

  updateMoveOrder(dt) {
    const o = this.order;
    const d = distXY(this.x, this.y, o.x, o.y);
    if (this.moveTowards(o.x, o.y, dt)) { this.order = null; return; }
    // Si algo le impide avanzar (p. ej. un animal en el punto), da la orden por cumplida.
    if (d < this.lastOrderDist - 1) {
      this.lastOrderDist = d;
      this.stuckTimer = 0;
    } else if ((this.stuckTimer += dt) > 0.8) {
      this.order = null;
    }
  }

  moveTowards(tx, ty, dt, stopDistance = 0) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopDistance + 0.5) return true;
    const step = Math.min(this.stats.moveSpeed * dt, d - stopDistance);
    this.x += dx / d * step;
    this.y += dy / d * step;
    this.faceAngle(Math.atan2(dy, dx), dt);
    this.moving = true;
    return d - step <= stopDistance + 0.5;
  }

  faceAngle(angle, dt) {
    this.angle = wrapAngle(rotateTowards(this.angle, angle, 16 * dt));
  }

  // =================== Combate ===================
  strike(target) {
    this.attackCooldown = 1 / this.stats.attacksPerSecond;
    this.attackAnim = 0.22;
    this.attackSide = -this.attackSide;
    this.engageTimer = 0;
    this.engageOrigin = { x: this.x, y: this.y };
    const ang = angleBetween(this, target);
    this.angle = ang;
    Effects.slash(target.x, target.y, ang);
    Combat.tigerStrike(this, target, this.stats.damage);
  }

  useSpecial(angle, animals) {
    if (!this.alive || this.specialCooldown > 0) return false;
    this.specialCooldown = CONFIG.special.cooldown;
    this.angle = angle;
    this.attackAnim = 0.22;
    const hits = Combat.bloodyClaw(this, angle, animals);
    Events.emit('specialUsed', { hits });
    return true;
  }

  takeDamage(amount, source) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtFlash = 0.22;
    Effects.floatText(this.x, this.y - 28, `-${Math.round(amount)}`, { color: '#ff5a4f', size: 25 });
    Events.emit('tigerDamaged', { amount, source });
    if (this.hp <= 0) { this.die(); return; }
    this.onAttackedBy(source);
  }

  // Si está quieto o peleando con una presa inofensiva, responde al agresor.
  // Si el jugador le ha mandado caminar, obedece y no se desvía.
  onAttackedBy(source) {
    if (!source || !source.alive) return;
    if (this.order && this.order.type === 'move') return;
    if (!this.target || (!this.targetExplicit && !this.target.isHostile)) this.engage(source, false);
  }

  applyKnockback(dx, dy) {
    const k = CONFIG.tiger.knockbackDecay;
    this.knockX += dx * k;
    this.knockY += dy * k;
  }

  heal(amount) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    const healed = this.hp - before;
    if (healed > 0) Events.emit('tigerHealed', { amount: healed });
    return healed;
  }

  die() {
    this.alive = false;
    this.order = null;
    this.clearTarget();
    Effects.burst(this.x, this.y, { count: 18, color: '#b3121c', speedMin: 40, speedMax: 140, life: 0.7, rMin: 2, rMax: 4 });
    Events.emit('tigerDied');
  }

  // =================== Dibujo ===================
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.alive) {
      // Círculo de selección, como una unidad de RTS.
      ctx.strokeStyle = 'rgba(140, 235, 120, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ell(ctx, 3, 5, 24, 14, this.angle);
    ctx.rotate(this.angle);
    let pal = TIGER_PALETTE;
    if (!this.alive) { pal = TIGER_DEAD; ctx.scale(1, 0.85); }
    else if (this.hurtFlash > 0) pal = TIGER_HURT;
    this.drawBody(ctx, pal);
    ctx.restore();
  }

  drawBody(ctx, pal) {
    const moving = this.moving && this.alive;
    const step = moving ? Math.sin(this.walkPhase) * 4 : 0;
    ctx.lineCap = 'round';

    // Patas
    ctx.fillStyle = pal.paw;
    circle(ctx, 10 + step, -9.5, 4);
    circle(ctx, 10 - step, 9.5, 4);
    circle(ctx, -10 - step, -9.5, 4);
    circle(ctx, -10 + step, 9.5, 4);

    // Zarpazo: una pata delantera se adelanta
    if (this.attackAnim > 0 && this.alive) {
      const p = 1 - this.attackAnim / 0.22;
      const ext = Math.sin(p * Math.PI) * 13;
      const side = this.attackSide * 7;
      ctx.fillStyle = pal.paw;
      circle(ctx, 16 + ext, side, 4.6);
      ctx.strokeStyle = '#fffaf0';
      ctx.lineWidth = 1.2;
      for (let k = -1; k <= 1; k++) line(ctx, 19 + ext, side + k * 2, 23.5 + ext, side + k * 2.6);
    }

    // Cola
    const t = this.time;
    const wag = this.alive ? Math.sin(t * (moving ? 10 : 2.5)) * (moving ? 7 : 4) : 3;
    ctx.strokeStyle = pal.fur;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-27, wag * 0.3, -36, wag);
    ctx.stroke();
    ctx.strokeStyle = pal.stripe;
    line(ctx, -33.5, wag * 0.85, -36, wag);

    // Cuerpo y rayas
    ctx.fillStyle = pal.fur;
    ell(ctx, 0, 0, 19, 11.5);
    ctx.strokeStyle = pal.stripe;
    ctx.lineWidth = 2.4;
    for (const sx of [-13, -7, -1, 5, 10]) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx, s * 11);
        ctx.quadraticCurveTo(sx + 3.5, s * 6.5, sx + 1, s * 2.5);
        ctx.stroke();
      }
    }

    // Cabeza
    ctx.fillStyle = pal.head;
    circle(ctx, 18, 0, 9.5);
    ctx.fillStyle = pal.stripe;
    circle(ctx, 14.5, -8, 3.2);
    circle(ctx, 14.5, 8, 3.2);
    ctx.fillStyle = pal.head;
    circle(ctx, 14.8, -7.6, 1.6);
    circle(ctx, 14.8, 7.6, 1.6);
    ctx.strokeStyle = pal.stripe;
    ctx.lineWidth = 1.6;
    line(ctx, 16, -3.2, 12.5, -4.6);
    line(ctx, 16, 3.2, 12.5, 4.6);
    ctx.fillStyle = pal.muzzle;
    ell(ctx, 24, 0, 4.6, 5.6);
    if (this.alive) {
      ctx.fillStyle = pal.eye;
      circle(ctx, 21, -3.8, 1.7);
      circle(ctx, 21, 3.8, 1.7);
    } else {
      ctx.strokeStyle = '#1a110b';
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        line(ctx, 19.5, s * 3.8 - 1.5, 22.5, s * 3.8 + 1.5);
        line(ctx, 19.5, s * 3.8 + 1.5, 22.5, s * 3.8 - 1.5);
      }
    }
    ctx.fillStyle = '#b25a58';
    circle(ctx, 27.8, 0, 1.7);
  }

  // Barra de vida sobre el tigre.
  drawOverlay(ctx) {
    if (!this.alive) return;
    const w = 42, x = this.x - w / 2, y = this.y - 34;
    const ratio = this.hp / this.stats.maxHp;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 1.5, y - 1.5, w + 3, 7);
    ctx.fillStyle = ratio > 0.5 ? '#6cbc58' : ratio > 0.25 ? '#eabf52' : '#e54a3f';
    ctx.fillRect(x, y, w * ratio, 4);
  }
}

const TIGER_PALETTE = { fur: '#e8862a', head: '#ef9236', paw: '#d0701f', stripe: '#1d130c', muzzle: '#f4e8d2', eye: '#c8e05a' };
const TIGER_HURT = { fur: '#ff5a44', head: '#ff6a50', paw: '#e04a36', stripe: '#4a0c08', muzzle: '#ffd0c4', eye: '#fff2a0' };
const TIGER_DEAD = { fur: '#7d5a3c', head: '#86613f', paw: '#6a4c33', stripe: '#2a1e16', muzzle: '#b8ab98', eye: '#555' };
