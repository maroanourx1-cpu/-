// تحميل بيانات الخريطة: ملف محلي → ذاكرة المتصفح (IndexedDB) → OpenStreetMap مباشرة → خريطة تجريبية
import { MAP_BBOX, MAP_CACHE_KEY, MAP_ORIGIN, OVERPASS_ENDPOINTS } from '../config.js';
import { convertOverpass, overpassQuery } from './osmConvert.js';
import { generateFallback } from './fallbackMap.js';

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('toktok-sha3bola', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbSet(k, v) {
  try {
    const db = await idb();
    db.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
  } catch { /* تجاهل */ }
}

const valid = (m) => m && Array.isArray(m.roads) && m.roads.length > 20 && Array.isArray(m.buildings);

async function fetchWithTimeout(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
}

export async function loadMap(onStatus = () => {}, { allowNetwork = true } = {}) {
  // 1) ملف محلي مجهّز مسبقًا (npm run fetch-map)
  try {
    onStatus('جاري قراءة بيانات الخريطة المحفوظة…');
    const res = await fetchWithTimeout(import.meta.env.BASE_URL + 'data/ain-shams-east.json', {}, 8000);
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const m = await res.json();
      if (valid(m)) return m;
    }
  } catch { /* لا يوجد ملف */ }
  // 2) كاش المتصفح
  const cached = await idbGet(MAP_CACHE_KEY);
  if (valid(cached)) return cached;
  // 3) OpenStreetMap مباشرة
  if (allowNetwork) {
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        onStatus('جاري تحميل شوارع عين شمس الشرقية من OpenStreetMap…');
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(overpassQuery(MAP_BBOX)),
        }, 30000);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const m = convertOverpass(await res.json(), MAP_ORIGIN);
        if (valid(m)) { idbSet(MAP_CACHE_KEY, m); return m; }
      } catch (e) { console.warn('Overpass فشل:', url, e.message); }
    }
  }
  // 4) خريطة تجريبية
  onStatus('تعذر تحميل بيانات OSM – استخدام خريطة تجريبية…');
  return generateFallback();
}
