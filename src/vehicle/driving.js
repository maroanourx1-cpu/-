// فيزياء قيادة التوكتوك (نموذج أركيد: دراجة ثلاثية، انزلاق جانبي، نيترو، تصادمات)
const CIRCLES = [[1.0, 0.68], [0.1, 0.72], [-0.85, 0.72]]; // [إزاحة للأمام, نصف قطر]

export class Vehicle {
  constructor(sw) {
    this.sw = sw;
    this.x = 0; this.z = 0; this.h = 0;
    this.vx = 0; this.vz = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.nitro = 0;
    this.nitroDelay = 0;
    this.boosting = false;
    this.stats = null;
    this.accelLong = 0; this.accelLat = 0;
    this.prevVf = 0;
    this.ev = { impact: 0, skid: 0, bump: 0 };
    this.time = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get forward() { return this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h); }
  setPose(x, z, h) { this.x = x; this.z = z; this.h = h; this.vx = this.vz = 0; this.yawRate = 0; }

  update(dt, inp, fuelEmpty) {
    const S = this.stats;
    const ev = this.ev;
    ev.impact = 0; ev.skid = 0; ev.bump = 0;
    this.time += dt;
    const fx = Math.sin(this.h), fz = Math.cos(this.h);
    const rx = Math.cos(this.h), rz = -Math.sin(this.h);
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * rx + this.vz * rz;

    // نيترو
    const boost = !!(inp.nitro && this.nitro > 0.5 && S.nitroCap > 0);
    this.boosting = boost;
    if (boost) { this.nitro = Math.max(0, this.nitro - 26 * dt); this.nitroDelay = 1.8; }
    else { this.nitroDelay -= dt; if (this.nitroDelay <= 0) this.nitro = Math.min(S.nitroCap, this.nitro + S.nitroRecharge * dt); }
    if (this.nitro > S.nitroCap) this.nitro = S.nitroCap;

    const powerK = fuelEmpty ? 0.3 : 1;
    const vmax = S.maxSpeed * (boost ? 1.45 : 1) * (fuelEmpty ? 0.5 : 1);

    // دفع / فرامل
    if (inp.throttle > 0 || boost) {
      const t = boost ? 1 : inp.throttle;
      const k = Math.max(0.04, 1 - Math.pow(Math.max(vf, 0) / vmax, 2));
      if (vf < vmax) vf += S.accel * powerK * t * (boost ? 2.2 : 1) * k * dt;
      else vf -= 6 * dt; // تخفيف عند الخروج من النيترو
    }
    if (inp.brake > 0) {
      if (vf > 0.5) vf = Math.max(0, vf - S.brake * inp.brake * dt);
      else vf = Math.max(-vmax * 0.32, vf - S.accel * 0.6 * powerK * inp.brake * dt);
    }
    if (inp.throttle <= 0 && inp.brake <= 0 && !boost) {
      const drag = (1.5 + 0.012 * vf * vf) * dt;
      vf = Math.abs(vf) < drag ? 0 : vf - Math.sign(vf) * drag;
    }
    if (inp.handbrake) {
      const d = 10 * dt;
      vf = Math.abs(vf) < d ? 0 : vf - Math.sign(vf) * d;
    }

    // التوجيه
    const target = inp.steer;
    const rate = Math.abs(target) > Math.abs(this.steer) ? 7 : 11;
    this.steer += (target - this.steer) * Math.min(1, dt * rate);
    const maxSteer = 0.62 - 0.42 * Math.min(1, Math.abs(vf) / 24);
    const delta = this.steer * maxSteer;
    let yawT = (vf * Math.tan(delta)) / 1.9;
    if (inp.handbrake && Math.abs(vf) > 5) yawT *= 1.35;
    yawT = Math.max(-2.5, Math.min(2.5, yawT));
    this.yawRate += (yawT - this.yawRate) * Math.min(1, dt * 10);

    // نركّب السرعة العالمية بالاتجاه القديم، ثم ندوّر الجسم؛ الفرق بين اتجاه الجسم واتجاه الحركة = انزلاق جانبي
    this.vx = fx * vf + rx * vl;
    this.vz = fz * vf + rz * vl;
    this.h += this.yawRate * dt;
    const fx2 = Math.sin(this.h), fz2 = Math.cos(this.h);
    const rx2 = Math.cos(this.h), rz2 = -Math.sin(this.h);
    vf = this.vx * fx2 + this.vz * fz2;
    vl = this.vx * rx2 + this.vz * rz2;

    // تماسك الإطارات: يقتل السرعة الجانبية؛ فوق حد معين (أو بفرامل اليد) يقل التماسك فيحصل انزلاق
    const aLat = Math.abs(vf * this.yawRate);
    const limit = 17 + S.grip * 1.6;
    let k = S.grip * 2.5;
    if (inp.handbrake) k *= 0.12;
    else if (aLat > limit) k *= 0.35;
    vl *= Math.exp(-k * dt);
    if (Math.abs(vl) > 2.4 && Math.abs(vf) > 3) ev.skid = Math.min(1, (Math.abs(vl) - 2.4) / 4);
    // الانزلاق يستهلك جزءًا من السرعة الأمامية
    if (Math.abs(vl) > 1) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (Math.abs(vl) - 1) * 0.9 * dt);

    this.vx = fx2 * vf + rx2 * vl;
    this.vz = fz2 * vf + rz2 * vl;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // تصادم مع المباني والعوائق
    let impact = 0;
    for (let it = 0; it < 3; it++) {
      let any = false;
      for (const [off, r] of CIRCLES) {
        const cx = this.x + fx2 * off, cz = this.z + fz2 * off;
        const cs = this.sw.push(cx, cz, r);
        for (let i = 0; i < cs.length; i++) {
          const c = cs[i];
          this.x += c.nx * c.pen; this.z += c.nz * c.pen;
          const vn = this.vx * c.nx + this.vz * c.nz;
          if (vn < 0) {
            impact = Math.max(impact, -vn);
            this.vx -= 1.25 * vn * c.nx; this.vz -= 1.25 * vn * c.nz;
            this.vx *= 0.985; this.vz *= 0.985;
            // لف خفيف عند الاصطدام الأمامي المائل
            this.yawRate += (c.nx * fz2 - c.nz * fx2) * -vn * 0.05 * Math.sign(off || 1);
          }
          any = true;
        }
      }
      if (!any) break;
    }
    ev.impact = impact;

    // مطبات
    this.sw.bumpHash.query(this.x, this.z, 3, (id) => {
      const b = this.sw.bumps[id];
      if (this.time - b.last < 0.6) return;
      const px = this.x - b.x, pz = this.z - b.z;
      const along = px * b.dx + pz * b.dz;
      const lat = -px * b.dz + pz * b.dx;
      if (Math.abs(along) < 0.9 && Math.abs(lat) < b.half && this.speed > 2) {
        b.last = this.time;
        ev.bump = Math.min(2.2, this.speed * 0.09) * S.bumpDamp;
        const f = 1 - 0.06 * S.bumpDamp;
        this.vx *= f; this.vz *= f;
      }
    });

    // تسارعات للأنيميشن
    const vfNow = this.vx * fx2 + this.vz * fz2;
    this.accelLong += (((vfNow - this.prevVf) / Math.max(dt, 1e-4)) - this.accelLong) * Math.min(1, dt * 8);
    this.prevVf = vfNow;
    const accelLatTarget = vfNow * this.yawRate;
    this.accelLat += (accelLatTarget - this.accelLat) * Math.min(1, dt * 8);
    return ev;
  }
}
