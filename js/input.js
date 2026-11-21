/* =====================================================================
 * ENTRADA — ratón y teclado traducidos a órdenes.
 *  Clic izquierdo en el suelo  → mover
 *  Clic izquierdo en un animal → atacar
 *  Clic derecho                → zarpazo sangriento hacia el cursor
 *  T → mejoras · F1 → depuración · Esc → cerrar panel
 * ===================================================================== */
const Input = {
  mouse: { x: 640, y: 360, inside: false },

  init(stage, canvas) {
    this.stage = stage;
    canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    canvas.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    stage.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.onKeyDown(e));
  },

  // Coordenadas de pantalla → coordenadas del escenario (1280 × 720).
  toStage(e) {
    const rect = this.stage.getBoundingClientRect();
    const s = rect.width / CONFIG.view.width;
    return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
  },

  onPointerMove(e) {
    const p = this.toStage(e);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    this.mouse.inside = true;
  },

  onPointerDown(e) {
    this.onPointerMove(e);
    if (!Game.acceptsCommands()) return;
    const tiger = Game.world.tiger;
    const p = this.mouse;

    if (e.button === 0) {
      const animal = Game.animalAt(p.x, p.y);
      if (animal) {
        tiger.orderAttack(animal);
        Effects.targetMarker(animal);
      } else {
        const q = Arena.clampPoint(p.x, p.y, tiger.radius);
        tiger.orderMove(q.x, q.y);
        Effects.moveMarker(q.x, q.y);
      }
    } else if (e.button === 2) {
      e.preventDefault();
      Game.trySpecial(Math.atan2(p.y - tiger.y, p.x - tiger.x));
    }
  },

  onKeyDown(e) {
    if (e.key === 'F1') {
      e.preventDefault();
      Debug.toggle();
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 't') {
      e.preventDefault();
      UI.toggleUpgrades();
    } else if (key === 'escape') {
      UI.closeUpgrades();
    }
  },
};
