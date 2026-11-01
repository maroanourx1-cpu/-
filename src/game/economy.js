// الاقتصاد: التطويرات والألوان والإضافات والأسعار
export const UPGRADES = {
  engine: { name: 'المحرك', icon: '⚙️', max: 5, desc: 'سرعة قصوى وتسارع أعلى', cost: (l) => Math.round(250 * Math.pow(1.75, l)) },
  brakes: { name: 'الفرامل', icon: '🛑', max: 5, desc: 'توقف أسرع', cost: (l) => Math.round(120 * Math.pow(1.7, l)) },
  tires: { name: 'العجلات', icon: '🛞', max: 5, desc: 'تماسك أعلى وانزلاق أقل', cost: (l) => Math.round(150 * Math.pow(1.7, l)) },
  suspension: { name: 'التعليق', icon: '🔧', max: 5, desc: 'ثبات أكبر على المطبات', cost: (l) => Math.round(140 * Math.pow(1.7, l)) },
  nitro: { name: 'النيترو', icon: '🔥', max: 5, desc: 'المستوى 1 = تركيب النيترو، وبعدها سعة أكبر وشحن أسرع', cost: (l) => (l === 0 ? 200 : Math.round(220 * Math.pow(1.6, l))) },
};

export const COLORS = ['#f2b705', '#1b1b1b', '#2e7d32', '#c62828', '#1565c0', '#f5f5f5', '#6a1b9a', '#ef6c00', '#00897b', '#ff4081', '#37474f', '#8d6e63', '#00bcd4', '#9e9d24'];
export const FREE_COLORS = {
  body: ['#f2b705', '#1b1b1b', '#2e7d32'],
  roof: ['#1b1b1b', '#f2b705', '#2e7d32'],
  seat: ['#7a1f1f', '#222222', '#6b4b2a'],
  rim: ['#c9c9c9', '#f2b705', '#222222'],
};
export const SEAT_COLORS = ['#7a1f1f', '#222222', '#6b4b2a', '#1565c0', '#c62828', '#f5f5f5', '#6a1b9a', '#2e7d32', '#ff4081', '#ef6c00'];
export const RIM_COLORS = ['#c9c9c9', '#f2b705', '#222222', '#c62828', '#1565c0', '#00e5ff', '#ff4081', '#76ff03'];
export const COLOR_PRICE = 60;

export const LIGHTS = {
  white: { name: 'أبيض', color: '#fff6dd', cost: 0 },
  blue: { name: 'أزرق زينون', color: '#8fc4ff', cost: 120 },
  yellow: { name: 'أصفر', color: '#ffd23a', cost: 90 },
  red: { name: 'أحمر نيون', color: '#ff3b3b', cost: 150 },
  green: { name: 'أخضر نيون', color: '#37ff7a', cost: 150 },
  pink: { name: 'وردي نيون', color: '#ff5fd0', cost: 180 },
};
export const DECOR = {
  charm: { name: 'خرزة زرقاء معلقة', cost: 60 },
  flags: { name: 'أعلام مصر', cost: 90 },
  roofsign: { name: 'لافتة السقف "شعبولا"', cost: 110 },
  antenna: { name: 'أنتينا وريشة', cost: 70 },
  led: { name: 'شريط LED سفلي', cost: 200 },
};
export const FUEL_PRICE = 0.6; // ج.م لكل 1%

export function upgradeStats(u) {
  return {
    maxSpeed: 17 * (1 + u.engine * 0.08), // م/ث (≈61 كم/س → 86 كم/س)
    accel: 7.5 * (1 + u.engine * 0.1),
    brake: 15 + u.brakes * 3,
    grip: 5 + u.tires * 1.1,
    bumpDamp: 1 - u.suspension * 0.14,
    nitroCap: u.nitro > 0 ? 80 + u.nitro * 25 : 0,
    nitroRecharge: 5 + u.nitro * 2.2,
  };
}

export function itemId(kind, value) { return kind + ':' + value; }

export class Economy {
  constructor(save, hooks = {}) {
    this.s = save;
    this.hooks = hooks;
  }
  get money() { return this.s.money; }
  earn(v) { this.s.money += v; this.s.shiftTotal += v; this.hooks.change?.(); }
  spend(v) {
    if (this.s.money < v) return false;
    this.s.money -= v;
    this.hooks.change?.();
    return true;
  }
  owns(id) { return this.s.owned.includes(id); }
  // شراء/تركيب لون
  pickColor(kind, hex) {
    const id = itemId(kind, hex);
    if (!this.owns(id)) {
      if (!this.spend(COLOR_PRICE)) return { ok: false, msg: 'الفلوس مش كفاية' };
      this.s.owned.push(id);
    }
    this.s.config[kind] = hex;
    this.hooks.change?.();
    return { ok: true };
  }
  pickLight(id) {
    const key = itemId('light', id);
    if (!this.owns(key)) {
      if (!this.spend(LIGHTS[id].cost)) return { ok: false, msg: 'الفلوس مش كفاية' };
      this.s.owned.push(key);
    }
    this.s.config.light = id;
    this.hooks.change?.();
    return { ok: true };
  }
  pickSticker(id) {
    const key = itemId('sticker', id);
    const cost = STICKER_COST[id] ?? 0;
    if (!this.owns(key) && cost > 0) {
      if (!this.spend(cost)) return { ok: false, msg: 'الفلوس مش كفاية' };
      this.s.owned.push(key);
    }
    this.s.config.sticker = id;
    this.hooks.change?.();
    return { ok: true };
  }
  toggleDecor(id) {
    const key = itemId('decor', id);
    if (!this.owns(key)) {
      if (!this.spend(DECOR[id].cost)) return { ok: false, msg: 'الفلوس مش كفاية' };
      this.s.owned.push(key);
      this.s.config.decor.push(id);
    } else {
      const i = this.s.config.decor.indexOf(id);
      if (i >= 0) this.s.config.decor.splice(i, 1); else this.s.config.decor.push(id);
    }
    this.hooks.change?.();
    return { ok: true };
  }
  upgradeCost(k) {
    const l = this.s.upgrades[k];
    return l >= UPGRADES[k].max ? null : UPGRADES[k].cost(l);
  }
  buyUpgrade(k) {
    const c = this.upgradeCost(k);
    if (c === null) return { ok: false, msg: 'وصلت لأقصى مستوى' };
    if (!this.spend(c)) return { ok: false, msg: 'الفلوس مش كفاية' };
    this.s.upgrades[k]++;
    this.hooks.change?.();
    return { ok: true };
  }
  refuel() {
    const need = 100 - this.s.fuel;
    if (need < 1) return { ok: false, msg: 'التانك مليان' };
    const price = Math.ceil(need * FUEL_PRICE);
    if (!this.spend(price)) return { ok: false, msg: 'الفلوس مش كفاية' };
    this.s.fuel = 100;
    this.hooks.change?.();
    return { ok: true, price };
  }
}

export const STICKER_COST = { none: 0, sha3bola: 120, mashallah: 80, flag: 100, stars: 90, fire: 150 };
