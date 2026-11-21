/* =====================================================================
 * GENERADOR DE ANIMALES — aparición continua, sin oleadas.
 * Un animal cada minInterval–maxInterval segundos mientras haya menos de
 * maxAlive vivos. La dificultad no cambia con el tiempo.
 * ===================================================================== */
const Spawner = {
  timer: 0,

  reset(world) {
    this.timer = this.nextInterval();
    for (let i = 0; i < CONFIG.spawner.initialAnimals; i++) {
      this.spawn(weightedPick(CONFIG.spawner.weights), world);
    }
  },

  nextInterval() {
    return rand(CONFIG.spawner.minInterval, CONFIG.spawner.maxInterval);
  },

  update(dt, world) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.nextInterval();
    if (world.animals.length >= CONFIG.spawner.maxAlive) return;
    this.spawn(weightedPick(CONFIG.spawner.weights), world);
  },

  // Crea un animal en una posición libre. Usado también por la depuración.
  spawn(kind, world) {
    const def = CONFIG.animals[kind];
    if (!def) return null;
    const pos = this.findPosition(def.radius, world);
    if (!pos) return null;
    const animal = new Animal(kind, pos.x, pos.y);
    world.animals.push(animal);
    Effects.ring(pos.x, pos.y, { color: '210, 235, 180', from: def.radius + 2, to: def.radius + 20, life: 0.5, width: 2, layer: 'ground' });
    return animal;
  },

  // Lejos del tigre y sin solaparse con otros animales. Si no encuentra
  // hueco tras varios intentos, relaja las condiciones.
  findPosition(radius, world) {
    const cfg = CONFIG.spawner, tiger = world.tiger;
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = Arena.randomPoint(radius + 12);
      const relaxed = attempt >= 25;
      if (tiger && distXY(p.x, p.y, tiger.x, tiger.y) < cfg.minDistanceFromTiger * (relaxed ? 0.6 : 1)) continue;
      const crowded = world.animals.some(a => distXY(p.x, p.y, a.x, a.y) < cfg.minDistanceBetween + a.radius + radius);
      if (crowded && !relaxed) continue;
      return p;
    }
    return null;
  },
};
