// موديل التوكتوك المصري ثلاثي الأبعاد + التخصيص + الأنيميشن
import * as THREE from 'three';
import { LIGHTS } from '../game/economy.js';
import { stickerTexture, plateTexture, roofSignTexture } from '../world/textures.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...o });

export function createTuktuk(envMap) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const E = envMap ? { envMap, envMapIntensity: 0.7 } : {};

  const M = {
    body: std('#f2b705', { roughness: 0.35, metalness: 0.35, ...E }),
    roof: std('#1b1b1b', { roughness: 0.5, ...E }),
    seat: std('#7a1f1f', { roughness: 0.8, metalness: 0 }),
    rim: std('#c9c9c9', { roughness: 0.25, metalness: 0.8, ...E }),
    tire: std('#151515', { roughness: 0.95, metalness: 0 }),
    black: std('#222326', { roughness: 0.6 }),
    chrome: std('#d8d8d8', { roughness: 0.15, metalness: 0.9, ...E }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fc6e0', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false, ...E }),
    head: new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#fff6dd', emissiveIntensity: 1.6 }),
    tail: new THREE.MeshStandardMaterial({ color: '#c01010', emissive: '#ff1a1a', emissiveIntensity: 0.9 }),
    skin: std('#a8704a', { roughness: 0.8, metalness: 0 }),
    shirt: std('#41566b', { roughness: 0.9, metalness: 0 }),
    pants: std('#2a2a33', { roughness: 0.9, metalness: 0 }),
    pshirt: std('#c84b4b', { roughness: 0.9, metalness: 0 }),
  };

  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);

  // —— الهيكل ——
  add(body, box(1.22, 0.3, 2.0), M.body, 0, 0.48, -0.1);
  add(body, box(0.1, 0.55, 1.2), M.body, 0.62, 0.78, -0.45);
  add(body, box(0.1, 0.55, 1.2), M.body, -0.62, 0.78, -0.45);
  add(body, box(1.2, 0.5, 0.08), M.body, 0, 0.82, -1.0); // الجدار الخلفي السفلي
  // مقدمة مدورة
  const nose = add(body, new THREE.CylinderGeometry(0.5, 0.55, 0.85, 14, 1, false, -Math.PI / 2, Math.PI), M.body, 0, 0.78, 0.85);
  nose.scale.set(1.14, 1, 1.15);
  add(body, box(1.14, 0.3, 0.5), M.body, 0, 0.5, 0.55);
  // غطاء مقدمة
  add(body, box(0.95, 0.06, 0.6), M.body, 0, 1.22, 0.85, 0.35, 0, 0);
  // الزجاج الأمامي
  add(body, box(1.2, 0.62, 0.025), M.glass, 0, 1.45, 0.62, -0.28, 0, 0);
  add(body, box(1.24, 0.04, 0.04), M.black, 0, 1.15, 0.7, -0.28, 0, 0);
  // المصد الأمامي
  add(body, cyl(0.035, 0.035, 1.1, 8), M.chrome, 0, 0.42, 1.48, 0, 0, Math.PI / 2);
  // —— السقف ——
  const roofM = add(body, box(1.38, 0.07, 1.95), M.roof, 0, 1.78, -0.28);
  add(body, box(1.38, 0.07, 0.4), M.roof, 0, 1.74, 0.75, 0.18, 0, 0);
  for (const sx of [-1, 1]) {
    add(body, cyl(0.025, 0.025, 0.9, 6), M.black, sx * 0.64, 1.3, 0.6, -0.15, 0, 0);
    add(body, cyl(0.025, 0.025, 1.05, 6), M.black, sx * 0.64, 1.3, -1.0);
  }
  // الحائط الخلفي (ستارة) + مكان الملصق
  const backPanel = add(body, box(1.2, 0.62, 0.04), M.roof, 0, 1.4, -1.0);
  // —— المقاعد ——
  add(body, box(1.05, 0.16, 0.5), M.seat, 0, 0.72, -0.62);
  add(body, box(1.05, 0.5, 0.1), M.seat, 0, 1.05, -0.9);
  add(body, box(0.46, 0.14, 0.4), M.seat, 0, 0.74, 0.12);
  add(body, box(0.46, 0.38, 0.08), M.seat, 0, 1.0, -0.08);
  // —— لوحة العدادات وعجلة القيادة (المقود) ——
  add(body, box(0.8, 0.2, 0.3), M.black, 0, 1.07, 0.62, -0.25, 0, 0);
  add(body, cyl(0.07, 0.07, 0.02, 14), M.chrome, 0, 1.15, 0.54, Math.PI / 2 - 0.25, 0, 0);
  const bar = new THREE.Group();
  bar.position.set(0, 1.12, 0.5);
  body.add(bar);
  add(bar, cyl(0.025, 0.025, 0.86, 8), M.chrome, 0, 0, 0, 0, 0, Math.PI / 2);
  add(bar, cyl(0.03, 0.03, 0.2, 8), M.black, 0.43, 0, 0, 0, 0, Math.PI / 2);
  add(bar, cyl(0.03, 0.03, 0.2, 8), M.black, -0.43, 0, 0, 0, 0, Math.PI / 2);
  add(bar, cyl(0.03, 0.03, 0.3, 8), M.chrome, 0, -0.14, 0.05, 0.4, 0, 0);
  // المرايات
  for (const sx of [-1, 1]) {
    add(body, cyl(0.012, 0.012, 0.28, 5), M.chrome, sx * 0.66, 1.32, 0.62, 0, 0, sx * -0.5);
    add(body, box(0.14, 0.1, 0.02), M.chrome, sx * 0.74, 1.46, 0.6, 0, sx * 0.25, 0);
  }
  // —— الأنوار ——
  const headlight = add(body, new THREE.SphereGeometry(0.13, 12, 10), M.head, 0, 0.9, 1.34);
  headlight.castShadow = false;
  for (const sx of [-1, 1]) add(body, box(0.1, 0.08, 0.04), M.tail, sx * 0.5, 0.7, -1.04);
  for (const sx of [-1, 1]) add(body, new THREE.SphereGeometry(0.05, 8, 6), M.head, sx * 0.5, 1.0, 1.0).castShadow = false;
  // لوحة الأرقام
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTexture() });
  const plate = add(body, new THREE.PlaneGeometry(0.4, 0.15), plateMat, 0, 0.48, -1.045, 0, Math.PI, 0);
  plate.castShadow = false;
  // العادم
  add(body, cyl(0.04, 0.05, 0.4, 8), M.chrome, 0.35, 0.36, -1.1, Math.PI / 2, 0, 0);
  const flame = add(body, new THREE.ConeGeometry(0.1, 1.0, 8), new THREE.MeshBasicMaterial({ color: '#58b8ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 0.35, 0.36, -1.7, -Math.PI / 2, 0, 0);
  flame.visible = false; flame.castShadow = false;
  const flameIn = add(body, new THREE.ConeGeometry(0.05, 0.6, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0.35, 0.36, -1.5, -Math.PI / 2, 0, 0);
  flameIn.visible = false; flameIn.castShadow = false;

  // —— العجلات ——
  const wheels = [];
  const makeWheel = () => {
    const w = new THREE.Group();
    const tg = new THREE.CylinderGeometry(0.31, 0.31, 0.19, 18); tg.rotateZ(Math.PI / 2);
    add(w, tg, M.tire);
    const rg = new THREE.CylinderGeometry(0.19, 0.19, 0.2, 12); rg.rotateZ(Math.PI / 2);
    add(w, rg, M.rim);
    add(w, box(0.21, 0.34, 0.05), M.rim);
    add(w, box(0.21, 0.05, 0.34), M.rim);
    return w;
  };
  const frontFork = new THREE.Group();
  frontFork.position.set(0, 0.31, 1.15);
  body.add(frontFork);
  const fw = makeWheel();
  frontFork.add(fw);
  wheels.push(fw);
  add(frontFork, box(0.08, 0.05, 0.05), M.chrome, 0, 0.55, 0);
  add(frontFork, box(0.05, 0.6, 0.05), M.chrome, 0.13, 0.25, 0);
  add(frontFork, box(0.05, 0.6, 0.05), M.chrome, -0.13, 0.25, 0);
  const fender = add(frontFork, new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14, 1, true, 0, Math.PI), M.body, 0, 0.08, 0, 0, 0, Math.PI / 2);
  fender.rotation.set(0, 0, Math.PI / 2);
  fender.rotation.y = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const w = makeWheel();
    w.position.set(sx * 0.64, 0.31, -0.75);
    body.add(w);
    wheels.push(w);
    add(body, box(0.32, 0.05, 0.8), M.body, sx * 0.64, 0.66, -0.75); // رفرف
  }

  // —— السائق (شعبولا) ——
  const driver = new THREE.Group();
  body.add(driver);
  add(driver, box(0.38, 0.5, 0.24), M.shirt, 0, 1.15, 0.0);
  add(driver, new THREE.SphereGeometry(0.14, 12, 10), M.skin, 0, 1.55, 0.04);
  add(driver, cyl(0.15, 0.15, 0.06, 12), M.roof, 0, 1.66, 0.04); // طاقية
  add(driver, box(0.14, 0.03, 0.02), M.black, 0, 1.52, 0.17); // شنب
  add(driver, box(0.12, 0.5, 0.14), M.pants, 0.11, 0.85, 0.18, -1.2, 0, 0);
  add(driver, box(0.12, 0.5, 0.14), M.pants, -0.11, 0.85, 0.18, -1.2, 0, 0);
  add(driver, box(0.1, 0.45, 0.1), M.shirt, 0.25, 1.2, 0.2, -1.0, 0, -0.2);
  add(driver, box(0.1, 0.45, 0.1), M.shirt, -0.25, 1.2, 0.2, -1.0, 0, 0.2);
  // —— الراكب ——
  const pass = new THREE.Group();
  pass.visible = false;
  body.add(pass);
  add(pass, box(0.4, 0.5, 0.22), M.pshirt, 0, 1.08, -0.72);
  add(pass, new THREE.SphereGeometry(0.14, 12, 10), M.skin, 0, 1.47, -0.72);
  add(pass, box(0.13, 0.4, 0.14), M.pants, 0.12, 0.88, -0.5, -1.4, 0, 0);
  add(pass, box(0.13, 0.4, 0.14), M.pants, -0.12, 0.88, -0.5, -1.4, 0, 0);

  // —— ملصقات ——
  const stickerMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const stickerBack = add(body, new THREE.PlaneGeometry(1.1, 0.42), stickerMat, 0, 1.4, -1.025, 0, Math.PI, 0);
  stickerBack.castShadow = false;
  const stickerSides = [-1, 1].map((sx) => {
    const m = add(body, new THREE.PlaneGeometry(0.95, 0.3), stickerMat, sx * 0.675, 0.8, -0.45, 0, sx * Math.PI / 2, 0);
    m.castShadow = false;
    return m;
  });
  stickerBack.visible = false; stickerSides.forEach((s) => (s.visible = false));

  // —— زينة ——
  const decor = {};
  const charm = new THREE.Group();
  add(charm, cyl(0.004, 0.004, 0.25, 4), M.black, 0, -0.12, 0);
  add(charm, new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: '#1565ff', emissive: '#0a2a88', roughness: 0.2 }), 0, -0.28, 0);
  charm.position.set(0.25, 1.74, 0.5);
  body.add(charm); decor.charm = charm;
  const flags = new THREE.Group();
  for (const sx of [-1, 1]) {
    add(flags, cyl(0.012, 0.012, 0.6, 4), M.chrome, sx * 0.66, 2.08, 0.8);
    const f = new THREE.Group();
    f.position.set(sx * 0.66 + sx * 0.14, 2.28, 0.8);
    add(f, box(0.26, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: '#ce1126' }), 0, 0.06, 0);
    add(f, box(0.26, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 0, 0, 0);
    add(f, box(0.26, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: '#111111' }), 0, -0.06, 0);
    flags.add(f);
  }
  body.add(flags); decor.flags = flags;
  const roofsignMat = new THREE.MeshBasicMaterial({ map: roofSignTexture() });
  const roofsign = add(body, box(0.55, 0.19, 0.06), [M.black, M.black, M.black, M.black, roofsignMat, roofsignMat], 0, 1.9, 0.68);
  decor.roofsign = roofsign;
  const antenna = new THREE.Group();
  add(antenna, cyl(0.008, 0.008, 1.2, 4), M.black, -0.55, 2.35, -0.95, 0.12, 0, 0);
  add(antenna, box(0.14, 0.2, 0.01), new THREE.MeshBasicMaterial({ color: '#ff3d71', side: THREE.DoubleSide }), -0.55, 2.9, -0.95);
  body.add(antenna); decor.antenna = antenna;
  const ledMat = new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const led = new THREE.Group();
  add(led, new THREE.PlaneGeometry(1.5, 2.6), ledMat, 0, 0.1, -0.1, -Math.PI / 2, 0, 0).castShadow = false;
  body.add(led); decor.led = led;
  Object.values(decor).forEach((d) => (d.visible = false));

  // —— واجهة التحكم ——
  const api = {
    root, body, bar, frontFork, wheels, driver, pass, flame, flameIn, materials: M, roofM, decor,
    state: { pitch: 0, roll: 0, pitchV: 0, rollV: 0, bounce: 0, bounceV: 0, spin: 0, flick: 0 },
    config: null,
    applyConfig(cfg) {
      this.config = cfg;
      M.body.color.set(cfg.body);
      M.roof.color.set(cfg.roof);
      M.seat.color.set(cfg.seat);
      M.rim.color.set(cfg.rim);
      const L = LIGHTS[cfg.light] || LIGHTS.white;
      M.head.color.set(L.color); M.head.emissive.set(L.color);
      ledMat.color.set(L.color === '#fff6dd' ? '#00e5ff' : L.color);
      for (const k of Object.keys(decor)) decor[k].visible = cfg.decor.includes(k);
      const tex = stickerTexture(cfg.sticker);
      if (tex) {
        stickerMat.map = tex; stickerMat.needsUpdate = true;
        stickerBack.visible = true; stickerSides.forEach((s) => (s.visible = true));
      } else { stickerBack.visible = false; stickerSides.forEach((s) => (s.visible = false)); }
    },
    // dt: ثواني، in: {speed (م/ث), steer (-1..1), accelLong, accelLat, bump, nitro, firstPerson, passenger, t}
    animate(dt, s) {
      const st = this.state;
      // زنبرك الميل (تعليق)
      const stiff = 60 + s.suspension * 14, damp = 7 + s.suspension * 1.6;
      const tp = THREE.MathUtils.clamp(-s.accelLong * 0.012, -0.12, 0.12);
      const tr = THREE.MathUtils.clamp(s.accelLat * 0.012, -0.16, 0.16);
      st.pitchV += ((tp - st.pitch) * stiff - st.pitchV * damp) * dt; st.pitch += st.pitchV * dt;
      st.rollV += ((tr - st.roll) * stiff - st.rollV * damp) * dt; st.roll += st.rollV * dt;
      if (s.bump) st.bounceV += s.bump;
      st.bounceV += (-st.bounce * 120 - st.bounceV * 10) * dt; st.bounce += st.bounceV * dt;
      const vib = Math.sin(s.t * 38) * 0.0035 * (0.3 + Math.min(1, Math.abs(s.speed) / 12));
      body.position.y = st.bounce + vib;
      body.rotation.x = st.pitch;
      body.rotation.z = st.roll;
      // العجلات
      st.spin += (s.speed / 0.31) * dt;
      for (const w of wheels) w.rotation.x = st.spin;
      frontFork.rotation.y = s.steer * 0.6;
      bar.rotation.y = s.steer * 0.6;
      driver.visible = !s.firstPerson;
      pass.visible = !!s.passenger;
      flame.visible = flameIn.visible = !!s.nitro;
      if (s.nitro) {
        const f = 0.8 + Math.random() * 0.5;
        flame.scale.set(1, f, 1); flameIn.scale.set(1, f, 1);
      }
      if (decor.flags.visible) decor.flags.children.forEach((c, i) => { if (c.isGroup) c.rotation.y = Math.sin(s.t * 12 + i) * 0.25 * Math.min(1, Math.abs(s.speed) / 8); });
      if (decor.charm.visible) decor.charm.rotation.z = Math.sin(s.t * 3) * 0.1 + st.roll * 2;
      if (decor.antenna.visible) decor.antenna.rotation.z = Math.sin(s.t * 8) * 0.04 + st.roll;
    },
  };
  return api;
}
