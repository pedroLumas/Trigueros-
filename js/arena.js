/* =====================================================================
 * ARENA — el claro de selva: límites, posiciones aleatorias, decorado
 * prerrenderizado y luciérnagas ambientales.
 * ===================================================================== */
const Arena = {
  bounds: null,
  bg: null,
  bgQuality: 0,
  fireflies: [],
  time: 0,

  init() {
    const a = CONFIG.arena;
    const left = a.x + a.border, top = a.y + a.border;
    const right = a.x + a.size - a.border, bottom = a.y + a.size - a.border;
    this.bounds = {
      left, top, right, bottom,
      width: right - left, height: bottom - top,
      cx: (left + right) / 2, cy: (top + bottom) / 2,
    };

    // Luciérnagas: solo en la selva y en el anillo de árboles, nunca en el centro.
    const rnd = seededRandom(11);
    this.fireflies = [];
    while (this.fireflies.length < 18) {
      const x = rnd() * CONFIG.view.width, y = rnd() * CONFIG.view.height;
      if (x > left + 30 && x < right - 30 && y > top + 30 && y < bottom - 30) continue;
      this.fireflies.push({
        x, y, ax: 8 + rnd() * 22, ay: 6 + rnd() * 16,
        sx: 0.15 + rnd() * 0.4, sy: 0.15 + rnd() * 0.4,
        blink: 0.7 + rnd() * 1.4, p: rnd() * TAU,
      });
    }
  },

  // ---------- Geometría ----------
  clampEntity(e) {
    const b = this.bounds;
    e.x = clamp(e.x, b.left + e.radius, b.right - e.radius);
    e.y = clamp(e.y, b.top + e.radius, b.bottom - e.radius);
  },

  clampPoint(x, y, margin = 0) {
    const b = this.bounds;
    return { x: clamp(x, b.left + margin, b.right - margin), y: clamp(y, b.top + margin, b.bottom - margin) };
  },

  randomPoint(margin = 0) {
    const b = this.bounds;
    return { x: rand(b.left + margin, b.right - margin), y: rand(b.top + margin, b.bottom - margin) };
  },

  randomPointNear(x, y, radius, margin = 0) {
    const ang = rand(0, TAU), d = rand(radius * 0.3, radius);
    return this.clampPoint(x + Math.cos(ang) * d, y + Math.sin(ang) * d, margin);
  },

  // ---------- Dibujo ----------
  update(dt) { this.time += dt; },

  ensureBackground(quality) {
    if (this.bg && this.bgQuality === quality) return;
    this.bg = this.renderBackground(quality);
    this.bgQuality = quality;
  },

  draw(ctx) {
    ctx.drawImage(this.bg, 0, 0, CONFIG.view.width, CONFIG.view.height);
  },

  drawAmbient(ctx) {
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const glow = Math.max(0, Math.sin(t * f.blink + f.p));
      if (glow < 0.05) continue;
      const x = f.x + Math.sin(t * f.sx + f.p) * f.ax;
      const y = f.y + Math.cos(t * f.sy + f.p * 1.3) * f.ay;
      ctx.fillStyle = `rgba(210, 240, 120, ${0.10 * glow})`;
      circle(ctx, x, y, 7);
      ctx.fillStyle = `rgba(235, 255, 170, ${0.65 * glow})`;
      circle(ctx, x, y, 1.6);
    }
    ctx.restore();
  },

  // El decorado se pinta una sola vez en un canvas aparte.
  renderBackground(quality) {
    const W = CONFIG.view.width, H = CONFIG.view.height, a = CONFIG.arena, b = this.bounds;
    const c = document.createElement('canvas');
    c.width = Math.round(W * quality);
    c.height = Math.round(H * quality);
    const g = c.getContext('2d');
    g.scale(quality, quality);
    const rnd = seededRandom(1337);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];

    // 1. Selva profunda (laterales)
    g.fillStyle = '#07110a';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * W, y = rnd() * H, r = 14 + rnd() * 30;
      g.fillStyle = pick(['#0b1c0e', '#0e2312', '#102816', '#0a180c', '#13301a']);
      circle(g, x, y, r);
      g.fillStyle = 'rgba(90, 140, 80, 0.06)';
      circle(g, x - r * 0.3, y - r * 0.3, r * 0.5);
    }

    // 2. Suelo del claro
    const ground = g.createRadialGradient(b.cx, b.cy, 40, b.cx, b.cy, a.size * 0.72);
    ground.addColorStop(0, '#2a4c24');
    ground.addColorStop(1, '#1a3317');
    g.fillStyle = ground;
    g.fillRect(a.x, a.y, a.size, a.size);

    // 3. Manchas de tierra y musgo
    for (let i = 0; i < 46; i++) {
      g.fillStyle = rnd() < 0.6 ? 'rgba(20, 38, 18, 0.45)' : 'rgba(70, 110, 55, 0.16)';
      ell(g, a.x + rnd() * a.size, a.y + rnd() * a.size, 18 + rnd() * 48, 10 + rnd() * 26, rnd() * TAU);
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(70, 52, 30, 0.22)';
      ell(g, b.left + rnd() * b.width, b.top + rnd() * b.height, 10 + rnd() * 24, 6 + rnd() * 12, rnd() * TAU);
    }

    // 4. Matas de hierba
    g.lineCap = 'round';
    for (let i = 0; i < 320; i++) {
      const x = a.x + rnd() * a.size, y = a.y + rnd() * a.size;
      g.strokeStyle = pick(['#3d6c33', '#2f5829', '#467a3a', '#28492a']);
      g.lineWidth = 1.2;
      for (let k = -1; k <= 1; k++) line(g, x + k * 2, y, x + k * 3.2 + rnd() * 1.5, y - 4 - rnd() * 3);
    }

    // 5. Piedrecitas, flores y hojas caídas (muy discretas)
    for (let i = 0; i < 22; i++) {
      const x = b.left + rnd() * b.width, y = b.top + rnd() * b.height, r = 1.5 + rnd() * 3;
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ell(g, x + 1, y + 1.2, r * 1.2, r * 0.8);
      g.fillStyle = pick(['#5d665a', '#6c7464', '#4f584d']);
      ell(g, x, y, r * 1.2, r * 0.8);
    }
    for (let i = 0; i < 34; i++) {
      g.fillStyle = pick(['rgba(233, 211, 106, 0.8)', 'rgba(231, 161, 196, 0.75)', 'rgba(242, 242, 230, 0.7)']);
      circle(g, a.x + rnd() * a.size, a.y + rnd() * a.size, 1.4);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = pick(['rgba(120, 95, 40, 0.45)', 'rgba(90, 70, 30, 0.45)']);
      ell(g, a.x + rnd() * a.size, a.y + rnd() * a.size, 3 + rnd() * 2, 1.4, rnd() * TAU);
    }

    // 6. Sombra interior junto al borde jugable
    const edge = 46;
    const shades = [
      [b.left, b.top, b.left + edge, b.top, b.left, b.top, edge, b.height],
      [b.right, b.top, b.right - edge, b.top, b.right - edge, b.top, edge, b.height],
      [b.left, b.top, b.left, b.top + edge, b.left, b.top, b.width, edge],
      [b.left, b.bottom, b.left, b.bottom - edge, b.left, b.bottom - edge, b.width, edge],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of shades) {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
      lg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = lg;
      g.fillRect(rx, ry, rw, rh);
    }

    // 7. Anillo de árboles alrededor del claro
    const drawTree = (x, y, r) => {
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ell(g, x + r * 0.25, y + r * 0.3, r * 1.02, r * 0.95);
      g.fillStyle = pick(['#173a1b', '#1a4220', '#143418', '#1d4722', '#21502a']);
      for (let k = 0; k < 6; k++) {
        const ang = k / 6 * TAU + rnd() * 0.5;
        circle(g, x + Math.cos(ang) * r * 0.42, y + Math.sin(ang) * r * 0.42, r * 0.6);
      }
      circle(g, x, y, r * 0.75);
      const light = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x - r * 0.1, y - r * 0.1, r);
      light.addColorStop(0, 'rgba(140, 190, 100, 0.30)');
      light.addColorStop(1, 'rgba(140, 190, 100, 0)');
      g.fillStyle = light;
      circle(g, x, y, r);
    };
    const trees = [];
    const ringTree = (along, side) => {
      const r = 18 + rnd() * 13;
      const out = r * 0.7 + rnd() * 14; // distancia hacia fuera desde el borde jugable
      if (side === 'top') trees.push([along, b.top - out, r]);
      if (side === 'bottom') trees.push([along, b.bottom + out, r]);
      if (side === 'left') trees.push([b.left - out, along, r]);
      if (side === 'right') trees.push([b.right + out, along, r]);
    };
    for (let p = a.x - 10; p < a.x + a.size + 10; p += 20 + rnd() * 10) {
      ringTree(p, 'top');
      ringTree(p, 'bottom');
    }
    for (let p = a.y - 10; p < a.y + a.size + 10; p += 20 + rnd() * 10) {
      ringTree(p, 'left');
      ringTree(p, 'right');
    }
    // Se dibujan de arriba abajo para que se solapen con naturalidad.
    trees.sort((t1, t2) => t1[1] - t2[1]);
    for (const [x, y, r] of trees) drawTree(x, y, r);

    // Arbustos pequeños asomando al claro
    for (let i = 0; i < 26; i++) {
      const side = Math.floor(rnd() * 4);
      let x, y;
      if (side === 0) { x = b.left + rnd() * b.width; y = b.top + rnd() * 6; }
      if (side === 1) { x = b.left + rnd() * b.width; y = b.bottom - rnd() * 6; }
      if (side === 2) { x = b.left + rnd() * 6; y = b.top + rnd() * b.height; }
      if (side === 3) { x = b.right - rnd() * 6; y = b.top + rnd() * b.height; }
      const r = 6 + rnd() * 6;
      g.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ell(g, x + 2, y + 3, r, r * 0.8);
      g.fillStyle = pick(['#2b5a27', '#326630', '#24502a']);
      circle(g, x, y, r);
      g.fillStyle = 'rgba(150, 200, 110, 0.18)';
      circle(g, x - r * 0.3, y - r * 0.3, r * 0.5);
    }

    // 8. Viñeta general
    const vig = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);

    return c;
  },
};
