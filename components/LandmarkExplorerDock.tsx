'use client';

import { useEffect, useState } from 'react';
import { places } from '@/lib/historicalData';

const iconByType: Record<string, string> = {
  'mosque-area': '◈',
  settlement: '⌂',
  farm: '♧',
  well: '◉',
  route: '↝',
  terrain: '△',
  market: '◇',
  residential: '▦'
};

export default function LandmarkExplorerDock() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const focused = document.querySelector<HTMLElement>('.landmark-marker.focused');
      setActiveId(focused?.dataset.placeId ?? null);
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const focus = (id: string) => {
    const marker = document.querySelector<HTMLButtonElement>(`.landmark-marker[data-place-id="${id}"]`);
    marker?.click();
    setActiveId(id);
  };

  const overview = () => {
    const recenter = document.querySelector<HTMLButtonElement>('.icon-button[aria-label="إعادة تمركز"]');
    recenter?.click();
    setActiveId(null);
  };

  return (
    <div className={`landmark-explorer ${open ? 'open' : 'collapsed'}`} dir="rtl">
      <button className="landmark-explorer-toggle" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>المعالم</span>
        <b>{open ? '×' : '⌁'}</b>
      </button>

      {open && (
        <div className="landmark-explorer-body">
          <div className="landmark-explorer-head">
            <div>
              <small>استكشاف موجّه</small>
              <strong>اختر موقعًا للانتقال إليه</strong>
            </div>
            <button type="button" onClick={overview}>نظرة عامة</button>
          </div>

          <div className="landmark-explorer-track" role="list" aria-label="المعالم التاريخية">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                role="listitem"
                className={activeId === place.id ? 'active' : ''}
                onClick={() => focus(place.id)}
              >
                <span className="landmark-explorer-icon">{iconByType[place.type] ?? '•'}</span>
                <span className="landmark-explorer-copy">
                  <b>{place.name}</b>
                  <small>{place.confidence}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
