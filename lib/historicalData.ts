export type HistoricalConfidence = 'documented' | 'high' | 'plausible' | 'unknown';

export type HistoricalPlace = {
  id: string;
  name: string;
  type: 'settlement' | 'well' | 'farm' | 'route' | 'mosque-area' | 'terrain' | 'market' | 'residential';
  coordinates: [number, number];
  confidence: HistoricalConfidence;
  description: string;
};

export const MADINAH_CENTER: [number, number] = [39.6111, 24.4672];

export const places: HistoricalPlace[] = [
  { id: 'central-settlement', name: 'التجمع المركزي التاريخي', type: 'settlement', coordinates: [39.6111, 24.4672], confidence: 'plausible', description: 'إعادة بناء تعليمية تقريبية للتجمع العمراني المركزي، وليست مسحًا أثريًا قطعيًا.' },
  { id: 'early-mosque-area', name: 'منطقة المسجد في المرحلة المبكرة', type: 'mosque-area', coordinates: [39.6114, 24.4675], confidence: 'high', description: 'تمثيل تعليمي للمسجد في المرحلة المبكرة بمواد محلية بسيطة ومن دون إسقاط الهيئة الحديثة للمسجد على القرن السابع.' },
  { id: 'hujurat-east', name: 'الحجرات شرقي المسجد', type: 'residential', coordinates: [39.61178, 24.46748], confidence: 'high', description: 'موضع تقريبي للحجرات المتصلة بالجانب الشرقي من المسجد. الهيئة والأبعاد البصرية تقريبية ومقيدة بوصف العمارة البسيطة في المصادر.' },
  { id: 'manakha-market', name: 'سوق المناخة', type: 'market', coordinates: [39.6099, 24.4671], confidence: 'high', description: 'تمثيل تقريبي للسوق المفتوح غرب المسجد، بلا صفوف دكاكين حجرية ثابتة، مع فضاء ترابي ومسارات قوافل مؤقتة.' },
  { id: 'baqi-direction', name: 'المسار نحو البقيع', type: 'route', coordinates: [39.6131, 24.4668], confidence: 'plausible', description: 'مسار تعليمي تقريبي يوضح اتصال المركز بمحيطه الشرقي، وليس إعادة رسم لمسار أثري قطعي.' },
  { id: 'oasis-west', name: 'بساتين الواحة الغربية', type: 'farm', coordinates: [39.6035, 24.467], confidence: 'plausible', description: 'منطقة زراعية معاد بناؤها بصريًا حول النخيل والآبار ومسارات الخدمة.' },
  { id: 'harrah-east', name: 'الحرة الشرقية', type: 'terrain', coordinates: [39.625, 24.468], confidence: 'high', description: 'إشارة إلى نطاق الحرة القديمة شرقي الواحة ضمن السياق الجغرافي العام، من دون تصوير ثوران أو حمم حديثة داخل مركز المدينة.' }
];

function seeded(i: number) { const x = Math.sin(i * 999.91) * 43758.5453; return x - Math.floor(x); }
function rotatePoint(x: number, y: number, angle: number) { const c = Math.cos(angle), s = Math.sin(angle); return [x * c - y * s, x * s + y * c] as const; }
function rectanglePolygon(lng: number, lat: number, widthM: number, depthM: number, angle: number) {
  const metersPerLng = 101500, metersPerLat = 111320, hw = widthM / 2, hd = depthM / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]].map(([x, y]) => {
    const [rx, ry] = rotatePoint(x, y, angle);
    return [lng + rx / metersPerLng, lat + ry / metersPerLat];
  });
}
function offsetMeters(lng: number, lat: number, dx: number, dy: number, angle: number) {
  const [rx, ry] = rotatePoint(dx, dy, angle);
  return [lng + rx / 101500, lat + ry / 111320] as [number, number];
}

export function makeHistoricalGeoJSON() {
  const buildings: GeoJSON.Feature[] = [];
  const palms: GeoJSON.Feature[] = [];
  const wells: GeoJSON.Feature[] = [];
  const streets: GeoJSON.Feature[] = [];
  const farms: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];

  const pushBuilding = (lng: number, lat: number, width: number, depth: number, angle: number, props: Record<string, unknown>) => {
    buildings.push({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [rectanglePolygon(lng, lat, width, depth, angle)] } });
  };

  const clusters = [
    { lng: 39.6111, lat: 24.4672, count: 105, spreadLng: 0.0048, spreadLat: 0.0039, angle: 0.05 },
    { lng: 39.6064, lat: 24.4700, count: 54, spreadLng: 0.0031, spreadLat: 0.0027, angle: -0.18 },
    { lng: 39.6158, lat: 24.4638, count: 50, spreadLng: 0.0032, spreadLat: 0.0026, angle: 0.22 },
    { lng: 39.6142, lat: 24.4708, count: 34, spreadLng: 0.0027, spreadLat: 0.0024, angle: -0.12 },
  ];

  let idx = 0;
  for (const cluster of clusters) {
    const cols = Math.ceil(Math.sqrt(cluster.count * 1.15));
    const rows = Math.ceil(cluster.count / cols);
    for (let i = 0; i < cluster.count; i++, idx++) {
      const col = i % cols, row = Math.floor(i / cols);
      const nx = cols <= 1 ? 0 : col / (cols - 1) - 0.5;
      const ny = rows <= 1 ? 0 : row / (rows - 1) - 0.5;
      const jitterLng = (seeded(idx * 19 + 1) - 0.5) * 0.00015;
      const jitterLat = (seeded(idx * 19 + 2) - 0.5) * 0.00013;
      const [rx, ry] = rotatePoint(nx * cluster.spreadLng, ny * cluster.spreadLat, cluster.angle);
      const lng = cluster.lng + rx + jitterLng, lat = cluster.lat + ry + jitterLat;
      const angle = cluster.angle + (seeded(idx * 19 + 3) - 0.5) * 0.22;
      const compoundW = 13 + seeded(idx * 19 + 4) * 19;
      const compoundD = 11 + seeded(idx * 19 + 5) * 17;
      const baseH = 2.6 + seeded(idx * 19 + 6) * 1.45;
      const startYear = idx % 9 < 5 ? 622 : idx % 9 < 8 ? 627 : 630;
      const tone = idx % 5;
      const wall = 0.55 + seeded(idx * 19 + 7) * 0.25;

      // Ring-like low mud-brick compound around an open courtyard.
      const sides = [
        { dx: 0, dy: -compoundD * .34, w: compoundW * (.48 + seeded(idx * 31 + 1) * .18), d: compoundD * .25 },
        { dx: compoundW * .35, dy: 0, w: compoundW * .24, d: compoundD * (.42 + seeded(idx * 31 + 2) * .2) },
        { dx: 0, dy: compoundD * .34, w: compoundW * (.42 + seeded(idx * 31 + 3) * .2), d: compoundD * .24 },
        { dx: -compoundW * .35, dy: 0, w: compoundW * .23, d: compoundD * (.34 + seeded(idx * 31 + 4) * .2) },
      ];
      const activeSides = 2 + Math.floor(seeded(idx * 31 + 5) * 3);
      sides.slice(0, activeSides).forEach((part, p) => {
        const [plng, plat] = offsetMeters(lng, lat, part.dx, part.dy, angle);
        pushBuilding(plng, plat, part.w, part.d, angle, {
          kind: 'mud-house', compound: idx, part: p, height: baseH + seeded(idx * 41 + p) * .55,
          base_height: 0, tone, confidence: 'plausible', start_year: startYear, roof: 'flat-earth'
        });
      });

      // Short perimeter wall segments create an actual compound silhouette in 3D.
      if (seeded(idx * 19 + 8) > .28) {
        const segments = [
          { dx: 0, dy: -compoundD * .5, w: compoundW, d: wall },
          { dx: 0, dy: compoundD * .5, w: compoundW, d: wall },
          { dx: -compoundW * .5, dy: 0, w: wall, d: compoundD },
          { dx: compoundW * .5, dy: 0, w: wall, d: compoundD },
        ];
        segments.forEach((seg, p) => {
          // Leave one gate gap by skipping a wall segment on some compounds.
          if (p === idx % 4 && seeded(idx * 53 + p) > .45) return;
          const [wlng, wlat] = offsetMeters(lng, lat, seg.dx, seg.dy, angle);
          pushBuilding(wlng, wlat, seg.w, seg.d, angle, {
            kind: 'compound-wall', compound: idx, height: 1.55 + seeded(idx * 61 + p) * .55,
            base_height: 0, tone, confidence: 'plausible', start_year: startYear, roof: 'wall-cap'
          });
        });
      }

      // Small service annex, storage or animal shelter, only on some compounds.
      if (seeded(idx * 19 + 9) > .52) {
        const [alng, alat] = offsetMeters(lng, lat, compoundW * .18, compoundD * .12, angle);
        pushBuilding(alng, alat, 4 + seeded(idx * 67) * 4.5, 3.5 + seeded(idx * 71) * 4, angle + .08, {
          kind: 'annex', compound: idx, height: 2.0 + seeded(idx * 73) * .7, base_height: 0, tone: (tone + 1) % 5,
          confidence: 'plausible', start_year: startYear, roof: 'light-cover'
        });
      }
    }
  }

  // Early mosque: deliberately low and visually distinct from residential compounds.
  pushBuilding(39.6114, 24.4675, 34, 31, 0.02, {
    kind: 'early-mosque', height: 2.95, base_height: 0, tone: 6, confidence: 'high', start_year: 622, roof: 'courtyard-enclosure'
  });
  // Simple shaded prayer-side strip to break the single-box silhouette.
  pushBuilding(39.6114, 24.46737, 27, 5.2, 0.02, {
    kind: 'mosque-shade', height: 3.15, base_height: 0, tone: 7, confidence: 'plausible', start_year: 622, roof: 'palm-trunk-shade'
  });

  for (let i = 0; i < 8; i++) {
    const lat = 24.46777 - i * 0.000075;
    const startYear = i < 4 ? 622 : i < 6 ? 625 : 627;
    pushBuilding(39.61179, lat, 5.1, 4.1, 0.02, {
      kind: 'hujra', height: 2.45 + (i % 3) * .12, base_height: 0, tone: 5, confidence: 'high', start_year: startYear, roof: 'simple-flat'
    });
  }

  const mainStreets: [number, number][][] = [
    [[39.595,24.458],[39.601,24.462],[39.606,24.465],[39.611,24.467],[39.617,24.471],[39.624,24.476]],
    [[39.600,24.481],[39.605,24.474],[39.611,24.467],[39.616,24.461],[39.621,24.454]],
    [[39.596,24.469],[39.603,24.469],[39.611,24.467],[39.619,24.466],[39.627,24.464]],
  ];
  mainStreets.forEach((coords, i) => streets.push({ type: 'Feature', properties: { kind: 'main-path', width: 4.2, i }, geometry: { type: 'LineString', coordinates: coords } }));

  const localCenters = [[39.6111,24.4672],[39.6064,24.4700],[39.6158,24.4638],[39.6142,24.4708]];
  localCenters.forEach(([lng, lat], c) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + c * 0.27, len = 0.0010 + seeded(c * 50 + i) * 0.0015;
      streets.push({ type: 'Feature', properties: { kind: 'local-path', width: 2.1, i: c * 10 + i }, geometry: { type: 'LineString', coordinates: [[lng - Math.cos(a) * len * 0.25, lat - Math.sin(a) * len * 0.20],[lng + Math.cos(a) * len, lat + Math.sin(a) * len * 0.78]] } });
    }
  });

  const farmPolys = [
    [[39.596,24.459],[39.604,24.459],[39.605,24.468],[39.599,24.472],[39.594,24.468],[39.596,24.459]],
    [[39.615,24.456],[39.622,24.456],[39.625,24.463],[39.621,24.469],[39.615,24.466],[39.615,24.456]],
    [[39.600,24.472],[39.607,24.475],[39.610,24.482],[39.603,24.485],[39.597,24.480],[39.600,24.472]],
  ];
  farmPolys.forEach((coords, i) => farms.push({ type: 'Feature', properties: { kind: 'farm', i }, geometry: { type: 'Polygon', coordinates: [coords] } }));

  for (let i = 0; i < 210; i++) {
    const a = seeded(i + 100) * Math.PI * 2, r = 0.0025 + seeded(i + 130) * 0.0105, westBias = i % 3 === 0 ? -0.004 : 0.0015;
    palms.push({ type: 'Feature', properties: { kind: 'palm', i }, geometry: { type: 'Point', coordinates: [MADINAH_CENTER[0] + Math.cos(a) * r + westBias, MADINAH_CENTER[1] + Math.sin(a) * r * 0.8] } });
  }

  [[39.6072,24.4681],[39.6144,24.4649],[39.6028,24.4633],[39.6181,24.4702]].forEach((c, i) => wells.push({ type: 'Feature', properties: { kind: 'well', i }, geometry: { type: 'Point', coordinates: c } }));
  places.forEach((p) => labels.push({ type: 'Feature', properties: { name: p.name, type: p.type, confidence: p.confidence }, geometry: { type: 'Point', coordinates: p.coordinates } }));

  return {
    buildings: { type: 'FeatureCollection', features: buildings } as GeoJSON.FeatureCollection,
    palms: { type: 'FeatureCollection', features: palms } as GeoJSON.FeatureCollection,
    wells: { type: 'FeatureCollection', features: wells } as GeoJSON.FeatureCollection,
    streets: { type: 'FeatureCollection', features: streets } as GeoJSON.FeatureCollection,
    farms: { type: 'FeatureCollection', features: farms } as GeoJSON.FeatureCollection,
    labels: { type: 'FeatureCollection', features: labels } as GeoJSON.FeatureCollection,
  };
}
