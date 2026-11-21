/* =====================================================================
 * EVENTOS — bus mínimo para desacoplar sistemas.
 *  animalKilled    { animal, source }
 *  corpseDevoured  { corpse, healed }
 *  bloodChanged    { blood }
 *  tigerDamaged    { amount, source }
 *  tigerHealed     { amount }
 *  tigerDied       {}
 *  upgradeBought   { id, level, price }
 *  specialUsed     { hits }
 * ===================================================================== */
const Events = {
  handlers: {},

  on(name, fn) {
    (this.handlers[name] || (this.handlers[name] = [])).push(fn);
  },

  emit(name, data = {}) {
    const list = this.handlers[name];
    if (!list) return;
    for (const fn of list) fn(data);
  },
};
