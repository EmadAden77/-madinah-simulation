'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { MADINAH_CENTER, makeHistoricalGeoJSON, places } from '@/lib/historicalData';
import { calculatePrayerTimes } from '@/lib/prayerTimes';
import { simulationRules, studyMeta, studySections } from '@/lib/studyData';

export default function HistoricalMapPhoto() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(15.8);
  const [year, setYear] = useState(622);
  const [hour, setHour] = useState(7.67);
  const [selected, setSelected] = useState<(typeof places)[number] | null>(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [studySection, setStudySection] = useState(studySections[0].id);
  const geo = useMemo(() => makeHistoricalGeoJSON(), []);
  const prayerTimes = useMemo(() => calculatePrayerTimes(new Date(Date.UTC(year, 5, 15))), [year]);

  const activeStudySection = useMemo(
    () => studySections.find((section) => section.id === studySection) ?? studySections[0],
    [studySection]
  );

  const currentActivity = useMemo(() => {
    const normalized = ((hour % 24) + 24) % 24;
    return simulationRules.activityByHour.find((period) => normalized >= period.from && normalized < period.to)
      ?? simulationRules.activityByHour[0];
  }, [hour]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const basePath = window.location.pathname.startsWith('/-madinah-simulation') ? '/-madinah-simulation' : '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: MADINAH_CENTER,
      zoom: 15.8,
      minZoom: 11,
      maxZoom: 19.5,
      pitch: 18,
      bearing: 0,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          historicalAerial: {
            type: 'image',
            url: `${basePath}/historical-base.svg`,
            coordinates: [
              [39.585, 24.490],
              [39.640, 24.490],
              [39.640, 24.445],
              [39.585, 24.445]
            ]
          },
          streets: { type: 'geojson', data: geo.streets },
          buildings: { type: 'geojson', data: geo.buildings },
          wells: { type: 'geojson', data: geo.wells },
        },
        layers: [
          { id: 'fallback-ground', type: 'background', paint: { 'background-color': '#b7a37e' } },
          { id: 'historical-aerial', type: 'raster', source: 'historicalAerial', paint: { 'raster-opacity': 1, 'raster-resampling': 'linear' } },
          { id: 'street-casing', type: 'line', source: 'streets', minzoom: 14.3, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#735f47', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.8, 18, 8], 'line-opacity': 0.35 } },
          { id: 'street-fill', type: 'line', source: 'streets', minzoom: 14.3, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#cbb58d', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.0, 18, 5.6], 'line-opacity': 0.6 } },
          { id: 'building-roofs', type: 'fill', source: 'buildings', minzoom: 14.8, maxzoom: 16.3, paint: { 'fill-color': ['match', ['get', 'tone'], 0, '#a77d58', 1, '#b58a61', 2, '#936d4d', 3, '#ae835d', '#a57b56'], 'fill-opacity': 0.72, 'fill-outline-color': '#664b35' } },
          { id: 'building-shadow', type: 'line', source: 'buildings', minzoom: 15.1, maxzoom: 16.3, paint: { 'line-color': '#4b3b2f', 'line-width': 1.2, 'line-opacity': 0.32 } },
          { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', minzoom: 16.3, paint: { 'fill-extrusion-color': ['match', ['get', 'tone'], 0, '#9e7653', 1, '#af845c', 2, '#8d6849', 3, '#b08760', '#a27a55'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92, 'fill-extrusion-vertical-gradient': true } },
          { id: 'wells', type: 'circle', source: 'wells', minzoom: 14.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14.5, 2.5, 18, 7], 'circle-color': '#4f7780', 'circle-stroke-color': '#e8dcc2', 'circle-stroke-width': 2 } },
        ]
      }
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-left');

    map.on('load', () => {
      places.forEach((p) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'historical-map-label';
        el.textContent = p.name;
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelected(p);
        });
        new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(p.coordinates).addTo(map);
      });
      setReady(true);
    });

    map.on('zoom', () => setZoom(map.getZoom()));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geo]);

  const simMode = zoom < 13.5 ? 'منظر إقليمي' : zoom < 15.0 ? 'خريطة جوية' : zoom < 16.3 ? 'تفاصيل عمرانية' : 'مبانٍ ثلاثية الأبعاد';
  const totalMinutes = Math.round(hour * 60);
  const timeLabel = `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <small>إعادة بناء جوية تاريخية · MAPLIBRE</small>
          <h1>المدينة المنورة</h1>
        </div>
        <div className="top-actions">
          <button className="study-button" onClick={() => setStudyOpen(true)}>الدراسة</button>
          <button className="icon-button" aria-label="إعادة تمركز الخريطة" onClick={() => mapRef.current?.easeTo({ center: MADINAH_CENTER, zoom: 15.8, pitch: 18, bearing: 0, duration: 700 })}>⌖</button>
        </div>
      </header>

      <section className="map-wrap">
        <div ref={containerRef} className="map" />
        <div className="status-pill">{ready ? '● جاهز' : 'جارٍ تحميل الخريطة…'} · {simMode} · Z {zoom.toFixed(1)}</div>
        <div className="activity-card">
          <strong>{timeLabel}</strong>
          <span>{currentActivity.activity}</span>
        </div>
        <div className="diagnostics"><span>Historical aerial reconstruction</span><span>Z {zoom.toFixed(1)}</span><span>{year}</span></div>
        {selected && <article className="place-card"><button onClick={() => setSelected(null)}>×</button><h2>{selected.name}</h2><p>{selected.description}</p><strong>الثقة التاريخية: {selected.confidence}</strong></article>}
      </section>

      <section className="timeline-panel">
        <div className="time-row"><span>الزمن المحاكى</span><b>{year} · {timeLabel}</b></div>
        <label>السنة <input type="range" min="622" max="632" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
        <label>الوقت <input type="range" min="0" max="23.75" step="0.25" value={hour} onChange={(e) => setHour(Number(e.target.value))} /></label>
        <div className="prayers"><span>الفجر {prayerTimes.fajr}</span><span>الظهر {prayerTimes.dhuhr}</span><span>العصر {prayerTimes.asr}</span><span>المغرب {prayerTimes.maghrib}</span><span>العشاء {prayerTimes.isha}</span></div>
      </section>

      <nav className="bottom-nav" aria-label="التنقل">
        <button className="active" onClick={() => mapRef.current?.easeTo({ zoom: 15.8, pitch: 18, duration: 700 })}>استكشف</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 17.1, pitch: 52, duration: 900 })}>المباني</button>
        <button onClick={() => mapRef.current?.easeTo({ zoom: 13.6, pitch: 0, duration: 800 })}>الواحة</button>
        <button onClick={() => setStudyOpen(true)}>المعرفة</button>
      </nav>

      {studyOpen && (
        <div className="study-backdrop" role="presentation" onClick={() => setStudyOpen(false)}>
          <aside className="study-drawer" role="dialog" aria-modal="true" aria-label="محتوى الدراسة" onClick={(event) => event.stopPropagation()}>
            <div className="study-head">
              <div>
                <small>{studyMeta.period}</small>
                <h2>{studyMeta.title}</h2>
              </div>
              <button onClick={() => setStudyOpen(false)} aria-label="إغلاق">×</button>
            </div>
            <p className="study-note">{studyMeta.note}</p>
            <div className="study-tabs">
              {studySections.map((section) => (
                <button key={section.id} className={studySection === section.id ? 'active' : ''} onClick={() => setStudySection(section.id)}>{section.title}</button>
              ))}
            </div>
            <section className="study-content">
              <h3>{activeStudySection.title}</h3>
              <p>{activeStudySection.summary}</p>
              <ul>
                {activeStudySection.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
