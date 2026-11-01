// نظام الرحلات: ركوب الزبون، المسار، الوصول، الأجرة
import * as THREE from 'three';
import { SPEECH } from '../npc/people.js';

export class Missions {
  constructor(game) {
    this.g = game;
    this.m = null; // الرحلة الحالية
    this.routePts = null;
    this.routeT = 0;
    this.lastNode = -1;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    game.scene.add(this.mesh);
    this.arrived = false;
  }

  get active() { return !!this.m; }

  reset() {
    this.m = null; this.routePts = null; this.arrived = false;
    this.g.people.setDestination(null);
    this.mesh.visible = false;
    this.g.tuk.pass.visible = false;
  }

  tryBoard() {
    const g = this.g;
    if (this.m) return false;
    const n = g.people.nearestCustomer(g.veh.x, g.veh.z);
    if (!n || n.d > 9) return false;
    if (g.veh.speed > 7) { g.ui.toast('وقّف الأول عشان الزبون يركب', 'warn'); return false; }
    const c = n.c;
    const graph = g.world.graph;
    const a = graph.nearestNode(g.veh.x, g.veh.z), b = graph.nearestNode(c.dest.x, c.dest.z);
    const p = graph.path(a, b);
    if (!p || p.nodes.length < 2) { g.ui.toast('الزبون غيّر رأيه', 'warn'); g.people.board(c); return false; }
    const fare = Math.max(30, Math.min(450, Math.round(25 + (p.dist / 1000) * 80)));
    const allowed = p.dist / 7.5 + 35;
    this.m = { dest: c.dest, name: c.dest.name, fare, dist: p.dist, t0: g.time, allowed, left: p.dist };
    this.arrived = false;
    g.people.board(c);
    g.people.setDestination(c.dest.x, c.dest.z);
    g.tuk.pass.visible = true;
    g.audio.ding();
    g.ui.bubble(SPEECH[(Math.random() * SPEECH.length) | 0].replace('{d}', c.dest.name));
    g.ui.toast(`ركب زبون — الأجرة المتوقعة ${fare} ج.م`, 'ok');
    this.lastNode = -1; this.routeT = 0;
    this._route(true);
    return true;
  }

  cancel() {
    if (!this.m) return;
    this.g.ui.toast('اتلغت الرحلة', 'warn');
    this.reset();
  }

  _route(force = false) {
    const g = this.g, graph = g.world.graph;
    const m = this.m;
    const here = graph.nearestNode(g.veh.x, g.veh.z);
    if (!force && here === this.lastNode) {
      this._updateHead();
      return;
    }
    this.lastNode = here;
    const there = graph.nearestNode(m.dest.x, m.dest.z);
    const p = graph.path(here, there);
    if (!p) return;
    const pts = p.nodes.map((n) => [graph.nodes[n].x, graph.nodes[n].z]);
    // تجاهل أول عقدة لو اللاعب بعدها
    if (pts.length > 1) {
      const dx = pts[1][0] - pts[0][0], dz = pts[1][1] - pts[0][1];
      if (dx * (g.veh.x - pts[0][0]) + dz * (g.veh.z - pts[0][1]) > 0) pts.shift();
    }
    pts.push([m.dest.x, m.dest.z]);
    this.pathPts = pts;
    this._updateHead();
  }

  _updateHead() {
    const g = this.g;
    const pts = [[g.veh.x, g.veh.z], ...this.pathPts];
    this.routePts = pts;
    let len = 0;
    for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    this.m.left = len;
    // شريط المسار
    const pos = [], idx = [];
    const hw = 0.7;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      pos.push(pts[i][0] - dz * hw, 0.3, pts[i][1] + dx * hw, pts[i][0] + dz * hw, 0.3, pts[i][1] - dx * hw);
      if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.visible = true;
  }

  update(dt) {
    const g = this.g;
    if (!this.m) return;
    this.routeT += dt;
    if (this.routeT > 0.25) { this.routeT = 0; this._route(); }
    const m = this.m;
    const d = Math.hypot(g.veh.x - m.dest.x, g.veh.z - m.dest.z);
    const was = this.arrived;
    this.arrived = d < 13;
    if (this.arrived && !was) g.ui.toast('وصلنا! وقّف واضغط E', 'ok');
  }

  finish() {
    const g = this.g;
    const m = this.m;
    if (!m || !this.arrived) return false;
    if (g.veh.speed > 6) { g.ui.toast('وقّف الأول عشان الزبون ينزل', 'warn'); return false; }
    const elapsed = g.time - m.t0;
    const tip = elapsed < m.allowed ? Math.round(m.fare * 0.25 * (1 - elapsed / m.allowed)) : 0;
    const total = m.fare + tip;
    g.economy.earn(total);
    g.save.trips++;
    g.audio.cash();
    g.ui.toast(`+${total} ج.م${tip ? ` (منها ${tip} بقشيش)` : ''}`, 'cash');
    g.ui.bubble('تسلم إيدك يا اسطى!');
    this.reset();
    g.persist();
    return true;
  }
}
