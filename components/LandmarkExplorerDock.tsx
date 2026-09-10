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
    <>
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

      <style jsx global>{`
        .landmark-explorer {
          position: fixed;
          z-index: 72;
          left: 50%;
          bottom: calc(126px + env(safe-area-inset-bottom));
          width: min(760px, calc(100vw - 28px));
          transform: translateX(-50%);
          pointer-events: none;
        }
        .landmark-explorer-toggle,
        .landmark-explorer-body { pointer-events: auto; }
        .landmark-explorer-toggle {
          margin-inline-start: auto;
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 38px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(35,31,27,.88);
          color: #fff8ee;
          backdrop-filter: blur(15px);
          box-shadow: 0 8px 28px rgba(0,0,0,.22);
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }
        .landmark-explorer-toggle b { font-size: 18px; line-height: 1; }
        .landmark-explorer-body {
          margin-top: 7px;
          padding: 10px;
          border-radius: 19px;
          border: 1px solid rgba(255,255,255,.26);
          background: linear-gradient(180deg, rgba(39,34,29,.92), rgba(29,26,23,.86));
          backdrop-filter: blur(18px);
          box-shadow: 0 16px 44px rgba(0,0,0,.28);
          color: #fff7eb;
        }
        .landmark-explorer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 2px 2px 9px;
        }
        .landmark-explorer-head div { display: grid; gap: 1px; }
        .landmark-explorer-head small { color: #d8c5ae; font-size: 9px; }
        .landmark-explorer-head strong { font-size: 12px; }
        .landmark-explorer-head > button {
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.08);
          color: #fff4e3;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 10px;
          cursor: pointer;
        }
        .landmark-explorer-track {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(138px, 1fr);
          gap: 7px;
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
          padding-bottom: 1px;
        }
        .landmark-explorer-track::-webkit-scrollbar { display: none; }
        .landmark-explorer-track > button {
          scroll-snap-align: start;
          min-height: 62px;
          display: grid;
          grid-template-columns: 34px 1fr;
          align-items: center;
          gap: 8px;
          text-align: right;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.055);
          color: #fff8ee;
          padding: 8px 9px;
          cursor: pointer;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }
        .landmark-explorer-track > button:hover { transform: translateY(-1px); background: rgba(255,255,255,.09); }
        .landmark-explorer-track > button.active {
          background: rgba(191,139,91,.26);
          border-color: rgba(233,187,138,.48);
          box-shadow: inset 0 0 0 1px rgba(255,226,190,.06);
        }
        .landmark-explorer-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 11px;
          background: rgba(222,181,129,.17);
          color: #f2d4ad;
          font-size: 19px;
          border: 1px solid rgba(243,210,169,.16);
        }
        .landmark-explorer-copy { min-width: 0; display: grid; gap: 4px; }
        .landmark-explorer-copy b {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 10px;
          line-height: 1.3;
        }
        .landmark-explorer-copy small { color: #cdbca8; font-size: 8px; }
        .landmark-explorer.collapsed { width: auto; left: 14px; transform: none; }
        @media (max-width: 560px) {
          .landmark-explorer { bottom: calc(126px + env(safe-area-inset-bottom)); width: calc(100vw - 20px); }
          .landmark-explorer-body { padding: 8px; border-radius: 16px; }
          .landmark-explorer-track { grid-auto-columns: 132px; }
          .landmark-explorer-head strong { font-size: 11px; }
        }
      `}</style>
    </>
  );
}
