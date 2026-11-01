// الخريطة المصغرة الدائرية + خريطة المدينة الكاملة
export class Minimap {
  constructor(map, canvas, bigCanvas) {
    this.canvas = canvas;
    this.big = bigCanvas;
    const b = map.bounds;
    const pad = 80;
    this.minx = b.minx - pad; this.minz = b.minz - pad;
    const W = b.maxx - b.minx + pad * 2, H = b.maxz - b.minz + pad * 2;
    this.S = Math.min(1.3, 3600 / Math.max(W, H));
    const pre = (this.pre = document.createElement('canvas'));
    pre.width = Math.ceil(W * this.S); pre.height = Math.ceil(H * this.S);
    const g = pre.getContext('2d');
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, pre.width, pre.height);
    const P = (p) => [(p[0] - this.minx) * this.S, (p[1] - this.minz) * this.S];
    g.fillStyle = '#34343b';
    for (const bl of map.buildings) {
      g.beginPath();
      bl.pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.closePath(); g.fill();
    }
    for (const lm of map.landmarks || []) {
      g.fillStyle = '#1f4a22';
      if (lm.type === 'island') { const q = P([lm.x, lm.z]); g.beginPath(); g.arc(q[0], q[1], lm.r * this.S, 0, 7); g.fill(); }
      else { g.beginPath(); lm.poly.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.fill(); }
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const draw = (color, extra, filter) => {
      g.strokeStyle = color;
      for (const r of map.roads) {
        if (!filter(r)) continue;
        g.lineWidth = Math.max(2, r.w * this.S * 0.9) + extra;
        g.beginPath();
        r.pts.forEach((p, i) => { const q = P(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
        g.stroke();
      }
    };
    const main = (r) => r.type === 'primary' || r.type === 'secondary' || r.type === 'trunk' || r.type === 'motorway';
    draw('#000', 3, () => true);
    draw('#c9c9cc', 0, (r) => !main(r));
    draw('#ffc400', 0, main);
    this.R = 170;
  }

  draw(st) {
    const c = this.canvas, g = c.getContext('2d');
    const W = c.width, cx = W / 2, cy = W / 2, R = this.R;
    const view = 125; // متر
    const ss = R / view;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#1b1b1f'; g.fillRect(0, 0, W, W);
    g.translate(cx, cy);
    g.rotate(Math.PI + st.h);
    g.save();
    const k = ss / this.S;
    g.scale(k, k);
    g.drawImage(this.pre, -(st.x - this.minx) * this.S, -(st.z - this.minz) * this.S);
    g.restore();
    // المسار
    if (st.route && st.route.length > 1) {
      g.strokeStyle = '#00e5ff'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      st.route.forEach((p, i) => { const x = (p[0] - st.x) * ss, y = (p[1] - st.z) * ss; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    }
    const marker = (mx, mz, color, shape) => {
      let dx = (mx - st.x) * ss, dz = (mz - st.z) * ss;
      const d = Math.hypot(dx, dz);
      const lim = R - 14;
      let edge = false;
      if (d > lim) { dx = (dx / d) * lim; dz = (dz / d) * lim; edge = true; }
      g.save(); g.translate(dx, dz); g.rotate(-(Math.PI + st.h));
      g.fillStyle = color; g.strokeStyle = '#111'; g.lineWidth = 2.5;
      g.beginPath();
      if (shape === 'pin') { g.moveTo(0, 0); g.bezierCurveTo(-10, -12, -10, -24, 0, -24); g.bezierCurveTo(10, -24, 10, -12, 0, 0); }
      else g.arc(0, 0, edge ? 6 : 8, 0, 7);
      g.fill(); g.stroke();
      if (shape === 'pin') { g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -15, 4, 0, 7); g.fill(); }
      g.restore();
    };
    for (const cu of st.customers) marker(cu.x, cu.z, '#ffc400', 'dot');
    if (st.dest) marker(st.dest.x, st.dest.z, '#ff3b30', 'pin');
    g.restore();
    // السهم
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#ffc400'; g.strokeStyle = '#111'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // حلقة
    g.strokeStyle = '#ffc400'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx, cy, R + 3, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R + 8, 0, Math.PI * 2); g.stroke();
    // الشمال
    const phi = Math.PI + st.h;
    const nx = Math.sin(phi), ny = -Math.cos(phi);
    return { nx, ny };
  }

  drawBig(st) {
    const c = this.big, g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
    const k = Math.min(W / this.pre.width, H / this.pre.height);
    const ox = (W - this.pre.width * k) / 2, oy = (H - this.pre.height * k) / 2;
    g.drawImage(this.pre, ox, oy, this.pre.width * k, this.pre.height * k);
    const T = (x, z) => [ox + (x - this.minx) * this.S * k, oy + (z - this.minz) * this.S * k];
    if (st.route && st.route.length > 1) {
      g.strokeStyle = '#00e5ff'; g.lineWidth = 4; g.lineJoin = 'round';
      g.beginPath(); st.route.forEach((p, i) => { const q = T(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke();
    }
    for (const cu of st.customers) { const q = T(cu.x, cu.z); g.fillStyle = '#ffc400'; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.arc(q[0], q[1], 6, 0, 7); g.fill(); g.stroke(); }
    if (st.dest) { const q = T(st.dest.x, st.dest.z); g.fillStyle = '#ff3b30'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(q[0], q[1], 9, 0, 7); g.fill(); g.stroke(); }
    const p = T(st.x, st.z);
    g.save(); g.translate(p[0], p[1]); g.rotate(Math.PI - st.h);
    g.fillStyle = '#00ff88'; g.strokeStyle = '#000'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 10); g.lineTo(0, 5); g.lineTo(-9, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
