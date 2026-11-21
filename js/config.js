/* =====================================================================
 * CONFIG — Todos los parámetros de equilibrio del prototipo.
 * Cambia cualquier valor y recarga la página. Las distancias están en
 * píxeles del escenario (1280 × 720), los tiempos en segundos.
 * ===================================================================== */
const CONFIG = {
  view: { width: 1280, height: 720 },

  // Claro de selva: cuadrado centrado. El anillo de árboles ("border") es
  // decorativo; el área jugable es el interior del anillo.
  arena: {
    x: 290,
    y: 10,
    size: 700,
    border: 46,
  },

  tiger: {
    maxHp: 100,
    damage: 10,
    attacksPerSecond: 1.0,
    moveSpeed: 150,
    attackRange: 35,             // del centro del tigre al borde del animal
    detectionRadius: 120,        // adquiere presas automáticamente dentro de este radio
    maxChaseDistance: 260,       // distancia máxima que persigue una presa adquirida sola
    moveAcquireConeDegrees: 160, // al caminar solo se desvía por presas que tiene delante (360 = en cualquier dirección)
    autoChaseTimeout: 5,         // segundos persiguiendo sin golpear antes de rendirse (presa automática)
    explicitChaseTimeout: 12,    // ídem para presas marcadas con clic
    ignoreAfterGiveUp: 2.5,      // segundos que ignora a una presa tras rendirse
    radius: 14,
    mass: 8,                     // para empujar a los animales al chocar
    knockbackDecay: 12,          // cuanto mayor, antes se frena tras un empujón
  },

  // Zarpazo sangriento (clic derecho)
  special: {
    damage: 30,
    range: 85,
    arcDegrees: 100,
    cooldown: 10,
  },

  corpse: {
    duration: 20,      // segundos antes de desaparecer
    pickupRadius: 25,  // distancia entre centros para devorarlo
    healPercent: 0.05, // 5 % de la vida máxima
    fadeStart: 6,      // segundos finales en los que pierde opacidad
    settleTime: 0.35,  // pequeño margen entre matar y poder devorar
  },

  spawner: {
    minInterval: 2,
    maxInterval: 4,
    maxAlive: 12,
    initialAnimals: 4,
    minDistanceFromTiger: 170,
    minDistanceBetween: 36,
    weights: { rabbit: 40, antelope: 30, boar: 20, deer: 10 },
  },

  combat: {
    hitSlowDuration: 0.35, // al recibir un golpe, el animal se frena un instante
    hitSlowFactor: 0.5,
  },

  animals: {
    rabbit: {
      name: 'Conejo', behavior: 'skittish',
      hp: 15, damage: 0, blood: 5, radius: 7, mass: 1,
      wanderSpeed: 38, fleeSpeed: 112,
      fearRadius: 90,     // huye si el tigre se acerca a esta distancia
      calmFactor: 1.6,    // deja de huir a fearRadius × calmFactor
      fleeStamina: 2.2,   // segundos de carrera antes de cansarse
      staminaRegen: 0.6,
      tiredSpeed: 55, tiredTime: 1.3,
      zigzag: 0.55,       // amplitud del zigzag al huir (radianes)
    },
    antelope: {
      name: 'Antílope', behavior: 'skittish',
      hp: 35, damage: 0, blood: 12, radius: 10, mass: 2,
      wanderSpeed: 55, fleeSpeed: 130,
      fearRadius: 170, calmFactor: 1.4,
      fleeStamina: 2.6, staminaRegen: 0.5,
      tiredSpeed: 62, tiredTime: 1.6,
      zigzag: 0.12,
    },
    boar: {
      name: 'Jabalí', behavior: 'brawler',
      hp: 65, damage: 8, blood: 25, radius: 13, mass: 4,
      wanderSpeed: 40, chaseSpeed: 118,
      attackReach: 6,         // separación máxima entre cuerpos para morder
      attackInterval: 1.5,
      firstAttackDelay: 0.6,
      aggroLeash: 230,        // distancia máxima que persigue desde donde le atacaron
      aggroTimeout: 5,        // se calma si pasa este tiempo sin pelear
    },
    deer: {
      name: 'Ciervo', behavior: 'charger',
      hp: 90, damage: 14, blood: 40, radius: 15, mass: 5,
      wanderSpeed: 45, chaseSpeed: 105,
      aggroLeash: 300, aggroTimeout: 6,
      chargeTriggerDistance: 150, // empieza a preparar la embestida a esta distancia
      minChargeDistance: 70,      // si está más cerca, retrocede antes de embestir
      repositionTime: 0.8,
      chargeWindup: 0.8,          // duración de la señal previa
      aimLockTime: 0.25,          // en los últimos instantes deja de apuntar (se puede esquivar)
      chargeSpeed: 400,
      chargeDistance: 210,
      chargeRecover: 1.5,         // aturdido tras embestir
      chargeKnockback: 45,
    },
  },

  upgrades: {
    priceGrowth: 1.35, // precio = coste inicial × 1,35 ^ nivel
    list: [
      { id: 'claws', name: 'Garras', baseCost: 15, perLevel: 3, effect: '+3 de daño por golpe' },
      { id: 'instinct', name: 'Instinto', baseCost: 25, perLevel: 0.10, effect: '+10 % de velocidad de ataque' },
      { id: 'hide', name: 'Piel resistente', baseCost: 20, perLevel: 20, effect: '+20 de vida máxima' },
      { id: 'fangs', name: 'Colmillos curativos', baseCost: 30, perLevel: 0.02, effect: '+2 puntos de curación al devorar' },
    ],
  },

  ui: {
    pauseWhileUpgrading: true,
  },
};
