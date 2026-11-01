// تحميل بيانات OpenStreetMap لعين شمس الشرقية وحفظها في public/data/ain-shams-east.json
// التشغيل: npm run fetch-map
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_BBOX, MAP_ORIGIN, OVERPASS_ENDPOINTS } from '../src/config.js';
import { convertOverpass, overpassQuery } from '../src/world/osmConvert.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'ain-shams-east.json');
const query = overpassQuery(MAP_BBOX);

let json = null;
const endpoints = process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : OVERPASS_ENDPOINTS; // OVERPASS_URL للاختبار أو لخادم خاص
for (const url of endpoints) {
  try {
    console.log('جاري التحميل من', url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    json = await res.json();
    break;
  } catch (e) {
    console.warn('فشل:', e.message);
  }
}
if (!json) {
  console.error('تعذر تحميل البيانات. اللعبة ستحاول التحميل من المتصفح أو تستخدم الخريطة التجريبية.');
  process.exit(0);
}
const map = convertOverpass(json, MAP_ORIGIN);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map));
console.log(`تم الحفظ: ${out}\n  شوارع: ${map.roads.length}  مبانٍ: ${map.buildings.length}`);
