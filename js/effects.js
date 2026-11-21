/* =====================================================================
 * EFECTOS — respuesta visual: números flotantes, marcadores de orden,
 * zarpazos, partículas, recogida de sangre y arco del ataque especial.
 * Todo es cosmético: ningún efecto cambia el estado del juego.
 * Capas: 'ground' (bajo los animales) y 'top' (por encima de todo).
 * ===================================================================== */
const FONT_NUM = '"Teko", "Arial Narrow", "Roboto Condensed", sans-serif';

const Effects = {
  items: [],

  reset() { this.items = []; },

  add(fx) {
    if (fx.t === undefined) fx.t = 0;
    this.items.push(fx);
    return fx;
  },

  update(dt) {
    for (const fx of this.items) {
      fx.t += dt;
      if (fx.update && fx.t >= 0) fx.update(dt);
    }
    this.items = this.items.filter(fx => fx.t < fx.life);
  },

  draw(ctx, layer) {
    for (const fx of this.items) {
      if (fx.layer !== layer || fx.t < 0) continue;
      ctx.save();
      fx.draw(ctx, clamp(fx.t / fx.life, 0, 1));
      ctx.restore();
    }
  },

  // ---------------------------------------------------------------
  // Número o texto que sube y se desvanece.
  floatText(x, y, text, opts = {}) {
    const size = opts.size || 20;
    const color = opts.color || '#fff3d6';
    const rise = opts.rise === undefined ? 36 : opts.rise;
    const ox = x + rand(-5, 5);
    return this.add({
      layer: 'top', life: opts.life || 0.95, t: -(opts.delay || 0),
      draw(ctx, p) {
        const pop = p < 0.18 ? 0.6 + 0.4 * easeOutBack(p / 0.18) : 1;
        ctx.globalAlpha = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
        const yy = y - rise * easeOutCubic(p);
        ctx.font = `600 ${(size * pop).toFixed(1)}px ${FONT_NUM}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(12, 6, 4, 0.85)';
        ctx.strokeText(text, ox, yy);
        ctx.fillStyle = color;
        ctx.fillText(text, ox, yy);
      },
    });
  },

  // Marcador verde al ordenar movimiento (flechas que convergen).
  moveMarker(x, y) {
    this.add({
      layer: 'ground', life: 0.6,
      draw(ctx, p) {
        const a = 1 - p;
        const r = lerp(18, 4, easeOutCubic(p));
        ctx.strokeStyle = `rgba(150, 240, 125, ${a})`;
        ctx.fillStyle = `rgba(150, 240, 125, ${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const ang = i * Math.PI / 2 + Math.PI / 4;
          const d = r + 7;
          ctx.save();
          ctx.translate(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
          ctx.rotate(ang + Math.PI);
          ctx.beginPath();
          ctx.moveTo(4.5, 0);
          ctx.lineTo(-3, -3.6);
          ctx.lineTo(-3, 3.6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      },
    });
  },

  // Anillo rojo sobre el animal marcado con clic.
  targetMarker(target) {
    this.add({
      layer: 'ground', life: 0.5,
      draw(ctx, p) {
        const r = target.radius + lerp(18, 6, easeOutCubic(p));
        ctx.strokeStyle = `rgba(255, 80, 60, ${1 - p})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(target.x, target.y, r, 0, TAU);
        ctx.stroke();
      },
    });
  },

  // Tres marcas de garra sobre el objetivo.
  slash(x, y, angle, scale = 1) {
    this.add({
      layer: 'top', life: 0.24,
      draw(ctx, p) {
        ctx.translate(x, y);
        ctx.rotate(angle + 0.8);
        ctx.scale(scale, scale);
        const grow = easeOutCubic(Math.min(1, p / 0.45));
        ctx.globalAlpha = 1 - Math.max(0, (p - 0.4) / 0.6);
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          const oy = i * 5.5;
          const len = 13 * grow;
          ctx.beginPath();
          ctx.moveTo(-len, oy - 2);
          ctx.quadraticCurveTo(0, oy + 3, len, oy - 2);
          ctx.strokeStyle = 'rgba(255, 70, 55, 0.9)';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 246, 232, 0.95)';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      },
    });
  },

  // Partículas genéricas.
  burst(x, y, opts = {}) {
    const count = opts.count || 8;
    const spread = opts.spread === undefined ? Math.PI : opts.spread;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const ang = (opts.angle === undefined ? rand(0, TAU) : opts.angle) + rand(-spread, spread);
      const sp = rand(opts.speedMin || 40, opts.speedMax || 120);
      parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rand(opts.rMin || 1.5, opts.rMax || 3) });
    }
    this.add({
      layer: opts.layer || 'top', life: opts.life || 0.45, parts, color: opts.color || '#c8232f',
      update(dt) {
        const drag = Math.pow(0.03, dt);
        for (const q of this.parts) {
          q.x += q.vx * dt; q.y += q.vy * dt;
          q.vx *= drag; q.vy *= drag;
        }
      },
      draw(ctx, p) {
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = this.color;
        for (const q of this.parts) circle(ctx, q.x, q.y, q.r * (1 - p * 0.5));
      },
    });
  },

  hitSparks(x, y, angle) {
    this.burst(x, y, { count: 7, angle, spread: 0.9, color: '#e0303a', speedMin: 60, speedMax: 170, life: 0.35 });
  },

  dust(x, y) {
    this.burst(x, y, { count: 8, color: 'rgba(190, 180, 150, 0.8)', speedMin: 20, speedMax: 70, life: 0.5, rMin: 2, rMax: 4, layer: 'ground' });
  },

  // Anillo que se expande (aparición de animales, compra de mejoras...).
  ring(x, y, opts = {}) {
    const from = opts.from || 6, to = opts.to || 30, width = opts.width || 2;
    const color = opts.color || '255, 255, 255';
    this.add({
      layer: opts.layer || 'top', life: opts.life || 0.5,
      draw(ctx, p) {
        const cx = opts.follow ? opts.follow.x : x;
        const cy = opts.follow ? opts.follow.y : y;
        ctx.strokeStyle = `rgba(${color}, ${1 - p})`;
        ctx.lineWidth = width * (1 - p * 0.5);
        ctx.beginPath();
        ctx.arc(cx, cy, lerp(from, to, easeOutCubic(p)), 0, TAU);
        ctx.stroke();
      },
    });
  },

  // Recogida de cadáver: salpicadura + gotas que vuelan al contador de sangre.
  devour(x, y, amount, hudTarget) {
    this.burst(x, y, { count: 12, color: '#d3242f', speedMin: 50, speedMax: 150, life: 0.5, rMin: 2, rMax: 3.5 });
    this.ring(x, y, { color: '255, 85, 85', from: 6, to: 36, life: 0.4, width: 3 });
    if (!hudTarget) return;
    const n = Math.min(10, 3 + Math.floor(amount / 6));
    for (let i = 0; i < n; i++) {
      const sx = x + rand(-8, 8), sy = y + rand(-8, 8);
      const cx = lerp(sx, hudTarget.x, 0.35) + rand(-90, 90);
      const cy = Math.min(sy, hudTarget.y) - rand(60, 170);
      this.add({
        layer: 'top', life: rand(0.55, 0.8), t: -i * 0.035,
        draw(ctx, p) {
          const e = p * p;
          const u = 1 - e;
          const px = u * u * sx + 2 * u * e * cx + e * e * hudTarget.x;
          const py = u * u * sy + 2 * u * e * cy + e * e * hudTarget.y;
          ctx.fillStyle = 'rgba(255, 60, 70, 0.25)';
          circle(ctx, px, py, 6 - 2 * e);
          ctx.fillStyle = '#e8343f';
          circle(ctx, px, py, 3.2 - 1.2 * e);
        },
      });
    }
  },

  // Arco rojo del zarpazo sangriento.
  specialArc(x, y, angle, range, arc) {
    this.add({
      layer: 'top', life: 0.42,
      draw(ctx, p) {
        const sweep = easeOutCubic(Math.min(1, p / 0.35));
        const start = angle - arc / 2;
        const end = start + arc * sweep;
        const alpha = p < 0.35 ? 0.6 : 0.6 * (1 - (p - 0.35) / 0.65);
        const g = ctx.createRadialGradient(x, y, range * 0.15, x, y, range);
        g.addColorStop(0, 'rgba(200, 20, 30, 0)');
        g.addColorStop(0.55, `rgba(215, 30, 40, ${alpha * 0.55})`);
        g.addColorStop(1, `rgba(255, 60, 60, ${alpha})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, range, start, end);
        ctx.closePath();
        ctx.fill();
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255, 210, 200, ${Math.min(1, alpha * 1.5)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, range, start, end);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (const k of [0.55, 0.72, 0.89]) {
          ctx.beginPath();
          ctx.arc(x, y, range * k, start + 0.12, Math.max(start + 0.12, end - 0.12));
          ctx.stroke();
        }
      },
    });
  },
};
