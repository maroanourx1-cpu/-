// خامات مولّدة برمجيًا (Canvas) لتقليل حجم الملفات وتجنب تحميل صور خارجية
import * as THREE from 'three';

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(canvas, repeat = true, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}
function noise(ctx, w, h, amt, alpha = 0.08) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export function asphaltTexture() {
  const [c, g] = mk(256, 256);
  g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 22);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(20,20,22,${Math.random() * 0.25})`; g.lineWidth = Math.random() * 1.5; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60); g.stroke(); }
  return tex(c);
}

export function pavementTexture() {
  // بلاط إنترلوك رمادي/بيج
  const [c, g] = mk(256, 256);
  g.fillStyle = '#8c8578'; g.fillRect(0, 0, 256, 256);
  const cols = ['#9a9387', '#847d71', '#a39b8d', '#8f877a', '#7b7468'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = cols[(Math.random() * cols.length) | 0];
    const ox = (y % 2) * 16;
    g.fillRect(x * 32 + ox + 1, y * 32 + 1, 30, 30);
  }
  noise(g, 256, 256, 22);
  return tex(c);
}

export function sidewalkTexture() {
  const [c, g] = mk(128, 128);
  g.fillStyle = '#b4aea2'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(70,65,55,.45)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  noise(g, 128, 128, 18);
  return tex(c);
}

const WALL_BASE = '#f3efe6';
export function wallTexture() {
  // لوح 8م × 3.2م: 3 أنماط نوافذ
  const W = 512, H = 256;
  const [c, g] = mk(W, H);
  g.fillStyle = WALL_BASE; g.fillRect(0, 0, W, H);
  noise(g, W, H, 14);
  // فواصل الأدوار
  g.fillStyle = 'rgba(120,110,95,.5)'; g.fillRect(0, H - 8, W, 8);
  const win = (x, kind) => {
    const ww = 52, wh = 112, y = 70;
    g.fillStyle = '#5b4a3a'; g.fillRect(x - 4, y - 4, ww + 8, wh + 8);
    const grd = g.createLinearGradient(x, y, x + ww, y + wh);
    grd.addColorStop(0, '#6f93b3'); grd.addColorStop(1, '#2d4358');
    g.fillStyle = grd; g.fillRect(x, y, ww, wh);
    g.fillStyle = '#e9e3d5'; g.fillRect(x + ww / 2 - 1.5, y, 3, wh); g.fillRect(x, y + wh / 2 - 1.5, ww, 3);
    if (kind === 1) { g.fillStyle = '#2f6b3a'; g.fillRect(x - 4, y - 4, 14, wh + 8); g.fillRect(x + ww - 10, y - 4, 14, wh + 8); }
    if (kind === 2) { g.fillStyle = '#bdb6a6'; g.fillRect(x - 12, y + wh + 4, ww + 24, 12); g.fillStyle = '#7a735f'; g.fillRect(x - 12, y + wh + 14, ww + 24, 3); }
  };
  win(40, 1); win(160, 0); win(300, 2); win(420, 0);
  // وحدة تكييف
  g.fillStyle = '#d9d9d6'; g.fillRect(216, 150, 40, 26); g.fillStyle = '#9b9b98'; g.fillRect(220, 156, 32, 3);
  return tex(c);
}

const SHOPS = [
  ['صيدلية الشفاء', '#1e8f4e', '#ffffff'],
  ['سوبر ماركت الأمل', '#d8322d', '#fff7d6'],
  ['كشري التحرير', '#f2b705', '#1b1b1b'],
  ['موبايلات النور', '#1f6fd1', '#ffffff'],
  ['مكتبة الجامعة', '#6b3fa0', '#ffffff'],
  ['فرن بلدي', '#c9792a', '#fff'],
  ['ورشة الأسطى', '#444', '#ffd34d'],
  ['عصير قصب', '#2e9e4f', '#fff6a8'],
];
export function shopTexture() {
  // 4 محلات × 4م = 16م × 3.6م (عرض 1024 ارتفاع 230)
  const W = 1024, H = 230;
  const [c, g] = mk(W, H);
  g.fillStyle = WALL_BASE; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    const [name, col, tcol] = SHOPS[(i * 2 + (Math.random() * 2 | 0)) % SHOPS.length];
    const x0 = i * 256;
    // الواجهة
    g.fillStyle = '#cfc9bc'; g.fillRect(x0, 0, 256, H);
    // لافتة
    g.fillStyle = col; g.fillRect(x0 + 6, 14, 244, 52);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(x0 + 6, 14, 244, 52);
    g.fillStyle = tcol; g.font = '800 34px Cairo, Tahoma, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.fillText(name, x0 + 128, 42, 230);
    // زجاج أو سلّم
    const open = Math.random() < 0.55;
    if (open) {
      const grd = g.createLinearGradient(0, 80, 0, 230);
      grd.addColorStop(0, '#f5e6b0'); grd.addColorStop(1, '#a8884a');
      g.fillStyle = grd; g.fillRect(x0 + 18, 88, 220, 142);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0 + 18, 88, 220, 18);
      for (let k = 0; k < 6; k++) { g.fillStyle = `hsl(${Math.random() * 360},60%,55%)`; g.fillRect(x0 + 30 + k * 34, 150 + (k % 2) * 16, 24, 40); }
    } else {
      g.fillStyle = '#5d6168'; g.fillRect(x0 + 18, 88, 220, 142);
      g.strokeStyle = '#464a50'; g.lineWidth = 3;
      for (let y = 96; y < 230; y += 10) { g.beginPath(); g.moveTo(x0 + 18, y); g.lineTo(x0 + 238, y); g.stroke(); }
    }
    // مظلة
    g.fillStyle = Math.random() < 0.5 ? '#c9392e' : '#2b6cb0';
    g.fillRect(x0 + 10, 70, 236, 14);
    for (let s = 0; s < 12; s++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0 + 10 + s * 20 + 10, 70, 10, 14); }
  }
  return tex(c);
}

export function groundTexture() {
  return pavementTexture();
}

export function plateTexture(text = 'القاهرة ٣٦٩') {
  const [c, g] = mk(256, 96);
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#1b4fa8'; g.fillRect(0, 0, 256, 20);
  g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 92);
  g.fillStyle = '#111'; g.font = '800 42px Cairo, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 60, 230);
  return tex(c, false, 4);
}

export const STICKERS = {
  none: { name: 'بدون', cost: 0 },
  sha3bola: { name: 'شعبولا', cost: 120, text: 'شعبولا', bg: '#111', fg: '#ffd21a' },
  mashallah: { name: 'ما شاء الله', cost: 80, text: 'ما شاء الله', bg: '#0d5c2e', fg: '#fff' },
  flag: { name: 'علم مصر', cost: 100, flag: true },
  stars: { name: 'نجوم', cost: 90, stars: true },
  fire: { name: 'نار', cost: 150, text: '🔥 مهرجان 🔥', bg: '#b3261e', fg: '#ffe9a8' },
};
export function stickerTexture(id) {
  const s = STICKERS[id];
  if (!s || id === 'none') return null;
  const [c, g] = mk(512, 192);
  g.clearRect(0, 0, 512, 192);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  if (s.flag) {
    g.fillStyle = '#ce1126'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#fff'; g.fillRect(0, 64, 512, 64); g.fillStyle = '#111'; g.fillRect(0, 128, 512, 64);
    g.fillStyle = '#c09300'; g.beginPath(); g.arc(256, 96, 26, 0, 7); g.fill();
  } else if (s.stars) {
    g.fillStyle = '#12123a'; g.fillRect(0, 0, 512, 192);
    for (let i = 0; i < 26; i++) { g.fillStyle = '#ffd21a'; g.font = `${20 + Math.random() * 36}px sans-serif`; g.fillText('★', Math.random() * 512, Math.random() * 192); }
  } else {
    g.fillStyle = s.bg; g.beginPath(); g.roundRect(0, 0, 512, 192, 28); g.fill();
    g.strokeStyle = s.fg; g.lineWidth = 8; g.beginPath(); g.roundRect(10, 10, 492, 172, 22); g.stroke();
    g.fillStyle = s.fg; g.font = '800 84px Cairo, Tahoma, sans-serif'; g.fillText(s.text, 256, 100, 460);
  }
  const t = tex(c, false, 4);
  return t;
}

export function roofSignTexture(text = 'شعبولا') {
  const [c, g] = mk(256, 80);
  g.fillStyle = '#ffd21a'; g.fillRect(0, 0, 256, 80);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 74);
  g.fillStyle = '#111'; g.font = '800 54px Cairo, Tahoma'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 44, 230);
  return tex(c, false, 4);
}
