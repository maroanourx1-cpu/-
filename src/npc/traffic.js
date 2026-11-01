// سيارات وميكروباصات وتكاتك متحركة على شبكة الطرق (Instanced)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function part(geo, hex, x = 0, y = 0, z = 0) {
  const g = geo.clone();
  g.translate(x, y, z);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function wheel(x, z, r = 0.32) {
  const g = new THREE.CylinderGeometry(r, r, 0.22, 10); g.rotateZ(Math.PI / 2);
  return part(g, '#161616', x, r, z);
}

function sedanGeo() {
  return mergeGeometries([
    part(B(1.8, 0.62, 4.2), '#ffffff', 0, 0.62, 0),
    part(B(1.55, 0.5, 2.2), '#8fb0c8', 0, 1.15, -0.2),
    part(B(1.5, 0.08, 2.0), '#ffffff', 0, 1.42, -0.2),
    part(B(0.5, 0.12, 0.05), '#fff2c0', 0.55, 0.7, 2.1),
    part(B(0.5, 0.12, 0.05), '#fff2c0', -0.55, 0.7, 2.1),
    part(B(0.5, 0.12, 0.05), '#b01010', 0.55, 0.7, -2.1),
    part(B(0.5, 0.12, 0.05), '#b01010', -0.55, 0.7, -2.1),
    wheel(0.85, 1.35), wheel(-0.85, 1.35), wheel(0.85, -1.3), wheel(-0.85, -1.3),
  ]);
}
function vanGeo() {
  return mergeGeometries([
    part(B(1.95, 1.0, 5.0), '#ffffff', 0, 0.75, 0),
    part(B(1.9, 0.75, 4.2), '#ffffff', 0, 1.62, -0.35),
    part(B(1.93, 0.4, 3.9), '#7aa0bb', 0, 1.62, -0.35),
    part(B(1.7, 0.08, 4.3), '#e9e9e9', 0, 2.03, -0.35),
    part(B(0.5, 0.12, 0.05), '#fff2c0', 0.65, 0.8, 2.5),
    part(B(0.5, 0.12, 0.05), '#fff2c0', -0.65, 0.8, 2.5),
    part(B(0.4, 0.14, 0.05), '#b01010', 0.7, 0.9, -2.5),
    part(B(0.4, 0.14, 0.05), '#b01010', -0.7, 0.9, -2.5),
    wheel(0.9, 1.6, 0.36), wheel(-0.9, 1.6, 0.36), wheel(0.9, -1.5, 0.36), wheel(-0.9, -1.5, 0.36),
  ]);
}
function tukGeo() {
  return mergeGeometries([
    part(B(1.2, 0.55, 2.0), '#ffffff', 0, 0.62, -0.1),
    part(B(0.9, 0.6, 0.6), '#ffffff', 0, 0.75, 0.95),
    part(B(1.35, 0.07, 1.8), '#222222', 0, 1.75, -0.25),
    part(B(0.04, 0.9, 0.04), '#222222', 0.62, 1.3, 0.55), part(B(0.04, 0.9, 0.04), '#222222', -0.62, 1.3, 0.55),
    part(B(0.04, 1.0, 0.04), '#222222', 0.62, 1.3, -1.0), part(B(0.04, 1.0, 0.04), '#222222', -0.62, 1.3, -1.0),
    part(B(1.0, 0.45, 0.1), '#55252a', 0, 1.05, -0.88),
    part(B(0.2, 0.12, 0.1), '#fff2c0', 0, 0.9, 1.28),
    wheel(0, 1.15, 0.3), wheel(0.62, -0.75, 0.3), wheel(-0.62, -0.75, 0.3),
  ]);
}

const CAR_COLORS = ['#e8e8e8', '#cfd3d6', '#1d1d1f', '#8e1b1b', '#1e3a6e', '#c9a227', '#3b3f45', '#f2f2f2', '#5a7d5a', '#d95f0e'].map((h) => new THREE.Color(h));
const KINDS = {
  sedan: { r: 1.0, off: 1.2, geo: sedanGeo, speed: 1 },
  van: { r: 1.1, off: 1.4, geo: vanGeo, speed: 0.9 },
  tuk: { r: 0.8, off: 0.6, geo: tukGeo, speed: 0.8 },
};

export class Traffic {
  constructor(scene, world, quality = 'medium') {
    this.world = world;
    this.graph = world.graph;
    this.cars = [];
    this.max = quality === 'low' ? 10 : quality === 'high' ? 32 : 22;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.meshes = {};
    for (const k of Object.keys(KINDS)) {
      const m = new THREE.InstancedMesh(KINDS[k].geo(), this.mat, 40);
      m.frustumCulled = false;
      m.castShadow = true;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      this.meshes[k] = m;
    }
    this.spawnT = 0;
  }
  setMax(n) { this.max = n; }
  get count() { return this.cars.length; }

  _spawn(px, pz) {
    const g = this.graph;
    for (let tries = 0; tries < 12; tries++) {
      const n = g.mainNodes[(Math.random() * g.mainNodes.length) | 0];
      const nd = g.nodes[n];
      const d = Math.hypot(nd.x - px, nd.z - pz);
      if (d < 70 || d > 250) continue;
      const opts = nd.adj.filter((ei) => g.edges[ei].w >= 6 && (!g.edges[ei].oneway || g.edges[ei].a === n));
      if (!opts.length) continue;
      const ei = opts[(Math.random() * opts.length) | 0];
      const e = g.edges[ei];
      const to = e.a === n ? e.b : e.a;
      const roll = Math.random();
      const kind = roll < 0.55 ? 'sedan' : roll < 0.75 ? 'van' : 'tuk';
      const car = { kind, from: n, to, edge: ei, t: Math.random() * e.len * 0.6, speed: 0, x: 0, z: 0, h: 0, stun: 0, color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0], pace: 0.75 + Math.random() * 0.3, wait: 0, init: true };
      // لا تنشئ فوق سيارة أخرى
      this._target(car);
      car.x = car.tx; car.z = car.tz; car.h = car.th;
      if (this.cars.some((c) => Math.hypot(c.x - car.x, c.z - car.z) < 6)) continue;
      if (Math.hypot(car.x - px, car.z - pz) < 60) continue;
      this.cars.push(car);
      return;
    }
  }

  _target(c) {
    const g = this.graph;
    const e = g.edges[c.edge];
    const A = g.nodes[c.from], Bn = g.nodes[c.to];
    const dx = (Bn.x - A.x) / e.len, dz = (Bn.z - A.z) / e.len;
    const lane = Math.min(e.w * 0.25, 2.6);
    c.tx = A.x + dx * c.t + dz * lane;
    c.tz = A.z + dz * c.t - dx * lane;
    c.th = Math.atan2(dx, dz);
    c.dx = dx; c.dz = dz;
  }

  update(dt, veh) {
    const g = this.graph;
    this.spawnT -= dt;
    if (this.cars.length < this.max && this.spawnT <= 0) { this._spawn(veh.x, veh.z); this.spawnT = 0.25; }
    const fx = Math.sin(veh.h), fz = Math.cos(veh.h);
    const pcs = [[veh.x + fx, veh.z + fz], [veh.x - fx * 0.8, veh.z - fz * 0.8]];
    let impact = 0;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (Math.hypot(c.x - veh.x, c.z - veh.z) > 340) { this.cars.splice(i, 1); continue; }
      const e = g.edges[c.edge];
      const K = KINDS[c.kind];
      c.stun = Math.max(0, c.stun - dt);
      // السرعة المطلوبة
      let want = e.speed * c.pace * K.speed;
      const remain = e.len - c.t;
      if (remain < 14 && g.degree(c.to) >= 3) want = Math.min(want, 4.5);
      // عائق أمام السيارة
      const hx = c.dx, hz = c.dz;
      let block = 99;
      const check = (ox, oz) => {
        const rx = ox - c.x, rz = oz - c.z;
        const along = rx * hx + rz * hz;
        const lat = Math.abs(-rx * hz + rz * hx);
        if (along > 0.5 && along < 14 && lat < 1.9) block = Math.min(block, along);
      };
      for (const p of pcs) check(p[0], p[1]);
      for (const o of this.cars) if (o !== c) check(o.x, o.z);
      if (block < 99) want = Math.min(want, Math.max(0, (block - 5.5) * 1.2));
      if (c.stun > 0) want = 0;
      c.speed += (want - c.speed) * Math.min(1, dt * (want < c.speed ? 3.5 : 1.2));
      c.t += c.speed * dt;
      if (c.t >= e.len) {
        // العقدة التالية
        const node = g.nodes[c.to];
        const opts = node.adj.filter((ei) => ei !== c.edge && g.edges[ei].w >= 6 && (!g.edges[ei].oneway || g.edges[ei].a === c.to));
        let ei;
        if (opts.length) ei = opts[(Math.random() * opts.length) | 0];
        else { // نهاية مسدودة: لف
          const back = node.adj.filter((x) => !g.edges[x].oneway || g.edges[x].a === c.to);
          if (!back.length) { this.cars.splice(i, 1); continue; }
          ei = back[0];
        }
        const ne = g.edges[ei];
        c.from = c.to; c.to = ne.a === c.from ? ne.b : ne.a; c.edge = ei; c.t = 0;
      }
      this._target(c);
      const k = Math.min(1, dt * 5);
      c.x += (c.tx - c.x) * k; c.z += (c.tz - c.z) * k;
      let dh = c.th - c.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      c.h += dh * Math.min(1, dt * 6);
      // تصادم مع اللاعب
      const sx = Math.sin(c.h), sz = Math.cos(c.h);
      for (const off of [K.off, -K.off]) {
        const cx = c.x + sx * off, cz = c.z + sz * off;
        for (const [ox, oz] of [[veh.x + fx * 1.0, veh.z + fz * 1.0], [veh.x, veh.z], [veh.x - fx * 0.85, veh.z - fz * 0.85]]) {
          const dx = ox - cx, dz = oz - cz;
          const d = Math.hypot(dx, dz);
          const R = K.r + 0.7;
          if (d < R && d > 1e-4) {
            const nx = dx / d, nz = dz / d, pen = R - d;
            veh.x += nx * pen * 0.85; veh.z += nz * pen * 0.85;
            const vn = veh.vx * nx + veh.vz * nz;
            if (vn < 0) { veh.vx -= 1.3 * vn * nx; veh.vz -= 1.3 * vn * nz; impact = Math.max(impact, -vn); c.stun = 1.2; c.speed *= 0.3; }
          }
        }
      }
    }
    // تحديث المصفوفات
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const counts = { sedan: 0, van: 0, tuk: 0 };
    const up = new THREE.Vector3(0, 1, 0);
    for (const c of this.cars) {
      const mesh = this.meshes[c.kind];
      const i = counts[c.kind]++;
      if (i >= 40) continue;
      q.setFromAxisAngle(up, c.h);
      p.set(c.x, 0, c.z);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, c.color);
    }
    for (const k of Object.keys(this.meshes)) {
      const m = this.meshes[k];
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    return impact;
  }
}
