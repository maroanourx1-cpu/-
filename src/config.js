// إعدادات عامة للعبة وللخريطة
// مركز المنطقة التقريبي: عين شمس الشرقية – القاهرة. يمكنك تعديل الإحداثيات ثم تشغيل: npm run fetch-map
export const MAP_ORIGIN = { lat: 30.132, lon: 31.333 };
export const MAP_BBOX = { s: 30.123, w: 31.3235, n: 30.141, e: 31.3425 }; // حوالي 2كم × 1.8كم

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export const CHUNK = 128; // حجم الـ Chunk بالمتر
export const SAVE_KEY = 'toktok-sha3bola-save-v1';
export const MAP_CACHE_KEY = 'toktok-osm-ain-shams-east-v1';

// أنواع الطرق: العرض (متر) والسرعة (م/ث) لسيارات المرور
export const ROAD_TYPES = {
  motorway: { w: 16, speed: 14, rank: 6 },
  trunk: { w: 15, speed: 14, rank: 6 },
  primary: { w: 14, speed: 12, rank: 5 },
  secondary: { w: 12, speed: 11, rank: 4 },
  tertiary: { w: 10, speed: 10, rank: 3 },
  unclassified: { w: 8, speed: 8, rank: 2 },
  residential: { w: 7.5, speed: 7, rank: 2 },
  living_street: { w: 6, speed: 5, rank: 1 },
  service: { w: 5, speed: 5, rank: 1 },
  road: { w: 7, speed: 7, rank: 2 },
};
