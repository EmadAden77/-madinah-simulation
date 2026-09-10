import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'public', 'reconstruction', 'buildings.geojson');
const center = { lon: 39.6114, lat: 24.4675 };
const market = { lon: 39.60988, lat: 24.46710, angle: -0.08 };
const mosqueA = 0.02;

function seed(n) { const x = Math.sin(n * 8117.913) * 43758.5453; return x - Math.floor(x); }
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
  return { kind, confidence: 'interpretive', aligned_to_raster: true, landmark_detail: true, ...extra };
}
function centroid(featureLike) {
  const ring = featureLike.geometry.coordinates[0].slice(0, -1);
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const features = data.features;
const original = [...features];
const before = features.length;

// Market micro-structure: low display tables, ground mats and sparse tether rails.
// These are deliberately temporary-looking and generic rather than permanent masonry shops.
for (let i = 0; i < 22; i++) {
  const dx = (seed(1000 + i * 13) - .5) * 82;
  const dy = (seed(1001 + i * 13) - .5) * 38;
  const [lon, lat] = offsetLngLat(market.lon, market.lat, dx, dy, market.angle);
  const angle = market.angle + (seed(1002 + i * 13) - .5) * .7;
  const born = i < 12 ? 622 : i < 18 ? 627 : 632;

  features.push(feature(lon, lat, 1.6 + seed(1003 + i) * 1.5, .65 + seed(1004 + i) * .6, angle, props('annex', {
    detail_role: 'market-display-table', start_year: born, tone: i % 4,
    base_height: .58, height: .72 + seed(1005 + i) * .12
  })));

  const [mlon, mlat] = offsetLngLat(lon, lat, 0, 1.0 + seed(1006 + i) * .6, angle);
  features.push(feature(mlon, mlat, 2.1 + seed(1007 + i) * 2.1, 1.1 + seed(1008 + i) * 1.3, angle, props('annex', {
    detail_role: 'market-ground-mat', start_year: born, tone: 4,
    base_height: 0, height: .025
  })));
}

for (let i = 0; i < 7; i++) {
  const dx = -34 + i * 11 + (seed(1200 + i) - .5) * 4;
  const dy = 13 + (seed(1210 + i) - .5) * 8;
  const [lon, lat] = offsetLngLat(market.lon, market.lat, dx, dy, market.angle);
  features.push(feature(lon, lat, 6 + seed(1220 + i) * 4, .22, market.angle + .08, props('compound-wall', {
    detail_role: 'market-tether-rail', start_year: i < 4 ? 622 : 627, tone: 2,
    base_height: .72, height: .88
  })));
}

// Early mosque close detail: a second restrained line of palm-trunk-like supports and segmented shade strips.
// Placement is interpretive and intended only to improve close-range spatial legibility.
const shadeCenter = offsetLngLat(center.lon, center.lat, 0, 31 * .27, mosqueA);
for (let row = 0; row < 2; row++) {
  for (let i = 0; i < 7; i++) {
    const x = -9 + i * 3;
    const y = row === 0 ? -1.05 : 1.05;
    const [lon, lat] = offsetLngLat(shadeCenter[0], shadeCenter[1], x, y, mosqueA);
    features.push(feature(lon, lat, .24, .24, mosqueA, props('mosque-shade', {
      detail_role: 'inner-shade-post', start_year: 622, tone: 7,
      base_height: 0, height: 2.96 + seed(1300 + row * 10 + i) * .12
    })));
  }
}
for (let i = 0; i < 4; i++) {
  const x = -8.4 + i * 5.6;
  const [lon, lat] = offsetLngLat(shadeCenter[0], shadeCenter[1], x, 0, mosqueA);
  features.push(feature(lon, lat, 5.25, 3.0, mosqueA, props('mosque-shade', {
    detail_role: 'segmented-shade-panel', start_year: 622, tone: 7,
    base_height: 2.91, height: 3.06
  })));
}

// Residential micro-details sampled from existing houses: low thresholds and occasional lean-to shade roofs.
// They provide scale cues when the camera approaches compounds without claiming exact household layouts.
const houses = original.filter((f) => f.properties?.kind === 'mud-house');
for (let i = 0; i < houses.length; i += 11) {
  const house = houses[i];
  const [cx, cy] = centroid(house);
  const ring = house.geometry.coordinates[0];
  const a = ring[0], b = ring[1];
  const angle = Math.atan2((b[1] - a[1]) * 111320, (b[0] - a[0]) * 101500);
  const start = house.properties?.start_year ?? 622;
  const tone = house.properties?.tone ?? 1;

  const [tlon, tlat] = offsetLngLat(cx, cy, 0, 2.2 + seed(1500 + i) * 2.4, angle);
  features.push(feature(tlon, tlat, 1.25 + seed(1510 + i) * .7, .42, angle, props('annex', {
    detail_role: 'house-threshold', start_year: start, tone,
    base_height: 0, height: .13 + seed(1520 + i) * .08
  })));

  if (i % 22 === 0) {
    const [alon, alat] = offsetLngLat(cx, cy, 3.1 + seed(1530 + i) * 2.6, 0, angle);
    features.push(feature(alon, alat, 3.0 + seed(1540 + i) * 2.4, 1.8 + seed(1550 + i) * 1.2, angle, props('annex', {
      detail_role: 'house-lean-to-shade', start_year: start, tone,
      base_height: 1.85, height: 1.98
    })));
    for (const px of [-1.15, 1.15]) {
      const [plon, plat] = offsetLngLat(alon, alat, px, .65, angle);
      features.push(feature(plon, plat, .18, .18, angle, props('compound-wall', {
        detail_role: 'lean-to-post', start_year: start, tone,
        base_height: 0, height: 1.88
      })));
    }
  }
}

data.features = features;
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Added ${features.length - before} interpretive close-range landmark and residential details.`);
