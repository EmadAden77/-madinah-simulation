'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, MercatorCoordinate } from 'maplibre-gl';
import * as THREE from 'three';
import { MADINAH_CENTER, makeHistoricalGeoJSON, places } from '@/lib/historicalData';
import { calculatePrayerTimes } from '@/lib/prayerTimes';

type AgentKind = 'person' | 'sheep' | 'goat' | 'horse' | 'camel' | 'donkey' | 'shepherd';

type Agent = {
  kind: AgentKind;
  origin: [number, number];
  speed: number;
  phase: number;
  mesh?: THREE.Object3D;
};

const COLORS = {
  sand: '#b9aa8b',
  farm: '#71815a',
  farmLine: '#5e6f4d',
  route: '#8a7759',
  well: '#5f7f87',
  house: '#9d7952',
};

function seeded(i: number) {
  const x = Math.sin(i * 8128.173) * 43758.5453;
  return x - Math.floor(x);
}

function makeAgents(): Agent[] {
  const kinds: AgentKind[] = [
    ...Array(22).fill('person'),
    ...Array(2).fill('shepherd'),
    ...Array(24).fill('sheep'),
    ...Array(10).fill('goat'),
    ...Array(3).fill('horse'),
    ...Array(5).fill('camel'),
    ...Array(4).fill('donkey'),
  ];
  return kinds.map((kind, i) => {
    const a = seeded(i + 500) * Math.PI * 2;
    const r = 0.0015 + seeded(i + 520) * 0.006;
    return {
      kind,
      origin: [MADINAH_CENTER[0] + Math.cos(a) * r, MADINAH_CENTER[1] + Math.sin(a) * r * 0.72],
      speed: 0.25 + seeded(i + 540) * 0.45,
      phase: seeded(i + 550) * Math.PI * 2,
    };
  });
}

function createPerson(kind: AgentKind) {
  const group = new THREE.Group();
  const bodyColor = kind === 'shepherd' ? 0x6e5d45 : 0xd8ccb0;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 3, 6), new THREE.MeshLambertMaterial({ color: bodyColor }));
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8f664c }));
  head.position.y = 1.75;
  group.add(body, head);
  group.scale.setScalar(kind === 'shepherd' ? 1.08 : 1);
  return group;
}

function createAnimal(kind: AgentKind) {
  const group = new THREE.Group();
  const config: Record<string, { c: number; sx: number; sy: number; sz: number }> = {
    sheep: { c: 0xd8d2c2, sx: 0.78, sy: 0.55, sz: 0.42 },
    goat: { c: 0x8e795d, sx: 0.7, sy: 0.5, sz: 0.36 },
    horse: { c: 0x6e4933, sx: 1.25, sy: 0.9, sz: 0.48 },
    camel: { c: 0xa97b4f, sx: 1.35, sy: 1.1, sz: 0.5 },
    donkey: { c: 0x777064, sx: 0.95, sy: 0.72, sz: 0.4 },
  };
  const q = config[kind] ?? config.sheep;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshLambertMaterial({ color: q.c }));
  body.scale.set(q.sx, q.sy, q.sz);
  body.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 5), new THREE.MeshLambertMaterial({ color: q.c }));
  head.position.set(0.62 * q.sx, 0.75, 0);
  group.add(body, head);
  if (kind === 'camel') {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), new THREE.MeshLambertMaterial({ color: q.c }));
    hump.position.set(-0.1, 1.1, 0);
    group.add(hump);
  }
  return group;
}

function createHistorical3DLayer(map: MapLibreMap, agents: Agent[]) {
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  let world: THREE.Group;
  let lastTime = performance.now();

  const anchor = MercatorCoordinate.fromLngLat({ lng: MADINAH_CENTER[0], lat: MADINAH_CENTER[1] }, 0);
  const meterScale = anchor.meterInMercatorCoordinateUnits();

  const lngLatToLocal = (lng: number, lat: number) => {
    const m = MercatorCoordinate.fromLngLat({ lng, lat }, 0);
    return new THREE.Vector3((m.x - anchor.x) / meterScale, 0, -(m.y - anchor.y) / meterScale);
  };

  return {
    id: 'historical-3d-world',
    type: 'custom' as const,
    renderingMode: '3d' as const,
    onAdd(_map: MapLibreMap, gl: WebGL2RenderingContext) {
      scene = new THREE.Scene();
      camera = new THREE.Camera();
      world = new THREE.Group();
      scene.add(world);

      const hemi = new THREE.HemisphereLight(0xfff1d2, 0x493d2d, 2.0);
      const sun = new THREE.DirectionalLight(0xffe4ac, 2.5);
      sun.position.set(-40, 80, 20);
      scene.add(hemi, sun);

      const geo = makeHistoricalGeoJSON();
      geo.houses.features.forEach((f, i) => {
        if (f.geometry.type !== 'Point') return;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        const width = 5 + seeded(i) * 5;
        const height = 2.7 + seeded(i + 2) * 2.2;
        const depth = 4 + seeded(i + 4) * 4;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshLambertMaterial({ color: i % 3 === 0 ? 0x9c7751 : 0xa9855c })
        );
        const p = lngLatToLocal(lng, lat);
        box.position.set(p.x, height / 2, p.z);
        box.rotation.y = seeded(i + 20) * Math.PI;
        world.add(box);
      });

      geo.palms.features.forEach((f, i) => {
        if (f.geometry.type !== 'Point') return;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        const p = lngLatToLocal(lng, lat);
        const palm = new THREE.Group();
        const trunkH = 4 + seeded(i + 30) * 3;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, trunkH, 6), new THREE.MeshLambertMaterial({ color: 0x6e4f2f }));
        trunk.position.y = trunkH / 2;
        palm.add(trunk);
        for (let j = 0; j < 7; j++) {
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.5, 4), new THREE.MeshLambertMaterial({ color: 0x38553a }));
          frond.position.y = trunkH + 0.15;
          frond.rotation.z = Math.PI / 2.8;
          frond.rotation.y = (j / 7) * Math.PI * 2;
          palm.add(frond);
        }
        palm.position.set(p.x, 0, p.z);
        palm.rotation.y = seeded(i + 90) * Math.PI * 2;
        world.add(palm);
      });

      agents.forEach((agent, i) => {
        const mesh = agent.kind === 'person' || agent.kind === 'shepherd' ? createPerson(agent.kind) : createAnimal(agent.kind);
        const p = lngLatToLocal(agent.origin[0], agent.origin[1]);
        mesh.position.set(p.x, 0, p.z);
        mesh.visible = false;
        mesh.scale.multiplyScalar(0.95 + seeded(i + 700) * 0.2);
        world.add(mesh);
        agent.mesh = mesh;
      });

      const transform = new THREE.Matrix4()
        .makeTranslation(anchor.x, anchor.y, anchor.z)
        .scale(new THREE.Vector3(meterScale, -meterScale, meterScale));
      world.userData.mercatorTransform = transform;

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(args: { gl: WebGL2RenderingContext; modelViewProjectionMatrix: Float32Array }) {
      const zoom = map.getZoom();
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      agents.forEach((agent) => {
        if (!agent.mesh) return;
        agent.mesh.visible = zoom >= 15.3;
        if (!agent.mesh.visible) return;
        agent.phase += dt * agent.speed;
        const origin = lngLatToLocal(agent.origin[0], agent.origin[1]);
        const meters = agent.kind === 'camel' || agent.kind === 'horse' ? 18 : 10;
        agent.mesh.position.x = origin.x + Math.cos(agent.phase) * meters;
        agent.mesh.position.z = origin.z + Math.sin(agent.phase * 0.84) * meters * 0.65;
        agent.mesh.rotation.y = -agent.phase + Math.PI / 2;
      });

      const m = new THREE.Matrix4().fromArray(Array.from(args.modelViewProjectionMatrix));
      const l = world.userData.mercatorTransform as THREE.Matrix4;
      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    }
  };
}

export default function HistoricalMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13.2);
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
      zoom: 13.2,
      minZoom: 10,
      maxZoom: 19.5,
      pitch: 28,
      bearing: -8,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          farms: { type: 'geojson', data: geo.farms },
          routes: { type: 'geojson', data: geo.routes },
          wells: { type: 'geojson', data: geo.wells },
          houses: { type: 'geojson', data: geo.houses },
          palms: { type: 'geojson', data: geo.palms },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': COLORS.sand } },
          { id: 'farms-fill', type: 'fill', source: 'farms', paint: { 'fill-color': COLORS.farm, 'fill-opacity': 0.42 } },
          { id: 'farms-line', type: 'line', source: 'farms', paint: { 'line-color': COLORS.farmLine, 'line-width': 1.2, 'line-opacity': 0.5 } },
          { id: 'routes', type: 'line', source: 'routes', paint: { 'line-color': COLORS.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 5], 'line-opacity': 0.72, 'line-dasharray': [2, 1.2] } },
          { id: 'wells', type: 'circle', source: 'wells', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 17, 9], 'circle-color': COLORS.well, 'circle-stroke-color': '#d7c9a8', 'circle-stroke-width': 2 } },
          { id: 'houses-flat', type: 'circle', source: 'houses', maxzoom: 15.2, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 15, 4], 'circle-color': COLORS.house } },
          { id: 'palms-flat', type: 'circle', source: 'palms', maxzoom: 15.2, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1, 15, 3], 'circle-color': '#3d5b3e', 'circle-opacity': 0.7 } },
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');

    map.on('load', () => {
      map.addLayer(createHistorical3DLayer(map, agents) as any);
      setReady(true);
    });

    map.on('zoom', () => setZoom(map.getZoom()));
    map.on('click', (e) => {
      let best: typeof places[number] | null = null;
      let dist = Infinity;
      places.forEach((p) => {
        const dx = p.coordinates[0] - e.lngLat.lng;
        const dy = p.coordinates[1] - e.lngLat.lat;
        const d = dx * dx + dy * dy;
        if (d < dist) { dist = d; best = p; }
      });
      if (best && dist < 0.00008) setSelected(best);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [agents, geo]);

  const simMode = zoom < 13 ? 'إقليمي' : zoom < 15.3 ? 'عمراني' : zoom < 17 ? 'محاكاة حية' : 'تفاصيل محلية';
  const visibleCount = zoom >= 15.3 ? agents.length : 0;
  const totalMinutes = Math.round(hour * 60);
  const timeLabel = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2,'0')}:${String(totalMinutes % 60).padStart(2,'0')}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <small>MAPLIBRE · WEBGL · إعادة بناء تاريخية</small>
          <h1>المدينة المنورة</h1>
        </div>
        <button className="icon-button" aria-label="إعادة تمركز الخريطة" onClick={() => mapRef.current?.easeTo({ center: MADINAH_CENTER, zoom: 13.2, pitch: 28, bearing: -8, duration: 700 })}>⌖</button>
      </header>

      <section className="map-wrap">
        <div ref={containerRef} className="map" />
        <div className="status-pill">{ready ? '● جاهز' : 'جارٍ التهيئة…'} · {simMode} · Z {zoom.toFixed(1)}</div>
        <div className="diagnostics">
          <span>LOD: {simMode}</span>
          <span>Agents: {visibleCount}</span>
          <span>Year: {year}</span>
        </div>
        {selected && (
          <article className="place-card">
            <button onClick={() => setSelected(null)}>×</button>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <strong>الثقة التاريخية: {selected.confidence}</strong>
          </article>
        )}
      </section>

      <section className="timeline-panel">
        <div className="time-row"><span>الزمن المحاكى</span><b>{year} · {timeLabel}</b></div>
        <label>السنة <input type="range" min="622" max="632" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label>الوقت <input type="range" min="0" max="23.75" step="0.25" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
        <div className="prayers">
          <span>الفجر {prayerTimes.fajr}</span><span>الظهر {prayerTimes.dhuhr}</span><span>العصر {prayerTimes.asr}</span><span>المغرب {prayerTimes.maghrib}</span><span>العشاء {prayerTimes.isha}</span>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="التنقل">
        <button className="active">استكشف</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 16.5, pitch: 52, duration: 900 })}>الحياة</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 14.5, pitch: 15, duration: 900 })}>الواحة</button>
        <button onClick={() => setSelected(places[1])}>دليل</button>
      </nav>
    </main>
  );
}
