import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'public', 'reconstruction');
const center = { lon: 39.6114, lat: 24.4675 };
const clusters = [
  [39.6111, 24.4672, 155, .0062, .0048],
  [39.6065, 24.4700, 72, .0038, .0029],
  [39.6160, 24.4640, 68, .0040, .0031],
  [39.6142, 24.4708, 55, .0032, .0026]
];

function seed(n) { const x = Math.sin(n * 9187.123) * 43758.5453; return x - Math.floor(x); }
function distM(aLon, aLat, bLon, bLat) { return Math.hypot((aLon - bLon) * 101500, (aLat - bLat) * 111320); }
function rotOffset(dx, dy, a) { const c = Math.cos(a), s = Math.sin(a); return [dx * c - dy * s, dx * s + dy * c]; }
function offsetLngLat(lon, lat, dx, dy, angle) {
  const [rx, ry] = rotOffset(dx, dy, angle);
  return [lon + rx / 101500, lat + ry / 111320];
}
function rectangle(lon, lat, widthM, depthM, angle) {
  const hw = widthM / 2, hd = depthM / 2;
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd],[-hw,-hd]].map(([x,y]) => offsetLngLat(lon, lat, x, y, angle));
}
function feature(lon, lat, width, depth, angle, properties) {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [rectangle(lon, lat, width, depth, angle)] } };
}

const compounds = [];
let ci = 0;
for (const [cx, cy, count, sx, sy] of clusters) {
  for (let i = 0; i < count; i++, ci++) {
    const lon = cx + (seed(ci * 23 + 1) - .5) * sx;
    const lat = cy + (seed(ci * 23 + 2) - .5) * sy;
    if (distM(lon, lat, center.lon, center.lat) < 72) { i--; continue; }
    const born = seed(ci * 29 + 11) < .58 ? 622 : (seed(ci * 29 + 12) < .57 ? 627 : 632);
    compounds.push({ lon, lat, w: 13 + seed(ci * 23 + 3) * 22, h: 11 + seed(ci * 23 + 4) * 19, ang: (seed(ci * 23 + 5) - .5) * .36, parts: 2 + Math.floor(seed(ci * 23 + 6) * 4), tone: seed(ci * 23 + 7), yard: seed(ci * 23 + 8) > .22, wall: seed(ci * 23 + 9) > .38, id: ci, born });
  }
}

const features = [];
for (const c of compounds) {
  const tone = Math.min(4, Math.floor(c.tone * 5));
  for (let p = 0; p < c.parts; p++) {
    const side = p % 4;
    const frac = .38 + seed(c.id * 31 + p * 7 + 1) * .22;
    let dx = 0, dy = 0, w = c.w * .34, h = c.h * .34;
    if (side === 0) { dy = -c.h * .34; dx = (seed(c.id * 37 + p) - .5) * c.w * .28; w = c.w * frac; h = c.h * .28; }
    if (side === 1) { dx = c.w * .34; dy = (seed(c.id * 41 + p) - .5) * c.h * .28; w = c.w * .28; h = c.h * frac; }
    if (side === 2) { dy = c.h * .34; dx = (seed(c.id * 43 + p) - .5) * c.w * .28; w = c.w * frac; h = c.h * .28; }
    if (side === 3) { dx = -c.w * .34; dy = (seed(c.id * 47 + p) - .5) * c.h * .28; w = c.w * .28; h = c.h * frac; }
    const [lon, lat] = offsetLngLat(c.lon, c.lat, dx, dy, c.ang);
    features.push(feature(lon, lat, w, h, c.ang, {
      kind: 'mud-house', compound: c.id, part: p, height: 2.7 + seed(c.id * 59 + p) * 1.25,
      base_height: 0, tone, start_year: c.born, confidence: 'interpretive', aligned_to_raster: true
    }));
  }
  if (c.wall) {
    const thickness = .62;
    const segments = [
      [0, -c.h * .55, c.w * 1.1, thickness], [0, c.h * .55, c.w * 1.1, thickness],
      [-c.w * .55, 0, thickness, c.h * 1.1], [c.w * .55, 0, thickness, c.h * 1.1]
    ];
    for (let p = 0; p < segments.length; p++) {
      if (p === c.id % 4 && seed(c.id * 53 + p) > .45) continue;
      const [dx, dy, w, h] = segments[p];
      const [lon, lat] = offsetLngLat(c.lon, c.lat, dx, dy, c.ang);
      features.push(feature(lon, lat, w, h, c.ang, {
        kind: 'compound-wall', compound: c.id, height: 1.55 + seed(c.id * 61 + p) * .55,
        base_height: 0, tone, start_year: c.born, confidence: 'interpretive', aligned_to_raster: true
      }));
    }
  }
}

// Central early mosque: courtyard enclosure rather than a solid box.
const mosqueW = 34, mosqueH = 31, mosqueA = .02, wallT = .7;
const mosqueSegments = [
  [0, -mosqueH / 2, mosqueW, wallT], [0, mosqueH / 2, mosqueW, wallT],
  [-mosqueW / 2, 0, wallT, mosqueH], [mosqueW / 2, 0, wallT, mosqueH]
];
for (const [dx, dy, w, h] of mosqueSegments) {
  const [lon, lat] = offsetLngLat(center.lon, center.lat, dx, dy, mosqueA);
  features.push(feature(lon, lat, w, h, mosqueA, { kind: 'early-mosque', height: 2.8, base_height: 0, tone: 6, start_year: 622, confidence: 'interpretive', aligned_to_raster: true }));
}
const shadeCenter = offsetLngLat(center.lon, center.lat, 0, mosqueH * .27, mosqueA);
features.push(feature(shadeCenter[0], shadeCenter[1], 24, 3.2, mosqueA, { kind: 'mosque-shade', height: 3.05, base_height: 0, tone: 7, start_year: 622, confidence: 'interpretive', aligned_to_raster: true }));

// Eastern chamber-like blocks follow the same V3 raster positions. Count/chronology remain interpretive.
for (let i = 0; i < 9; i++) {
  features.push(feature(39.61179, 24.46777 - i * .000075, 5.1, 4.1, mosqueA, {
    kind: 'hujra', height: 2.35 + (i % 3) * .12, base_height: 0, tone: 5,
    start_year: i < 7 ? 622 : 627, confidence: 'interpretive', aligned_to_raster: true
  }));
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'buildings.geojson'), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Generated ${features.length} raster-aligned 3D reconstruction features.`);
