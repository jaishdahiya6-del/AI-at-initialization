import { Observation } from '../models';

export const TARGETS = ['pm25', 'pm10'] as const;
export type Target = (typeof TARGETS)[number];
export const HORIZONS = [6, 12, 24, 48, 72];
export const IST_H = 5.5; // diurnal patterns follow local (India) time
export interface Hour { pm25: number; pm10: number; temp: number; hum: number; wind: number; pres: number; rain: number }
export const FEATURES = ['t0', 'lag1', 'lag3', 'lag6', 'lag24', 'mean24', 'other', 'hSin', 'hCos', 'dSin', 'dCos', 'mSin', 'mCos', 'temp', 'hum', 'wind', 'pres', 'rain'];
export const MIN_ROWS = 300;
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/** Hourly dense series (index = hours since `start`); missing hours are null. */
export async function loadSeries(city: string, days = 365) {
  const docs = await Observation.find({ city, ts: { $gte: new Date(Date.now() - days * 86400_000) } })
    .select('ts pm25 pm10 temp humidity pressure windSpeed rain').sort({ ts: 1 }).lean();
  return bucket(docs.map((d: any) => ({ ts: +d.ts, pm25: d.pm25, pm10: d.pm10, temp: d.temp, hum: d.humidity, pres: d.pressure, wind: d.windSpeed, rain: d.rain })));
}
export function bucket(rows: any[]) {
  if (!rows.length) return { start: 0, hours: [] as (Hour | null)[] };
  const acc = new Map<number, Record<string, number[]>>();
  for (const r of rows) {
    const h = Math.floor(r.ts / 3600_000);
    const a = acc.get(h) ?? {};
    for (const k of ['pm25', 'pm10', 'temp', 'hum', 'wind', 'pres', 'rain']) if (typeof r[k] === 'number' && Number.isFinite(r[k])) (a[k] ??= []).push(r[k]);
    acc.set(h, a);
  }
  const keys = [...acc.keys()];
  const start = Math.min(...keys), end = Math.max(...keys);
  const hours: (Hour | null)[] = [];
  for (let h = start; h <= end; h++) {
    const a = acc.get(h);
    hours.push(a ? { pm25: avg(a.pm25 ?? []), pm10: avg(a.pm10 ?? []), temp: avg(a.temp ?? []), hum: avg(a.hum ?? []), wind: avg(a.wind ?? []), pres: avg(a.pres ?? []), rain: avg(a.rain ?? []) } : null);
  }
  return { start, hours };
}

/** Feature vector at hour index i for a horizon. NaN = missing (imputed later with TRAIN means). Uses only data at or before i. */
export function featureRow(hours: (Hour | null)[], start: number, i: number, h: number, target: Target): number[] | null {
  const v = (k: number) => { const x = hours[k]?.[target]; return typeof x === 'number' && !Number.isNaN(x) ? x : NaN; };
  const t0 = v(i), l1 = v(i - 1), l3 = v(i - 3), l6 = v(i - 6), l24 = v(i - 24);
  if ([t0, l1, l3, l6, l24].some(Number.isNaN)) return null;
  const win: number[] = [];
  for (let k = i - 23; k <= i; k++) if (!Number.isNaN(v(k))) win.push(v(k));
  if (win.length < 12) return null;
  const cur = hours[i]!;
  const tt = new Date(((start + i + h) * 3600_000) + IST_H * 3600_000);
  const hr = tt.getUTCHours() + 0, dow = tt.getUTCDay(), mon = tt.getUTCMonth();
  const s = (x: number, p: number) => Math.sin((2 * Math.PI * x) / p), c = (x: number, p: number) => Math.cos((2 * Math.PI * x) / p);
  const other = target === 'pm25' ? cur.pm10 : cur.pm25;
  return [t0, l1, l3, l6, l24, avg(win), other, s(hr, 24), c(hr, 24), s(dow, 7), c(dow, 7), s(mon, 12), c(mon, 12), cur.temp, cur.hum, cur.wind, cur.pres, cur.rain];
}

export function buildRows(hours: (Hour | null)[], start: number, target: Target, h: number) {
  const X: number[][] = [], y: number[] = [], idx: number[] = [];
  for (let i = 24; i + h < hours.length; i++) {
    const yv = hours[i + h]?.[target];
    if (typeof yv !== 'number' || Number.isNaN(yv)) continue;
    const f = featureRow(hours, start, i, h, target);
    if (f) { X.push(f); y.push(yv); idx.push(i); }
  }
  return { X, y, idx };
}
