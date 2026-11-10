import { Alert, Setting } from '../models';
import { emit } from '../sockets';
import { logger } from '../utils/logger';

export const DEFAULT_THRESHOLDS = { aqi: 300, pm25: 120, pm10: 250, uv: 8, tempHigh: 42, tempLow: 4, wind: 14, rain3h: 15, tempSwing: 8, spikePct: 50, spikeMinDelta: 30 };
export type Thresholds = typeof DEFAULT_THRESHOLDS;

export async function getThresholds(): Promise<Thresholds> {
  const s = await Setting.findOne({ key: 'thresholds' }).lean();
  return { ...DEFAULT_THRESHOLDS, ...((s?.value as object) ?? {}) };
}
export async function setThresholds(v: Partial<Thresholds>) {
  const merged = { ...(await getThresholds()), ...v };
  await Setting.updateOne({ key: 'thresholds' }, { $set: { value: merged } }, { upsert: true });
  return merged;
}

async function raise(city: string, type: string, value: number, threshold: number, message: string) {
  const since = new Date(Date.now() - 6 * 3600_000);
  if (await Alert.exists({ city, type, createdAt: { $gte: since } })) return null; // 6h cool-down
  const severity = value >= threshold * 1.3 || value <= threshold * 0.7 && type === 'temp_low' ? 'critical' : 'warning';
  const a = await Alert.create({ city, type, severity, message, value, threshold });
  emit('alert', a.toObject());
  logger.info(`alert ${type} ${city}`);
  return a;
}

/** Evaluate live observation (+ optional provider forecast and a reading from ~3h ago). */
export async function evaluateAlerts(cityName: string, o: any, fc?: any, prev?: any) {
  const t = await getThresholds();
  const r = (n: number) => Math.round(n);
  const checks: Promise<any>[] = [];
  const hi = (type: string, v: any, th: number, msg: string) => { if (typeof v === 'number' && v >= th) checks.push(raise(cityName, type, v, th, msg)); };
  hi('aqi', o.aqi, t.aqi, `${cityName}: AQI ${o.aqi} (${o.dominant ?? 'n/a'} dominant) is at or above ${t.aqi}.`);
  hi('pm25', o.pm25, t.pm25, `${cityName}: PM2.5 is ${r(o.pm25)} µg/m³ (threshold ${t.pm25}).`);
  hi('pm10', o.pm10, t.pm10, `${cityName}: PM10 is ${r(o.pm10)} µg/m³ (threshold ${t.pm10}).`);
  hi('uv', o.uv, t.uv, `${cityName}: UV index ${o.uv} (threshold ${t.uv}).`);
  hi('temp_high', o.temp, t.tempHigh, `${cityName}: temperature ${r(o.temp)}°C (threshold ${t.tempHigh}°C).`);
  hi('wind', o.windSpeed, t.wind, `${cityName}: wind ${o.windSpeed} m/s (threshold ${t.wind} m/s).`);
  if (typeof o.temp === 'number' && o.temp <= t.tempLow) checks.push(raise(cityName, 'temp_low', o.temp, t.tempLow, `${cityName}: temperature ${r(o.temp)}°C (threshold ${t.tempLow}°C).`));
  if (prev?.pm25 && typeof o.pm25 === 'number') {
    const d = o.pm25 - prev.pm25;
    if (d >= t.spikeMinDelta && d / prev.pm25 >= t.spikePct / 100) checks.push(raise(cityName, 'spike', r(o.pm25), r(prev.pm25), `${cityName}: PM2.5 rose from ${r(prev.pm25)} to ${r(o.pm25)} µg/m³ in about 3 hours.`));
  }
  if (fc?.weather?.length) {
    const next = fc.weather.slice(0, 8); // next 24h (3-hourly)
    const wetter = Math.max(...next.map((x: any) => x.rain));
    if (wetter >= t.rain3h) checks.push(raise(cityName, 'rain', wetter, t.rain3h, `${cityName}: provider forecast shows ${wetter} mm of rain in a 3-hour window within 24h.`));
    const temps = next.slice(0, 4).map((x: any) => x.temp);
    const swing = Math.max(...temps) - Math.min(...temps);
    if (swing >= t.tempSwing) checks.push(raise(cityName, 'weather_change', r(swing), t.tempSwing, `${cityName}: forecast temperature swing of ${r(swing)}°C within 12 hours.`));
  }
  await Promise.all(checks);
}
