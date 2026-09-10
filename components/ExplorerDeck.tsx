'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ExplorerDeck.module.css';

type SceneCategory = 'all' | 'core' | 'daily' | 'landscape';

type Scene = {
  id: string;
  icon: string;
  title: string;
  meta: string;
  category: Exclude<SceneCategory, 'all'>;
  confidence: 'مرتفعة' | 'متوسطة' | 'تقديرية';
};

const scenes: Scene[] = [
  { id: 'early-mosque-area', icon: '◈', title: 'منطقة المسجد في المرحلة المبكرة', meta: 'مركز الاستكشاف · عمارة مبكرة', category: 'core', confidence: 'مرتفعة' },
  { id: 'hujurat-east', icon: '▦', title: 'الحجرات شرقي المسجد', meta: 'سكن بسيط · إعادة بناء تقديرية', category: 'core', confidence: 'تقديرية' },
  { id: 'manakha-market', icon: '◇', title: 'سوق المناخة', meta: 'سوق مفتوح · حركة وقوافل', category: 'daily', confidence: 'متوسطة' },
  { id: 'central-settlement', icon: '⌂', title: 'التجمع المركزي التاريخي', meta: 'نسيج عمراني · أزقة ومساكن', category: 'daily', confidence: 'تقديرية' },
  { id: 'baqi-direction', icon: '↝', title: 'المسار نحو البقيع', meta: 'طريق تاريخي تقريبي', category: 'daily', confidence: 'متوسطة' },
  { id: 'oasis-west', icon: '♧', title: 'بساتين الواحة الغربية', meta: 'نخيل · آبار · زراعة', category: 'landscape', confidence: 'متوسطة' },
  { id: 'harrah-east', icon: '△', title: 'الحرة الشرقية', meta: 'تضاريس بركانية قديمة', category: 'landscape', confidence: 'مرتفعة' }
];

const categoryLabels: Record<SceneCategory, string> = {
  all: 'الكل',
  core: 'المعالم',
  daily: 'الحياة اليومية',
  landscape: 'الطبيعة'
};

function clickScene(id: string) {
  const el = document.querySelector<HTMLElement>(`.landmark-marker[data-place-id="${id}"]`);
  el?.click();
}

function resetMap() {
  document.querySelector<HTMLElement>('button[aria-label="إعادة تمركز"]')?.click();
}

export default function ExplorerDeck() {
  const [activeId, setActiveId] = useState(scenes[0].id);
  const [category, setCategory] = useState<SceneCategory>('all');
  const [touring, setTouring] = useState(false);
  const stepRef = useRef(0);
  const filteredScenes = useMemo(() => category === 'all' ? scenes : scenes.filter((scene) => scene.category === category), [category]);
  const activeScene = scenes.find((scene) => scene.id === activeId) ?? scenes[0];
  const activeIndex = Math.max(0, filteredScenes.findIndex((scene) => scene.id === activeId));

  useEffect(() => {
    if (!filteredScenes.some((scene) => scene.id === activeId)) {
      setActiveId(filteredScenes[0]?.id ?? scenes[0].id);
    }
    stepRef.current = 0;
  }, [category]);

  useEffect(() => {
    if (!touring || filteredScenes.length === 0) return;
    const run = () => {
      const scene = filteredScenes[stepRef.current % filteredScenes.length];
      setActiveId(scene.id);
      clickScene(scene.id);
      stepRef.current += 1;
    };
    run();
    const id = window.setInterval(run, 6500);
    return () => window.clearInterval(id);
  }, [touring, filteredScenes]);

  const open = (id: string) => {
    setTouring(false);
    setActiveId(id);
    clickScene(id);
  };

  const move = (direction: -1 | 1) => {
    if (!filteredScenes.length) return;
    const current = Math.max(0, filteredScenes.findIndex((scene) => scene.id === activeId));
    const next = (current + direction + filteredScenes.length) % filteredScenes.length;
    open(filteredScenes[next].id);
  };

  return (
    <aside className={styles.shell} aria-label="لوحة الاستكشاف التاريخي">
      <div className={styles.rail}>
        <section className={styles.panel}>
          <div className={styles.head}>
            <div className={styles.eyebrow}><span>استكشاف تفاعلي</span><span>622–632م</span></div>
            <h2>المدينة المنورة في العهد النبوي</h2>
            <p>اختر معلمًا للانتقال مباشرة إلى زاوية عرض قريبة، ثم تنقّل بين طبقات المكان والزمن.</p>
          </div>

          <div className={styles.filters} role="tablist" aria-label="تصنيف المعالم">
            {(Object.keys(categoryLabels) as SceneCategory[]).map((key) => (
              <button key={key} className={category === key ? styles.activeFilter : ''} onClick={() => setCategory(key)}>{categoryLabels[key]}</button>
            ))}
          </div>

          <div className={styles.actions}>
            <button className={touring ? styles.active : ''} onClick={() => setTouring((v) => !v)}>{touring ? 'إيقاف الجولة' : 'جولة تلقائية'}</button>
            <button onClick={() => { setTouring(false); resetMap(); }}>نظرة عامة</button>
          </div>

          <div className={styles.featured}>
            <div className={styles.featuredIcon}>{activeScene.icon}</div>
            <div className={styles.featuredText}>
              <small>المشهد الحالي</small>
              <strong>{activeScene.title}</strong>
              <span>{activeScene.meta}</span>
            </div>
            <div className={styles.confidence}>الثقة: {activeScene.confidence}</div>
          </div>

          <div className={styles.navigator}>
            <button aria-label="المعلم السابق" onClick={() => move(-1)}>‹</button>
            <div><b>{activeIndex + 1}</b><span>/</span><span>{filteredScenes.length}</span></div>
            <button aria-label="المعلم التالي" onClick={() => move(1)}>›</button>
          </div>

          <div className={styles.list}>
            {filteredScenes.map((scene) => (
              <button key={scene.id} className={`${styles.card} ${activeId === scene.id ? styles.active : ''}`} onClick={() => open(scene.id)}>
                <span className={styles.badge}>{scene.icon}</span>
                <span className={styles.cardText}><b>{scene.title}</b><small>{scene.meta}</small></span>
                <span className={styles.chevron}>←</span>
              </button>
            ))}
          </div>

          <div className={styles.footer}>إعادة بناء تاريخية تقديرية. بعض المواقع والتفاصيل العمرانية تقريبية بحسب مستوى الدليل المتاح.</div>
        </section>
      </div>

      <div className={styles.mobileStrip}>
        {filteredScenes.map((scene) => (
          <article key={scene.id} className={`${styles.mobileCard} ${activeId === scene.id ? styles.mobileActive : ''}`}>
            <div className={styles.mobileTop}><span>{scene.icon}</span><small>{scene.confidence}</small></div>
            <b>{scene.title}</b>
            <small>{scene.meta}</small>
            <button onClick={() => open(scene.id)}>استكشف</button>
          </article>
        ))}
      </div>

      <div className={styles.hint}>{touring ? 'الجولة التلقائية تعمل الآن' : `${activeScene.icon} ${activeScene.title}`}</div>
    </aside>
  );
}
