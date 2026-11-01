// موديلات الأعمدة والأشجار والنخيل والإشارات (هندسة مدمجة بألوان رؤوس) + توزيعها على الشوارع
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { distPointSeg } from './spatial.js';
import { SpatialHash } from './spatial.js';

function part(geo, hex, m) {
  let g = geo.clone();
  if (g.index) g = g.toNonIndexed(); // بعض الأشكال مفهرسة وبعضها لا؛ نوحّدها قبل الدمج
  if (m) g.applyMatrix4(m);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const M = new THREE.Matrix4();
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = (a) => new THREE.Matrix4().makeRotationX(a);
const RY = (a) => new THREE.Matrix4().makeRotationY(a);
const mul = (...ms) => ms.reduce((a, b) => a.clone().multiply(b));

export function lampGeo() {
  const parts = [
    part(new THREE.CylinderGeometry(0.07, 0.1, 6.4, 6), '#4b4f55', T(0, 3.2, 0)),
    part(new THREE.BoxGeometry(0.08, 0.08, 1.6), '#4b4f55', T(0, 6.35, 0.75)),
    part(new THREE.BoxGeometry(0.4, 0.12, 0.7), '#fff3c4', T(0, 6.27, 1.45)),
  ];
  return mergeGeometries(parts);
}
export function treeGeo() {
  const parts = [part(new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6), '#6a4a2e', T(0, 1.3, 0))];
  const cols = ['#3f7d34', '#4a8c3a', '#35702d'];
  const pos = [[0, 3.6, 0, 1.7], [0.9, 3.1, 0.4, 1.2], [-0.8, 3.3, -0.5, 1.3], [0.2, 4.4, -0.3, 1.1]];
  pos.forEach(([x, y, z, r], i) => parts.push(part(new THREE.IcosahedronGeometry(r, 1), cols[i % 3], T(x, y, z))));
  return mergeGeometries(parts);
}
export function palmGeo() {
  const parts = [part(new THREE.CylinderGeometry(0.17, 0.27, 6.4, 7), '#8a6a45', T(0, 3.2, 0))];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const leaf = new THREE.BoxGeometry(0.5, 0.05, 3.4);
    parts.push(part(leaf, k % 2 ? '#2f7a2c' : '#3d8c36', mul(T(0, 6.4, 0), RY(a), RX(0.55), T(0, 0, 1.6))));
  }
  parts.push(part(new THREE.SphereGeometry(0.3, 6, 5), '#6b4b2a', T(0, 6.3, 0)));
  return mergeGeometries(parts);
}
export function signalGeo() {
  const parts = [
    part(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), '#33363a', T(0, 2.1, 0)),
    part(new THREE.BoxGeometry(0.32, 0.95, 0.28), '#1c1d20', T(0, 4.3, 0.1)),
    part(new THREE.SphereGeometry(0.1, 6, 5), '#ff2b1f', T(0, 4.6, 0.26)),
    part(new THREE.SphereGeometry(0.1, 6, 5), '#ffb400', T(0, 4.3, 0.26)),
    part(new THREE.SphereGeometry(0.1, 6, 5), '#2bdc54', T(0, 4.0, 0.26)),
  ];
  return mergeGeometries(parts);
}
export function signGeo() {
  const parts = [
    part(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5), '#555a60', T(0, 1.6, 0)),
    part(new THREE.BoxGeometry(1.5, 0.9, 0.06), '#1565c0', T(0, 3.1, 0)),
    part(new THREE.BoxGeometry(1.2, 0.18, 0.07), '#ffffff', T(0, 3.1, 0.01)),
    part(new THREE.BoxGeometry(0.4, 0.5, 0.07), '#ffffff', T(0.35, 3.1, 0.01)),
  ];
  return mergeGeometries(parts);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// يوزّع الأشياء ويسجل عوائقها في عالم التصادم. يعيد {lamp:[],tree:[],palm:[],signal:[],sign:[]}
export function placeProps(map, graph, sw) {
  const R = rng(777);
  const out = { lamp: [], tree: [], palm: [], signal: [], sign: [] };
  // تقاطعات
  const inter = new SpatialHash(32);
  const interNodes = [];
  graph.nodes.forEach((n, i) => {
    if (n.adj.length >= 3) { interNodes.push(i); inter.add(i, n.x - 1, n.z - 1, n.x + 1, n.z + 1); }
  });
  const nearInter = (x, z, d) => {
    let hit = false;
    inter.query(x, z, d, (i) => {
      if (!hit) { const n = graph.nodes[i]; if (Math.hypot(n.x - x, n.z - z) < d) hit = true; }
    });
    return hit;
  };
  const free = (x, z, bd) => !sw.onRoad(x, z, 0.4) && sw.distToBuilding(x, z, bd + 0.1) >= bd;

  for (const r of map.roads) {
    if (r.w < 6) continue;
    let acc = 0, nextLamp = 8 + R() * 20, nextTree = 6 + R() * 10, nextSign = 40 + R() * 80;
    let lampSide = R() < 0.5 ? 1 : -1;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.1) continue;
      const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
      const nx = -dz, nz = dx;
      for (let s = 0; s < L; s += 2) {
        const gs = acc + s;
        const cx = a[0] + dx * s, cz = a[1] + dz * s;
        if (gs >= nextLamp) {
          nextLamp = gs + 34;
          lampSide = -lampSide;
          const off = r.w / 2 + 1.0;
          const x = cx + nx * off * lampSide, z = cz + nz * off * lampSide;
          if (!nearInter(x, z, r.w / 2 + 9) && free(x, z, 1.3)) {
            out.lamp.push({ x, z, rot: Math.atan2(-nx * lampSide, -nz * lampSide), s: 1 });
            sw.addCircle(x, z, 0.28);
          }
        }
        if (gs >= nextTree) {
          nextTree = gs + 14 + R() * 12;
          const side = R() < 0.5 ? 1 : -1;
          const off = r.w / 2 + 1.9;
          const x = cx + nx * off * side, z = cz + nz * off * side;
          if (R() < 0.7 && !nearInter(x, z, r.w / 2 + 8) && free(x, z, 1.6)) {
            const palm = (r.type === 'primary' || r.type === 'secondary') ? R() < 0.7 : R() < 0.2;
            out[palm ? 'palm' : 'tree'].push({ x, z, rot: R() * 6.28, s: 0.85 + R() * 0.4 });
            sw.addCircle(x, z, 0.32);
          }
        }
        if (gs >= nextSign && (r.type === 'primary' || r.type === 'secondary')) {
          nextSign = gs + 110 + R() * 60;
          const off = r.w / 2 + 1.3;
          const x = cx + nx * off, z = cz + nz * off;
          if (!nearInter(x, z, r.w / 2 + 12) && free(x, z, 1.2)) {
            out.sign.push({ x, z, rot: Math.atan2(-nx, -nz), s: 1 });
            sw.addCircle(x, z, 0.2);
          }
        }
      }
      acc += L;
      // مطبات صناعية
      if ((r.type === 'residential' || r.type === 'tertiary' || r.type === 'unclassified') && L > 40 && R() < 0.25) {
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        if (!nearInter(mx, mz, r.w + 6)) sw.addBump(mx, mz, dx, dz, r.w / 2);
      }
    }
  }
  // إشارات المرور عند التقاطعات الكبيرة
  for (const ni of interNodes) {
    const n = graph.nodes[ni];
    if (n.adj.length < 4) continue;
    let maxW = 0;
    for (const ei of n.adj) maxW = Math.max(maxW, graph.edges[ei].w);
    if (maxW < 10) continue;
    const corners = [[1, 1], [-1, -1]];
    for (const [sx, sz] of corners) {
      const x = n.x + sx * (maxW / 2 + 1.2), z = n.z + sz * (maxW / 2 + 1.2);
      if (sw.distToBuilding(x, z, 1.2) >= 1.2) {
        out.signal.push({ x, z, rot: Math.atan2(-sx, -sz), s: 1 });
        sw.addCircle(x, z, 0.25);
      }
    }
  }
  // أشجار الحدائق والجزر
  for (const lm of map.landmarks || []) {
    if (lm.type === 'island') {
      out.palm.push({ x: lm.x, z: lm.z, rot: 0, s: 1.25 });
      sw.addCircle(lm.x, lm.z, lm.r); // الجزيرة نفسها عائق
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 6.28;
        out.palm.push({ x: lm.x + Math.cos(a) * (lm.r - 2), z: lm.z + Math.sin(a) * (lm.r - 2), rot: 0, s: 0.8 });
      }
    } else if (lm.type === 'park') {
      const xs = lm.poly.map((p) => p[0]), zs = lm.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      for (let k = 0; k < 30; k++) {
        const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
        if (pointInPoly(x, z, lm.poly) && !sw.onRoad(x, z, 1) && sw.distToBuilding(x, z, 2) >= 2) {
          out[R() < 0.35 ? 'palm' : 'tree'].push({ x, z, rot: R() * 6.28, s: 0.9 + R() * 0.5 });
          sw.addCircle(x, z, 0.35);
        }
      }
    }
  }
  return out;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
