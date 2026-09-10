const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function dayOfYear(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function solarDeclination(n: number) {
  return 23.45 * Math.sin(DEG * (360 / 365) * (284 + n));
}

function equationOfTime(n: number) {
  const b = DEG * (360 / 365) * (n - 81);
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

function hourAngle(latitude: number, declination: number, altitude: number) {
  const lat = latitude * DEG;
  const dec = declination * DEG;
  const alt = altitude * DEG;
  const c = (Math.sin(alt) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  return Math.acos(Math.max(-1, Math.min(1, c))) * RAD / 15;
}

function formatHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  const hh = (h + Math.floor(m / 60)) % 24;
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export type PrayerTimes = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export function calculatePrayerTimes(date: Date, latitude = 24.4672, longitude = 39.6111, tz = 3): PrayerTimes {
  const n = dayOfYear(date);
  const dec = solarDeclination(n);
  const eot = equationOfTime(n);
  const solarNoon = 12 + tz - longitude / 15 - eot / 60;

  const sunriseHA = hourAngle(latitude, dec, -0.833);
  const fajrHA = hourAngle(latitude, dec, -18);
  const ishaHA = hourAngle(latitude, dec, -18);

  // Approximate Hanafi-independent Asr using shadow ratio 1.
  const lat = latitude * DEG;
  const decR = dec * DEG;
  const asrAlt = Math.atan(1 / (1 + Math.tan(Math.abs(lat - decR)))) * RAD;
  const asrHA = hourAngle(latitude, dec, asrAlt);

  return {
    fajr: formatHour(solarNoon - fajrHA),
    sunrise: formatHour(solarNoon - sunriseHA),
    dhuhr: formatHour(solarNoon),
    asr: formatHour(solarNoon + asrHA),
    maghrib: formatHour(solarNoon + sunriseHA),
    isha: formatHour(solarNoon + ishaHA),
  };
}
