// خريطة تجريبية مولّدة (على نمط أحياء القاهرة) تُستخدم فقط إذا لم تتوفر بيانات OSM.
// ليست نسخة من شوارع عين شمس الحقيقية.
import { ROAD_TYPES } from '../config.js';

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

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function polyArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
}

// إزاحة مضلع محدب للداخل بمسافة مختلفة لكل ضلع
function insetConvex(poly, dists) {
  const n = poly.length;
  const sgn = polyArea(poly) > 0 ? 1 : -1;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const d = sub(b, a);
    const l = len(d);
    const dir = [d[0] / l, d[1] / l];
    const nrm = [-dir[1] * sgn, dir[0] * sgn]; // للداخل
    lines.push({ p: [a[0] + nrm[0] * dists[i], a[1] + nrm[1] * dists[i]], d: dir });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i + n - 1) % n], L2 = lines[i];
    const cross = L1.d[0] * L2.d[1] - L1.d[1] * L2.d[0];
    if (Math.abs(cross) < 1e-6) { out.push(L2.p); continue; }
    const dp = [L2.p[0] - L1.p[0], L2.p[1] - L1.p[1]];
    const t = (dp[0] * L2.d[1] - dp[1] * L2.d[0]) / cross;
    out.push([L1.p[0] + L1.d[0] * t, L1.p[1] + L1.d[1] * t]);
  }
  return out;
}

export function generateFallback(seed = 1987) {
  const R = rng(seed);
  const NX = 11, NZ = 11;
  const xs = [], zs = [];
  let x = 0, z = 0;
  for (let i = 0; i < NX; i++) { xs.push(x); x += 120 + R() * 80; }
  for (let j = 0; j < NZ; j++) { zs.push(z); z += 120 + R() * 80; }
  const cx = xs[NX - 1] / 2, cz = zs[NZ - 1] / 2;
  const P = [];
  for (let i = 0; i < NX; i++) {
    P[i] = [];
    for (let j = 0; j < NZ; j++) {
      const edge = i === 0 || j === 0 || i === NX - 1 || j === NZ - 1;
      const jit = edge ? 6 : 24;
      P[i][j] = [xs[i] - cx + (R() - 0.5) * jit, zs[j] - cz + (R() - 0.5) * jit];
    }
  }
  const MID = 5;
  const roads = [];
  const buildings = [];
  const landmarks = [];
  const vType = (i) => (i === MID ? 'primary' : i % 4 === 0 ? 'secondary' : 'residential');
  const hType = (j) => (j === MID ? 'primary' : j % 3 === 0 ? 'secondary' : 'residential');
  const names = ['شارع النصر', 'شارع الجمهورية', 'شارع السلام', 'شارع الجيش', 'شارع المحطة', 'شارع التحرير', 'شارع الشهيد', 'شارع المدرسة', 'شارع الحرية', 'شارع الورد'];

  // ميدان في المنتصف (دوران)
  const plaza = P[MID][MID];
  const PR = 24;
  const ring = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ring.push([Math.round((plaza[0] + Math.cos(a) * PR) * 10) / 10, Math.round((plaza[1] + Math.sin(a) * PR) * 10) / 10]);
  }
  roads.push({ type: 'primary', name: 'ميدان عين شمس', pts: [...ring, ring[0]], w: 10, oneway: false });
  landmarks.push({ type: 'island', x: plaza[0], z: plaza[1], r: PR - 8 });
  const nearestRing = (toward) => {
    let best = ring[0], bd = 1e9;
    for (const r of ring) {
      const d = Math.hypot(r[0] - toward[0], r[1] - toward[1]);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };

  const addRoad = (A, B, type, name, ai, aj, bi, bj) => {
    const d = sub(B, A);
    const l = len(d);
    const nrm = [-d[1] / l, d[0] / l];
    const bend = (R() - 0.5) * 5;
    let a = A, b = B;
    if (ai === MID && aj === MID) a = nearestRing(lerp(A, B, 0.5));
    if (bi === MID && bj === MID) b = nearestRing(lerp(A, B, 0.5));
    const m = lerp(A, B, 0.5);
    const mid = [m[0] + nrm[0] * bend, m[1] + nrm[1] * bend];
    const r1 = (p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
    roads.push({ type, name, pts: [r1(a), r1(mid), r1(b)], w: ROAD_TYPES[type].w, oneway: false });
  };
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ - 1; j++) addRoad(P[i][j], P[i][j + 1], vType(i), names[(i * 3) % names.length], i, j, i, j + 1);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX - 1; i++) addRoad(P[i][j], P[i + 1][j], hType(j), names[(j * 7 + 2) % names.length], i, j, i + 1, j);

  const halfW = (t) => ROAD_TYPES[t].w / 2 + 3.2;

  const lotsAlong = (A, B, n, depth, trimA, trimB, shopP, hBias) => {
    const L = len(sub(B, A));
    const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    let s = trimA;
    const end = L - trimB;
    while (s < end - 7) {
      let w = 13 + R() * 11;
      if (s + w > end) w = end - s;
      if (w < 7) break;
      if (R() < 0.07) { s += w; continue; } // أرض فاضية
      const gap = 0.25 + R() * 0.5;
      const s0 = s + gap * 0.5, s1 = s + w - gap * 0.5;
      const d = depth * (0.85 + R() * 0.3);
      const p0 = [A[0] + u[0] * s0, A[1] + u[1] * s0];
      const p1 = [A[0] + u[0] * s1, A[1] + u[1] * s1];
      const q1 = [p1[0] + n[0] * d, p1[1] + n[1] * d];
      const q0 = [p0[0] + n[0] * d, p0[1] + n[1] * d];
      const floors = 3 + Math.floor(R() * 6 + hBias * R() * 3);
      const poly = [p0, p1, q1, q0];
      if (polyArea(poly) < 0) poly.reverse();
      buildings.push({ pts: poly.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), h: floors * 3.2 + 1, shop: R() < shopP });
      s += w;
    }
  };

  for (let i = 0; i < NX - 1; i++) {
    for (let j = 0; j < NZ - 1; j++) {
      const corners = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
      const types = [hType(j), vType(i + 1), hType(j + 1), vType(i)];
      let poly = insetConvex(corners, types.map(halfW));
      const centroid = [(poly[0][0] + poly[1][0] + poly[2][0] + poly[3][0]) / 4, (poly[0][1] + poly[1][1] + poly[2][1] + poly[3][1]) / 4];
      // تفريغ الزوايا القريبة من الميدان
      const cornerIdx = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      poly = poly.map((p, k) => {
        if (cornerIdx[k][0] === MID && cornerIdx[k][1] === MID) {
          const d = sub(centroid, p);
          const l = len(d);
          return [p[0] + (d[0] / l) * 24, p[1] + (d[1] / l) * 24];
        }
        return p;
      });
      const sides = poly.map((p, k) => len(sub(poly[(k + 1) % 4], p)));
      const minSide = Math.min(...sides);
      if (minSide < 24) continue;
      const roll = R();
      if (roll < 0.09) {
        landmarks.push({ type: 'park', poly: poly.map((p) => [Math.round(p[0]), Math.round(p[1])]) });
        continue;
      }
      const depth = Math.min(17, minSide * 0.36);
      const sgn = polyArea(poly) > 0 ? 1 : -1;
      for (let k = 0; k < 4; k++) {
        const A = poly[k], B = poly[(k + 1) % 4];
        const d = sub(B, A), l = len(d);
        const n = [(-d[1] / l) * sgn, (d[0] / l) * sgn];
        const odd = k % 2 === 1;
        const shopP = types[k] === 'residential' ? 0.35 : 0.85;
        lotsAlong(A, B, n, depth, odd ? depth : 0, odd ? depth : 0, shopP, types[k] === 'primary' ? 1 : 0);
      }
      // مبنى داخلي منخفض في قلب البلوك
      if (minSide > 70 && R() < 0.6) {
        const inner = insetConvex(poly, [depth + 3, depth + 3, depth + 3, depth + 3]);
        if (polyArea(inner) > 150) {
          const q = polyArea(inner) < 0 ? inner.slice().reverse() : inner;
          buildings.push({ pts: q.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), h: 4.5 + R() * 6, shop: false });
        }
      }
    }
  }

  // مبانٍ على الحافة الخارجية للمنطقة (خارج آخر شارع)
  const outer = [];
  for (let i = 0; i < NX - 1; i++) { outer.push([P[i][0], P[i + 1][0], [0, -1], hType(0)]); outer.push([P[i + 1][NZ - 1], P[i][NZ - 1], [0, 1], hType(NZ - 1)]); }
  for (let j = 0; j < NZ - 1; j++) { outer.push([P[0][j + 1], P[0][j], [-1, 0], vType(0)]); outer.push([P[NX - 1][j], P[NX - 1][j + 1], [1, 0], vType(NX - 1)]); }
  for (const [A0, B0, nrm, t] of outer) {
    const off = halfW(t);
    const A = [A0[0] + nrm[0] * off, A0[1] + nrm[1] * off];
    const B = [B0[0] + nrm[0] * off, B0[1] + nrm[1] * off];
    lotsAlong(A, B, nrm, 18, 6, 6, 0.6, 1);
  }

  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (const r of roads) for (const p of r.pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
  return { source: 'procedural', origin: null, roads, buildings, landmarks, bounds: { minx, maxx, minz, maxz } };
}
