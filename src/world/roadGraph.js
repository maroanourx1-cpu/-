// رسم بياني للطرق + إيجاد المسار (A*)
import { ROAD_TYPES } from '../config.js';

export class RoadGraph {
  constructor(roads) {
    this.nodes = []; // {x,z,adj:[edgeIdx]}
    this.edges = []; // {a,b,len,w,type,name,oneway,speed}
    const key = new Map();
    const node = (p) => {
      const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);
      let i = key.get(k);
      if (i === undefined) {
        i = this.nodes.length;
        this.nodes.push({ x: p[0], z: p[1], adj: [] });
        key.set(k, i);
      }
      return i;
    };
    for (const r of roads) {
      const def = ROAD_TYPES[r.type] || ROAD_TYPES.residential;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = node(r.pts[i]);
        const b = node(r.pts[i + 1]);
        if (a === b) continue;
        const na = this.nodes[a], nb = this.nodes[b];
        const e = {
          a, b,
          len: Math.hypot(na.x - nb.x, na.z - nb.z),
          w: r.w, type: r.type, name: r.name, oneway: !!r.oneway, speed: def.speed,
        };
        const id = this.edges.length;
        this.edges.push(e);
        na.adj.push(id);
        nb.adj.push(id);
      }
    }
    // أكبر مكوّن متصل
    const comp = new Int32Array(this.nodes.length).fill(-1);
    let best = -1, bestSize = 0, c = 0;
    for (let s = 0; s < this.nodes.length; s++) {
      if (comp[s] >= 0) continue;
      let size = 0;
      const st = [s];
      comp[s] = c;
      while (st.length) {
        const n = st.pop();
        size++;
        for (const ei of this.nodes[n].adj) {
          const e = this.edges[ei];
          const o = e.a === n ? e.b : e.a;
          if (comp[o] < 0) { comp[o] = c; st.push(o); }
        }
      }
      if (size > bestSize) { bestSize = size; best = c; }
      c++;
    }
    this.main = comp;
    this.mainId = best;
    this.mainNodes = [];
    for (let i = 0; i < this.nodes.length; i++) if (comp[i] === best) this.mainNodes.push(i);
    // شبكة بحث للأقرب
    this.cell = 64;
    this.grid = new Map();
    for (const i of this.mainNodes) {
      const n = this.nodes[i];
      const k = Math.floor(n.x / 64) + ',' + Math.floor(n.z / 64);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    }
  }
  degree(i) {
    return this.nodes[i].adj.length;
  }
  nearestNode(x, z) {
    let best = -1, bd = 1e18;
    const cx = Math.floor(x / 64), cz = Math.floor(z / 64);
    for (let r = 0; r < 12 && best < 0; r++) {
      for (let ix = cx - r; ix <= cx + r; ix++)
        for (let iz = cz - r; iz <= cz + r; iz++) {
          if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== r) continue;
          const a = this.grid.get(ix + ',' + iz);
          if (!a) continue;
          for (const i of a) {
            const n = this.nodes[i];
            const d = (n.x - x) ** 2 + (n.z - z) ** 2;
            if (d < bd) { bd = d; best = i; }
          }
        }
    }
    if (best < 0) for (const i of this.mainNodes) { const n = this.nodes[i]; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // مسار بين عقدتين: يعيد {nodes:[...], dist}
  path(from, to) {
    if (from === to) return { nodes: [from], dist: 0 };
    const N = this.nodes.length;
    const g = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const tn = this.nodes[to];
    const h = (i) => Math.hypot(this.nodes[i].x - tn.x, this.nodes[i].z - tn.z);
    // كومة ثنائية
    const heap = [[h(from), from]];
    g[from] = 0;
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [, n] = pop();
      if (closed[n]) continue;
      closed[n] = 1;
      if (n === to) break;
      for (const ei of this.nodes[n].adj) {
        const e = this.edges[ei];
        const o = e.a === n ? e.b : e.a;
        if (closed[o]) continue;
        const ng = g[n] + e.len;
        if (ng < g[o]) { g[o] = ng; prev[o] = n; push([ng + h(o), o]); }
      }
    }
    if (prev[to] < 0) return null;
    const nodes = [];
    for (let c = to; c !== -1; c = prev[c]) nodes.push(c);
    nodes.reverse();
    return { nodes, dist: g[to] };
  }
}
