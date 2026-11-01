// واجهة المستخدم: HUD + القوائم (بداية، إيقاف، جراج، إعدادات، خريطة)
import { UPGRADES, COLORS, SEAT_COLORS, RIM_COLORS, COLOR_PRICE, LIGHTS, DECOR, STICKER_COST, FUEL_PRICE, FREE_COLORS } from '../game/economy.js';
import { STICKERS } from '../world/textures.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export class UI {
  constructor(game) {
    this.g = game;
    this.tab = 'colors';
    this.el = {};
    for (const id of ['hud', 'loading', 'loadmsg', 'loadbar', 'mainMenu', 'pauseMenu', 'garage', 'settings', 'mapOverlay', 'prompt', 'bubble', 'toasts', 'spd', 'nitroBar', 'fuelBar', 'shiftVal', 'bankVal', 'tripsVal', 'missionTitle', 'missionSub', 'north', 'boostFx', 'dbg', 'radioTrack', 'radioStation', 'garageBody', 'gMoneyVal', 'mapSource', 'mmContinue', 'bigmap']) this.el[id] = $(id);
    this._bubbleT = 0;
    this._last = {};
    this._bind();
  }

  _bind() {
    const g = this.g;
    const on = (id, fn) => $(id).addEventListener('click', () => { g.audio.init(); g.audio.click(); fn(); });
    on('mmContinue', () => g.startGame(false));
    on('mmNew', () => { if (g.hasSave && !confirm('هتبدأ لعبة جديدة وتمسح التقدم القديم. متأكد؟')) return; g.startGame(true); });
    on('mmGarage', () => g.startGame(false, true));
    on('mmSettings', () => g.openSettings('main'));
    on('pmResume', () => g.resume());
    on('pmGarage', () => g.openGarage());
    on('pmMap', () => g.openMap('pause'));
    on('pmSettings', () => g.openSettings('pause'));
    on('pmQuit', () => g.quitToMenu());
    on('gClose', () => g.closeGarage());
    on('sBack', () => g.closeSettings());
    on('mapClose', () => g.closeMap());
    on('btnMap', () => g.openMap('play'));
    on('btnCam', () => g.toggleCamera());
    on('btnGarage', () => g.tryOpenGarage());
    $('sReset').addEventListener('click', () => { if (confirm('مسح كل التقدم والبدء من جديد؟')) g.resetProgress(); });
    document.querySelectorAll('#gTabs .tab').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; g.audio.click(); this.renderGarage(); }));
    // الإعدادات
    const S = () => g.save.settings;
    const sl = (id, key, apply) => $(id).addEventListener('input', (e) => { S()[key] = parseFloat(e.target.value); apply?.(); g.persist(); });
    sl('sMaster', 'master', () => g.applySettings()); sl('sSfx', 'sfx', () => g.applySettings()); sl('sEngine', 'engine', () => g.applySettings());
    sl('sAmbient', 'ambient', () => g.applySettings()); sl('sMusic', 'music', () => g.applySettings()); sl('sSens', 'sens', () => g.applySettings());
    $('sQuality').addEventListener('change', (e) => { S().quality = e.target.value; g.applySettings(); g.persist(); });
    $('sFps').addEventListener('change', (e) => { S().fps = e.target.checked; g.persist(); });
  }

  setLoading(p, msg) {
    this.el.loadbar.style.width = Math.round(p * 100) + '%';
    if (msg) this.el.loadmsg.textContent = msg;
  }
  hideLoading() { this.el.loading.classList.add('hidden'); }

  show(name) { this.el[name].classList.remove('hidden'); }
  hide(name) { this.el[name].classList.add('hidden'); }
  hideAllMenus() { for (const n of ['mainMenu', 'pauseMenu', 'garage', 'settings', 'mapOverlay']) this.hide(n); }

  syncSettings() {
    const s = this.g.save.settings;
    $('sMaster').value = s.master; $('sSfx').value = s.sfx; $('sEngine').value = s.engine; $('sAmbient').value = s.ambient; $('sMusic').value = s.music;
    $('sQuality').value = s.quality; $('sSens').value = s.sens; $('sFps').checked = s.fps;
  }

  toast(msg, type = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = msg;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), type === 'cash' ? 3600 : 2600);
  }
  bubble(text) {
    this.el.bubble.textContent = text;
    this.el.bubble.classList.remove('hidden');
    this._bubbleT = 3.4;
  }
  prompt(text) {
    if (this._last.prompt === text) return;
    this._last.prompt = text;
    if (!text) this.el.prompt.classList.add('hidden');
    else { this.el.prompt.textContent = text; this.el.prompt.classList.remove('hidden'); }
  }

  // تحديث الـ HUD كل إطار (نكتب DOM فقط عند التغيير)
  updateHud(d, dt) {
    const set = (k, el, v) => { if (this._last[k] !== v) { this._last[k] = v; el.textContent = v; } };
    set('spd', this.el.spd, String(d.kmh));
    set('shift', this.el.shiftVal, fmt(d.shift));
    set('bank', this.el.bankVal, fmt(d.money));
    set('trips', this.el.tripsVal, String(d.trips));
    const w = (k, el, v) => { const s = v.toFixed(0) + '%'; if (this._last[k] !== s) { this._last[k] = s; el.style.width = s; } };
    w('nb', this.el.nitroBar, d.nitroPct);
    w('fb', this.el.fuelBar, d.fuel);
    this.el.fuelBar.style.backgroundPosition = `${100 - d.fuel}% 0`;
    set('mt', this.el.missionTitle, d.missionTitle);
    set('ms', this.el.missionSub, d.missionSub);
    const bf = d.boost ? '1' : '0';
    if (this._last.bf !== bf) { this._last.bf = bf; this.el.boostFx.style.opacity = bf; }
    if (d.north) this.el.north.style.transform = `translate(${(d.north.nx * 93).toFixed(1)}px, ${(d.north.ny * 93).toFixed(1)}px)`;
    if (this._bubbleT > 0) { this._bubbleT -= dt; if (this._bubbleT <= 0) this.el.bubble.classList.add('hidden'); }
    if (d.dbg !== undefined) set('dbg', this.el.dbg, d.dbg);
    set('rt', this.el.radioTrack, this.g.audio.musicOn ? this.g.audio.trackName : 'الراديو مقفول');
  }

  // —— الجراج ——
  renderGarage() {
    const g = this.g, eco = g.economy, s = g.save;
    document.querySelectorAll('#gTabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    this.el.gMoneyVal.textContent = fmt(s.money);
    const body = this.el.garageBody;
    body.innerHTML = '';
    const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
    const result = (r) => { if (!r.ok) { g.audio.error(); this.toast(r.msg, 'warn'); } else g.audio.buy(); g.applyTuktukConfig(); g.persist(); this.renderGarage(); };

    if (this.tab === 'colors') {
      const sections = [['body', 'لون التوكتوك', COLORS], ['roof', 'لون السقف', COLORS], ['seat', 'لون المقاعد', SEAT_COLORS], ['rim', 'لون الجنوط', RIM_COLORS]];
      for (const [kind, title, list] of sections) {
        const sec = mk('div', 'sec', `<h3>${title}</h3>`);
        const row = mk('div', 'swatches');
        for (const hex of list) {
          const owned = eco.owns(kind + ':' + hex);
          const sw = mk('div', 'sw' + (s.config[kind] === hex ? ' on' : ''));
          sw.style.background = hex;
          if (owned) { if (s.config[kind] === hex) sw.appendChild(mk('span', 'ck', '✓')); }
          else sw.appendChild(mk('span', 'pr', COLOR_PRICE + ' ج'));
          sw.addEventListener('click', () => result(eco.pickColor(kind, hex)));
          row.appendChild(sw);
        }
        sec.appendChild(row); body.appendChild(sec);
      }
      body.appendChild(mk('div', 'note', 'اللون الجديد بيتشترى مرة واحدة وبعدها تركّبه ببلاش.'));
    } else if (this.tab === 'extras') {
      const lights = mk('div', 'sec', '<h3>إضاءة الكشافات</h3>');
      for (const [id, L] of Object.entries(LIGHTS)) {
        const owned = eco.owns('light:' + id);
        const o = mk('div', 'opt' + (s.config.light === id ? ' on' : ''), `<span><i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${L.color};margin-inline-end:8px"></i>${L.name}</span><span class="p">${owned ? (s.config.light === id ? '✓ مركّب' : 'تركيب') : L.cost + ' ج.م'}</span>`);
        o.addEventListener('click', () => result(eco.pickLight(id)));
        lights.appendChild(o);
      }
      body.appendChild(lights);
      const st = mk('div', 'sec', '<h3>ملصقات</h3>');
      for (const id of Object.keys(STICKERS)) {
        const owned = eco.owns('sticker:' + id) || STICKER_COST[id] === 0;
        const o = mk('div', 'opt' + (s.config.sticker === id ? ' on' : ''), `<span>${STICKERS[id].name}</span><span class="p">${owned ? (s.config.sticker === id ? '✓ مركّب' : 'تركيب') : STICKER_COST[id] + ' ج.م'}</span>`);
        o.addEventListener('click', () => result(eco.pickSticker(id)));
        st.appendChild(o);
      }
      body.appendChild(st);
      const dc = mk('div', 'sec', '<h3>زينة</h3>');
      for (const [id, D] of Object.entries(DECOR)) {
        const owned = eco.owns('decor:' + id);
        const on = s.config.decor.includes(id);
        const o = mk('div', 'opt' + (on ? ' on' : ''), `<span>${D.name}</span><span class="p">${owned ? (on ? '✓ مركّبة (إزالة)' : 'تركيب') : D.cost + ' ج.م'}</span>`);
        o.addEventListener('click', () => result(eco.toggleDecor(id)));
        dc.appendChild(o);
      }
      body.appendChild(dc);
    } else if (this.tab === 'upgrades') {
      for (const [k, U] of Object.entries(UPGRADES)) {
        const lvl = s.upgrades[k];
        const cost = eco.upgradeCost(k);
        const card = mk('div', 'up');
        const label = k === 'nitro' && lvl === 0 ? 'غير مركّب' : 'المستوى ' + lvl + ' / ' + U.max;
        card.innerHTML = `<div class="top"><span>${U.icon} ${U.name}</span><span style="font-size:12px;color:#bbb">${label}</span></div><div class="pips">${Array.from({ length: U.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div><div class="d">${U.desc}</div>`;
        const b = mk('button', 'btn buy' + (cost === null ? '' : ' primary'), cost === null ? 'أقصى مستوى' : `${k === 'nitro' && lvl === 0 ? 'تركيب' : 'تطوير'} — ${fmt(cost)} ج.م`);
        b.disabled = cost === null;
        b.addEventListener('click', () => result(eco.buyUpgrade(k)));
        card.appendChild(b);
        body.appendChild(card);
      }
    } else if (this.tab === 'fuel') {
      const need = 100 - s.fuel;
      const price = Math.ceil(need * FUEL_PRICE);
      const card = mk('div', 'up');
      card.innerHTML = `<div class="top"><span>⛽ البنزين</span><span>${s.fuel.toFixed(0)}%</span></div><div class="pips" style="gap:0"><i class="on" style="flex:${s.fuel};width:auto"></i><i style="flex:${Math.max(0.01, need)};width:auto"></i></div><div class="d">لو البنزين خلص التوكتوك هيمشي بالعافية.</div>`;
      const b = mk('button', 'btn buy primary', need < 1 ? 'التانك مليان' : `تعبئة — ${fmt(price)} ج.م`);
      b.disabled = need < 1;
      b.addEventListener('click', () => { const r = eco.refuel(); if (!r.ok) { g.audio.error(); this.toast(r.msg, 'warn'); } else { g.audio.buy(); this.toast('تم تعبئة التانك', 'ok'); } g.persist(); this.renderGarage(); });
      card.appendChild(b);
      body.appendChild(card);
    }
  }
}
