// جسيمات بسيطة: دخان الفرامل، غبار، شرارات النيترو
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 600) {
    this.max = max;
    this.i = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.grow = new Float32Array(max);
    this.a0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uPx: { value: 1 } },
      vertexShader: `attribute float aAlpha; attribute float aSize; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uPx;
        void main(){ vA=aAlpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPx*420.0/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.2,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(vC,a); }`,
    });
    this.mat = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }
  setPixelRatio(p) { this.mat.uniforms.uPx.value = p; }
  emit(x, y, z, vx, vy, vz, life, size, color, alpha = 0.5, grow = 1.5) {
    const i = this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.a0[i] = alpha; this.grow[i] = grow;
    const c = color;
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    this.alpha[i] = alpha;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = this.a0[i] * t;
      this.size[i] += this.grow[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
