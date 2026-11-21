/* =====================================================================
 * ECONOMÍA — la sangre es la única moneda. Solo se gana devorando
 * cadáveres (o con la herramienta de depuración).
 * ===================================================================== */
const Economy = {
  blood: 0,
  totalBlood: 0, // sangre conseguida devorando (para el resumen final)
  devoured: 0,

  reset() {
    this.blood = 0;
    this.totalBlood = 0;
    this.devoured = 0;
    Events.emit('bloodChanged', { blood: this.blood });
  },

  addBlood(amount, fromDebug = false) {
    this.blood += amount;
    if (!fromDebug) this.totalBlood += amount;
    Events.emit('bloodChanged', { blood: this.blood });
  },

  registerDevoured() {
    this.devoured += 1;
  },

  canAfford(amount) {
    return this.blood >= amount;
  },

  spend(amount) {
    if (!this.canAfford(amount)) return false;
    this.blood -= amount;
    Events.emit('bloodChanged', { blood: this.blood });
    return true;
  },
};
