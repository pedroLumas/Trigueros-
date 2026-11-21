/* =====================================================================
 * INTERFAZ — HUD (vida, sangre, ataque especial), panel de mejoras y
 * pantalla de muerte. Es HTML superpuesto al canvas; el juego solo se
 * comunica con ella mediante eventos y lecturas de estado.
 * ===================================================================== */
const UI = {
  el: {},
  cards: {},
  upgradesOpen: false,
  shown: {},
  ghostHp: 0,
  ghostDelay: 0,
  deathTimer: null,

  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      stage: $('stage'),
      healthBox: $('hud-health'), hpCurrent: $('hp-current'), hpMax: $('hp-max'), hpBar: $('hp-bar'), hpGhost: $('hp-ghost'),
      bloodBox: $('hud-blood'), bloodValue: $('blood-value'), bloodDrop: $('blood-drop'), devoured: $('devoured-value'),
      specialBtn: $('special-btn'), specialCd: $('special-cd'), specialTime: $('special-time'), specialState: $('special-state'),
      upgradesBtn: $('upgrades-btn'), upgradesBadge: $('upgrades-badge'), upgradesPanel: $('upgrades-panel'),
      upgradesClose: $('upgrades-close'), upgradeList: $('upgrade-list'),
      death: $('death-screen'), deathStats: $('death-stats'), restartBtn: $('restart-btn'),
      debugBtn: $('debug-btn'),
    };
    this.buildUpgradeCards();

    this.el.upgradesBtn.addEventListener('click', () => this.toggleUpgrades());
    this.el.upgradesClose.addEventListener('click', () => this.closeUpgrades());
    this.el.specialBtn.addEventListener('click', () => Game.trySpecial(null));
    this.el.restartBtn.addEventListener('click', () => Game.reset());
    this.el.debugBtn.addEventListener('click', () => Debug.toggle());

    Events.on('bloodChanged', () => this.refreshUpgrades());
    Events.on('corpseDevoured', () => this.bump(this.el.bloodBox, 'bump'));
    Events.on('tigerDamaged', () => this.bump(this.el.healthBox, 'hurt'));
    Events.on('tigerHealed', () => this.bump(this.el.healthBox, 'healed'));
    Events.on('upgradeBought', e => this.onUpgradeBought(e));
    Events.on('tigerDied', () => {
      this.closeUpgrades();
      clearTimeout(this.deathTimer);
      this.deathTimer = setTimeout(() => this.showDeath(), 1000);
    });
  },

  onReset() {
    clearTimeout(this.deathTimer);
    this.el.death.hidden = true;
    this.closeUpgrades();
    this.shown = {};
    this.ghostHp = Game.world.tiger.hp;
    this.refreshUpgrades();
  },

  // Reinicia una animación CSS aunque ya se estuviera reproduciendo.
  bump(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  },

  // Centro del icono de sangre en coordenadas del escenario (destino de las gotas).
  bloodTarget() {
    const sr = this.el.stage.getBoundingClientRect();
    const r = this.el.bloodDrop.getBoundingClientRect();
    const s = sr.width / CONFIG.view.width;
    if (!s) return null;
    return { x: (r.left + r.width / 2 - sr.left) / s, y: (r.top + r.height / 2 - sr.top) / s };
  },

  // ---------- HUD por fotograma ----------
  update(dt) {
    const tiger = Game.world.tiger;
    if (!tiger) return;
    const el = this.el;

    const hp = Math.ceil(tiger.hp), max = tiger.stats.maxHp;
    if (hp !== this.shown.hp || max !== this.shown.max) {
      el.hpCurrent.textContent = hp;
      el.hpMax.textContent = max;
      const ratio = clamp(tiger.hp / max, 0, 1);
      el.hpBar.style.width = `${ratio * 100}%`;
      el.hpBar.classList.toggle('mid', ratio <= 0.5 && ratio > 0.25);
      el.hpBar.classList.toggle('low', ratio <= 0.25);
      if (hp < (this.shown.hp || 0)) this.ghostDelay = 0.35;
      this.shown.hp = hp;
      this.shown.max = max;
    }
    // Barra "fantasma" que muestra el daño recién recibido.
    if (this.ghostHp > tiger.hp) {
      this.ghostDelay -= dt;
      if (this.ghostDelay <= 0) this.ghostHp = Math.max(tiger.hp, this.ghostHp - max * 0.4 * dt);
    } else {
      this.ghostHp = tiger.hp;
    }
    el.hpGhost.style.width = `${clamp(this.ghostHp / max, 0, 1) * 100}%`;

    if (Economy.blood !== this.shown.blood) {
      el.bloodValue.textContent = Economy.blood;
      this.shown.blood = Economy.blood;
    }
    if (Economy.devoured !== this.shown.devoured) {
      el.devoured.textContent = Economy.devoured;
      this.shown.devoured = Economy.devoured;
    }

    // Ataque especial
    const cd = tiger.specialCooldown, total = CONFIG.special.cooldown;
    const cdKey = cd > 0 ? cd.toFixed(1) : 'ready';
    if (cdKey !== this.shown.cd) {
      this.shown.cd = cdKey;
      const ready = cd <= 0;
      el.specialBtn.classList.toggle('ready', ready);
      el.specialCd.style.background = ready ? 'none' : `conic-gradient(rgba(4, 9, 5, 0.78) ${(cd / total) * 360}deg, transparent 0deg)`;
      el.specialTime.textContent = ready ? '' : formatDecimal(cd, 1);
      el.specialState.textContent = ready ? 'Listo · clic derecho' : 'Recargando…';
    }
  },

  // ---------- Panel de mejoras ----------
  buildUpgradeCards() {
    this.el.upgradeList.innerHTML = '';
    for (const def of CONFIG.upgrades.list) {
      const card = document.createElement('article');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="uc-head"><h3>${def.name}</h3><span class="uc-level">Nv <b>0</b></span></div>
        <p class="uc-effect">${def.effect}</p>
        <div class="uc-foot">
          <span class="uc-change"></span>
          <button type="button" class="uc-buy" id="buy-${def.id}">
            <span class="uc-price">0</span><span class="drop drop-sm" aria-hidden="true"></span>
          </button>
        </div>`;
      const buy = card.querySelector('.uc-buy');
      buy.addEventListener('click', () => this.buy(def.id));
      this.el.upgradeList.appendChild(card);
      this.cards[def.id] = {
        card, buy,
        level: card.querySelector('.uc-level b'),
        change: card.querySelector('.uc-change'),
        price: card.querySelector('.uc-price'),
      };
    }
  },

  buy(id) {
    const tiger = Game.world.tiger;
    if (!Upgrades.buy(id, tiger)) this.bump(this.cards[id].card, 'denied');
  },

  refreshUpgrades() {
    if (!Game.world.tiger) return;
    for (const def of CONFIG.upgrades.list) {
      const c = this.cards[def.id];
      const info = Upgrades.describe(def.id);
      const affordable = Economy.canAfford(info.price);
      c.level.textContent = info.level;
      c.change.textContent = info.change;
      c.price.textContent = info.price;
      c.card.classList.toggle('affordable', affordable);
      c.buy.setAttribute('aria-label', `Comprar ${def.name} por ${info.price} de sangre`);
    }
    this.el.upgradesBadge.hidden = !Upgrades.anyAffordable();
  },

  onUpgradeBought({ id, level }) {
    this.refreshUpgrades();
    const c = this.cards[id];
    this.bump(c.card, 'bought');
    this.bump(c.level, 'pop');
    const tiger = Game.world.tiger;
    // Si se compran varias seguidas, los textos se apilan en vez de solaparse.
    const now = performance.now();
    this.upgradeStack = now - (this.lastUpgradeText || 0) < 900 ? (this.upgradeStack || 0) + 1 : 0;
    this.lastUpgradeText = now;
    Effects.ring(tiger.x, tiger.y, { follow: tiger, color: '234, 191, 82', from: 16, to: 50, life: 0.7, width: 3 });
    Effects.floatText(tiger.x, tiger.y - 40 - (this.upgradeStack % 4) * 22, `${Upgrades.def(id).name} · Nv ${level}`, { color: '#eabf52', size: 23, life: 1.3 });
  },

  toggleUpgrades() {
    if (this.upgradesOpen) this.closeUpgrades();
    else this.openUpgrades();
  },

  openUpgrades() {
    if (!Game.world.tiger || !Game.world.tiger.alive) return;
    this.upgradesOpen = true;
    this.el.upgradesPanel.hidden = false;
    this.el.upgradesBtn.setAttribute('aria-expanded', 'true');
    this.refreshUpgrades();
  },

  closeUpgrades() {
    this.upgradesOpen = false;
    this.el.upgradesPanel.hidden = true;
    this.el.upgradesBtn.setAttribute('aria-expanded', 'false');
  },

  specialDenied() {
    this.bump(this.el.specialBtn, 'denied');
  },

  // ---------- Muerte ----------
  showDeath() {
    const levels = Upgrades.totalLevels();
    this.el.deathStats.innerHTML = `
      <span><b>${formatTime(Game.time)}</b> de caza</span>
      <span><b>${Economy.devoured}</b> animales devorados</span>
      <span><b>${Economy.totalBlood}</b> de sangre conseguida</span>
      <span><b>${levels}</b> ${levels === 1 ? 'mejora comprada' : 'mejoras compradas'}</span>`;
    this.el.death.hidden = false;
    this.el.restartBtn.focus();
  },
};
