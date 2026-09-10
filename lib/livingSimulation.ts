export type LivingKind = 'person' | 'camel' | 'horse' | 'donkey' | 'sheep' | 'goat';

type Route = [number, number][];

type LivingContext = {
  year: number;
  hour: number;
  tick: number;
};

const MARKET: Route = [[39.6089,24.4668],[39.6095,24.4670],[39.6102,24.46715],[39.6108,24.46725]];
const EAST_ROUTE: Route = [[39.6108,24.4673],[39.6120,24.4671],[39.6132,24.4668],[39.6145,24.4664],[39.6160,24.4660]];
const WEST_ROUTE: Route = [[39.6110,24.46735],[39.6096,24.46755],[39.6080,24.4678],[39.6064,24.4682],[39.6044,24.4687],[39.6026,24.4690]];
const SOUTH_ROUTE: Route = [[39.6111,24.4670],[39.6108,24.4659],[39.6103,24.4647],[39.6098,24.4635],[39.6093,24.4623]];
const FARM_ROUTE: Route = [[39.6002,24.4680],[39.6012,24.4686],[39.6024,24.4690],[39.6035,24.4692],[39.6048,24.4691]];

function seeded(n: number) {
  const x = Math.sin(n * 9271.73) * 43758.5453;
  return x - Math.floor(x);
}

function pointOnRoute(route: Route, progress: number): [number, number] {
  const p = ((progress % 1) + 1) % 1;
  const scaled = p * (route.length - 1);
  const i = Math.min(route.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const a = route[i], b = route[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function activityScale(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 0.62;
  if (h >= 8 && h < 12) return 1;
  if (h >= 12 && h < 15) return 0.78;
  if (h >= 15 && h < 18.5) return 0.92;
  if (h >= 18.5 && h < 21) return 0.42;
  return 0.12;
}

function pushAgents(features: GeoJSON.Feature[], route: Route, kind: LivingKind, count: number, speed: number, offset: number, ctx: LivingContext, zone: string) {
  const scale = activityScale(ctx.hour) * (0.78 + (ctx.year - 622) * 0.035);
  const visible = Math.max(0, Math.round(count * scale));
  for (let i = 0; i < visible; i++) {
    const progress = seeded(i * 17 + offset) + ctx.tick * speed + i / Math.max(1, visible);
    const [lng, lat] = pointOnRoute(route, progress);
    const jitterLng = (seeded(i * 37 + offset) - .5) * 0.00006;
    const jitterLat = (seeded(i * 43 + offset) - .5) * 0.00005;
    features.push({
      type: 'Feature',
      properties: { kind, zone, i, historical: 'generic-anonymous' },
      geometry: { type: 'Point', coordinates: [lng + jitterLng, lat + jitterLat] }
    });
  }
}

export function makeLivingSnapshot(ctx: LivingContext): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  pushAgents(features, MARKET, 'person', 24, 0.0009, 10, ctx, 'market');
  pushAgents(features, EAST_ROUTE, 'person', 12, 0.00055, 20, ctx, 'east-route');
  pushAgents(features, WEST_ROUTE, 'person', 11, 0.0005, 30, ctx, 'west-route');
  pushAgents(features, SOUTH_ROUTE, 'person', 8, 0.00045, 40, ctx, 'south-route');
  pushAgents(features, FARM_ROUTE, 'person', 9, 0.00032, 50, ctx, 'farms');

  pushAgents(features, WEST_ROUTE, 'camel', 5, 0.00024, 60, ctx, 'caravan');
  pushAgents(features, EAST_ROUTE, 'donkey', 4, 0.0003, 70, ctx, 'route');
  pushAgents(features, EAST_ROUTE, 'horse', 2, 0.00038, 80, ctx, 'route');
  pushAgents(features, FARM_ROUTE, 'sheep', 16, 0.00018, 90, ctx, 'pasture');
  pushAgents(features, FARM_ROUTE, 'goat', 9, 0.00021, 100, ctx, 'pasture');

  return { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection;
}
