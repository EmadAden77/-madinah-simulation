'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, MercatorCoordinate } from 'maplibre-gl';
import * as THREE from 'three';
import { MADINAH_CENTER, makeHistoricalGeoJSON, places } from '@/lib/historicalData';
import { calculatePrayerTimes } from '@/lib/prayerTimes';

type AgentKind = 'person' | 'sheep' | 'goat' | 'horse' | 'camel' | 'donkey' | 'shepherd';
type Agent = { kind: AgentKind; origin: [number, number]; speed: number; phase: number; mesh?: THREE.Object3D };

function seeded(i: number) {
  const x = Math.sin(i * 8128.173) * 43758.5453;
  return x - Math.floor(x);
}

function makeAgents(): Agent[] {
  const kinds: AgentKind[] = [
    ...Array(30).fill('person'), ...Array(3).fill('shepherd'), ...Array(32).fill('sheep'),
    ...Array(14).fill('goat'), ...Array(4).fill('horse'), ...Array(7).fill('camel'), ...Array(5).fill('donkey')
  ];
  return kinds.map((kind, i) => {
    const a = seeded(i + 500) * Math.PI * 2;
    const r = 0.0012 + seeded(i + 520) * 0.0055;
    return {
      kind,
      origin: [MADINAH_CENTER[0] + Math.cos(a) * r, MADINAH_CENTER[1] + Math.sin(a) * r * 0.72],
      speed: 0.22 + seeded(i + 540) * 0.42,
      phase: seeded(i + 550) * Math.PI * 2,
    };
  });
}

function createPerson(kind: AgentKind) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.92, 3, 6),
    new THREE.MeshLambertMaterial({ color: kind === 'shepherd' ? 0x6f5a3e : 0xd8cab0 })
  );
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8f664c }));
  head.position.y = 1.72;
  group.add(body, head);
  return group;
}

function createAnimal(kind: AgentKind) {
  const cfg: Record<string, { c: number; sx: number; sy: number; sz: number }> = {
    sheep: { c: 0xd8d2c2, sx: 0.80, sy: 0.56, sz: 0.43 },
    goat: { c: 0x8e795d, sx: 0.72, sy: 0.50, sz: 0.37 },
    horse: { c: 0x6e4933, sx: 1.25, sy: 0.88, sz: 0.48 },
    camel: { c: 0xa97b4f, sx: 1.35, sy: 1.08, sz: 0.50 },
    donkey: { c: 0x777064, sx: 0.95, sy: 0.70, sz: 0.40 },
  };
  const q = cfg[kind] ?? cfg.sheep;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshLambertMaterial({ color: q.c }));
  body.scale.set(q.sx, q.sy, q.sz);
  body.position.y = 0.58;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 7, 5), new THREE.MeshLambertMaterial({ color: q.c }));
  head.position.set(0.62 * q.sx, 0.72, 0);
  group.add(body, head);
  if (kind === 'camel') {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.31, 7, 5), new THREE.MeshLambertMaterial({ color: q.c }));
    hump.position.set(-0.08, 1.08, 0);
    group.add(hump);
  }
  return group;
}

function createLifeLayer(map: MapLibreMap, agents: Agent[]) {
  let scene: THREE.Scene;
  let camera: THREE.Camera;
  let renderer: THREE.WebGLRenderer;
  let world: THREE.Group;
  let last = performance.now();

  const anchor = MercatorCoordinate.fromLngLat({ lng: MADINAH_CENTER[0], lat: MADINAH_CENTER[1] }, 0);
  const meterScale = anchor.meterInMercatorCoordinateUnits();
  const local = (lng: number, lat: number) => {
    const m = MercatorCoordinate.fromLngLat({ lng, lat }, 0);
    return new THREE.Vector3((m.x - anchor.x) / meterScale, 0, -(m.y - anchor.y) / meterScale);
  };

  return {
    id: 'historical-life-3d', type: 'custom' as const, renderingMode: '3d' as const,
    onAdd(_map: MapLibreMap, gl: WebGL2RenderingContext) {
      scene = new THREE.Scene(); camera = new THREE.Camera(); world = new THREE.Group(); scene.add(world);
      scene.add(new THREE.HemisphereLight(0xffefd4, 0x4d4032, 2));
      const sun = new THREE.DirectionalLight(0xffdfaa, 2.4); sun.position.set(-35, 70, 25); scene.add(sun);
      agents.forEach((agent, i) => {
        const mesh = agent.kind === 'person' || agent.kind === 'shepherd' ? createPerson(agent.kind) : createAnimal(agent.kind);
        const p = local(agent.origin[0], agent.origin[1]);
        mesh.position.set(p.x, 0, p.z); mesh.visible = false; mesh.scale.multiplyScalar(0.9 + seeded(i + 700) * 0.22);
        world.add(mesh); agent.mesh = mesh;
      });
      world.userData.transform = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z).scale(new THREE.Vector3(meterScale, -meterScale, meterScale));
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(args: { gl: WebGL2RenderingContext; modelViewProjectionMatrix: Float32Array }) {
      const z = map.getZoom(); const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
      agents.forEach((a) => {
        if (!a.mesh) return;
        a.mesh.visible = z >= 16.15;
        if (!a.mesh.visible) return;
        a.phase += dt * a.speed;
        const p = local(a.origin[0], a.origin[1]);
        const radius = a.kind === 'camel' || a.kind === 'horse' ? 15 : 8;
        a.mesh.position.x = p.x + Math.cos(a.phase) * radius;
        a.mesh.position.z = p.z + Math.sin(a.phase * 0.87) * radius * 0.65;
        a.mesh.rotation.y = -a.phase + Math.PI / 2;
      });
      const m = new THREE.Matrix4().fromArray(Array.from(args.modelViewProjectionMatrix));
      camera.projectionMatrix = m.multiply(world.userData.transform as THREE.Matrix4);
      renderer.resetState(); renderer.render(scene, camera); map.triggerRepaint();
    }
  };
}

export default function HistoricalMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(15.1);
  const [year, setYear] = useState(622);
  const [hour, setHour] = useState(7.67);
  const [selected, setSelected] = useState<(typeof places)[number] | null>(null);
  const agents = useMemo(() => makeAgents(), []);
  const geo = useMemo(() => makeHistoricalGeoJSON(), []);
  const prayerTimes = useMemo(() => calculatePrayerTimes(new Date(Date.UTC(year, 5, 15))), [year]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: MADINAH_CENTER,
      zoom: 15.1,
      minZoom: 10,
      maxZoom: 19.5,
      pitch: 24,
      bearing: 0,
      attributionControl: false,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          farms: { type: 'geojson', data: geo.farms },
          streets: { type: 'geojson', data: geo.streets },
          buildings: { type: 'geojson', data: geo.buildings },
          palms: { type: 'geojson', data: geo.palms },
          wells: { type: 'geojson', data: geo.wells },
          labels: { type: 'geojson', data: geo.labels },
        },
        layers: [
          { id: 'ground', type: 'background', paint: { 'background-color': '#c8b998' } },
          { id: 'farm-fill', type: 'fill', source: 'farms', paint: { 'fill-color': '#7e8b62', 'fill-opacity': 0.43 } },
          { id: 'farm-outline', type: 'line', source: 'farms', paint: { 'line-color': '#65724f', 'line-width': 1.4, 'line-opacity': 0.55 } },
          { id: 'street-casing', type: 'line', source: 'streets', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#8a795d', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 17, 12], 'line-opacity': 0.72 } },
          { id: 'street-fill', type: 'line', source: 'streets', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#cbbd9f', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 17, 8], 'line-opacity': 0.96 } },
          { id: 'building-footprints', type: 'fill', source: 'buildings', minzoom: 13.2, maxzoom: 15.4, paint: { 'fill-color': ['match', ['get', 'tone'], 0, '#9f7b55', 1, '#ac865e', 2, '#92704e', '#b18b64'], 'fill-opacity': 0.95, 'fill-outline-color': '#6e533a' } },
          { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', minzoom: 15.4, paint: { 'fill-extrusion-color': ['match', ['get', 'tone'], 0, '#9f7b55', 1, '#ad8860', 2, '#94714f', '#b28c65'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.96, 'fill-extrusion-vertical-gradient': true } },
          { id: 'palms', type: 'circle', source: 'palms', minzoom: 11.5, maxzoom: 16.2, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.3, 16, 4.8], 'circle-color': '#3f5f3d', 'circle-stroke-color': '#2f452f', 'circle-stroke-width': 0.7, 'circle-opacity': 0.88 } },
          { id: 'wells', type: 'circle', source: 'wells', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 17, 9], 'circle-color': '#557985', 'circle-stroke-color': '#e7d8b4', 'circle-stroke-width': 2 } },
          { id: 'place-labels', type: 'symbol', source: 'labels', minzoom: 13.2, layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 17, 15], 'text-offset': [0, 1.1], 'text-anchor': 'top' }, paint: { 'text-color': '#3f372d', 'text-halo-color': '#eadfc8', 'text-halo-width': 1.4 } },
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');
    map.on('load', () => { map.addLayer(createLifeLayer(map, agents) as any); setReady(true); });
    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('click', (e) => {
      let best: typeof places[number] | null = null; let dist = Infinity;
      for (const p of places) {
        const dx = p.coordinates[0] - e.lngLat.lng; const dy = p.coordinates[1] - e.lngLat.lat; const d = dx * dx + dy * dy;
        if (d < dist) { dist = d; best = p; }
      }
      if (best && dist < 0.00008) setSelected(best);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [agents, geo]);

  const simMode = zoom < 13.2 ? 'إقليمي' : zoom < 15.4 ? 'خريطة عمرانية' : zoom < 16.15 ? 'مبانٍ ثلاثية الأبعاد' : 'محاكاة حياة';
  const visibleCount = zoom >= 16.15 ? agents.length : 0;
  const totalMinutes = Math.round(hour * 60);
  const timeLabel = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <small>MAPLIBRE · WEBGL · إعادة بناء تاريخية</small>
          <h1>المدينة المنورة</h1>
        </div>
        <button className="icon-button" aria-label="إعادة تمركز الخريطة" onClick={() => mapRef.current?.easeTo({ center: MADINAH_CENTER, zoom: 15.1, pitch: 24, bearing: 0, duration: 700 })}>⌖</button>
      </header>

      <section className="map-wrap">
        <div ref={containerRef} className="map" />
        <div className="status-pill">{ready ? '● جاهز' : 'جارٍ التهيئة…'} · {simMode} · Z {zoom.toFixed(1)}</div>
        <div className="diagnostics"><span>LOD: {simMode}</span><span>Agents: {visibleCount}</span><span>Year: {year}</span></div>
        {selected && <article className="place-card"><button onClick={() => setSelected(null)}>×</button><h2>{selected.name}</h2><p>{selected.description}</p><strong>الثقة التاريخية: {selected.confidence}</strong></article>}
      </section>

      <section className="timeline-panel">
        <div className="time-row"><span>الزمن المحاكى</span><b>{year} · {timeLabel}</b></div>
        <label>السنة <input type="range" min="622" max="632" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label>الوقت <input type="range" min="0" max="23.75" step="0.25" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
        <div className="prayers"><span>الفجر {prayerTimes.fajr}</span><span>الظهر {prayerTimes.dhuhr}</span><span>العصر {prayerTimes.asr}</span><span>المغرب {prayerTimes.maghrib}</span><span>العشاء {prayerTimes.isha}</span></div>
      </section>

      <nav className="bottom-nav" aria-label="التنقل">
        <button className="active" onClick={() => mapRef.current?.easeTo({ zoom: 15.1, pitch: 20, duration: 700 })}>استكشف</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 17.2, pitch: 55, duration: 900 })}>الحياة</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 14.2, pitch: 8, duration: 800 })}>الواحة</button>
        <button onClick={() => setSelected(places[1])}>دليل</button>
      </nav>
    </main>
  );
}
