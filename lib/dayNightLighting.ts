export type DayPhase = 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'sunset';

export type LightingState = {
  phase: DayPhase;
  label: string;
  sunAzimuth: number;
  sunAltitude: number;
  rasterBrightnessMin: number;
  rasterBrightnessMax: number;
  rasterContrast: number;
  rasterSaturation: number;
  hillshadeDirection: number;
  hillshadeExaggeration: number;
  livingShadowOpacity: number;
  livingShadowTranslate: [number, number];
  overlay: string;
};

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function getHistoricalLighting(hour: number): LightingState {
  const h = ((hour % 24) + 24) % 24;
  const sunrise = 5.55;
  const sunset = 18.45;
  const solarT = clamp((h - sunrise) / (sunset - sunrise));
  const altitude = Math.max(0, Math.sin(solarT * Math.PI) * 74);
  const azimuth = 84 + solarT * 192;
  const daylight = smoothstep(sunrise - 0.45, sunrise + 0.75, h) * (1 - smoothstep(sunset - 0.75, sunset + 0.45, h));
  const lowSun = daylight * (1 - clamp(altitude / 42));
  const shadowLen = daylight > 0 ? 1.5 + lowSun * 8.5 : 0.7;
  const angle = (azimuth + 180) * Math.PI / 180;
  const shadow: [number, number] = [Math.cos(angle) * shadowLen, Math.sin(angle) * shadowLen];

  let phase: DayPhase = 'night';
  let label = 'ليل';
  let overlay = 'rgba(18, 26, 40, 0.48)';
  if (h >= 4.9 && h < 6.4) { phase = 'dawn'; label = 'فجر'; overlay = 'rgba(163, 102, 70, 0.15)'; }
  else if (h >= 6.4 && h < 10.0) { phase = 'morning'; label = 'صباح'; overlay = 'rgba(255, 214, 148, 0.06)'; }
  else if (h >= 10.0 && h < 14.2) { phase = 'midday'; label = 'ظهيرة'; overlay = 'rgba(255, 246, 214, 0.025)'; }
  else if (h >= 14.2 && h < 17.55) { phase = 'afternoon'; label = 'عصر'; overlay = 'rgba(210, 141, 82, 0.07)'; }
  else if (h >= 17.55 && h < 19.05) { phase = 'sunset'; label = 'غروب'; overlay = 'rgba(161, 76, 54, 0.18)'; }

  const twilight = phase === 'dawn' || phase === 'sunset';
  const night = phase === 'night';

  return {
    phase,
    label,
    sunAzimuth: azimuth,
    sunAltitude: altitude,
    rasterBrightnessMin: night ? 0.08 : twilight ? 0.14 : 0.18,
    rasterBrightnessMax: night ? 0.46 : twilight ? 0.82 : phase === 'midday' ? 1 : 0.94,
    rasterContrast: night ? 0.08 : twilight ? 0.12 : phase === 'midday' ? 0.04 : 0.08,
    rasterSaturation: night ? -0.55 : twilight ? -0.1 : 0.03,
    hillshadeDirection: azimuth,
    hillshadeExaggeration: night ? 0.08 : 0.28 + lowSun * 0.26,
    livingShadowOpacity: night ? 0.05 : 0.16 + lowSun * 0.16,
    livingShadowTranslate: shadow,
    overlay
  };
}
