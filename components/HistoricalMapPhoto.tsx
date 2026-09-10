'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import { MADINAH_CENTER, makeHistoricalGeoJSON, places } from '@/lib/historicalData';
import { makeLivingSnapshot } from '@/lib/livingSimulation';
import { getHistoricalLighting } from '@/lib/dayNightLighting';
import { calculatePrayerTimes } from '@/lib/prayerTimes';
import { simulationRules, studyMeta, studySections } from '@/lib/studyData';

const RASTER_BOUNDS: [number, number, number, number] = [39.585, 24.445, 39.640, 24.490];
const TERRAIN_BOUNDS: [number, number, number, number] = [39.57, 24.43, 39.655, 24.505];
const LANDMARK_KINDS = ['early-mosque', 'mosque-shade', 'hujra'];

type LayerState = { buildings: boolean; routes: boolean; farms: boolean; wells: boolean; landmarks: boolean; terrain: boolean; life: boolean };
type CameraPreset = { zoom: number; pitch: number; bearing: number; duration: number };

const placeIcon: Record<string, string> = {
  'mosque-area': '◈', settlement: '⌂', farm: '♧', well: '◉', route: '↝', terrain: '△', market: '◇', residential: '▦'
};

function cameraPreset(type: string): CameraPreset {
  switch (type) {
    case 'mosque-area': return { zoom: 18.15, pitch: 62, bearing: -24, duration: 1350 };
    case 'residential': return { zoom: 18.0, pitch: 60, bearing: -16, duration: 1250 };
    case 'market': return { zoom: 17.45, pitch: 52, bearing: 18, duration: 1200 };
    case 'well': return { zoom: 17.7, pitch: 55, bearing: 12, duration: 1150 };
    case 'farm': return { zoom: 16.8, pitch: 46, bearing: -8, duration: 1150 };
    case 'terrain': return { zoom: 15.5, pitch: 64, bearing: 28, duration: 1300 };
    case 'route': return { zoom: 16.7, pitch: 48, bearing: 10, duration: 1100 };
    default: return { zoom: 17.0, pitch: 56, bearing: -14, duration: 1150 };
  }
}

export default function HistoricalMapPhoto() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const tickRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(15.6);
  const [year, setYear] = useState(622);
  const [hour, setHour] = useState(7.67);
  const [is3D, setIs3D] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<(typeof places)[number] | null>(places[1] ?? null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [studySection, setStudySection] = useState(studySections[0].id);
  const [layers, setLayers] = useState<LayerState>({ buildings: true, routes: false, farms: false, wells: true, landmarks: true, terrain: true, life: true });
  const geo = useMemo(() => makeHistoricalGeoJSON(), []);
  const lighting = useMemo(() => getHistoricalLighting(hour), [hour]);
  const prayerTimes = useMemo(() => calculatePrayerTimes(new Date(Date.UTC(year, 5, 15))), [year]);
  const activeStudySection = useMemo(() => studySections.find((section) => section.id === studySection) ?? studySections[0], [studySection]);
  const currentActivity = useMemo(() => {
    const normalized = ((hour % 24) + 24) % 24;
    return simulationRules.activityByHour.find((period) => normalized >= period.from && normalized < period.to) ?? simulationRules.activityByHour[0];
  }, [hour]);
  const growthLabel = year <= 623 ? 'بداية المرحلة المدنية' : year <= 627 ? 'نمو عمراني مبكر' : year <= 630 ? 'اتساع التجمع والعمران' : 'أواخر العهد النبوي';

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const basePath = window.location.pathname.startsWith('/-madinah-simulation') ? '/-madinah-simulation' : '';
    const rasterSource = (epoch: 622 | 627 | 632) => ({ type: 'raster' as const, tiles: [`${basePath}/tiles/${epoch}/{z}/{x}/{y}.png`], tileSize: 512, minzoom: 13, maxzoom: 17, bounds: RASTER_BOUNDS });
    const genericFilter = ['all', ['<=', ['get', 'start_year'], 622], ['!', ['in', ['get', 'kind'], ['literal', LANDMARK_KINDS]]]] as any;
    const landmarkFilter = ['all', ['<=', ['get', 'start_year'], 622], ['in', ['get', 'kind'], ['literal', LANDMARK_KINDS]]] as any;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: MADINAH_CENTER,
      zoom: 16.9,
      minZoom: 13,
      maxZoom: 19.5,
      maxPitch: 68,
      pitch: 58,
      bearing: -18,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          raster622: rasterSource(622), raster627: rasterSource(627), raster632: rasterSource(632),
          terrainDem: { type: 'raster-dem', tiles: [`${basePath}/terrain/{z}/{x}/{y}.png`], tileSize: 256, minzoom: 11, maxzoom: 15, bounds: TERRAIN_BOUNDS, encoding: 'mapbox' },
          buildings: { type: 'geojson', data: `${basePath}/reconstruction/buildings.geojson` }, wells: { type: 'geojson', data: geo.wells }, routes: { type: 'geojson', data: geo.streets }, farms: { type: 'geojson', data: geo.farms },
          living: { type: 'geojson', data: makeLivingSnapshot({ year: 622, hour: 7.67, tick: 0 }) }
        },
        layers: [
          { id: 'fallback-ground', type: 'background', paint: { 'background-color': '#b29a72' } },
          { id: 'historical-raster-622', type: 'raster', source: 'raster622', minzoom: 13, paint: { 'raster-opacity': 1, 'raster-resampling': 'linear', 'raster-fade-duration': 120 } },
          { id: 'historical-raster-627', type: 'raster', source: 'raster627', minzoom: 13, paint: { 'raster-opacity': 0, 'raster-resampling': 'linear', 'raster-fade-duration': 120 } },
          { id: 'historical-raster-632', type: 'raster', source: 'raster632', minzoom: 13, paint: { 'raster-opacity': 0, 'raster-resampling': 'linear', 'raster-fade-duration': 120 } },
          { id: 'terrain-hillshade', type: 'hillshade', source: 'terrainDem', paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#5f4a35', 'hillshade-highlight-color': '#e8d6ad', 'hillshade-accent-color': '#8d7656', 'hillshade-illumination-direction': 315 } },
          { id: 'farm-overlay', type: 'fill', source: 'farms', layout: { visibility: 'none' }, paint: { 'fill-color': '#6d7d45', 'fill-opacity': 0.2, 'fill-outline-color': '#687044' } },
          { id: 'route-overlay', type: 'line', source: 'routes', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f0d39d', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.4, 18, 5.5], 'line-opacity': 0.75 } },
          {
            id: 'buildings-lod-far', type: 'fill-extrusion', source: 'buildings', minzoom: 15.6, maxzoom: 17.15, filter: genericFilter,
            paint: { 'fill-extrusion-color': ['match', ['get', 'tone'], 0, '#9a7351', 1, '#aa8059', 2, '#8c6748', 3, '#aa815a', 4, '#9d7552', '#98704e'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0], 'fill-extrusion-opacity': 0.72, 'fill-extrusion-vertical-gradient': true }
          },
          {
            id: 'buildings-lod-near', type: 'fill-extrusion', source: 'buildings', minzoom: 17.15, filter: genericFilter,
            paint: { 'fill-extrusion-color': ['match', ['get', 'kind'], 'compound-wall', '#856047', 'annex', '#956b4b', ['match', ['get', 'tone'], 0, '#9e7653', 1, '#af845c', 2, '#8d6849', 3, '#b08760', 4, '#a27a55', '#9c7350']], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0], 'fill-extrusion-opacity': 0.91, 'fill-extrusion-vertical-gradient': true }
          },
          {
            id: 'landmark-buildings-3d', type: 'fill-extrusion', source: 'buildings', minzoom: 16.2, filter: landmarkFilter,
            paint: { 'fill-extrusion-color': ['match', ['get', 'kind'], 'early-mosque', '#c29767', 'mosque-shade', '#76563c', 'hujra', '#ad7952', '#a77a55'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0], 'fill-extrusion-opacity': 0.98, 'fill-extrusion-vertical-gradient': true }
          },
          { id: 'living-shadow', type: 'circle', source: 'living', minzoom: 15.2, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15.2, 1.2, 18, 5.2], 'circle-color': '#30271f', 'circle-opacity': 0.18, 'circle-translate': [1.5, 2] } },
          { id: 'living-agents', type: 'circle', source: 'living', minzoom: 15.2, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15.2, 1.1, 17, 3.1, 18.5, 5.8], 'circle-color': ['match', ['get', 'kind'], 'person', '#6b4937', 'camel', '#8d6a45', 'horse', '#4c382d', 'donkey', '#71665c', 'sheep', '#d9cfba', 'goat', '#9a8b73', '#765f48'], 'circle-stroke-color': '#f1e2c3', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 15.2, 0, 18, 1], 'circle-opacity': 0.92 } },
          { id: 'wells', type: 'circle', source: 'wells', minzoom: 15.4, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15.4, 2.5, 18, 6], 'circle-color': '#416c77', 'circle-stroke-color': '#f0e1bf', 'circle-stroke-width': 2 } }
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-left');
    map.on('load', () => {
      map.setTerrain({ source: 'terrainDem', exaggeration: 1.35 });
      markersRef.current = places.map((p) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.dataset.placeId = p.id;
        el.className = `landmark-marker landmark-${p.type}`;
        el.innerHTML = `<span>${placeIcon[p.type] ?? '•'}</span><b>${p.name}</b>`;
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          const preset = cameraPreset(p.type);
          setSelected(p);
          setIs3D(true);
          map.flyTo({ center: p.coordinates, zoom: preset.zoom, pitch: preset.pitch, bearing: preset.bearing, duration: preset.duration, essential: true });
        });
        return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(p.coordinates).addTo(map);
      });
      setReady(true);
    });
    map.on('zoom', () => setZoom(map.getZoom()));
    mapRef.current = map;
    return () => { markersRef.current.forEach((m) => m.remove()); map.remove(); mapRef.current = null; };
  }, [geo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let opacity627 = 0, opacity632 = 0;
    if (year <= 627) opacity627 = (year - 622) / 5;
    else { opacity627 = 1; opacity632 = (year - 627) / 5; }
    map.setPaintProperty('historical-raster-622', 'raster-opacity', 1);
    map.setPaintProperty('historical-raster-627', 'raster-opacity', Math.max(0, Math.min(1, opacity627)));
    map.setPaintProperty('historical-raster-632', 'raster-opacity', Math.max(0, Math.min(1, opacity632)));
    const genericFilter = ['all', ['<=', ['get', 'start_year'], year], ['!', ['in', ['get', 'kind'], ['literal', LANDMARK_KINDS]]]] as any;
    const landmarkFilter = ['all', ['<=', ['get', 'start_year'], year], ['in', ['get', 'kind'], ['literal', LANDMARK_KINDS]]] as any;
    map.setFilter('buildings-lod-far', genericFilter);
    map.setFilter('buildings-lod-near', genericFilter);
    map.setFilter('landmark-buildings-3d', landmarkFilter);
  }, [year, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const update = () => {
      tickRef.current += 1;
      const source = map.getSource('living') as GeoJSONSource | undefined;
      source?.setData(makeLivingSnapshot({ year, hour, tick: tickRef.current }));
    };
    update();
    if (!layers.life) return;
    const id = window.setInterval(update, 850);
    return () => window.clearInterval(id);
  }, [ready, year, hour, layers.life]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const terrainOn = is3D && layers.terrain;
    const buildingOn = is3D && layers.buildings;
    map.setTerrain(terrainOn ? { source: 'terrainDem', exaggeration: 1.35 } : null);
    map.setLayoutProperty('terrain-hillshade', 'visibility', layers.terrain ? 'visible' : 'none');
    map.setPaintProperty('buildings-lod-far', 'fill-extrusion-opacity', buildingOn ? 0.72 : 0);
    map.setPaintProperty('buildings-lod-near', 'fill-extrusion-opacity', buildingOn ? 0.91 : 0);
    map.setPaintProperty('landmark-buildings-3d', 'fill-extrusion-opacity', buildingOn ? 0.98 : 0);
    map.setLayoutProperty('route-overlay', 'visibility', layers.routes ? 'visible' : 'none');
    map.setLayoutProperty('farm-overlay', 'visibility', layers.farms ? 'visible' : 'none');
    map.setLayoutProperty('wells', 'visibility', layers.wells ? 'visible' : 'none');
    map.setLayoutProperty('living-shadow', 'visibility', layers.life ? 'visible' : 'none');
    map.setLayoutProperty('living-agents', 'visibility', layers.life ? 'visible' : 'none');
    markersRef.current.forEach((marker) => { marker.getElement().style.display = layers.landmarks ? '' : 'none'; });
  }, [layers, is3D, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const rasterIds = ['historical-raster-622', 'historical-raster-627', 'historical-raster-632'];
    rasterIds.forEach((id) => {
      map.setPaintProperty(id, 'raster-brightness-min', lighting.rasterBrightnessMin);
      map.setPaintProperty(id, 'raster-brightness-max', lighting.rasterBrightnessMax);
      map.setPaintProperty(id, 'raster-contrast', lighting.rasterContrast);
      map.setPaintProperty(id, 'raster-saturation', lighting.rasterSaturation);
    });
    map.setPaintProperty('terrain-hillshade', 'hillshade-illumination-direction', lighting.hillshadeDirection);
    map.setPaintProperty('terrain-hillshade', 'hillshade-exaggeration', lighting.hillshadeExaggeration);
    map.setPaintProperty('living-shadow', 'circle-opacity', lighting.livingShadowOpacity);
    map.setPaintProperty('living-shadow', 'circle-translate', lighting.livingShadowTranslate);
  }, [lighting, ready]);

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const el = marker.getElement();
      el.classList.toggle('focused', Boolean(selected && el.dataset.placeId === selected.id));
    });
  }, [selected]);

  const focusPlace = (place: (typeof places)[number]) => {
    const preset = cameraPreset(place.type);
    setSelected(place);
    setIs3D(true);
    mapRef.current?.flyTo({ center: place.coordinates, zoom: preset.zoom, pitch: preset.pitch, bearing: preset.bearing, duration: preset.duration, essential: true });
  };

  const setThreeD = (next: boolean) => {
    setIs3D(next);
    mapRef.current?.easeTo({ zoom: next ? Math.max(zoom, 16.9) : Math.min(zoom, 16.2), pitch: next ? 60 : 0, bearing: next ? -18 : 0, duration: 950 });
  };

  const focusSelected = () => selected && focusPlace(selected);
  const toggle3D = () => setThreeD(!is3D);
  const lodLabel = zoom < 17.15 ? 'تفصيل متوسط' : 'تفصيل قريب';
  const simMode = is3D ? (layers.terrain ? `استكشاف مجسّم · ${lodLabel}` : `عمارة مجسّمة · ${lodLabel}`) : zoom < 14 ? 'نطاق الواحة' : zoom < 16 ? 'المشهد التاريخي' : 'تفاصيل المعالم';
  const totalMinutes = Math.round(hour * 60);
  const timeLabel = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

  return (
    <main className={`app-shell phase-${lighting.phase}`}>
      <section className="map-wrap immersive-map">
        <div ref={containerRef} className="map" />
        <div className="time-light-overlay" style={{ background: lighting.overlay }} />
        <div className="edge-vignette" />

        <header className="floating-header">
          <div className="brand-lockup">
            <small>إعادة بناء تاريخية تقديرية · 622–632م</small>
            <h1>المدينة المنورة</h1>
          </div>
          <div className="header-actions">
            <button className="glass-button" onClick={() => setStudyOpen(true)}>المعرفة</button>
            <button className={is3D ? 'glass-button active' : 'glass-button'} onClick={toggle3D}>{is3D ? '2D' : '3D'}</button>
          </div>
        </header>

        <aside className="explorer-dock" aria-label="أدوات الاستكشاف">
          <button className={layersOpen ? 'active' : ''} onClick={() => setLayersOpen((v) => !v)} title="الطبقات">☷</button>
          <button onClick={() => mapRef.current?.easeTo({ center: MADINAH_CENTER, zoom: 16.2, pitch: is3D ? 56 : 0, bearing: is3D ? -18 : 0, duration: 900 })} title="العودة للمركز">⌖</button>
          <button onClick={() => setThreeD(!is3D)} title="تبديل العرض">◫</button>
          <button onClick={() => { setIs3D(false); mapRef.current?.easeTo({ zoom: 13.6, pitch: 0, bearing: 0, duration: 900 }); }} title="مشهد الواحة">△</button>
        </aside>

        {layersOpen && (
          <div className="layers-panel immersive-panel">
            <div className="panel-title"><strong>طبقات المشهد</strong><button onClick={() => setLayersOpen(false)}>×</button></div>
            {(Object.keys(layers) as (keyof LayerState)[]).map((key) => {
              const names: Record<keyof LayerState, string> = { buildings: 'العمارة والمجمعات', routes: 'المسارات', farms: 'البساتين والزراعة', wells: 'الآبار', landmarks: 'أسماء المعالم', terrain: 'التضاريس', life: 'الحياة اليومية' };
              return <label key={key}><span>{names[key]}</span><input type="checkbox" checked={layers[key]} onChange={() => setLayers((s) => ({ ...s, [key]: !s[key] }))} /></label>;
            })}
          </div>
        )}

        <div className="scene-status">
          <span className="status-dot" />
          <strong>{ready ? simMode : 'جارٍ تحميل المشهد…'}</strong>
          <small>{year}م · {timeLabel} · {lighting.label}</small>
        </div>

        {selected && (
          <article className="focus-card">
            <div className="focus-kicker">معلم تاريخي</div>
            <button className="focus-close" onClick={() => setSelected(null)}>×</button>
            <h2>{selected.name}</h2>
            <p>{selected.description}</p>
            <div className="focus-meta"><span>الثقة: {selected.confidence}</span><span>{growthLabel}</span></div>
            <div className="focus-actions"><button onClick={focusSelected}>اقترب من المعلم</button><button className="secondary" onClick={() => setStudyOpen(true)}>اقرأ السياق</button></div>
          </article>
        )}

        <div className="activity-chip">
          <b>{lighting.label} · {timeLabel}</b>
          <span>{currentActivity.activity}</span>
        </div>

        <div className="landmark-strip" aria-label="المعالم التاريخية">
          {places.map((place) => (
            <button key={place.id} className={selected?.id === place.id ? 'landmark-tile active' : 'landmark-tile'} onClick={() => focusPlace(place)}>
              <span className="tile-icon">{placeIcon[place.type] ?? '•'}</span>
              <span><b>{place.name}</b><small>{place.type === 'mosque-area' ? 'مركز العمران' : place.type === 'market' ? 'السوق' : place.type === 'farm' ? 'الواحة' : place.type === 'terrain' ? 'التضاريس' : 'موضع تاريخي'}</small></span>
            </button>
          ))}
        </div>

        <section className="timeline-float">
          <div className="timeline-head"><span>{growthLabel}</span><b>{year}م</b></div>
          <label><span>السنة</span><input type="range" min="622" max="632" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
          <label><span>الوقت</span><input type="range" min="0" max="23.75" step="0.25" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
          <div className="prayers compact"><span>الفجر {prayerTimes.fajr}</span><span>الظهر {prayerTimes.dhuhr}</span><span>العصر {prayerTimes.asr}</span><span>المغرب {prayerTimes.maghrib}</span><span>العشاء {prayerTimes.isha}</span></div>
        </section>
      </section>

      {studyOpen && <div className="study-backdrop" role="presentation" onClick={() => setStudyOpen(false)}><aside className="study-drawer" role="dialog" aria-modal="true" aria-label="محتوى الدراسة" onClick={(event) => event.stopPropagation()}><div className="study-head"><div><small>{studyMeta.period}</small><h2>{studyMeta.title}</h2></div><button onClick={() => setStudyOpen(false)}>×</button></div><p className="study-note">{studyMeta.note}</p><div className="study-tabs">{studySections.map((section) => <button key={section.id} className={studySection === section.id ? 'active' : ''} onClick={() => setStudySection(section.id)}>{section.title}</button>)}</div><section className="study-content"><h3>{activeStudySection.title}</h3><p>{activeStudySection.summary}</p><ul>{activeStudySection.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></section></aside></div>}
    </main>
  );
}
