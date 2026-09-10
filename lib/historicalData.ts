export type HistoricalConfidence = 'documented' | 'high' | 'plausible' | 'unknown';

export type HistoricalPlace = {
  id: string;
  name: string;
  type: 'settlement' | 'well' | 'farm' | 'route' | 'mosque-area' | 'terrain';
  coordinates: [number, number];
  confidence: HistoricalConfidence;
  description: string;
};

export const MADINAH_CENTER: [number, number] = [39.6111, 24.4672];

export const places: HistoricalPlace[] = [
  {
    id: 'central-settlement',
    name: 'التجمع المركزي التاريخي',
    type: 'settlement',
    coordinates: [39.6111, 24.4672],
    confidence: 'plausible',
    description: 'إعادة بناء تعليمية تقريبية للتجمع العمراني المركزي، وليست مسحًا أثريًا قطعيًا.'
  },
  {
    id: 'early-mosque-area',
    name: 'منطقة المسجد في المرحلة المبكرة',
    type: 'mosque-area',
    coordinates: [39.6114, 24.4675],
    confidence: 'high',
    description: 'موضع تعليمي تقريبي ضمن نموذج زمني مبكر، مع تجنب إسقاط الهيئة الحديثة للمسجد.'
  },
  {
    id: 'oasis-west',
    name: 'بساتين الواحة الغربية',
    type: 'farm',
    coordinates: [39.6035, 24.467],
    confidence: 'plausible',
    description: 'منطقة زراعية معاد بناؤها بصريًا حول النخيل والآبار ومسارات الخدمة.'
  },
  {
    id: 'harrah-east',
    name: 'الحرة الشرقية',
    type: 'terrain',
    coordinates: [39.625, 24.468],
    confidence: 'high',
    description: 'تمثيل بصري مبسط للأرض البركانية شرق الواحة.'
  }
];

function seeded(i: number) {
  const x = Math.sin(i * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

function rotatePoint(x: number, y: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c] as const;
}

function rectanglePolygon(lng: number, lat: number, widthM: number, depthM: number, angle: number) {
  const metersPerLng = 101500;
  const metersPerLat = 111320;
  const hw = widthM / 2;
  const hd = depthM / 2;
  const corners = [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]
  ].map(([x, y]) => {
    const [rx, ry] = rotatePoint(x, y, angle);
    return [lng + rx / metersPerLng, lat + ry / metersPerLat];
  });
  return corners;
}

export function makeHistoricalGeoJSON() {
  const buildings: GeoJSON.Feature[] = [];
  const palms: GeoJSON.Feature[] = [];
  const wells: GeoJSON.Feature[] = [];
  const streets: GeoJSON.Feature[] = [];
  const farms: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];

  // Dense, irregular settlement clusters. These are reconstruction geometry, not claims of exact footprints.
  const clusters = [
    { lng: 39.6111, lat: 24.4672, count: 92, spreadLng: 0.0042, spreadLat: 0.0033 },
    { lng: 39.6064, lat: 24.4700, count: 38, spreadLng: 0.0025, spreadLat: 0.0022 },
    { lng: 39.6158, lat: 24.4638, count: 34, spreadLng: 0.0027, spreadLat: 0.0020 },
  ];

  let idx = 0;
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++, idx++) {
      const lng = cluster.lng + (seeded(idx * 7 + 1) - 0.5) * cluster.spreadLng;
      const lat = cluster.lat + (seeded(idx * 7 + 2) - 0.5) * cluster.spreadLat;
      const width = 7 + seeded(idx * 7 + 3) * 12;
      const depth = 6 + seeded(idx * 7 + 4) * 11;
      const height = 2.8 + seeded(idx * 7 + 5) * 2.6;
      const angle = (seeded(idx * 7 + 6) - 0.5) * 0.5;
      buildings.push({
        type: 'Feature',
        properties: {
          kind: 'house',
          height,
          base_height: 0,
          tone: idx % 4,
          confidence: 'plausible',
        },
        geometry: { type: 'Polygon', coordinates: [rectanglePolygon(lng, lat, width, depth, angle)] }
      });
    }
  }

  // Historical path network rendered with road casing + fill, visually closer to a proper map.
  const streetSets: [number, number][][] = [
    [[39.595,24.458],[39.601,24.462],[39.606,24.465],[39.611,24.467],[39.617,24.471],[39.624,24.476]],
    [[39.600,24.481],[39.605,24.474],[39.611,24.467],[39.616,24.461],[39.621,24.454]],
    [[39.596,24.469],[39.603,24.469],[39.611,24.467],[39.619,24.466],[39.627,24.464]],
    [[39.604,24.458],[39.607,24.463],[39.610,24.468],[39.613,24.474]],
    [[39.608,24.474],[39.611,24.471],[39.614,24.468],[39.618,24.466]],
    [[39.603,24.465],[39.606,24.467],[39.609,24.469],[39.612,24.470]],
    [[39.609,24.463],[39.611,24.465],[39.614,24.467],[39.617,24.470]],
  ];
  streetSets.forEach((coords, i) => streets.push({
    type: 'Feature',
    properties: { kind: i < 3 ? 'main-path' : 'local-path', width: i < 3 ? 3.2 : 1.8 },
    geometry: { type: 'LineString', coordinates: coords }
  }));

  // Oasis/agriculture polygons.
  const farmPolys = [
    [[39.596,24.459],[39.604,24.459],[39.605,24.468],[39.599,24.472],[39.594,24.468],[39.596,24.459]],
    [[39.615,24.456],[39.622,24.456],[39.625,24.463],[39.621,24.469],[39.615,24.466],[39.615,24.456]],
    [[39.600,24.472],[39.607,24.475],[39.610,24.482],[39.603,24.485],[39.597,24.480],[39.600,24.472]],
  ];
  farmPolys.forEach((coords, i) => farms.push({
    type: 'Feature',
    properties: { kind: 'farm', i },
    geometry: { type: 'Polygon', coordinates: [coords] }
  }));

  for (let i = 0; i < 240; i++) {
    const a = seeded(i + 100) * Math.PI * 2;
    const r = 0.002 + seeded(i + 130) * 0.0105;
    const westBias = i % 3 === 0 ? -0.004 : 0.0015;
    const lng = MADINAH_CENTER[0] + Math.cos(a) * r + westBias;
    const lat = MADINAH_CENTER[1] + Math.sin(a) * r * 0.8;
    palms.push({ type: 'Feature', properties: { kind: 'palm', i }, geometry: { type: 'Point', coordinates: [lng, lat] } });
  }

  [[39.6072,24.4681],[39.6144,24.4649],[39.6028,24.4633],[39.6181,24.4702]].forEach((c, i) => {
    wells.push({ type: 'Feature', properties: { kind: 'well', i }, geometry: { type: 'Point', coordinates: c } });
  });

  places.forEach((p) => labels.push({
    type: 'Feature',
    properties: { name: p.name, type: p.type, confidence: p.confidence },
    geometry: { type: 'Point', coordinates: p.coordinates }
  }));

  return {
    buildings: { type: 'FeatureCollection', features: buildings } as GeoJSON.FeatureCollection,
    palms: { type: 'FeatureCollection', features: palms } as GeoJSON.FeatureCollection,
    wells: { type: 'FeatureCollection', features: wells } as GeoJSON.FeatureCollection,
    streets: { type: 'FeatureCollection', features: streets } as GeoJSON.FeatureCollection,
    farms: { type: 'FeatureCollection', features: farms } as GeoJSON.FeatureCollection,
    labels: { type: 'FeatureCollection', features: labels } as GeoJSON.FeatureCollection,
  };
}
