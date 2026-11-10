import { Observation } from '../models';
import { CITIES, City } from '../utils/cities';
import { getCurrent, getForecast, getUv, fetchAirHistory } from './provider';
import { evaluateAlerts } from './alerts';
import { emit } from '../sockets';
import { logger } from '../utils/logger';
import { computeAqi } from '../utils/aqi';

export async function collectCity(c: City, withForecast = true) {
  const snap = await getCurrent(c.lat, c.lon);
  const uv = await getUv(c.lat, c.lon);
  const doc = {
    ...snap.weather, ...snap.air, aqi: snap.aqi?.aqi, dominant: snap.aqi?.dominant, uv: uv.available ? uv.uv : undefined,
  } as any;
  delete doc.description; delete doc.icon;
  const ts = new Date(snap.ts);
  await Observation.updateOne({ city: c.id, ts, source: 'owm-live' }, { $set: doc }, { upsert: true });
  const prev = await Observation.findOne({ city: c.id, source: 'owm-live', ts: { $lte: new Date(ts.getTime() - 2.5 * 3600_000), $gte: new Date(ts.getTime() - 4 * 3600_000) } }).sort({ ts: -1 }).lean();
  const fc = withForecast ? await getForecast(c.lat, c.lon).catch(() => undefined) : undefined;
  await evaluateAlerts(c.name, doc, fc, prev);
  emit('data:update', { city: c.id, ts });
  return doc;
}

export async function collectAll() {
  let ok = 0;
  for (const c of CITIES) {
    try { await collectCity(c); ok++; } catch (e: any) { logger.warn(`collect ${c.id} failed: ${e.message}`); }
  }
  logger.info(`collected ${ok}/${CITIES.length} cities`);
  return ok;
}

/** Backfill hourly pollutant history from OpenWeather (free endpoint; no weather history on free plans). */
export async function backfillCity(c: City, days = 30) {
  const end = Math.floor(Date.now() / 1000);
  let total = 0;
  for (let s = end - days * 86400; s < end; s += 7 * 86400) {
    const rows = await fetchAirHistory(c.lat, c.lon, s, Math.min(s + 7 * 86400, end));
    const ops = rows.map((r: any) => {
      const a = computeAqi(r);
      return { updateOne: { filter: { city: c.id, ts: r.ts, source: 'owm-history' }, update: { $set: { pm25: r.pm25, pm10: r.pm10, co: r.co, no: r.no, no2: r.no2, so2: r.so2, o3: r.o3, nh3: r.nh3, aqi: a?.aqi, dominant: a?.dominant } }, upsert: true } };
    });
    if (ops.length) await Observation.bulkWrite(ops, { ordered: false });
    total += ops.length;
  }
  return total;
}
