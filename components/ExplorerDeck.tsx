'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ExplorerDeck.module.css';

const scenes = [
  { id: 'early-mosque-area', icon: '◈', title: 'منطقة المسجد في المرحلة المبكرة', meta: 'مركز الاستكشاف · عمارة مبكرة' },
  { id: 'hujurat-east', icon: '▦', title: 'الحجرات شرقي المسجد', meta: 'سكن بسيط · إعادة بناء تقديرية' },
  { id: 'manakha-market', icon: '◇', title: 'سوق المناخة', meta: 'السوق المفتوح · حركة وقوافل' },
  { id: 'central-settlement', icon: '⌂', title: 'التجمع المركزي التاريخي', meta: 'نسيج عمراني · أزقة ومساكن' },
  { id: 'baqi-direction', icon: '↝', title: 'المسار نحو البقيع', meta: 'طريق تاريخي تقريبي' },
  { id: 'oasis-west', icon: '♧', title: 'بساتين الواحة الغربية', meta: 'نخيل · آبار · زراعة' },
  { id: 'harrah-east', icon: '△', title: 'الحرة الشرقية', meta: 'تضاريس بركانية قديمة' }
];

function clickScene(id: string) {
  const el = document.querySelector<HTMLElement>(`.landmark-marker[data-place-id="${id}"]`);
  el?.click();
}

function resetMap() {
  document.querySelector<HTMLElement>('button[aria-label="إعادة تمركز"]')?.click();
}

export default function ExplorerDeck() {
  const [activeId, setActiveId] = useState(scenes[0].id);
  const [touring, setTouring] = useState(false);
  const stepRef = useRef(0);

  useEffect(() => {
    if (!touring) return;
    const run = () => {
      const scene = scenes[stepRef.current % scenes.length];
      setActiveId(scene.id);
      clickScene(scene.id);
      stepRef.current += 1;
    };
    run();
    const id = window.setInterval(run, 6500);
    return () => window.clearInterval(id);
  }, [touring]);

  const open = (id: string) => {
    setTouring(false);
    setActiveId(id);
    clickScene(id);
  };

  return (
    <aside className={styles.shell} aria-label="لوحة الاستكشاف التاريخي">
      <div className={styles.rail}>
        <section className={styles.panel}>
          <div className={styles.head}>
            <div className={styles.eyebrow}><span>استكشاف تفاعلي</span><span>622–632م</span></div>
            <h2>المدينة المنورة في العهد النبوي</h2>
          </div>
          <div className={styles.actions}>
            <button className={touring ? styles.active : ''} onClick={() => setTouring((v) => !v)}>{touring ? 'إيقاف الجولة' : 'جولة تلقائية'}</button>
            <button onClick={() => { setTouring(false); resetMap(); }}>نظرة عامة</button>
          </div>
          <div className={styles.list}>
            {scenes.map((scene) => (
              <button key={scene.id} className={`${styles.card} ${activeId === scene.id ? styles.active : ''}`} onClick={() => open(scene.id)}>
                <span className={styles.badge}>{scene.icon}</span>
                <span className={styles.cardText}><b>{scene.title}</b><small>{scene.meta}</small></span>
              </button>
            ))}
          </div>
          <div className={styles.footer}>إعادة بناء تاريخية تقديرية. الانتقال إلى كل معلم يفتح زاوية استكشاف ثلاثية الأبعاد مناسبة للمشهد.</div>
        </section>
      </div>

      <div className={styles.mobileStrip}>
        {scenes.map((scene) => (
          <article key={scene.id} className={styles.mobileCard}>
            <b>{scene.icon} {scene.title}</b>
            <small>{scene.meta}</small>
            <button onClick={() => open(scene.id)}>استكشف</button>
          </article>
        ))}
      </div>
      <div className={styles.hint}>{touring ? 'الجولة التلقائية تعمل الآن' : 'اختر معلمًا للانتقال إليه مباشرة'}</div>
    </aside>
  );
}
