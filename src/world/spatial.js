// بنية تقسيم مكاني بسيطة + عالم التصادم الثابت (مباني، أعمدة، أشجار)
export class SpatialHash {
  constructor(cell = 32) {
    this.cell = cell;
    this.map = new Map();
  }
  _k(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }
  add(id, minx, minz, maxx, maxz) {
    const c = this.cell;
    const x0 = Math.floor(minx / c), x1 = Math.floor(maxx / c);
    const z0 = Math.floor(minz / c), z1 = Math.floor(maxz / c);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const k = this._k(ix, iz);
        let a = this.map.get(k);
        if (!a) this.map.set(k, (a = []));
        a.push(id);
      }
  }
  // يستدعي cb(id) لكل عنصر في الخلايا القريبة (قد يتكرر العنصر، يتجاهله المستدعي إن لزم)
  query(x, z, r, cb) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const a = this.map.get(this._k(ix, iz));
        if (a) for (let i = 0; i < a.length; i++) cb(a[i]);
      }
  }
}

const contacts = [];

export class StaticWorld {
  constructor() {
    this.segs = []; // x1,z1,x2,z2,kind
    this.circles = []; // x,z,r
    this.segHash = new SpatialHash(24);
    this.circHash = new SpatialHash(24);
    this.roadSegs = [];
    this.roadHash = new SpatialHash(32);
    this.bumps = [];
    this.bumpHash = new SpatialHash(32);
  }
  addSegment(x1, z1, x2, z2, kind = 0) {
    const id = this.segs.length;
    this.segs.push([x1, z1, x2, z2, kind]);
    this.segHash.add(id, Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2));
  }
  addCircle(x, z, r) {
    const id = this.circles.length;
    this.circles.push([x, z, r]);
    this.circHash.add(id, x - r, z - r, x + r, z + r);
  }
  addRoadSeg(x1, z1, x2, z2, w) {
    const id = this.roadSegs.length;
    this.roadSegs.push([x1, z1, x2, z2, w]);
    this.roadHash.add(id, Math.min(x1, x2) - w, Math.min(z1, z2) - w, Math.max(x1, x2) + w, Math.max(z1, z2) + w);
  }
  addBump(x, z, dx, dz, half) {
    const id = this.bumps.length;
    this.bumps.push({ x, z, dx, dz, half, last: 0 });
    this.bumpHash.add(id, x - half, z - half, x + half, z + half);
  }
  // أقرب مسافة من نقطة إلى أي جدار مبنى
  distToBuilding(x, z, maxD = 6) {
    let best = maxD;
    this.segHash.query(x, z, maxD, (id) => {
      const s = this.segs[id];
      if (s[4] !== 0) return;
      const d = distPointSeg(x, z, s[0], s[1], s[2], s[3]);
      if (d < best) best = d;
    });
    return best;
  }
  distToObstacle(x, z, maxD = 6) {
    let best = this.distToBuilding(x, z, maxD);
    this.circHash.query(x, z, maxD, (id) => {
      const c = this.circles[id];
      const d = Math.hypot(x - c[0], z - c[1]) - c[2];
      if (d < best) best = d;
    });
    return best;
  }
  // هل النقطة على طريق (مع هامش)؟ يعيد أقصى هامش داخل الطريق
  onRoad(x, z, margin = 0) {
    let hit = false;
    this.roadHash.query(x, z, 2, (id) => {
      if (hit) return;
      const s = this.roadSegs[id];
      if (distPointSeg(x, z, s[0], s[1], s[2], s[3]) < s[4] / 2 + margin) hit = true;
    });
    return hit;
  }
  // دفع دائرة خارج العوائق. يعيد قائمة تماسات {nx,nz,pen}
  push(x, z, r) {
    contacts.length = 0;
    this.segHash.query(x, z, r + 0.5, (id) => {
      const s = this.segs[id];
      const cp = closestOnSeg(x, z, s[0], s[1], s[2], s[3]);
      const dx = x - cp[0], dz = z - cp[1];
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-5) contacts.push({ nx: dx / d, nz: dz / d, pen: r - d });
        else {
          // مركز الدائرة على الجدار تمامًا: ادفع بعيدًا عن منتصف القطعة
          const sx = s[2] - s[0], sz = s[3] - s[1];
          const l = Math.hypot(sx, sz) || 1;
          contacts.push({ nx: -sz / l, nz: sx / l, pen: r });
        }
      }
    });
    this.circHash.query(x, z, r + 1, (id) => {
      const c = this.circles[id];
      const dx = x - c[0], dz = z - c[1];
      const d = Math.hypot(dx, dz);
      if (d < r + c[2]) contacts.push({ nx: dx / (d || 1), nz: dz / (d || 1), pen: r + c[2] - d });
    });
    return contacts;
  }
}

export function distPointSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}
function closestOnSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return [x1 + dx * t, z1 + dz * t];
}
