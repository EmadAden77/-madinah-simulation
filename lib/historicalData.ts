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
    description: 'تمثيل تقريبي للتجمع العمراني المركزي ضمن إعادة بناء تعليمية غير قطعية.'
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
    name: 'واحة وبساتين غربية',
    type: 'farm',
    coordinates: [39.6035, 24.467],
    confidence: 'plausible',
    description: 'إعادة بناء لبيئة زراعية قائمة على النخيل والآبار ومسارات الخدمة.'
  },
  {
    id: 'harrah-east',
    name: 'أرض بركانية شرقية',
    type: 'terrain',
    coordinates: [39.625, 24.468],
    confidence: 'high',
    description: 'تمثيل مبسط لحزام أرض بركانية يحيط بالواحة من الشرق.'
  }
];

export function makeHistoricalGeoJSON() {
  const houses: GeoJSON.Feature[] = [];
  const palms: GeoJSON.Feature[] = [];
  const wells: GeoJSON.Feature[] = [];
  const routes: GeoJSON.Feature[] = [];
  const farms: GeoJSON.Feature[] = [];

  const seeded = (i: number) => {
    const x = Math.sin(i * 999.91) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 58; i++) {
    const a = seeded(i) * Math.PI * 2;
    const r = 0.0012 + seeded(i + 3) * 0.0075;
    const lng = MADINAH_CENTER[0] + Math.cos(a) * r;
    const lat = MADINAH_CENTER[1] + Math.sin(a) * r * 0.72;
    houses.push({ type: 'Feature', properties: { kind: 'house', i }, geometry: { type: 'Point', coordinates: [lng, lat] } });
  }

  for (let i = 0; i < 180; i++) {
    const a = seeded(i + 100) * Math.PI * 2;
    const r = 0.002 + seeded(i + 130) * 0.011;
    const bias = i % 3 === 0 ? -0.004 : 0.002;
    const lng = MADINAH_CENTER[0] + Math.cos(a) * r + bias;
    const lat = MADINAH_CENTER[1] + Math.sin(a) * r * 0.8;
    palms.push({ type: 'Feature', properties: { kind: 'palm', i }, geometry: { type: 'Point', coordinates: [lng, lat] } });
  }

  [[39.6072,24.4681],[39.6144,24.4649],[39.6028,24.4633],[39.6181,24.4702]].forEach((c, i) => {
    wells.push({ type: 'Feature', properties: { kind: 'well', i }, geometry: { type: 'Point', coordinates: c } });
  });

  const routeSets = [
    [[39.591,24.457],[39.601,24.462],[39.611,24.467],[39.622,24.474],[39.633,24.483]],
    [[39.598,24.481],[39.606,24.473],[39.611,24.467],[39.617,24.459],[39.625,24.451]],
    [[39.592,24.47],[39.602,24.469],[39.611,24.467],[39.619,24.466],[39.63,24.464]]
  ];
  routeSets.forEach((coords, i) => routes.push({ type: 'Feature', properties: { kind: 'route', i }, geometry: { type: 'LineString', coordinates: coords } }));

  const farmPolys = [
    [[39.596,24.459],[39.604,24.459],[39.605,24.468],[39.599,24.472],[39.594,24.468],[39.596,24.459]],
    [[39.615,24.456],[39.622,24.456],[39.625,24.463],[39.621,24.469],[39.615,24.466],[39.615,24.456]],
    [[39.6,24.472],[39.607,24.475],[39.61,24.482],[39.603,24.485],[39.597,24.48],[39.6,24.472]]
  ];
  farmPolys.forEach((coords, i) => farms.push({ type: 'Feature', properties: { kind: 'farm', i }, geometry: { type: 'Polygon', coordinates: [coords] } }));

  return {
    houses: { type: 'FeatureCollection', features: houses } as GeoJSON.FeatureCollection,
    palms: { type: 'FeatureCollection', features: palms } as GeoJSON.FeatureCollection,
    wells: { type: 'FeatureCollection', features: wells } as GeoJSON.FeatureCollection,
    routes: { type: 'FeatureCollection', features: routes } as GeoJSON.FeatureCollection,
    farms: { type: 'FeatureCollection', features: farms } as GeoJSON.FeatureCollection,
  };
}
