import { Observation } from '../models';

export const METRICS = ['aqi', 'pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'temp', 'humidity', 'windSpeed', 'pressure', 'rain', 'uv'] as const;
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function bucketStart(d: Date, b: string) {
  const x = new Date(d);
  if (b === 'hour') x.setUTCMinutes(0, 0, 0);
  else { x.setUTCHours(0, 0, 0, 0); if (b === 'week') x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); if (b === 'month') x.setUTCDate(1); }
  return x;
}
export async function getRange(city: string, from: Date, to: Date) {
  return Observation.find({ city, ts: { $gte: from, $lte: to } }).sort({ ts: 1 }).lean();
}
export function aggregate(docs: any[], bucket: string, metrics: readonly string[] = METRICS) {
  const m = new Map<number, Record<string, number[]>>();
  for (const d of docs) {
    const k = +bucketStart(d.ts, bucket);
    const a = m.get(k) ?? {};
    for (const f of metrics) if (typeof d[f] === 'number') (a[f] ??= []).push(d[f]);
    m.set(k, a);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, a]) => {
    const row: any = { ts: new Date(k).toISOString() };
    for (const f of metrics) { const v = avg(a[f] ?? []); row[f] = v === null ? null : +v.toFixed(2); }
    return row;
  });
}
export async function stats(city: string, from: Date, to: Date, docs?: any[]) {
  docs ??= await getRange(city, from, to);
  const days = aggregate(docs, 'day', ['aqi', 'pm25']).filter((d) => d.aqi !== null);
  const mean = (arr: any[], k: string) => avg(arr.map((d) => d[k]).filter((v: any) => typeof v === 'number'));
  const span = +to - +from;
  const prevDocs = await getRange(city, new Date(+from - span), from);
  const cur = mean(docs, 'aqi'), prev = mean(prevDocs, 'aqi');
  const hi = days.length ? days.reduce((a, b) => (b.aqi > a.aqi ? b : a)) : null;
  const lo = days.length ? days.reduce((a, b) => (b.aqi < a.aqi ? b : a)) : null;
  return {
    samples: docs.length, avgAqi: cur === null ? null : Math.round(cur),
    highestDay: hi && { date: hi.ts, aqi: Math.round(hi.aqi) }, lowestDay: lo && { date: lo.ts, aqi: Math.round(lo.aqi) },
    changePct: cur !== null && prev ? +(((cur - prev) / prev) * 100).toFixed(1) : null,
    note: prev === null ? 'No data in the previous period, so change cannot be computed.' : undefined,
  };
}
export async function seasonal(city: string, pollutant: string) {
  const docs = await Observation.find({ city, [pollutant]: { $type: 'number' } }).select(`ts ${pollutant}`).lean();
  const m: number[][] = Array.from({ length: 12 }, () => []);
  docs.forEach((d: any) => m[new Date(d.ts).getUTCMonth()].push(d[pollutant]));
  return m.map((a, i) => ({ month: i + 1, avg: avg(a) === null ? null : +avg(a)!.toFixed(2), samples: a.length }));
}
export function toCsv(docs: any[]) {
  const cols = ['ts', 'city', 'source', ...METRICS, 'condition', 'dominant'];
  const esc = (v: any) => (v === undefined || v === null ? '' : v instanceof Date ? v.toISOString() : String(v).includes(',') ? `"${v}"` : String(v));
  return [cols.join(','), ...docs.map((d) => cols.map((c) => esc(d[c])).join(','))].join('\n');
}
