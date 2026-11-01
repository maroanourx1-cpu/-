// الكاميرا: ثالثة (خلف التوكتوك مع تدوير بالماوس) وأولى (من داخل التوكتوك)
import * as THREE from 'three';

export class CameraRig {
  constructor(camera, sw) {
    this.cam = camera;
    this.sw = sw;
    this.mode = 'third';
    this.yaw = 0; this.pitch = 0;
    this.dragging = false;
    this.idle = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.fov = 62;
    this.sens = 1;
    this.orbitAngle = 0;
    this.initialized = false;
  }
  toggle() { this.mode = this.mode === 'third' ? 'first' : 'third'; this.yaw = this.pitch = 0; }
  attach(el) {
    let lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => { this.dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      this.yaw -= dx * 0.006 * this.sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004 * this.sens, -0.3, 0.8);
      this.idle = 0;
    });
  }
  snap() { this.initialized = false; }

  update(dt, veh, mesh, opts = {}) {
    const cam = this.cam;
    const sp = Math.min(1, veh.speed / 25);
    const boost = veh.boosting ? 1 : 0;
    this.shake = Math.max(0, this.shake - dt * 3);
    const targetFov = (this.mode === 'first' ? 75 : 62) + sp * 8 + boost * 10;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    if (opts.garage) {
      this.orbitAngle += (opts.dragYaw !== undefined ? 0 : dt * 0.5);
      const a = this.orbitAngle + (opts.dragYaw || 0);
      let r = 6.6;
      // لا تدخل الكاميرا داخل المباني
      for (let q = 1.5; q <= 6.6; q += 0.6) {
        if (this.sw.distToBuilding(veh.x + Math.sin(a) * q, veh.z + Math.cos(a) * q, 1.0) < 0.9) { r = Math.max(2.6, q - 1.0); break; }
      }
      const p = new THREE.Vector3(veh.x + Math.sin(a) * r, 1.4 + r * 0.15, veh.z + Math.cos(a) * r);
      this.pos.lerp(p, Math.min(1, dt * 4));
      cam.position.copy(this.pos);
      cam.lookAt(veh.x, 0.9, veh.z);
      return;
    }

    const fx = Math.sin(veh.h), fz = Math.cos(veh.h);
    if (this.mode === 'first') {
      const sway = Math.sin(veh.time * 30) * 0.004 * sp;
      const q = mesh.state;
      cam.position.set(veh.x + fx * 0.05, 1.62 + sway + q.bounce, veh.z + fz * 0.05);
      cam.position.x += (-fz) * 0.0; // مركزي
      const look = veh.h + this.yaw * 0.6;
      cam.rotation.order = 'YXZ';
      cam.rotation.set(-this.pitch * 0.4 - q.pitch * 0.5, look + Math.PI, -q.roll * 0.6);
      this.pos.copy(cam.position);
      this.initialized = false;
      return;
    }

    // ثالثة
    if (!this.dragging) {
      this.idle += dt;
      if (this.idle > 1.2) { this.yaw *= Math.max(0, 1 - dt * 2.5); this.pitch *= Math.max(0, 1 - dt * 2.5); }
    }
    const dist = 6.4 + sp * 1.6;
    const ang = veh.h + Math.PI + this.yaw;
    let dx = Math.sin(ang), dz = Math.cos(ang);
    const hgt = 2.9 + this.pitch * 5 - sp * 0.3;
    // تفادي دخول الكاميرا داخل المباني
    let d = dist;
    for (let s = 1.5; s <= dist; s += 0.8) {
      const px = veh.x + dx * s, pz = veh.z + dz * s;
      if (this.sw.distToBuilding(px, pz, 1.0) < 0.9) { d = Math.max(2.2, s - 1.0); break; }
    }
    const target = new THREE.Vector3(veh.x + dx * d, hgt * (d / dist * 0.5 + 0.5), veh.z + dz * d);
    if (!this.initialized) { this.pos.copy(target); this.initialized = true; }
    else this.pos.lerp(target, Math.min(1, dt * (d < dist ? 12 : 5.5)));
    cam.position.copy(this.pos);
    if (this.shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3));
    this.look.set(veh.x - dx * 3.5 + 0, 1.3, veh.z - dz * 3.5);
    cam.lookAt(this.look);
  }
}
