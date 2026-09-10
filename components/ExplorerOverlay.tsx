'use client';

import { useEffect, useState } from 'react';
import styles from './ExplorerOverlay.module.css';

const landmarks = [
  { id: 'early-mosque-area', label: 'المسجد النبوي', caption: 'المركز العمراني' },
  { id: 'manakha-market', label: 'السوق', caption: 'الحركة والتجارة' },
  { id: 'oasis-west', label: 'البساتين', caption: 'النخيل والزراعة' },
  { id: 'harrah-east', label: 'الحرة الشرقية', caption: 'التضاريس' },
  { id: 'baqi-direction', label: 'جهة البقيع', caption: 'المعالم الشرقية' },
];

function triggerExisting(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  el?.click();
}

export default function ExplorerOverlay() {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const focused = document.querySelector<HTMLElement>('.landmark-marker.focused');
      setActive(focused?.dataset.placeId ?? null);
    };
    const id = window.setInterval(sync, 450);
    return () => window.clearInterval(id);
  }, []);

  const focus = (id: string) => {
    setActive(id);
    triggerExisting(`[data-place-id="${id}"]`);
  };

  return (
    <div className={styles.overlay} dir="rtl">
      <button className={styles.handle} onClick={() => setOpen((v) => !v)} aria-label="فتح مستكشف المعالم">
        {open ? '×' : '☰'}
      </button>

      {open && (
        <aside className={styles.panel} aria-label="مستكشف المعالم">
          <div className={styles.head}>
            <div>
              <small>استكشاف المدينة</small>
              <strong>المعالم التاريخية</strong>
            </div>
            <span>622–632م</span>
          </div>

          <div className={styles.landmarks}>
            {landmarks.map((item) => (
              <button
                key={item.id}
                className={active === item.id ? styles.active : ''}
                onClick={() => focus(item.id)}
              >
                <span className={styles.dot} />
                <span className={styles.text}>
                  <b>{item.label}</b>
                  <small>{item.caption}</small>
                </span>
              </button>
            ))}
          </div>

          <div className={styles.quickActions}>
            <button onClick={() => triggerExisting('.map-toolbar button:nth-child(2)')}>عرض 3D</button>
            <button onClick={() => triggerExisting('.map-toolbar button:first-child')}>الطبقات</button>
          </div>

          <p className={styles.note}>إعادة بناء تاريخية تقديرية. الأشكال والمواقع التفصيلية تمثيل تفسيري وليست تصويرًا أصليًا من القرن السابع.</p>
        </aside>
      )}
    </div>
  );
}
