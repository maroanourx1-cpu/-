// تحويل بيانات OpenStreetMap (Overpass JSON) إلى صيغة اللعبة (إحداثيات بالمتر)
import { ROAD_TYPES } from '../config.js';

export function project(lat, lon, o) {
  const kx = 111320 * Math.cos((o.lat * Math.PI) / 180);
  return [Math.round((lon - o.lon) * kx * 10) / 10, Math.round(-(lat - o.lat) * 110574 * 10) / 10];
}

export function overpassQuery(b) {
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  return `[out:json][timeout:90];(way["highway"](${bb});way["building"](${bb}););out geom;`;
}

function hashId(id) {
  let h = (id * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  return (h >>> 0) / 4294967296;
}

function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

export function convertOverpass(json, origin) {
  const roads = [];
  const buildings = [];
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
  const grow = (p) => {
    if (p[0] < minx) minx = p[0];
    if (p[0] > maxx) maxx = p[0];
    if (p[1] < minz) minz = p[1];
    if (p[1] > maxz) maxz = p[1];
  };
  for (const el of json.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags || {};
    const pts = el.geometry.map((g) => project(g.lat, g.lon, origin));
    if (t.highway && ROAD_TYPES[t.highway]) {
      if (t.service === 'driveway' || t.service === 'parking_aisle') continue;
      const def = ROAD_TYPES[t.highway];
      let w = def.w;
      const lanes = parseInt(t.lanes, 10);
      if (lanes > 0) w = Math.max(w * 0.8, Math.min(lanes * 3.3, 18));
      if (t.width && parseFloat(t.width) > 3) w = Math.min(parseFloat(t.width), 20);
      pts.forEach(grow);
      roads.push({
        id: el.id,
        type: t.highway,
        name: t['name:ar'] || t.name || '',
        pts,
        w,
        oneway: t.oneway === 'yes' || t.junction === 'roundabout',
      });
    } else if (t.building && pts.length >= 4) {
      const first = pts[0], last = pts[pts.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) continue;
      pts.pop();
      let a = area(pts);
      if (Math.abs(a) < 25 || Math.abs(a) > 15000) continue;
      if (a < 0) pts.reverse();
      let floors = parseFloat(t['building:levels']);
      let h = parseFloat(t.height);
      if (!(h > 0)) h = floors > 0 ? floors * 3.2 + 1 : 3.2 * (3 + Math.floor(hashId(el.id) * 7)) + 1;
      h = Math.min(h, 70);
      pts.forEach(grow);
      buildings.push({ pts, h, shop: hashId(el.id + 7) < 0.55 });
    }
  }
  if (!roads.length) throw new Error('لا توجد شوارع في بيانات OSM');
  return { source: 'osm', origin, roads, buildings, landmarks: [], bounds: { minx, maxx, minz, maxz } };
}
