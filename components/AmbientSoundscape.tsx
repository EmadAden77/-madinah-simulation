'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientSoundscapeEngine, getSoundscapeState, type SoundZone } from '@/lib/ambientSoundscape';

function inferHour() {
  const text = document.querySelector('.activity-card strong')?.textContent ?? '';
  const match = text.match(/(\d{2}):(\d{2})/);
  if (!match) return 8;
  return Number(match[1]) + Number(match[2]) / 60;
}

function inferZone(): SoundZone {
  const title = document.querySelector('.place-card h2')?.textContent ?? '';
  if (title.includes('سوق')) return 'market';
  if (title.includes('بساتين') || title.includes('واحة')) return 'farm';
  if (title.includes('بئر')) return 'well';
  if (title.includes('حرة')) return 'terrain';
  if (title.includes('مسار') || title.includes('طريق')) return 'route';
  if (title.includes('حجرات')) return 'residential';
  if (title.includes('مسجد')) return 'mosque-area';
  return 'settlement';
}

export default function AmbientSoundscape() {
  const engineRef = useRef<AmbientSoundscapeEngine | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(8);
  const [zone, setZone] = useState<SoundZone>('settlement');
  const state = useMemo(() => getSoundscapeState(zone, hour), [zone, hour]);

  useEffect(() => {
    const sync = () => {
      setHour(inferHour());
      setZone(inferZone());
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const timer = window.setInterval(sync, 1500);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    engineRef.current?.update(state);
  }, [enabled, state]);

  useEffect(() => () => engineRef.current?.stop(), []);

  const toggle = async () => {
    if (enabled) {
      engineRef.current?.stop();
      engineRef.current = null;
      setEnabled(false);
      return;
    }
    const engine = new AmbientSoundscapeEngine();
    engineRef.current = engine;
    await engine.start();
    engine.update(state);
    setEnabled(true);
  };

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 'calc(74px + env(safe-area-inset-bottom))',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 16,
        background: 'rgba(40,35,30,.82)',
        color: '#fff8ec',
        border: '1px solid rgba(255,255,255,.14)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0,0,0,.2)'
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? 'إيقاف الصوت المحيطي' : 'تشغيل الصوت المحيطي'}
        style={{
          border: 0,
          borderRadius: 999,
          padding: '8px 11px',
          background: enabled ? '#9a6749' : '#efe2cf',
          color: enabled ? '#fff' : '#4d3d31',
          fontWeight: 800,
          cursor: 'pointer'
        }}
      >
        {enabled ? '🔊 الصوت' : '🔇 الصوت'}
      </button>
      {enabled && (
        <span style={{ fontSize: 10, opacity: .9, whiteSpace: 'nowrap' }}>
          {state.label} · {hour >= 18.6 || hour < 5.5 ? 'ليل' : 'نهار'}
        </span>
      )}
    </div>
  );
}
