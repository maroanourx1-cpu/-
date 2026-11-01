// المشاة والزبائن: أشخاص يمشون على الأرصفة، وزبائن واقفون في أماكن آمنة بجانب الطريق
import * as THREE from 'three';
import { SpatialHash } from '../world/spatial.js';

const SHIRTS = ['#c84b4b', '#41566b', '#e2c044', '#4b8f5a', '#7d5ba6', '#d9d9d9', '#2f2f35', '#c97a2b', '#2c7da0'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
const PANTS = ['#2a2a33', '#3b3b44', '#4a3b2c', '#1f2d4a'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
const SKINS = ['#a8704a', '#c68e62', '#8a5a3a', '#d9a77a'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
const GEO = {
  torso: new THREE.BoxGeometry(0.38, 0.55, 0.22),
  head: new THREE.SphereGeometry(0.13, 10, 8),
  leg: (() => { const g = new THREE.BoxGeometry(0.14, 0.78, 0.15); g.translate(0, -0.39, 0); return g; })(),
  arm: (() => { const g = new THREE.BoxGeometry(0.1, 0.55, 0.1); g.translate(0, -0.25, 0); return g; })(),
};
const pick = (a) => a[(Math.random() * a.length) | 0];

export function makeFigure() {
  const g = new THREE.Group();
  const shirt = pick(SHIRTS), pants = pick(PANTS), skin = pick(SKINS);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(GEO.torso, shirt, 0, 1.08, 0);
  add(GEO.head, skin, 0, 1.55, 0);
  const legL = add(GEO.leg, pants, 0.1, 0.8, 0);
  const legR = add(GEO.leg, pants, -0.1, 0.8, 0);
  const armL = add(GEO.arm, shirt, 0.26, 1.33, 0);
  const armR = add(GEO.arm, shirt, -0.26, 1.33, 0);
  g.userData = { legL, legR, armL, armR };
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// خطوط الأرصفة الآمنة (بدون مبانٍ أو عوائق)
export function buildSidewalkLines(world) {
  const { graph, sw } = world;
  const lines = [];
  for (const e of graph.edges) {
    if (graph.main[e.a] !== graph.mainId) continue;
    if (e.len < 28 || e.w < 6 || e.type === 'service') continue;
    const A = graph.nodes[e.a], B = graph.nodes[e.b];
    const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len;
    const nx = -dz, nz = dx;
    const s0 = 12, s1 = e.len - 12;
    if (s1 - s0 < 10) continue;
    for (const side of [1, -1]) {
      const off = e.w / 2 + 1.3;
      let ok = true;
      for (let s = s0; s <= s1; s += 4) {
        const x = A.x + dx * s + nx * off * side, z = A.z + dz * s + nz * off * side;
        if (sw.distToObstacle(x, z, 1.2) < 0.9 || sw.onRoad(x, z, 0.2)) { ok = false; break; }
      }
      if (!ok) continue;
      lines.push({
        ax: A.x + dx * s0 + nx * off * side, az: A.z + dz * s0 + nz * off * side,
        bx: A.x + dx * s1 + nx * off * side, bz: A.z + dz * s1 + nz * off * side,
        facing: Math.atan2(-nx * side, -nz * side), edge: e,
      });
    }
  }
  return lines;
}

export const PLACE_NAMES = [
  'صيدلية الشفاء', 'مدرسة الأمل', 'سوبر ماركت النور', 'مسجد الرحمة', 'كافيه النجمة', 'عيادة الدكتور أحمد', 'مخبز البركة',
  'محطة المترو', 'كشري التحرير', 'مستشفى عين شمس', 'سنتر الصفا', 'ميدان المحطة', 'بيت الفرح', 'جامعة عين شمس', 'سوق الخضار',
  'ورشة الأسطى حسن', 'نادي الشباب', 'مول النصر', 'شقة الدور الخامس', 'محل الموبايلات',
];
export const SPEECH = [
  'على {d} يا اسطى!', 'وصلني {d} بسرعة لو سمحت', 'رايح {d}، ماشي؟', 'الله يخليك {d} وأنا مستعجل', 'يا شعبولا، {d} من فضلك',
];

export class People {
  constructor(scene, world, lines, quality = 'medium') {
    this.scene = scene;
    this.world = world;
    this.lines = lines;
    this.hash = new SpatialHash(64);
    lines.forEach((l, i) => this.hash.add(i, Math.min(l.ax, l.bx), Math.min(l.az, l.bz), Math.max(l.ax, l.bx), Math.max(l.az, l.bz)));
    this.walkers = [];
    this.customers = [];
    this.maxWalkers = quality === 'low' ? 10 : quality === 'high' ? 40 : 24;
    this.maxCust = 8;
    this.t = 0;
    this.spawnT = 0;
    // علامة الزبون
    this.beamGeo = new THREE.CylinderGeometry(0.7, 0.7, 40, 14, 1, true);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.arrowGeo = new THREE.ConeGeometry(0.35, 0.7, 4);
    this.arrowGeo.rotateX(Math.PI);
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0xffc400 });
    // وجهة
    this.destBeamMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.dest = new THREE.Group();
    const db = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 60, 24, 1, true), this.destBeamMat);
    db.position.y = 30;
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5, 32), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.9), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    diamond.position.y = 4.5;
    this.destDiamond = diamond;
    this.dest.add(db, ring, diamond);
    this.dest.visible = false;
    scene.add(this.dest);
  }

  // مسح كل الزبائن والمشاة (عند بدء لعبة أو الانتقال لمكان جديد)
  reset() {
    for (let i = this.customers.length - 1; i >= 0; i--) this._removeCustomer(i);
    for (const w of this.walkers) this.scene.remove(w.fig);
    this.walkers.length = 0;
    this.dest.visible = false;
  }

  setDestination(x, z) {
    if (x === null) { this.dest.visible = false; return; }
    this.dest.visible = true;
    this.dest.position.set(x, 0, z);
  }

  _randomLineNear(px, pz, rmin, rmax) {
    const cand = [];
    this.hash.query(px, pz, rmax, (i) => cand.push(i));
    if (!cand.length) return null;
    for (let k = 0; k < 10; k++) {
      const l = this.lines[cand[(Math.random() * cand.length) | 0]];
      const mx = (l.ax + l.bx) / 2, mz = (l.az + l.bz) / 2;
      const d = Math.hypot(mx - px, mz - pz);
      if (d >= rmin && d <= rmax) return l;
    }
    return null;
  }

  randomSpot(px, pz, rmin, rmax) {
    const l = this._randomLineNear(px, pz, rmin, rmax);
    if (!l) return null;
    const u = 0.15 + Math.random() * 0.7;
    return { x: l.ax + (l.bx - l.ax) * u, z: l.az + (l.bz - l.az) * u, facing: l.facing, line: l };
  }

  pickDestination(from) {
    // وجهة بين 250 و1500 متر
    for (let k = 0; k < 40; k++) {
      const s = this.randomSpot(from.x, from.z, 250, 1500) || this.randomSpot(from.x, from.z, 120, 900);
      if (s) return { ...s, name: PLACE_NAMES[(Math.random() * PLACE_NAMES.length) | 0] };
    }
    return null;
  }

  fillInitial(px, pz) {
    for (let i = 0; i < this.maxCust; i++) this._spawnCustomer(px, pz, 25, 170);
    for (let i = 0; i < this.maxWalkers; i++) this._spawnWalker(px, pz, 15, 120);
  }

  _spawnWalker(px, pz, rmin, rmax) {
    const l = this._randomLineNear(px, pz, rmin, rmax);
    if (!l) return;
    const fig = makeFigure();
    const u = Math.random();
    const w = { line: l, u, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1 + Math.random() * 0.6, fig, phase: Math.random() * 6 };
    this.scene.add(fig);
    this.walkers.push(w);
  }

  _spawnCustomer(px, pz, rmin, rmax) {
    const s = this.randomSpot(px, pz, rmin, rmax);
    if (!s) return;
    if (this.customers.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < 18)) return;
    const dest = this.pickDestination(s);
    if (!dest) return;
    const fig = makeFigure();
    fig.position.set(s.x, 0, s.z);
    fig.rotation.y = s.facing;
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
    beam.position.y = 20;
    const arrow = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    arrow.position.y = 2.7;
    marker.add(beam, arrow);
    marker.position.set(s.x, 0, s.z);
    this.scene.add(fig, marker);
    this.customers.push({ x: s.x, z: s.z, fig, marker, arrow, dest, phase: Math.random() * 6 });
  }

  _removeCustomer(i) {
    const c = this.customers[i];
    this.scene.remove(c.fig, c.marker);
    this.customers.splice(i, 1);
  }

  nearestCustomer(x, z) {
    let best = null, bd = 1e9;
    for (const c of this.customers) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { c: best, d: bd } : null;
  }

  board(c) {
    const i = this.customers.indexOf(c);
    if (i >= 0) this._removeCustomer(i);
  }

  update(dt, px, pz) {
    this.t += dt;
    this.spawnT -= dt;
    // زبائن
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d > 320) { this._removeCustomer(i); continue; }
      const near = d < 45;
      c.arrow.position.y = 2.7 + Math.sin(this.t * 3 + c.phase) * 0.2;
      c.arrow.rotation.y += dt * 2;
      const u = c.fig.userData;
      if (near) {
        u.armL.rotation.z = -2.6 + Math.sin(this.t * 8 + c.phase) * 0.35; // يلوّح
        u.armL.rotation.x = 0;
      } else u.armL.rotation.z = 0;
    }
    if (this.customers.length < this.maxCust && this.spawnT <= 0) {
      this._spawnCustomer(px, pz, 60, 240);
      this.spawnT = 0.5;
    }
    // مشاة
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      const l = w.line;
      const L = Math.hypot(l.bx - l.ax, l.bz - l.az);
      w.u += (w.dir * w.speed * dt) / L;
      if (w.u > 1) { w.u = 1; w.dir = -1; } else if (w.u < 0) { w.u = 0; w.dir = 1; }
      const x = l.ax + (l.bx - l.ax) * w.u, z = l.az + (l.bz - l.az) * w.u;
      w.fig.position.set(x, Math.abs(Math.sin(this.t * 7 + w.phase)) * 0.03, z);
      w.fig.rotation.y = Math.atan2((l.bx - l.ax) * w.dir, (l.bz - l.az) * w.dir);
      const s = Math.sin(this.t * 6.5 * (w.speed / 1.3) + w.phase);
      const u = w.fig.userData;
      u.legL.rotation.x = s * 0.6; u.legR.rotation.x = -s * 0.6;
      u.armL.rotation.x = -s * 0.5; u.armR.rotation.x = s * 0.5;
      const d = Math.hypot(x - px, z - pz);
      if (d > 170) { this.scene.remove(w.fig); this.walkers.splice(i, 1); }
    }
    if (this.walkers.length < this.maxWalkers && this.spawnT <= 0.3) this._spawnWalker(px, pz, 50, 140);
    this.destDiamond.rotation.y += dt * 2;
    this.destDiamond.position.y = 4.5 + Math.sin(this.t * 3) * 0.4;
  }
}
