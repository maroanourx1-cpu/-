// صوت اللعبة: كله مولّد بـ WebAudio (بدون ملفات خارجية)
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, sfx: 0.9, engine: 0.7, ambient: 0.5, music: 0.35 };
    this.trackName = 'بيت عربي – توليد مباشر';
    this.station = 'شعبولا إف إم ٩٨٫٧';
    this.musicOn = true;
    this.hornOn = false;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.connect(c.destination);
    this.bus = {};
    for (const k of ['sfx', 'engine', 'ambient', 'music']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    this.applyVolumes();
    // ضوضاء
    const len = c.sampleRate * 2;
    const nb = c.createBuffer(1, len, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const bb = c.createBuffer(1, len, c.sampleRate);
    const bd = bb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brownBuf = bb;
    this._engine();
    this._loops();
    this._ambient();
    this.startMusic();
  }
  applyVolumes(v) {
    if (v) Object.assign(this.vol, v);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    for (const k of ['sfx', 'engine', 'ambient', 'music']) this.bus[k].gain.setTargetAtTime(this.vol[k], t, 0.05);
  }
  _noise(buf, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = loop;
    return s;
  }
  _engine() {
    const c = this.ctx;
    this.eo1 = c.createOscillator(); this.eo1.type = 'sawtooth';
    this.eo2 = c.createOscillator(); this.eo2.type = 'square';
    this.eLP = c.createBiquadFilter(); this.eLP.type = 'lowpass'; this.eLP.frequency.value = 700;
    this.eGain = c.createGain(); this.eGain.gain.value = 0;
    this.eMod = c.createGain(); this.eMod.gain.value = 1;
    this.lfo = c.createOscillator(); this.lfo.type = 'square'; this.lfo.frequency.value = 20;
    this.lfoG = c.createGain(); this.lfoG.gain.value = 0.35;
    this.lfo.connect(this.lfoG).connect(this.eMod.gain);
    const mix = c.createGain(); mix.gain.value = 0.5;
    this.eo1.connect(mix); this.eo2.connect(mix);
    mix.connect(this.eLP).connect(this.eMod).connect(this.eGain).connect(this.bus.engine);
    this.eo1.start(); this.eo2.start(); this.lfo.start();
  }
  _loops() {
    const c = this.ctx;
    // صرير الفرامل
    const n = this._noise(this.noiseBuf);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 7;
    this.skidG = c.createGain(); this.skidG.gain.value = 0;
    n.connect(bp).connect(this.skidG).connect(this.bus.sfx); n.start();
    // نيترو
    const n2 = this._noise(this.noiseBuf);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    this.nitroG = c.createGain(); this.nitroG.gain.value = 0;
    n2.connect(hp).connect(this.nitroG).connect(this.bus.sfx); n2.start();
    // كلاكس
    this.hornG = c.createGain(); this.hornG.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    for (const f of [415, 523, 622]) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0.22;
      o.connect(g).connect(lp); o.start();
    }
    lp.connect(this.hornG).connect(this.bus.sfx);
  }
  _ambient() {
    const c = this.ctx;
    const n = this._noise(this.brownBuf);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.18;
    n.connect(lp).connect(g).connect(this.bus.ambient); n.start();
    const far = () => {
      if (this.ctx && this.ctx.state === 'running') this.distantHorn();
      setTimeout(far, 3500 + Math.random() * 7000);
    };
    setTimeout(far, 3000);
  }
  distantHorn() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 330 + Math.random() * 120;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.setValueAtTime(0.05, t + 0.18 + Math.random() * 0.3); g.gain.linearRampToValueAtTime(0, t + 0.6);
    o.connect(lp).connect(g).connect(this.bus.ambient);
    o.start(t); o.stop(t + 0.7);
  }
  // يُستدعى كل إطار
  update({ speedRatio, throttle, skid, nitro, horn, fuelEmpty, running }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = running;
    const rpm = Math.min(1, 0.22 + speedRatio * 0.95 + throttle * 0.12);
    const f = 36 + rpm * 118 + (nitro ? 18 : 0);
    this.eo1.frequency.setTargetAtTime(f, t, 0.04);
    this.eo2.frequency.setTargetAtTime(f * 0.5, t, 0.04);
    this.lfo.frequency.setTargetAtTime(f * 0.5 + (fuelEmpty ? Math.random() * 6 : 0), t, 0.04);
    this.eLP.frequency.setTargetAtTime(500 + rpm * 1400, t, 0.05);
    this.eGain.gain.setTargetAtTime(on ? 0.22 + throttle * 0.14 : 0, t, 0.08);
    this.skidG.gain.setTargetAtTime(on ? skid * 0.16 : 0, t, 0.04);
    this.nitroG.gain.setTargetAtTime(on && nitro ? 0.13 : 0, t, 0.05);
    this.hornG.gain.setTargetAtTime(on && horn ? 0.28 : 0, t, 0.015);
  }
  _tone(freq, dur, type = 'sine', vol = 0.3, freqEnd = null, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.bus.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _burst(dur, freq, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const n = this._noise(this.noiseBuf, false);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(this.bus.sfx);
    n.start(t); n.stop(t + dur + 0.05);
  }
  cash() { this._tone(988, 0.12, 'sine', 0.3); this._tone(1319, 0.28, 'sine', 0.3, null, 0.09); this._tone(1760, 0.35, 'triangle', 0.18, null, 0.18); }
  ding() { this._tone(660, 0.15, 'triangle', 0.3); this._tone(990, 0.3, 'triangle', 0.3, null, 0.1); }
  thud(power = 1) { this._burst(0.25, 500, 0.35 * Math.min(1.5, power)); this._tone(110, 0.2, 'sine', 0.35 * Math.min(1.5, power), 40); }
  bump() { this._tone(90, 0.12, 'sine', 0.25, 45); }
  nitroStart() { this._tone(250, 0.5, 'sawtooth', 0.12, 1100); }
  click() { this._tone(520, 0.05, 'square', 0.08); }
  buy() { this._tone(520, 0.08, 'triangle', 0.25); this._tone(780, 0.14, 'triangle', 0.25, null, 0.07); }
  error() { this._tone(180, 0.18, 'sawtooth', 0.2, 120); }

  // —— الراديو (موسيقى مولّدة) ——
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const c = this.ctx;
    this.step = 0;
    this.next = c.currentTime + 0.1;
    const bpm = 98, sd = 60 / bpm / 4;
    const scale = [62, 63, 66, 67, 69, 70, 72, 74]; // D هيجاز
    const bassPat = [0, null, null, 0, null, 0, null, null, 0, null, null, 0, null, 3, null, 2];
    const melodyNotes = [4, 3, 2, 3, 2, 1, 0, 1];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn) { this.next = c.currentTime + 0.1; return; }
      while (this.next < c.currentTime + 0.25) {
        const s = this.step % 16, bar = Math.floor(this.step / 16) % 4;
        const t = this.next;
        if ([0, 3, 8, 10].includes(s)) this._drum(t, 'kick');
        if ([4, 12].includes(s)) this._drum(t, 'clap');
        if (s % 2 === 1) this._drum(t, 'hat');
        const b = bassPat[s];
        if (b !== null) this._note(midi(scale[b] - 24), t, sd * 2.2, 'sawtooth', 0.22, 360);
        if (s % 2 === 0) {
          const mi = (s / 2 + bar * 3) % melodyNotes.length;
          const n = scale[melodyNotes[mi]] + (bar === 3 ? 12 : 0);
          if ((s + bar) % 4 !== 3) this._note(midi(n), t, sd * 1.8, 'square', 0.1, 2200);
        }
        this.next += sd;
        this.step++;
      }
    }, 60);
  }
  setMusic(on) { this.musicOn = on; }
  _note(freq, t, dur, type, vol, cutoff) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(this.bus.music);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _drum(t, kind) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(this.bus.music); o.start(t); o.stop(t + 0.25);
    } else {
      const n = this._noise(this.noiseBuf, false);
      const f = c.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1500;
      const g = c.createGain(); const d = kind === 'hat' ? 0.04 : 0.14;
      g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f).connect(g).connect(this.bus.music); n.start(t); n.stop(t + d + 0.02);
    }
  }
}
