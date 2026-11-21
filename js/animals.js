/* =====================================================================
 * ANIMALES — entidad Animal, inteligencia artificial y dibujo.
 *
 * Comportamientos (CONFIG.animals[x].behavior):
 *  - skittish (conejo, antílope): deambulan y huyen del tigre; se cansan.
 *  - brawler  (jabalí): deambula; si le atacan, persigue y muerde.
 *  - charger  (ciervo): deambula; si le atacan, prepara embestidas
 *                       con aviso visual y queda aturdido después.
 * ===================================================================== */
const HOSTILE_STATES = new Set(['aggro', 'approach', 'reposition', 'windup', 'charge', 'recover']);

class Animal {
  constructor(kind, x, y) {
    const def = CONFIG.animals[kind];
    this.kind = kind;
    this.def = def;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = def.radius;
    this.mass = def.mass;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.alive = true;
    this.angle = rand(-Math.PI, Math.PI);
    this.age = 0;

    this.state = 'wander';
    this.stateTime = 0;
    this.wanderTarget = null;
    this.wanderTimer = 0;
    this.pauseTimer = rand(0.2, 1.2);
    this.walkPhase = rand(0, TAU);

    this.flash = 0;        // destello blanco al recibir un golpe
    this.slowTimer = 0;    // frenazo al recibir un golpe
    this.sinceHurt = 99;
    this.sinceStrike = 99;

    this.stamina = def.fleeStamina || 0;
    this.aggroOrigin = null;
    this.attackCooldown = 0;
    this.lunge = 0;

    this.chargeDir = 0;
    this.chargeTravelled = 0;
    this.chargeHit = false;
    this.unstoppable = false; // durante la embestida no le frenan ni le empujan
  }

  get isHostile() { return HOSTILE_STATES.has(this.state); }
  get isMoving() { return this.vx * this.vx + this.vy * this.vy > 100; }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  speedFactor() {
    return this.slowTimer > 0 && !this.unstoppable ? CONFIG.combat.hitSlowFactor : 1;
  }

  update(dt, world) {
    if (!this.alive) return;
    this.age += dt;
    this.stateTime += dt;
    this.sinceHurt += dt;
    this.sinceStrike += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.lunge = Math.max(0, this.lunge - dt);

    this.vx = 0; this.vy = 0;
    AnimalAI[this.def.behavior](this, dt, world);

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 1) this.walkPhase += dt * (6 + sp * 0.08);
    Arena.clampEntity(this);
  }

  // ---------- Movimiento ----------
  steer(dx, dy, speed, dt) {
    const len = Math.hypot(dx, dy) || 1;
    const s = speed * this.speedFactor();
    this.vx = dx / len * s;
    this.vy = dy / len * s;
    this.turnTo(Math.atan2(dy, dx), dt, 10);
  }

  moveTo(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) return true;
    this.steer(dx, dy, Math.min(speed, d / dt), dt);
    return false;
  }

  turnTo(angle, dt, rate) {
    this.angle = wrapAngle(rotateTowards(this.angle, angle, rate * dt));
  }

  wander(dt, speed) {
    if (this.pauseTimer > 0) { this.pauseTimer -= dt; return; }
    if (!this.wanderTarget) {
      this.wanderTarget = Arena.randomPointNear(this.x, this.y, 170, this.radius + 10);
      this.wanderTimer = 0;
    }
    this.wanderTimer += dt;
    if (this.moveTo(this.wanderTarget.x, this.wanderTarget.y, speed, dt) || this.wanderTimer > 6) {
      this.wanderTarget = null;
      this.pauseTimer = rand(0.6, 2.4);
    }
  }

  // ---------- Daño ----------
  takeDamage(amount, source) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 0.12;
    this.slowTimer = CONFIG.combat.hitSlowDuration;
    this.sinceHurt = 0;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.unstoppable = false;
      Events.emit('animalKilled', { animal: this, source });
      return true;
    }
    AnimalAI.onHurt(this, source);
    return false;
  }

  // ---------- Dibujo ----------
  draw(ctx) {
    const k = this.age < 0.35 ? Math.max(0.01, easeOutBack(this.age / 0.35)) : 1;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ell(ctx, 2, 4, this.radius * 1.35 * k, this.radius * 0.9 * k);
    if (this.state === 'windup') ctx.translate(Math.sin(this.stateTime * 70) * 1.6, 0);
    ctx.rotate(this.angle);
    if (this.lunge > 0) ctx.translate(Math.sin((1 - this.lunge / 0.2) * Math.PI) * 7, 0);
    const bob = this.isMoving ? Math.sin(this.walkPhase * 2) * 0.05 : 0;
    ctx.scale(k * (1 + bob), k * (1 - bob));
    AnimalArt[this.kind](ctx, this, this.flash > 0 ? COLOR_FLASH : COLOR_SAME);
    ctx.restore();
  }

  // Indicador de embestida: franja roja que se rellena antes de cargar.
  drawTelegraph(ctx) {
    if (this.state !== 'windup') return;
    const def = this.def;
    const p = clamp(this.stateTime / def.chargeWindup, 0, 1);
    const locked = this.stateTime >= def.chargeWindup - def.aimLockTime;
    const len = def.chargeDistance, w = this.radius * 2 + 8;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.chargeDir);
    ctx.fillStyle = `rgba(230, 40, 30, ${0.10 + 0.15 * p})`;
    ctx.fillRect(0, -w / 2, len, w);
    ctx.fillStyle = `rgba(255, 70, 50, ${locked ? 0.42 : 0.24})`;
    ctx.fillRect(0, -w / 2, len * p, w);
    ctx.beginPath();
    ctx.moveTo(len + 14, 0);
    ctx.lineTo(len, -w / 2 - 5);
    ctx.lineTo(len, w / 2 + 5);
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 80, 60, ${0.25 + 0.45 * p})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 140, 120, ${0.25 + 0.4 * p})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, -w / 2, len, w);
    ctx.restore();
  }

  // Barra de vida, "!" de agresividad y estrellas de aturdimiento.
  drawOverlay(ctx, time) {
    const top = this.y - this.radius;
    if (this.hp < this.maxHp) {
      const w = Math.max(20, this.radius * 2.4), x = this.x - w / 2, y = top - 11;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = '#e8473c';
      ctx.fillRect(x, y, w * this.hp / this.maxHp, 3);
    }
    if (this.state === 'recover') {
      ctx.fillStyle = '#ffe17a';
      for (let i = 0; i < 3; i++) {
        const ang = time * 5 + i * TAU / 3;
        circle(ctx, this.x + Math.cos(ang) * 10, top - 16 + Math.sin(ang) * 3, 2);
      }
    } else if (this.isHostile) {
      ctx.font = `600 20px ${FONT_NUM}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(12, 6, 4, 0.85)';
      ctx.strokeText('!', this.x, top - 20);
      ctx.fillStyle = '#ff5a4a';
      ctx.fillText('!', this.x, top - 20);
    }
  }
}

/* ---------------------------------------------------------------------
 * Inteligencia artificial
 * ------------------------------------------------------------------- */
const AnimalAI = {
  // Reacción inmediata al recibir un golpe del tigre.
  onHurt(a) {
    const behavior = a.def.behavior;
    if (behavior === 'skittish') {
      if (a.state === 'wander') {
        a.stamina = Math.max(a.stamina, a.def.fleeStamina * 0.5);
        a.setState('flee');
        a.wanderTarget = null;
      }
    } else if (behavior === 'brawler') {
      if (a.state !== 'aggro') {
        a.setState('aggro');
        a.attackCooldown = a.def.firstAttackDelay;
        a.sinceStrike = 0;
      }
      a.aggroOrigin = { x: a.x, y: a.y };
    } else if (behavior === 'charger') {
      if (a.state === 'wander') a.setState('approach');
      a.aggroOrigin = { x: a.x, y: a.y };
    }
  },

  calmDown(a) {
    a.setState('wander');
    a.aggroOrigin = null;
    a.wanderTarget = null;
    a.unstoppable = false;
    a.pauseTimer = rand(0.5, 1.2);
  },

  // Dirección de huida: lejos del tigre, evitando paredes y esquinas.
  fleeDirection(a, tiger, zigzag) {
    let dx = a.x - tiger.x, dy = a.y - tiger.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const b = Arena.bounds, margin = 70, push = 1.6;
    const wl = a.x - b.left, wr = b.right - a.x, wt = a.y - b.top, wb = b.bottom - a.y;
    if (wl < margin) dx += (1 - wl / margin) * push;
    if (wr < margin) dx -= (1 - wr / margin) * push;
    if (wt < margin) dy += (1 - wt / margin) * push;
    if (wb < margin) dy -= (1 - wb / margin) * push;
    if (Math.hypot(dx, dy) < 0.25) {
      // Acorralado: se escurre de lado.
      const side = Math.sin(a.walkPhase) > 0 ? 1 : -1;
      dx = -(a.y - tiger.y) / d * side;
      dy = (a.x - tiger.x) / d * side;
    }
    if (zigzag) {
      const z = Math.sin(a.stateTime * 9 + a.walkPhase) * zigzag;
      const c = Math.cos(z), s = Math.sin(z);
      [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
    }
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  },

  // ---- Presas: conejo y antílope ----
  skittish(a, dt, world) {
    const def = a.def, tiger = world.tiger;
    const threat = tiger.alive ? dist(a, tiger) : Infinity;
    if (a.state === 'wander') a.stamina = Math.min(def.fleeStamina, a.stamina + dt * def.staminaRegen);

    switch (a.state) {
      case 'wander':
        if (threat < def.fearRadius && a.stamina > 0.3) {
          a.setState('flee');
          a.wanderTarget = null;
          break;
        }
        a.wander(dt, def.wanderSpeed);
        break;

      case 'flee': {
        if (threat > def.fearRadius * def.calmFactor) {
          a.setState('wander');
          a.pauseTimer = rand(0.3, 0.8);
          break;
        }
        a.stamina -= dt;
        if (a.stamina <= 0) { a.setState('tired'); break; }
        const dir = AnimalAI.fleeDirection(a, tiger, def.zigzag);
        a.steer(dir.x, dir.y, def.fleeSpeed, dt);
        break;
      }

      case 'tired': {
        if (a.stateTime >= def.tiredTime) {
          a.stamina = def.fleeStamina * 0.6;
          a.setState(threat < def.fearRadius ? 'flee' : 'wander');
          break;
        }
        if (threat < def.fearRadius * def.calmFactor) {
          const dir = AnimalAI.fleeDirection(a, tiger, 0);
          a.steer(dir.x, dir.y, def.tiredSpeed, dt);
        }
        break;
      }
    }
  },

  // ---- Jabalí ----
  brawler(a, dt, world) {
    const def = a.def, tiger = world.tiger;
    if (a.state !== 'aggro') { a.wander(dt, def.wanderSpeed); return; }

    const tooFar = dist(a, a.aggroOrigin) > def.aggroLeash;
    const bored = a.sinceHurt > def.aggroTimeout && a.sinceStrike > def.aggroTimeout;
    if (!tiger.alive || tooFar || bored) { AnimalAI.calmDown(a); return; }

    const ang = angleBetween(a, tiger);
    const gap = dist(a, tiger) - a.radius - tiger.radius;
    if (gap > def.attackReach) {
      a.steer(Math.cos(ang), Math.sin(ang), def.chaseSpeed, dt);
    } else {
      a.turnTo(ang, dt, 12);
      if (a.attackCooldown <= 0) {
        a.attackCooldown = def.attackInterval;
        a.lunge = 0.2;
        a.sinceStrike = 0;
        Combat.animalStrike(a, tiger, def.damage);
      }
    }
  },

  // ---- Ciervo ----
  charger(a, dt, world) {
    const def = a.def, tiger = world.tiger;
    if (a.state === 'wander') { a.wander(dt, def.wanderSpeed); return; }
    if (a.state === 'charge') { AnimalAI.chargeStep(a, dt, tiger); return; }
    if (!tiger.alive) { AnimalAI.calmDown(a); return; }

    const d = dist(a, tiger), ang = angleBetween(a, tiger);
    switch (a.state) {
      case 'approach':
        if (dist(a, a.aggroOrigin) > def.aggroLeash || a.sinceHurt > def.aggroTimeout) {
          AnimalAI.calmDown(a);
          return;
        }
        if (d <= def.chargeTriggerDistance) {
          if (d < def.minChargeDistance) a.setState('reposition');
          else { a.setState('windup'); a.chargeDir = ang; }
        } else {
          a.steer(Math.cos(ang), Math.sin(ang), def.chaseSpeed, dt);
        }
        break;

      case 'reposition': {
        // Retrocede para tomar carrerilla.
        const away = AnimalAI.fleeDirection(a, tiger, 0);
        a.steer(away.x, away.y, def.chaseSpeed, dt);
        a.angle = ang; // sigue mirando al tigre mientras retrocede
        if (d >= def.minChargeDistance + 20 || a.stateTime >= def.repositionTime) {
          a.setState('windup');
          a.chargeDir = ang;
        }
        break;
      }

      case 'windup':
        // Apunta al tigre hasta los últimos instantes: así se puede esquivar.
        if (a.stateTime < def.chargeWindup - def.aimLockTime) a.chargeDir = ang;
        a.turnTo(a.chargeDir, dt, 16);
        if (a.stateTime >= def.chargeWindup) {
          a.setState('charge');
          a.angle = a.chargeDir;
          a.chargeTravelled = 0;
          a.chargeHit = false;
          a.unstoppable = true;
        }
        break;

      case 'recover':
        if (a.stateTime >= def.chargeRecover) a.setState('approach');
        break;
    }
  },

  chargeStep(a, dt, tiger) {
    const def = a.def, b = Arena.bounds;
    const cx = Math.cos(a.chargeDir), cy = Math.sin(a.chargeDir);
    if (tiger.alive && !a.chargeHit && dist(a, tiger) <= a.radius + tiger.radius + 4) {
      a.chargeHit = true;
      Combat.animalStrike(a, tiger, def.damage, def.chargeKnockback, a.chargeDir);
      AnimalAI.endCharge(a);
      return;
    }
    const nx = a.x + cx * def.chargeSpeed * dt, ny = a.y + cy * def.chargeSpeed * dt;
    const hitsWall = nx < b.left + a.radius || nx > b.right - a.radius || ny < b.top + a.radius || ny > b.bottom - a.radius;
    if (hitsWall || a.chargeTravelled >= def.chargeDistance) {
      if (hitsWall) Effects.dust(a.x + cx * a.radius, a.y + cy * a.radius);
      AnimalAI.endCharge(a);
      return;
    }
    a.vx = cx * def.chargeSpeed;
    a.vy = cy * def.chargeSpeed;
    a.chargeTravelled += def.chargeSpeed * dt;
    if (Math.random() < dt * 25) {
      Effects.burst(a.x - cx * a.radius, a.y - cy * a.radius, { count: 2, color: 'rgba(170, 160, 130, 0.6)', speedMin: 10, speedMax: 40, life: 0.4, layer: 'ground' });
    }
  },

  endCharge(a) {
    a.unstoppable = false;
    a.vx = 0; a.vy = 0;
    a.setState('recover');
  },
};

/* ---------------------------------------------------------------------
 * Dibujo de cada especie (mirando hacia +x, vista cenital).
 * `col` permite reutilizar las formas para destellos y cadáveres.
 * ------------------------------------------------------------------- */
const COLOR_SAME = c => c;
const COLOR_FLASH = () => '#ffffff';
const COLOR_CORPSE = c => mixColor(c, '#2a0d0c', 0.5);

const AnimalArt = {
  rabbit(ctx, a, col) {
    ctx.fillStyle = col('#f4efe6');
    circle(ctx, -8, 0, 2.6);                       // cola
    ctx.fillStyle = col('#c9b89c');
    ell(ctx, 0, 0, 8.5, 6.2);                      // cuerpo
    ctx.fillStyle = col('#d6c6aa');
    circle(ctx, 6.5, 0, 4.6);                      // cabeza
    ctx.fillStyle = col('#b8a487');
    ell(ctx, 1.5, -3, 6, 1.9, -0.25);              // orejas tumbadas
    ell(ctx, 1.5, 3, 6, 1.9, 0.25);
    ctx.fillStyle = col('#e5b0ae');
    ell(ctx, 1.8, -3, 4, 0.8, -0.25);
    ell(ctx, 1.8, 3, 4, 0.8, 0.25);
    ctx.fillStyle = col('#2a1d14');
    circle(ctx, 8.5, -2.2, 0.9);
    circle(ctx, 8.5, 2.2, 0.9);
  },

  antelope(ctx, a, col) {
    ctx.fillStyle = col('#3b2a18');
    ell(ctx, -12.8, 0, 2.6, 1.4);                  // cola
    ctx.fillStyle = col('#c8964a');
    ell(ctx, 0, 0, 12.5, 6.2);                     // cuerpo esbelto
    ctx.strokeStyle = col('#6e4b22');
    ctx.lineWidth = 1.4;
    line(ctx, -7, -4.6, 7, -4.6);                  // franjas laterales
    line(ctx, -7, 4.6, 7, 4.6);
    ctx.fillStyle = col('#c8964a');
    ell(ctx, 11, 0, 4.5, 3);                       // cuello
    ctx.fillStyle = col('#d6a65c');
    ell(ctx, 15, 0, 4.2, 3.2);                     // cabeza
    ctx.strokeStyle = col('#2a2016');
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();                               // cuernos largos
    ctx.moveTo(14, -1.8); ctx.quadraticCurveTo(8, -4.8, 2.5, -3.3);
    ctx.moveTo(14, 1.8); ctx.quadraticCurveTo(8, 4.8, 2.5, 3.3);
    ctx.stroke();
    ctx.fillStyle = col('#1e140c');
    circle(ctx, 16.6, -2, 0.8);
    circle(ctx, 16.6, 2, 0.8);
  },

  boar(ctx, a, col) {
    ctx.fillStyle = col('#4e3727');
    ell(ctx, -1, 0, 15, 11.5);                     // cuerpo robusto
    ctx.strokeStyle = col('#2b1d13');
    ctx.lineWidth = 2;
    line(ctx, -14, 0, 8, 0);                       // cresta de cerdas
    ctx.lineWidth = 1.2;
    for (let x = -12; x <= 6; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, -2.5); ctx.lineTo(x + 2, 0); ctx.lineTo(x, 2.5);
      ctx.stroke();
    }
    ctx.fillStyle = col('#3a281c');                // orejas
    ctx.beginPath();
    ctx.moveTo(10, -5); ctx.lineTo(5.5, -10); ctx.lineTo(7, -3.5);
    ctx.moveTo(10, 5); ctx.lineTo(5.5, 10); ctx.lineTo(7, 3.5);
    ctx.fill();
    ctx.fillStyle = col('#5c4130');
    circle(ctx, 13, 0, 7);                         // cabeza
    ctx.fillStyle = col('#a87862');
    ell(ctx, 19.5, 0, 3.2, 4);                     // hocico
    ctx.fillStyle = col('#4a2c22');
    circle(ctx, 20.6, -1.3, 0.8);
    circle(ctx, 20.6, 1.3, 0.8);
    ctx.strokeStyle = col('#f1ead8');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();                               // colmillos
    ctx.moveTo(17, -4); ctx.quadraticCurveTo(20, -7, 22.5, -6);
    ctx.moveTo(17, 4); ctx.quadraticCurveTo(20, 7, 22.5, 6);
    ctx.stroke();
    ctx.fillStyle = col(a && a.isHostile ? '#ff4433' : '#1a120c');
    circle(ctx, 15, -3.6, 1.1);
    circle(ctx, 15, 3.6, 1.1);
  },

  deer(ctx, a, col) {
    ctx.fillStyle = col('#efe4cf');
    ell(ctx, -14, 0, 4, 5.5);                      // grupa blanca
    ctx.fillStyle = col('#9a5532');
    ell(ctx, 0, 0, 15.5, 9);                       // cuerpo
    ctx.fillStyle = col('#7d4024');
    ell(ctx, -1, 0, 12, 3.2);                      // lomo
    ctx.fillStyle = col('#9a5532');
    ell(ctx, 13, 0, 5, 4);                         // cuello
    ctx.fillStyle = col('#a8603a');
    ell(ctx, 18, 0, 5.5, 4);                       // cabeza
    ctx.fillStyle = col('#3a2418');
    circle(ctx, 23.2, 0, 1.4);
    ctx.strokeStyle = col('#e2d2ad');              // cornamenta
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(16, s * 2.5);
      ctx.quadraticCurveTo(14, s * 9, 9, s * 13);
      ctx.moveTo(14.6, s * 7); ctx.lineTo(19.5, s * 10);
      ctx.moveTo(12.2, s * 10.4); ctx.lineTo(14.8, s * 15);
      ctx.moveTo(10.2, s * 12.2); ctx.lineTo(5.5, s * 13);
      ctx.stroke();
    }
    ctx.fillStyle = col('#1e140c');
    circle(ctx, 19.6, -2.6, 1);
    circle(ctx, 19.6, 2.6, 1);
  },
};
