/* =====================================================================
 * UTILIDADES — matemáticas y dibujo comunes.
 * ===================================================================== */
const TAU = Math.PI * 2;

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return min + Math.random() * (max - min); }
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function distXY(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function rotateTowards(current, target, maxStep) {
  const d = wrapAngle(target - current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

function weightedPick(weights) {
  let total = 0;
  for (const k in weights) total += weights[k];
  let r = Math.random() * total;
  for (const k in weights) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0];
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Generador pseudoaleatorio con semilla (para que el decorado sea siempre igual).
function seededRandom(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatDecimal(value, digits = 2) {
  return value.toFixed(digits).replace('.', ',');
}

// Mezcla dos colores hex (#rrggbb). Con caché porque se usa al dibujar.
const _mixCache = new Map();
function mixColor(hexA, hexB, t) {
  const key = hexA + hexB + t;
  let out = _mixCache.get(key);
  if (out) return out;
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t));
  const g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  out = `rgb(${r}, ${g}, ${bl})`;
  _mixCache.set(key, out);
  return out;
}

// Atajos de dibujo
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
