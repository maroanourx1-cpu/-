// العالم ثلاثي الأبعاد: سماء، إضاءة، أرض، تحميل المناطق (Chunks) من بيانات الخريطة
import * as THREE from 'three';
import { CHUNK } from '../config.js';
import { RoadGraph } from './roadGraph.js';
import { StaticWorld } from './spatial.js';
import { placeProps, lampGeo, treeGeo, palmGeo, signalGeo, signGeo, pointInPoly } from './props.js';
import { asphaltTexture, sidewalkTexture, wallTexture, shopTexture, groundTexture } from './textures.js';

class GB {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, v, col) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(col[0], col[1], col[2]);
    return this.p.length / 3 - 1;
  }
  triUp(a, b, c) {
    const P = this.p;
    const ax = P[a * 3], az = P[a * 3 + 2], bx = P[b * 3], bz = P[b * 3 + 2], cx = P[c * 3], cz = P[c * 3 + 2];
    const y = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (y > 0) this.i.push(a, b, c); else this.i.push(a, c, b); // الوجه الأمامي لأعلى (CCW من فوق)
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    if (!this.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const WALL_COLORS = ['#f2ead8', '#e6d8bd', '#d9cdb8', '#efe3c8', '#d8c3a5', '#cfd6d8', '#e9d1b8', '#f4f0e8', '#d4b896', '#c9d4c0'].map((h) => new THREE.Color(h));
const WHITE = [1, 1, 1];
const ROOF_COL = new THREE.Color('#8a8379');
const SHOP_H = 3.6;

function hash2(a, b) {
  let h = (Math.floor(a * 7.13) * 374761393 + Math.floor(b * 3.77) * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class World {
  constructor(scene, map, quality = 'medium') {
    this.scene = scene;
    this.map = map;
    this.quality = quality;
    this.chunks = new Map();
    this.index = new Map();
    this.graph = new RoadGraph(map.roads);
    this.sw = new StaticWorld();
    this.group = new THREE.Group();
    scene.add(this.group);

    this._materials();
    this._sky();
    this._lights();
    this._ground();

    // عوائق المباني + الطرق
    for (const b of map.buildings) {
      const p = b.pts;
      for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        this.sw.addSegment(p[i][0], p[i][1], q[0], q[1], 0);
      }
    }
    for (const e of this.graph.edges) {
      const a = this.graph.nodes[e.a], b = this.graph.nodes[e.b];
      this.sw.addRoadSeg(a.x, a.z, b.x, b.z, e.w);
    }
    this.props = placeProps(map, this.graph, this.sw);
    this._index();
    this.geos = { lamp: lampGeo(), tree: treeGeo(), palm: palmGeo(), signal: signalGeo(), sign: signGeo() };
    this.queue = 0;
    this.setQuality(quality);
  }

  setQuality(q) {
    this.quality = q;
    this.radius = q === 'low' ? 2 : q === 'high' ? 4 : 3;
    const far = (this.radius + 0.4) * CHUNK;
    this.scene.fog.near = far * 0.35;
    this.scene.fog.far = far * 0.95;
    this.sun.castShadow = q !== 'low';
    const sz = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== sz) {
      this.sun.shadow.mapSize.set(sz, sz);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    for (const [, c] of this.chunks) c.group.traverse((o) => { if (o.isMesh && o.userData.caster) o.castShadow = q !== 'low'; });
  }

  _materials() {
    const asphalt = asphaltTexture(); asphalt.repeat.set(1, 1);
    this.mat = {
      road: new THREE.MeshLambertMaterial({ map: asphalt, vertexColors: true }),
      sidewalk: new THREE.MeshLambertMaterial({ map: sidewalkTexture(), vertexColors: true }),
      mark: new THREE.MeshLambertMaterial({ color: 0xf2f2e8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      wall: new THREE.MeshLambertMaterial({ map: wallTexture(), vertexColors: true }),
      shop: new THREE.MeshLambertMaterial({ map: shopTexture(), vertexColors: true }),
      roof: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
      props: new THREE.MeshLambertMaterial({ vertexColors: true }),
    };
  }

  _sky() {
    this.sunDir = new THREE.Vector3(-0.5, 0.62, -0.45).normalize();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sun: { value: this.sunDir } },
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vD; uniform vec3 sun;
        void main(){
          float h = clamp(vD.y,0.0,1.0);
          vec3 top=vec3(0.16,0.42,0.82), hor=vec3(0.80,0.88,0.96);
          vec3 c = mix(hor, top, pow(h,0.55));
          float s = max(dot(normalize(vD), normalize(sun)),0.0);
          c += vec3(1.0,0.85,0.55)*pow(s,24.0)*0.45 + vec3(1.0,0.95,0.8)*pow(s,900.0)*2.0;
          // سحب بسيطة
          float cl = smoothstep(0.55,0.75, sin(vD.x*9.0+sin(vD.z*7.0)*1.5)*sin(vD.z*6.0+vD.x*3.0)*0.5+0.5) * smoothstep(0.05,0.35,h) * (1.0-smoothstep(0.5,0.9,h));
          c = mix(c, vec3(1.0), cl*0.45);
          gl_FragColor = vec4(c,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xcfdde9, 100, 400);
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xcfe4ff, 0x7a7872, 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.camera.left = -70; s.camera.right = 70; s.camera.top = 70; s.camera.bottom = -70;
    s.camera.near = 1; s.camera.far = 260;
    s.bias = -0.0006; s.normalBias = 0.8;
    this.scene.add(this.sun, this.sun.target);
  }

  _ground() {
    const t = groundTexture();
    t.repeat.set(250, 250);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ map: t, color: 0xd9cdb8 }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.ground = g;
    this.scene.add(g);
  }

  key(cx, cz) { return cx + ',' + cz; }
  _data(cx, cz) {
    const k = this.key(cx, cz);
    let d = this.index.get(k);
    if (!d) this.index.set(k, (d = { edges: [], nodes: [], buildings: [], bumps: [], lm: [], props: { lamp: [], tree: [], palm: [], signal: [], sign: [] } }));
    return d;
  }
  _index() {
    const C = CHUNK;
    const cc = (x) => Math.floor(x / C);
    this.graph.edges.forEach((e, i) => {
      const a = this.graph.nodes[e.a], b = this.graph.nodes[e.b];
      this._data(cc((a.x + b.x) / 2), cc((a.z + b.z) / 2)).edges.push(i);
    });
    this.graph.nodes.forEach((n, i) => this._data(cc(n.x), cc(n.z)).nodes.push(i));
    for (const b of this.map.buildings) {
      let x = 0, z = 0;
      for (const p of b.pts) { x += p[0]; z += p[1]; }
      this._data(cc(x / b.pts.length), cc(z / b.pts.length)).buildings.push(b);
    }
    for (const b of this.sw.bumps) this._data(cc(b.x), cc(b.z)).bumps.push(b);
    for (const lm of this.map.landmarks || []) {
      if (lm.type === 'island') this._data(cc(lm.x), cc(lm.z)).lm.push(lm);
      else { const p = lm.poly[0]; this._data(cc(p[0]), cc(p[1])).lm.push(lm); }
    }
    for (const t of Object.keys(this.props)) for (const p of this.props[t]) this._data(cc(p.x), cc(p.z)).props[t].push(p);
  }

  update(px, pz, dt, forceAll = false) {
    const C = CHUNK;
    const pcx = Math.floor(px / C), pcz = Math.floor(pz / C);
    const R = this.radius;
    // إزالة البعيد
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - pcx) > R + 1 || Math.abs(c.cz - pcz) > R + 1) {
        this.group.remove(c.group);
        c.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
        this.chunks.delete(k);
      }
    }
    // بناء الناقص (واحد كل إطار، والكل عند البداية)
    const need = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
      const k = this.key(cx, cz);
      if (!this.chunks.has(k) && this.index.has(k)) need.push([dx * dx + dz * dz, cx, cz]);
    }
    need.sort((a, b) => a[0] - b[0]);
    const n = forceAll ? need.length : Math.min(1, need.length);
    for (let i = 0; i < n; i++) this._buildChunk(need[i][1], need[i][2]);
    // ظل الشمس يتبع اللاعب
    const snap = 4;
    const sx = Math.round(px / snap) * snap, sz = Math.round(pz / snap) * snap;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunDir.x * 140, this.sunDir.y * 140, sz + this.sunDir.z * 140);
    this.ground.position.set(Math.round(px / 8) * 8, 0, Math.round(pz / 8) * 8);
    this.ground.material.map.offset.set(-(this.ground.position.x % 8) / 8 * 0 , 0);
  }

  followSky(camPos) { this.sky.position.copy(camPos); }

  _buildChunk(cx, cz) {
    const d = this.index.get(this.key(cx, cz));
    const g = new THREE.Group();
    const graph = this.graph;
    const road = new GB(), side = new GB(), mark = new GB(), wallU = new GB(), shopB = new GB(), roof = new GB(), plain = new GB();
    const UP = [0, 1, 0];
    const rc = WHITE;
    const sideCol = [1, 1, 1];
    const nodeR = (ni) => { let m = 0; for (const ei of graph.nodes[ni].adj) m = Math.max(m, graph.edges[ei].w); return m / 2; };

    // الطرق
    for (const ei of d.edges) {
      const e = graph.edges[ei];
      const A = graph.nodes[e.a], B = graph.nodes[e.b];
      const L = e.len, dx = (B.x - A.x) / L, dz = (B.z - A.z) / L;
      const nx = -dz, nz = dx, hw = e.w / 2;
      const y = 0.02 + e.w * 0.00005;
      const a1 = road.v(A.x + nx * hw, y, A.z + nz * hw, 0, 1, 0, (A.x + nx * hw) / 6, (A.z + nz * hw) / 6, rc);
      const a2 = road.v(A.x - nx * hw, y, A.z - nz * hw, 0, 1, 0, (A.x - nx * hw) / 6, (A.z - nz * hw) / 6, rc);
      const b1 = road.v(B.x - nx * hw, y, B.z - nz * hw, 0, 1, 0, (B.x - nx * hw) / 6, (B.z - nz * hw) / 6, rc);
      const b2 = road.v(B.x + nx * hw, y, B.z + nz * hw, 0, 1, 0, (B.x + nx * hw) / 6, (B.z + nz * hw) / 6, rc);
      road.triUp(a1, a2, b1); road.triUp(a1, b1, b2);

      const dA = graph.degree(e.a) >= 3, dB = graph.degree(e.b) >= 3;
      const tA = dA ? nodeR(e.a) + 2.5 : 0, tB = dB ? nodeR(e.b) + 2.5 : 0;
      // أرصفة
      if (e.w >= 6 && L - tA - tB > 4) {
        for (const sd of [1, -1]) {
          const o0 = hw + 0.05, o1 = hw + 2.3;
          const s0 = tA, s1 = L - tB;
          const p = (s, o) => [A.x + dx * s + nx * o * sd, A.z + dz * s + nz * o * sd];
          const q = [p(s0, o0), p(s0, o1), p(s1, o1), p(s1, o0)];
          const ids = q.map((pt, k) => side.v(pt[0], 0.045, pt[1], 0, 1, 0, (k < 2 ? s0 : s1) / 3, (k % 2 ? 0.8 : 0), sideCol));
          side.triUp(ids[0], ids[1], ids[2]); side.triUp(ids[0], ids[2], ids[3]);
        }
      }
      // خط المنتصف المتقطع
      if (e.w >= 9) {
        for (let s = tA + 1; s + 3 < L - tB - 1; s += 7) {
          const hw2 = 0.09;
          const p0 = [A.x + dx * s, A.z + dz * s], p1 = [A.x + dx * (s + 3), A.z + dz * (s + 3)];
          const ids = [
            mark.v(p0[0] + nx * hw2, 0.04, p0[1] + nz * hw2, 0, 1, 0, 0, 0, WHITE),
            mark.v(p0[0] - nx * hw2, 0.04, p0[1] - nz * hw2, 0, 1, 0, 0, 0, WHITE),
            mark.v(p1[0] - nx * hw2, 0.04, p1[1] - nz * hw2, 0, 1, 0, 0, 0, WHITE),
            mark.v(p1[0] + nx * hw2, 0.04, p1[1] + nz * hw2, 0, 1, 0, 0, 0, WHITE),
          ];
          mark.triUp(ids[0], ids[1], ids[2]); mark.triUp(ids[0], ids[2], ids[3]);
        }
      }
    }
    // وصلات التقاطعات + مشايات المشاة
    for (const ni of d.nodes) {
      const n = graph.nodes[ni];
      if (!n.adj.length) continue;
      const r = nodeR(ni);
      const c = road.v(n.x, 0.0215, n.z, 0, 1, 0, n.x / 6, n.z / 6, rc);
      const S = 14;
      let prev = -1, first = -1;
      for (let k = 0; k <= S; k++) {
        const a = (k / S) * Math.PI * 2;
        const px = n.x + Math.cos(a) * r, pz = n.z + Math.sin(a) * r;
        const id = road.v(px, 0.0215, pz, 0, 1, 0, px / 6, pz / 6, rc);
        if (k === 0) first = id;
        if (prev >= 0) road.triUp(c, prev, id);
        prev = id;
      }
      if (n.adj.length >= 3) {
        for (const ei of n.adj) {
          const e = graph.edges[ei];
          if (e.len < 22 || e.w < 7) continue;
          const o = e.a === ni ? graph.nodes[e.b] : graph.nodes[e.a];
          const dx = (o.x - n.x) / e.len, dz = (o.z - n.z) / e.len;
          const nx = -dz, nz = dx;
          const s0 = r + 2.2, s1 = s0 + 3;
          const bars = Math.floor(e.w / 0.95);
          for (let k = 0; k < bars; k++) {
            const off = (k - (bars - 1) / 2) * 0.95;
            const hw = 0.22;
            const P = (s, oo) => [n.x + dx * s + nx * oo, n.z + dz * s + nz * oo];
            const q = [P(s0, off - hw), P(s0, off + hw), P(s1, off + hw), P(s1, off - hw)];
            const ids = q.map((pt) => mark.v(pt[0], 0.04, pt[1], 0, 1, 0, 0, 0, WHITE));
            mark.triUp(ids[0], ids[1], ids[2]); mark.triUp(ids[0], ids[2], ids[3]);
          }
        }
      }
    }

    // المباني
    for (const b of d.buildings) {
      const pts = b.pts, N = pts.length;
      const col = WALL_COLORS[Math.floor(hash2(pts[0][0], pts[0][1]) * WALL_COLORS.length)];
      const tint = [col.r, col.g, col.b];
      const hasShop = b.shop && b.h > SHOP_H + 2;
      let acc = hash2(pts[0][1], pts[0][0]) * 16;
      let area = 0;
      for (let i = 0; i < N; i++) { const q = pts[(i + 1) % N]; area += pts[i][0] * q[1] - q[0] * pts[i][1]; }
      for (let i = 0; i < N; i++) {
        let A = pts[i], B = pts[(i + 1) % N];
        if (area > 0) { const t = A; A = B; B = t; } // يجعل الاتجاه للخارج
        const ex = B[0] - A[0], ez = B[1] - A[1];
        const L = Math.hypot(ex, ez);
        if (L < 0.05) continue;
        const nx = -ez / L, nz = ex / L;
        const u0 = acc / 8, u1 = (acc + L) / 8; acc += L;
        const quad = (gb, y0, y1, v0, v1, uu0, uu1) => {
          const a = gb.v(A[0], y0, A[1], nx, 0, nz, uu0, v0, tint);
          const bb = gb.v(B[0], y0, B[1], nx, 0, nz, uu1, v0, tint);
          const c = gb.v(B[0], y1, B[1], nx, 0, nz, uu1, v1, tint);
          const dd = gb.v(A[0], y1, A[1], nx, 0, nz, uu0, v1, tint);
          gb.quad(a, bb, c, dd);
        };
        if (hasShop) {
          quad(shopB, 0, SHOP_H, 0, 1, (acc - L) / 16, acc / 16);
          quad(wallU, SHOP_H, b.h, 0, (b.h - SHOP_H) / 3.2, u0, u1);
        } else quad(wallU, 0, b.h, 0, b.h / 3.2, u0, u1);
      }
      // السطح
      const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const rc2 = [ROOF_COL.r * (0.9 + hash2(pts[0][0], 3) * 0.2), ROOF_COL.g, ROOF_COL.b];
      const ids = pts.map((p) => roof.v(p[0], b.h + 0.02, p[1], 0, 1, 0, 0, 0, rc2));
      for (const t of tris) roof.triUp(ids[t[0]], ids[t[1]], ids[t[2]]);
      // خزان/غرفة سطح
      if (hash2(pts[0][0] + 1, pts[0][1]) < 0.5 && area !== 0) {
        let cx = 0, cz = 0;
        for (const p of pts) { cx += p[0]; cz += p[1]; }
        cx /= N; cz /= N;
        if (pointInPoly(cx, cz, pts)) {
          const s = 0.9 + hash2(cx, cz) * 0.5, hh = 1.2 + hash2(cz, cx) * 0.8;
          const cl = hash2(cx, 9) < 0.5 ? [0.25, 0.4, 0.6] : [0.7, 0.68, 0.62];
          const y0 = b.h + 0.02, y1 = y0 + hh;
          const v = (x, y, z, nx, ny, nz) => roof.v(x, y, z, nx, ny, nz, 0, 0, cl);
          const top = [v(cx - s, y1, cz - s, 0, 1, 0), v(cx + s, y1, cz - s, 0, 1, 0), v(cx + s, y1, cz + s, 0, 1, 0), v(cx - s, y1, cz + s, 0, 1, 0)];
          roof.quad(top[0], top[1], top[2], top[3]);
          const sides = [[cx - s, cz - s, cx + s, cz - s, 0, -1], [cx + s, cz - s, cx + s, cz + s, 1, 0], [cx + s, cz + s, cx - s, cz + s, 0, 1], [cx - s, cz + s, cx - s, cz - s, -1, 0]];
          for (const [x1, z1, x2, z2, nx, nz] of sides) {
            const a = v(x1, y0, z1, nx, 0, nz), b2 = v(x2, y0, z2, nx, 0, nz), c = v(x2, y1, z2, nx, 0, nz), dd = v(x1, y1, z1, nx, 0, nz);
            roof.quad(a, b2, c, dd);
          }
        }
      }
    }

    // معالم: جزر وحدائق ومطبات
    const GREEN = [0.2, 0.42, 0.16];
    for (const lm of d.lm) {
      if (lm.type === 'island') {
        const c = plain.v(lm.x, 0.09, lm.z, 0, 1, 0, 0, 0, GREEN);
        let prev = -1;
        for (let k = 0; k <= 20; k++) {
          const a = (k / 20) * 6.283;
          const id = plain.v(lm.x + Math.cos(a) * lm.r, 0.09, lm.z + Math.sin(a) * lm.r, 0, 1, 0, 0, 0, GREEN);
          if (prev >= 0) plain.triUp(c, prev, id);
          prev = id;
        }
        const c2 = plain.v(lm.x, 0.07, lm.z, 0, 1, 0, 0, 0, [0.7, 0.68, 0.6]);
        prev = -1;
        for (let k = 0; k <= 20; k++) {
          const a = (k / 20) * 6.283;
          const id = plain.v(lm.x + Math.cos(a) * (lm.r + 0.8), 0.07, lm.z + Math.sin(a) * (lm.r + 0.8), 0, 1, 0, 0, 0, [0.7, 0.68, 0.6]);
          if (prev >= 0) plain.triUp(c2, prev, id);
          prev = id;
        }
      } else {
        const contour = lm.poly.map((p) => new THREE.Vector2(p[0], p[1]));
        const tris = THREE.ShapeUtils.triangulateShape(contour, []);
        const ids = lm.poly.map((p) => plain.v(p[0], 0.05, p[1], 0, 1, 0, 0, 0, GREEN));
        for (const t of tris) plain.triUp(ids[t[0]], ids[t[1]], ids[t[2]]);
      }
    }
    const BUMP = [0.9, 0.7, 0.1];
    for (const b of d.bumps) {
      const nx = -b.dz, nz = b.dx;
      const hw = b.half, hl = 0.45;
      const P = (s, o, y) => [b.x + b.dx * s + nx * o, y, b.z + b.dz * s + nz * o];
      const pts = [P(-hl, -hw, 0.1), P(hl, -hw, 0.1), P(hl, hw, 0.1), P(-hl, hw, 0.1)];
      const ids = pts.map((p) => plain.v(p[0], p[1], p[2], 0, 1, 0, 0, 0, BUMP));
      plain.triUp(ids[0], ids[1], ids[2]); plain.triUp(ids[0], ids[2], ids[3]);
    }

    const add = (gb, mat, caster = false, receive = true) => {
      const geo = gb.build();
      if (!geo) return;
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = receive;
      if (caster) { m.castShadow = this.quality !== 'low'; m.userData.caster = true; }
      g.add(m);
    };
    add(road, this.mat.road);
    add(side, this.mat.sidewalk);
    add(mark, this.mat.mark, false, false);
    add(wallU, this.mat.wall, true);
    add(shopB, this.mat.shop, true);
    add(roof, this.mat.roof, true);
    add(plain, this.mat.plain);

    // عناصر مكررة (Instancing)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    for (const t of Object.keys(d.props)) {
      const list = d.props[t];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(this.geos[t], this.mat.props, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
        pos.set(p.x, 0, p.z);
        sc.set(p.s, p.s, p.s);
        m4.compose(pos, q, sc);
        im.setMatrixAt(i, m4);
        const v = 0.85 + hash2(p.x, p.z) * 0.3;
        im.setColorAt(i, col.setRGB(v, v, v));
      });
      im.castShadow = t === 'tree' || t === 'palm';
      if (im.castShadow) im.userData.caster = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    this.group.add(g);
    this.chunks.set(this.key(cx, cz), { cx, cz, group: g });
  }
}
