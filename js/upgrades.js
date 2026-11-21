/* =====================================================================
 * MEJORAS — cuatro mejoras independientes y repetibles.
 * Precio = coste inicial × priceGrowth ^ nivel actual.
 * Las estadísticas del tigre se recalculan siempre desde los valores
 * base, así que comprar en cualquier orden da el mismo resultado.
 * ===================================================================== */
const Upgrades = {
  levels: {},

  reset() {
    for (const def of CONFIG.upgrades.list) this.levels[def.id] = 0;
  },

  def(id) {
    return CONFIG.upgrades.list.find(d => d.id === id);
  },

  price(id) {
    return Math.round(this.def(id).baseCost * Math.pow(CONFIG.upgrades.priceGrowth, this.levels[id]));
  },

  anyAffordable() {
    return CONFIG.upgrades.list.some(d => Economy.canAfford(this.price(d.id)));
  },

  totalLevels() {
    return Object.values(this.levels).reduce((s, v) => s + v, 0);
  },

  buy(id, tiger) {
    const price = this.price(id);
    if (!tiger.alive || !Economy.spend(price)) return false;
    this.levels[id] += 1;
    this.applyTo(tiger, id);
    Events.emit('upgradeBought', { id, level: this.levels[id], price });
    return true;
  },

  // Valor de cada estadística mejorable para un nivel dado.
  valueAt(id, level) {
    const per = this.def(id).perLevel;
    switch (id) {
      case 'claws': return CONFIG.tiger.damage + level * per;
      case 'instinct': return CONFIG.tiger.attacksPerSecond * (1 + level * per);
      case 'hide': return CONFIG.tiger.maxHp + level * per;
      case 'fangs': return CONFIG.corpse.healPercent + level * per;
    }
    return 0;
  },

  applyTo(tiger, boughtId = null) {
    const s = tiger.stats;
    const oldMax = s.maxHp;
    s.damage = this.valueAt('claws', this.levels.claws);
    s.attacksPerSecond = this.valueAt('instinct', this.levels.instinct);
    s.maxHp = this.valueAt('hide', this.levels.hide);
    s.healPercent = this.valueAt('fangs', this.levels.fangs);
    // Al mejorar la vida máxima, la vida actual sube lo mismo.
    if (boughtId === 'hide') tiger.hp += s.maxHp - oldMax;
    tiger.hp = Math.min(tiger.hp, s.maxHp);
  },

  // Texto "actual → siguiente" para el panel.
  describe(id) {
    const level = this.levels[id];
    const now = this.valueAt(id, level), next = this.valueAt(id, level + 1);
    let change = '';
    switch (id) {
      case 'claws': change = `Daño ${now} → ${next}`; break;
      case 'instinct': change = `${formatDecimal(now)} → ${formatDecimal(next)} golpes/s`; break;
      case 'hide': change = `Vida máx. ${now} → ${next}`; break;
      case 'fangs': change = `Curación ${Math.round(now * 100)} % → ${Math.round(next * 100)} %`; break;
    }
    return { level, price: this.price(id), change };
  },
};
