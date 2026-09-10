import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'public', 'reconstruction', 'buildings.geojson');
const center = { lon: 39.6114, lat: 24.4675 };
const mosqueA = 0.02;

function seed(n) { const x = Math.sin(n * 7919.37) * 43758.5453; return x - Math.floor(x); }
function rotOffset(dx, dy, a) { const c = Math.cos(a), s = Math.sin(a); return [dx * c - dy * s, dx * s + dy * c]; }
function offsetLngLat(lon, lat, dx, dy, angle = 0) {
  const [rx, ry] = rotOffset(dx, dy, angle);
  return [lon + rx / 101500, lat + ry / 111320];
}
function rectangle(lon, lat, widthM, depthM, angle = 0) {
  const hw = widthM / 2, hd = depthM / 2;
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd],[-hw,-hd]].map(([x,y]) => offsetLngLat(lon, lat, x, y, angle));
}
function feature(lon, lat, width, depth, angle, properties) {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [rectangle(lon, lat, width, depth, angle)] } };
}
function props(kind, extra = {}) {
  return { kind, confidence: 'interpretive', aligned_to_raster: true, close_detail: true, ...extra };
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const features = data.features;
const original = [...features];

// Add restrained rooftop parapet fragments to a subset of houses so close zoom gains depth
// without turning every compound into a repetitive procedural model.
let houseIndex = 0;
for (const f of original) {
  if (f.properties?.kind !== 'mud-house') continue;
  const i = houseIndex++;
  if (i % 5 !== 0) continue;
  const ring = f.geometry.coordinates[0];
  const a = ring[0], b = ring[1], d = ring[3];
  const cx = ring.slice(0, -1).reduce((s, p) => s + p[0], 0) / 4;
  const cy = ring.slice(0, -1).reduce((s, p) => s + p[1], 0) / 4;
  const width = Math.hypot((b[0] - a[0]) * 101500, (b[1] - a[1]) * 111320);
  const depth = Math.hypot((d[0] - a[0]) * 101500, (d[1] - a[1]) * 111320);
  const angle = Math.atan2((b[1] - a[1]) * 111320, (b[0] - a[0]) * 101500);
  const top = Number(f.properties.height || 3);
  const t = 0.22;
  const strips = [[0,-depth/2,width,t],[0,depth/2,width,t],[-width/2,0,t,depth],[width/2,0,t,depth]];
  for (let s = 0; s < strips.length; s++) {
    if (s === i % 4) continue;
    const [dx,dy,w,h] = strips[s];
    const [lon,lat] = offsetLngLat(cx, cy, dx, dy, angle);
    features.push(feature(lon, lat, w, h, angle, props('mud-house', {
      detail_role: 'roof-parapet', compound: f.properties.compound, tone: f.properties.tone,
      start_year: f.properties.start_year, base_height: top, height: top + 0.28
    })));
  }
}

// Add occasional courtyard shade structures. They remain generic and interpretive.
for (let i = 0; i < 48; i++) {
  const base = original[(i * 17) % original.length];
  if (!base || base.properties?.kind !== 'mud-house') continue;
  const ring = base.geometry.coordinates[0];
  const cx = ring.slice(0, -1).reduce((s, p) => s + p[0], 0) / 4;
  const cy = ring.slice(0, -1).reduce((s, p) => s + p[1], 0) / 4;
  const angle = (seed(i * 13) - .5) * .5;
  const [lon,lat] = offsetLngLat(cx, cy, 5 + seed(i * 7) * 5, (seed(i * 11) - .5) * 7, angle);
  const start = base.properties.start_year ?? 622;
  features.push(feature(lon, lat, 3.6 + seed(i) * 2.8, 2.2 + seed(i + 1) * 1.7, angle, props('annex', {
    detail_role: 'courtyard-awning', start_year: start, tone: base.properties.tone,
    base_height: 2.05, height: 2.18
  })));
  for (const [px,py] of [[-1.4,-.8],[1.4,-.8],[-1.4,.8],[1.4,.8]]) {
    const [plon,plat] = offsetLngLat(lon, lat, px, py, angle);
    features.push(feature(plon, plat, .22, .22, angle, props('compound-wall', {
      detail_role: 'awning-post', start_year: start, tone: base.properties.tone,
      base_height: 0, height: 2.08
    })));
  }
}

// Early mosque shade: separate canopy slab from palm-trunk-like supports.
const shadeCenter = offsetLngLat(center.lon, center.lat, 0, 31 * .27, mosqueA);
for (let i = 0; i < 7; i++) {
  const x = -9 + i * 3;
  const [lon,lat] = offsetLngLat(shadeCenter[0], shadeCenter[1], x, 0, mosqueA);
  features.push(feature(lon, lat, .28, .28, mosqueA, props('mosque-shade', {
    detail_role: 'shade-post', start_year: 622, tone: 7, base_height: 0, height: 3.0
  })));
}
features.push(feature(shadeCenter[0], shadeCenter[1], 24, 3.2, mosqueA, props('mosque-shade', {
  detail_role: 'shade-canopy', start_year: 622, tone: 7, base_height: 2.92, height: 3.08
})));

// Open market west of the early mosque: temporary-looking shade stalls and posts, not masonry shops.
const market = { lon: 39.60988, lat: 24.46710, angle: -0.08 };
for (let i = 0; i < 16; i++) {
  const dx = (seed(700 + i * 5) - .5) * 78;
  const dy = (seed(701 + i * 5) - .5) * 34;
  const [lon,lat] = offsetLngLat(market.lon, market.lat, dx, dy, market.angle);
  const born = i < 8 ? 622 : i < 12 ? 627 : 632;
  const w = 2.8 + seed(900 + i) * 3.4;
  const d = 2.0 + seed(930 + i) * 1.8;
  const angle = market.angle + (seed(950 + i) - .5) * .55;
  features.push(feature(lon, lat, w, d, angle, props('annex', {
    detail_role: 'market-canopy', start_year: born, tone: i % 4,
    base_height: 2.0, height: 2.14
  })));
  for (const [px,py] of [[-w*.42,-d*.42],[w*.42,-d*.42],[-w*.42,d*.42],[w*.42,d*.42]]) {
    const [plon,plat] = offsetLngLat(lon, lat, px, py, angle);
    features.push(feature(plon, plat, .18, .18, angle, props('compound-wall', {
      detail_role: 'market-post', start_year: born, tone: i % 4,
      base_height: 0, height: 2.02
    })));
  }
}

data.features = features;
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Enriched reconstruction with ${features.length - original.length} close-range architectural details.`);
