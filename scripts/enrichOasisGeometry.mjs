import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'public', 'reconstruction', 'buildings.geojson');
const farms = [
  [39.6010,24.4690,.0075,.0060],
  [39.6168,24.4617,.0068,.0050],
  [39.6042,24.4790,.0060,.0046],
  [39.6125,24.4746,.0044,.0034]
];

function seed(n) { const x = Math.sin(n * 6151.731) * 43758.5453; return x - Math.floor(x); }
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
  return { kind, confidence: 'interpretive', aligned_to_raster: true, oasis_detail: true, start_year: 622, ...extra };
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const features = data.features;
const before = features.length;

for (let fi = 0; fi < farms.length; fi++) {
  const [lon, lat, rx, ry] = farms[fi];
  const widthM = rx * 101500 * 1.36;
  const depthM = ry * 111320 * 1.32;
  const angle = (seed(fi * 31 + 3) - .5) * .24;

  // Low earthen field edges. These are visual reconstruction cues, not claimed parcel boundaries.
  const edgeT = .42;
  const edgeSegments = [
    [0, -depthM / 2, widthM, edgeT],
    [0, depthM / 2, widthM, edgeT],
    [-widthM / 2, 0, edgeT, depthM],
    [widthM / 2, 0, edgeT, depthM]
  ];
  for (let e = 0; e < edgeSegments.length; e++) {
    const [dx, dy, w, h] = edgeSegments[e];
    const [elng, elat] = offsetLngLat(lon, lat, dx, dy, angle);
    features.push(feature(elng, elat, w, h, angle, props('farm-boundary', {
      detail_role: 'earthen-field-edge', farm: fi, tone: 1,
      base_height: 0, height: .34 + seed(fi * 41 + e) * .22
    })));
  }

  // Narrow irrigation channels crossing the grove. Slight spacing variation avoids a modern grid look.
  const channels = 11;
  for (let i = 0; i < channels; i++) {
    const t = channels === 1 ? 0 : i / (channels - 1);
    const dy = (t - .5) * depthM * .78 + (seed(fi * 101 + i * 7) - .5) * 7;
    const dx = (seed(fi * 107 + i * 11) - .5) * 15;
    const [clng, clat] = offsetLngLat(lon, lat, dx, dy, angle);
    features.push(feature(clng, clat, widthM * (.48 + seed(fi * 113 + i) * .25), .48 + seed(fi * 127 + i) * .35, angle, props('irrigation-channel', {
      detail_role: 'shallow-irrigation-cut', farm: fi, tone: 2,
      base_height: 0, height: .035 + seed(fi * 131 + i) * .025
    })));
  }

  // A few wider service paths through each grove, deliberately irregular and sparse.
  for (let i = 0; i < 4; i++) {
    const vertical = i % 2 === 0;
    const offset = (seed(fi * 151 + i * 13) - .5) * (vertical ? widthM : depthM) * .46;
    const [plng, plat] = offsetLngLat(lon, lat, vertical ? offset : 0, vertical ? 0 : offset, angle);
    features.push(feature(
      plng,
      plat,
      vertical ? 1.8 + seed(fi * 163 + i) * 1.1 : widthM * (.42 + seed(fi * 167 + i) * .18),
      vertical ? depthM * (.40 + seed(fi * 173 + i) * .20) : 1.8 + seed(fi * 179 + i) * 1.1,
      angle,
      props('farm-path', {
        detail_role: 'grove-service-path', farm: fi, tone: 4,
        base_height: 0, height: .018
      })
    ));
  }

  // Small raised soil beds provide depth changes near close zoom without pretending exact agriculture layouts.
  for (let i = 0; i < 10; i++) {
    const dx = (seed(fi * 211 + i * 17) - .5) * widthM * .64;
    const dy = (seed(fi * 223 + i * 19) - .5) * depthM * .64;
    const [blng, blat] = offsetLngLat(lon, lat, dx, dy, angle);
    features.push(feature(blng, blat, 8 + seed(fi * 227 + i) * 18, 5 + seed(fi * 229 + i) * 12, angle + (seed(fi * 233 + i) - .5) * .22, props('farm-bed', {
      detail_role: 'cultivated-soil-bed', farm: fi, tone: i % 2 ? 3 : 4,
      base_height: 0, height: .07 + seed(fi * 239 + i) * .08
    })));
  }
}

data.features = features;
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Added ${features.length - before} interpretive oasis irrigation, field-edge and service-path features.`);
