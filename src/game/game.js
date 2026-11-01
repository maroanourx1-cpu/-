// المنسّق الرئيسي: يربط العالم والتوكتوك والكاميرا والزبائن والاقتصاد والواجهة والصوت والحفظ
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loadMap } from '../world/mapLoader.js';
import { World } from '../world/world.js';
import { Vehicle } from '../vehicle/driving.js';
import { createTuktuk } from '../vehicle/tuktuk.js';
import { CameraRig } from '../vehicle/camera.js';
import { Traffic } from '../npc/traffic.js';
import { People, buildSidewalkLines } from '../npc/people.js';
import { Missions } from './missions.js';
import { Economy, upgradeStats } from './economy.js';
import { Particles } from './fx.js';
import { defaultSave, hasSave, loadSave, writeSave, clearSave } from './save.js';
import { GameAudio } from '../audio/audio.js';
import { UI } from '../ui/ui.js';
import { Minimap } from '../ui/minimap.js';

const nextFrame = () => new Promise((r) => setTimeout(r, 16));
const PIXEL = { low: 0.75, medium: 1, high: 1.5 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'loading'; // loading | menu | play | pause | garage | map | settings
    this.time = 0;
    this.keys = new Set();
    this.pressed = new Set(); // ضغطات هذا الإطار
    this.garageYaw = undefined;
    this.garageFrom = 'play';
    this.settingsFrom = 'main';
    this.mapFrom = 'play';
    this.started = false;
    this.noPersist = false;
    this.fps = 60; this._fpsAcc = 0; this._fpsN = 0;
    this._persistT = 0;
    this._prevBoost = false;
    this._lastNitroMsg = 0;
    this._lowFuelWarned = false;
    this._mapFrame = 0;
    this.hasSave = hasSave();
    this.save = loadSave();
    this.audio = new GameAudio();
    this.audio.musicOn = true;
    this.ui = new UI(this);
  }

  // ————————————————— التحميل —————————————————
  async init() {
    const ui = this.ui;
    ui.setLoading(0.05, 'تجهيز محرك الرسومات…');
    this._initRenderer();
    await nextFrame();

    ui.setLoading(0.15, 'تحميل خريطة عين شمس الشرقية…');
    this.map = await loadMap((m) => ui.setLoading(0.2, m));
    ui.setLoading(0.4, 'بناء الشوارع والمباني…');
    await nextFrame();

    const q = this.save.settings.quality;
    this.world = new World(this.scene, this.map, q);
    this.sw = this.world.sw;
    ui.setLoading(0.6, 'تجهيز التوكتوك…');
    await nextFrame();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.tuk = createTuktuk(this.envMap);
    this.scene.add(this.tuk.root);
    this.veh = new Vehicle(this.sw);
    this.cam = new CameraRig(this.camera, this.sw);
    this.cam.attach(this.canvas);
    this.particles = new Particles(this.scene, 500);
    this.particles.setPixelRatio(this.renderer.getPixelRatio());
    this.economy = new Economy(this.save, { change: () => this.ui.refreshMoney?.() });
    this.missions = new Missions(this);

    ui.setLoading(0.75, 'تجهيز الزباين والمرور…');
    await nextFrame();
    this.traffic = new Traffic(this.scene, this.world, q);
    this.people = new People(this.scene, this.world, buildSidewalkLines(this.world), q);
    this.minimap = new Minimap(this.map, document.getElementById('minimap'), document.getElementById('bigmap'));

    this._bindInput();
    this.applySettings();
    this.ui.syncSettings();
    this._placeVehicle(false);
    this.applyTuktukConfig(true);
    this._syncTuk(0);
    this.world.update(this.veh.x, this.veh.z, 0, true);
    this.people.fillInitial(this.veh.x, this.veh.z);

    ui.setLoading(1, 'جاهز!');
    const src = document.getElementById('mapSource');
    src.textContent = this.map.source === 'osm'
      ? `✔ الخريطة من بيانات OpenStreetMap الحقيقية (${this.map.roads.length} شارع · ${this.map.buildings.length} مبنى)`
      : 'الخريطة الحالية تجريبية بنمط شوارع القاهرة. شغّل اللعبة بالإنترنت (أو npm run fetch-map) لتحميل شوارع عين شمس الحقيقية.';
    document.getElementById('mmContinue').disabled = !this.hasSave;
    document.getElementById('mmContinue').style.opacity = this.hasSave ? '' : '0.45';
    await nextFrame();
    ui.hideLoading();
    this.showMenu();
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  }

  _initRenderer() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' }));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
    this._resize();
    addEventListener('resize', () => this._resize());
  }

  _resize() {
    const q = this.save.settings.quality;
    const pr = Math.min(devicePixelRatio || 1, PIXEL[q] || 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this._applyViewOffset();
    this.camera.updateProjectionMatrix();
    this.particles?.setPixelRatio(pr);
  }

  // في الجراج نزيح الصورة لليسار حتى لا تغطي لوحة القوائم التوكتوك
  _applyViewOffset() {
    if (this.state === 'garage' && innerWidth > 760) this.camera.setViewOffset(innerWidth, innerHeight, 230, 0, innerWidth, innerHeight);
    else this.camera.clearViewOffset();
  }

  applySettings() {
    const s = this.save.settings;
    this.audio.applyVolumes({ master: s.master, sfx: s.sfx, engine: s.engine, ambient: s.ambient, music: s.music });
    this.cam.sens = s.sens;
    if (this.world.quality !== s.quality) {
      this.world.setQuality(s.quality);
      this.traffic.setMax(s.quality === 'low' ? 10 : s.quality === 'high' ? 32 : 22);
      this.people.maxWalkers = s.quality === 'low' ? 10 : s.quality === 'high' ? 40 : 24;
    }
    this._resize();
  }

  // ————————————————— التوكتوك —————————————————
  applyTuktukConfig(first = false) {
    const st = upgradeStats(this.save.upgrades);
    this.veh.stats = st;
    this.tuk.applyConfig(this.save.config);
    if (first || this._lastCap !== st.nitroCap) this.veh.nitro = st.nitroCap;
    this._lastCap = st.nitroCap;
    this.veh.nitro = Math.min(this.veh.nitro, st.nitroCap);
  }

  // نقطة البداية: منتصف شارع طويل قريب من مركز الخريطة (بعيدًا عن التقاطعات)
  _spawnPose() {
    const g = this.world.graph;
    let best = null, bs = 1e18;
    for (const e of g.edges) {
      if (g.main[e.a] !== g.mainId || e.len < 45 || e.w < 7) continue;
      const a = g.nodes[e.a], b = g.nodes[e.b];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const score = Math.hypot(mx, mz) - e.len * 0.5;
      if (score < bs) { bs = score; best = { a, b, mx, mz }; }
    }
    if (!best) return this._poseOnNode(g.mainNodes[0]);
    return { x: best.mx, z: best.mz, h: Math.atan2(best.b.x - best.a.x, best.b.z - best.a.z) };
  }

  _poseOnNode(i) {
    const g = this.world.graph;
    const n = g.nodes[i];
    let be = null;
    for (const ei of n.adj) { const e = g.edges[ei]; if (!be || e.len > be.len) be = e; }
    if (!be) return { x: n.x, z: n.z, h: 0 };
    const o = g.nodes[be.a === i ? be.b : be.a];
    const h = Math.atan2(o.x - n.x, o.z - n.z);
    const off = Math.min(8, be.len * 0.3);
    return { x: n.x + Math.sin(h) * off, z: n.z + Math.cos(h) * off, h };
  }

  _placeVehicle(useSaved) {
    let p = null;
    const s = this.save.pos;
    if (useSaved && s && Number.isFinite(s.x) && Number.isFinite(s.z)) {
      if (this.sw.onRoad(s.x, s.z, 1.5) && this.sw.distToBuilding(s.x, s.z, 2) > 1.2) p = s;
      else p = this._poseOnNode(this.world.graph.nearestNode(s.x, s.z)); // آخر موقع لم يعد صالحًا: أقرب شارع
    }
    if (!p) p = this._spawnPose();
    this.veh.setPose(p.x, p.z, p.h);
    this.cam.snap();
  }

  // يعيد التوكتوك إلى أقرب شارع (لو علق)
  recover() {
    const n = this.world.graph.nearestNode(this.veh.x, this.veh.z);
    const p = this._poseOnNode(n);
    this.veh.setPose(p.x, p.z, p.h);
    this.cam.snap();
    this.ui.toast('رجّعنا التوكتوك للشارع', 'ok');
  }

  _syncTuk(dt, ev = { bump: 0 }, throttle = 0) {
    const v = this.veh;
    this.tuk.root.position.set(v.x, 0, v.z);
    this.tuk.root.rotation.y = v.h;
    this.tuk.animate(dt, {
      speed: v.forward, steer: v.steer, accelLong: v.accelLong, accelLat: v.accelLat, bump: ev.bump,
      nitro: v.boosting, firstPerson: this.cam.mode === 'first', passenger: this.missions.active,
      t: this.time, suspension: this.save.upgrades.suspension,
    });
  }

  // ————————————————— الحالات —————————————————
  _setState(s) {
    this.state = s;
    this._applyViewOffset();
    this.camera.updateProjectionMatrix();
    const ui = this.ui;
    ui.hideAllMenus();
    const hud = document.getElementById('hud');
    hud.classList.toggle('hidden', !(s === 'play' || s === 'pause' || s === 'map' || (s === 'settings' && this.settingsFrom === 'pause')));
    if (s === 'menu') ui.show('mainMenu');
    if (s === 'pause') ui.show('pauseMenu');
    if (s === 'garage') ui.show('garage');
    if (s === 'settings') ui.show('settings');
    if (s === 'map') ui.show('mapOverlay');
  }

  showMenu() {
    this._setState('menu');
    this.cam.mode = 'third';
    this.cam.snap();
  }

  startGame(isNew, openGarage = false) {
    this.audio.init();
    if (isNew) {
      clearSave();
      this.save = defaultSave();
      this.economy.s = this.save;
      this.hasSave = false;
    }
    this.economy.s = this.save;
    this.missions.reset();
    this._placeVehicle(!isNew);
    this.applyTuktukConfig(true);
    this.ui.syncSettings();
    this.applySettings();
    this.world.update(this.veh.x, this.veh.z, 0, true);
    this.people.reset();
    this.people.fillInitial(this.veh.x, this.veh.z);
    this.traffic.cars.length = 0;
    this._lowFuelWarned = false;
    this.started = true;
    this._setState('play');
    this.cam.snap();
    this.persist();
    if (openGarage) this.openGarage();
    else this.ui.toast('اضغط W للتحرك · وقّف عند أي زبون واضغط E', 'ok');
  }

  pause() { if (this.state === 'play') { this._setState('pause'); this.persist(); } }
  resume() { this._setState('play'); }
  quitToMenu() {
    this.persist();
    this.missions.reset();
    this.hasSave = hasSave();
    document.getElementById('mmContinue').disabled = !this.hasSave;
    document.getElementById('mmContinue').style.opacity = this.hasSave ? '' : '0.45';
    this.showMenu();
  }

  tryOpenGarage() {
    if (this.state !== 'play') return;
    if (this.veh.speed > 3) { this.ui.toast('وقّف التوكتوك الأول عشان تدخل الجراج', 'warn'); return; }
    this.openGarage();
  }
  openGarage() {
    this.garageFrom = this.state === 'pause' ? 'pause' : 'play';
    this.garageYaw = undefined;
    this._setState('garage');
    this.cam.mode = 'third';
    this.cam.orbitAngle = this.veh.h + Math.PI * 0.8;
    this.cam.pos.set(this.veh.x + 5, 2, this.veh.z + 5);
    this.veh.vx = this.veh.vz = 0;
    this.ui.tab = 'colors';
    this.ui.renderGarage();
  }
  closeGarage() {
    this.persist();
    this._setState(this.garageFrom);
    this.cam.snap();
  }

  openSettings(from) {
    this.settingsFrom = from;
    this.ui.syncSettings();
    this._setState('settings');
  }
  closeSettings() {
    this.persist();
    if (this.settingsFrom === 'pause') this._setState('pause');
    else this.showMenu();
  }

  openMap(from) {
    this.mapFrom = from;
    this._setState('map');
    this._drawBig();
  }
  closeMap() { this._setState(this.mapFrom === 'pause' ? 'pause' : 'play'); }

  toggleCamera() {
    this.cam.toggle();
    this.ui.toast(this.cam.mode === 'first' ? 'كاميرا السائق' : 'كاميرا خلف التوكتوك');
  }

  resetProgress() {
    this.noPersist = true;
    clearSave();
    location.reload();
  }

  persist() {
    if (this.noPersist || !this.started) return;
    this.save.pos = { x: Math.round(this.veh.x * 10) / 10, z: Math.round(this.veh.z * 10) / 10, h: Math.round(this.veh.h * 100) / 100 };
    writeSave(this.save);
    this.hasSave = true;
  }

  // ————————————————— الإدخال —————————————————
  _bindInput() {
    const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { if (e.code === 'Escape') e.target.blur(); return; }
      this.audio.init();
      if (prevent.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (!e.repeat) this._onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('pointerdown', () => this.audio.init(), { once: true });
    addEventListener('beforeunload', () => this.persist());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.persist(); if (this.state === 'play') this.pause(); } });
    // سحب الماوس لتدوير الجراج
    let drag = false, lx = 0;
    this.canvas.addEventListener('pointerdown', (e) => { if (this.state === 'garage') { drag = true; lx = e.clientX; } });
    addEventListener('pointerup', () => { drag = false; });
    addEventListener('pointermove', (e) => {
      if (!drag || this.state !== 'garage') return;
      this.garageYaw = (this.garageYaw || 0) - (e.clientX - lx) * 0.01;
      lx = e.clientX;
    });
    document.getElementById('radio').addEventListener('click', () => {
      this.audio.init();
      this.audio.setMusic(!this.audio.musicOn);
    });
  }

  _onKey(code) {
    const st = this.state;
    if (code === 'Escape') {
      if (st === 'play') this.pause();
      else if (st === 'pause') this.resume();
      else if (st === 'garage') this.closeGarage();
      else if (st === 'map') this.closeMap();
      else if (st === 'settings') this.closeSettings();
      return;
    }
    if (st === 'map' && code === 'KeyM') { this.closeMap(); return; }
    if (st === 'garage' && code === 'KeyG') { this.closeGarage(); return; }
    if (st !== 'play') return;
    switch (code) {
      case 'KeyE': this._interact(); break;
      case 'KeyV': this.toggleCamera(); break;
      case 'KeyG': this.tryOpenGarage(); break;
      case 'KeyM': this.openMap('play'); break;
      case 'KeyR': this.recover(); break;
      case 'KeyX': this.missions.cancel(); break;
      case 'KeyP': this.pause(); break;
      default: break;
    }
  }

  _interact() {
    const m = this.missions;
    if (m.active) {
      if (m.arrived) m.finish();
      else this.ui.toast('لسه ماوصلناش للوجهة', 'warn');
    } else if (!m.tryBoard()) {
      const n = this.people.nearestCustomer(this.veh.x, this.veh.z);
      if (!n || n.d > 9) this.ui.toast('مفيش زبون قريب — دوّر على العلامة الصفراء', 'warn');
    }
  }

  // ————————————————— الحلقة —————————————————
  _loop = (now) => {
    requestAnimationFrame(this._loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) return;
    this._fpsAcc += dt; this._fpsN++; // FPS الحقيقي من الزمن الفعلي
    dt = Math.min(dt, 0.05);
    if (this._fpsAcc >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
    try { this._frame(dt); } catch (e) { console.error(e); }
    this.pressed.clear();
  };

  _frame(dt) {
    const st = this.state;
    const v = this.veh;
    if (st === 'play') this._simulate(dt);
    else if (st === 'menu' || st === 'garage') {
      this.time += dt;
      this.world.update(v.x, v.z, dt);
      this.cam.update(dt, v, this.tuk, { garage: true, dragYaw: st === 'garage' ? this.garageYaw : undefined });
      this._syncTuk(dt);
      this.audio.update({ speedRatio: 0, throttle: 0, skid: 0, nitro: false, horn: false, fuelEmpty: false, running: false });
      if (st === 'garage') this.ui.updateHud?.(this._hudData(), dt);
    } else {
      this.audio.update({ speedRatio: 0, throttle: 0, skid: 0, nitro: false, horn: false, fuelEmpty: false, running: false });
      if (st === 'map') this._drawBig();
    }
    this.world.followSky(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  _hudData() {
    const v = this.veh, s = this.save, m = this.missions;
    let title, sub;
    if (m.active) {
      title = `وصّل الزبون: ${m.m.name}`;
      sub = m.arrived ? 'وصلت! وقّف واضغط E' : `${Math.round(m.m.left)} م · الأجرة ${m.m.fare} ج.م`;
    } else {
      title = 'ابحث عن زبون';
      const n = this.people.nearestCustomer(v.x, v.z);
      sub = n ? `أقرب زبون على بعد ${Math.round(n.d)} م` : 'لف في الشوارع…';
    }
    return {
      kmh: Math.round(Math.abs(v.forward) * 3.6), shift: s.shiftTotal, money: s.money, trips: s.trips,
      nitroPct: v.stats && v.stats.nitroCap > 0 ? (v.nitro / v.stats.nitroCap) * 100 : 0,
      fuel: Math.max(0, Math.min(100, s.fuel)), missionTitle: title, missionSub: sub, boost: v.boosting,
      north: this._north,
      dbg: s.settings.fps ? `WebGL · ${s.settings.quality.toUpperCase()} · ${this.fps} FPS · cam: ${this.cam.mode === 'first' ? 'Driver' : 'Chase'} · traffic ${this.traffic.count} · people ${this.people.walkers.length}` : '',
    };
  }

  _minimapState() {
    const v = this.veh, m = this.missions;
    const custs = this.people.customers.filter((c) => Math.hypot(c.x - v.x, c.z - v.z) < 260);
    return { x: v.x, z: v.z, h: v.h, route: m.active ? m.routePts : null, customers: m.active ? [] : custs, dest: m.active ? m.m.dest : null };
  }
  _drawBig() { this.minimap.drawBig(this._minimapState()); }

  _simulate(dt) {
    const k = this.keys, v = this.veh, save = this.save, ui = this.ui;
    this.time += dt;
    const fuelEmpty = save.fuel <= 0;
    const throttle = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    const inp = {
      throttle,
      brake: k.has('KeyS') || k.has('ArrowDown') ? 1 : 0,
      steer: (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0), // موجب = يسار
      handbrake: k.has('Space'),
      nitro: k.has('ShiftLeft') || k.has('ShiftRight'),
    };
    if (inp.nitro && v.stats.nitroCap <= 0 && this.time - this._lastNitroMsg > 4 && this.pressed.has('ShiftLeft')) {
      this._lastNitroMsg = this.time;
      ui.toast('النيترو مش مركّب — اشتريه من الجراج (G)', 'warn');
    }
    const steps = dt > 1 / 40 ? 2 : 1;
    let impact = 0, bump = 0, skid = 0;
    for (let i = 0; i < steps; i++) {
      const ev = v.update(dt / steps, inp, fuelEmpty);
      impact = Math.max(impact, ev.impact); bump = Math.max(bump, ev.bump); skid = Math.max(skid, ev.skid);
    }
    const ti = this.traffic.update(dt, v);
    impact = Math.max(impact, ti);
    if (impact > 2.5) { this.audio.thud(impact / 8); this.cam.shake = Math.min(1.2, impact / 8); }
    if (bump > 0.1) this.audio.bump();

    // بنزين
    if (!fuelEmpty) {
      const drain = 0.004 + (throttle ? 0.03 : 0) + (v.boosting ? 0.05 : 0);
      save.fuel = Math.max(0, save.fuel - drain * dt);
    }
    if (save.fuel < 15 && !this._lowFuelWarned) { this._lowFuelWarned = true; ui.toast('البنزين على وشك الخلاص! عبّي من الجراج (G)', 'warn'); }
    if (save.fuel > 20) this._lowFuelWarned = false;

    // نيترو: صوت + جسيمات
    if (v.boosting && !this._prevBoost) this.audio.nitroStart();
    this._prevBoost = v.boosting;
    const fx = Math.sin(v.h), fz = Math.cos(v.h), lx = Math.cos(v.h), lz = -Math.sin(v.h);
    const P = this.particles;
    if (skid > 0.25 && Math.random() < 0.7) {
      for (const sgn of [-1, 1]) {
        P.emit(v.x - fx * 0.75 + lx * 0.64 * sgn, 0.15, v.z - fz * 0.75 + lz * 0.64 * sgn, (Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6, 0.9, 0.7, [0.85, 0.85, 0.85], 0.35, 1.6);
      }
    }
    if (v.boosting) {
      P.emit(v.x - fx * 1.7 + lx * 0.35, 0.4, v.z - fz * 1.7 + lz * 0.35, -fx * 6 + (Math.random() - 0.5), 0.3, -fz * 6 + (Math.random() - 0.5), 0.4, 0.5, [0.4, 0.75, 1], 0.7, 0.6);
    }
    P.update(dt);

    // الرحلات
    this.missions.update(dt);

    // عالم وكاميرا وأنيميشن
    this.world.update(v.x, v.z, dt);
    this.people.update(dt, v.x, v.z);
    this.cam.update(dt, v, this.tuk, {});
    this._syncTuk(dt, { bump }, throttle);

    // الصوت
    this.audio.update({
      speedRatio: Math.min(1, Math.abs(v.forward) / (v.stats.maxSpeed * (v.boosting ? 1.45 : 1))), throttle, skid,
      nitro: v.boosting, horn: k.has('KeyH'), fuelEmpty, running: true,
    });

    // الرسائل التفاعلية
    const n = this.people.nearestCustomer(v.x, v.z);
    const m = this.missions;
    let prompt = '';
    if (m.active) { if (m.arrived) prompt = 'اضغط E لإنهاء الرحلة واستلام الفلوس'; }
    else if (n && n.d < 9) prompt = v.speed > 7 ? 'خفّف السرعة عشان الزبون يركب' : 'اضغط E لركوب الزبون';
    ui.prompt(prompt);

    // الخريطة المصغرة + HUD
    this._mapFrame++;
    if (this._mapFrame % 2 === 0) this._north = this.minimap.draw(this._minimapState());
    ui.updateHud(this._hudData(), dt);

    this._persistT += dt;
    if (this._persistT > 8) { this._persistT = 0; this.persist(); }
  }
}
