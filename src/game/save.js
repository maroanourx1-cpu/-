// حفظ وتحميل التقدم (LocalStorage)
import { SAVE_KEY } from '../config.js';

export const DEFAULT_SETTINGS = { master: 0.8, sfx: 0.9, engine: 0.7, ambient: 0.5, music: 0.35, quality: 'medium', sens: 1, fps: true };

export function defaultSave() {
  return {
    v: 1,
    money: 350,
    shiftTotal: 0,
    trips: 0,
    config: { body: '#f2b705', roof: '#1b1b1b', seat: '#7a1f1f', rim: '#c9c9c9', light: 'white', sticker: 'none', decor: [] },
    owned: ['body:#f2b705', 'body:#1b1b1b', 'body:#2e7d32', 'roof:#1b1b1b', 'roof:#f2b705', 'roof:#2e7d32', 'seat:#7a1f1f', 'seat:#222222', 'seat:#6b4b2a', 'rim:#c9c9c9', 'rim:#f2b705', 'rim:#222222', 'light:white'],
    upgrades: { engine: 0, brakes: 0, tires: 0, suspension: 0, nitro: 0 },
    fuel: 100,
    pos: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function loadSave() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    return {
      ...d, ...s,
      config: { ...d.config, ...(s.config || {}) },
      upgrades: { ...d.upgrades, ...(s.upgrades || {}) },
      settings: { ...d.settings, ...(s.settings || {}) },
      owned: Array.from(new Set([...(d.owned), ...(s.owned || [])])),
    };
  } catch { return d; }
}

export function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* تجاهل */ }
}
