import { Alert, Observation } from '../models';
import { CITIES, City } from '../utils/cities';
import { getCurrent, getForecast, getUv } from './provider';
import { advisory } from './advisory';
import { predictCity } from '../ml/predict';
import { aggregate, getRange } from './history';
import { aqiCategory } from '../utils/aqi';

async function latest(c: City) {
  try {
    const s = await getCurrent(c.lat, c.lon);
    return { c, aqi: s.aqi?.aqi, cat: s.aqi?.category, pm25: s.air.pm25, pm10: s.air.pm10, temp: s.weather.temp, ts: s.ts, age: (Date.now() - +new Date(s.ts)) / 60000, live: true };
  } catch {
    const o: any = await Observation.findOne({ city: c.id, source: { $ne: 'owm-history' } }).sort({ ts: -1 }).lean();
    if (!o) return null;
    return { c, aqi: o.aqi, cat: o.aqi != null ? aqiCategory(o.aqi) : undefined, pm25: o.pm25, pm10: o.pm10, temp: o.temp, ts: o.ts, age: (Date.now() - +o.ts) / 60000, live: false };
  }
}
const stale = (x: any) => (x.age > 180 ? ` (note: this reading is ${Math.round(x.age / 60)}h old${x.live ? '' : ' and the live provider is unreachable'})` : '');
const find = (q: string) => [...CITIES].sort((a, b) => b.name.length - a.name.length).reduce<{ found: City[]; rest: string }>((acc, c) => {
  const n = c.name.toLowerCase();
  return acc.rest.includes(n) ? { found: [...acc.found, c], rest: acc.rest.replace(n, ' ') } : acc;
}, { found: [], rest: q }).found;

export async function ask(q: string, defaultCity: string) {
  const text = q.toLowerCase();
  const cities = find(text);
  const city = cities[0] ?? CITIES.find((c) => c.id === defaultCity) ?? CITIES[0];
  const sources: string[] = [];
  const nodata = `I don't have a usable reading for ${city.name} right now, so I won't guess.`;

  if (/compare|\bvs\b|versus/.test(text) && cities.length >= 2) {
    const r = (await Promise.all(cities.map(latest)));
    if (r.some((x) => !x)) return { answer: 'I could not get data for all of those cities, so I cannot compare them fairly.', sources };
    const gap = Math.max(...r.map((x) => +new Date(x!.ts))) - Math.min(...r.map((x) => +new Date(x!.ts)));
    return { answer: r.map((x) => `${x!.c.name}: AQI ${x!.aqi ?? 'n/a'} (${x!.cat ?? 'n/a'}), PM2.5 ${x!.pm25?.toFixed(0)}, PM10 ${x!.pm10?.toFixed(0)}`).join('\n') + (gap > 3 * 3600_000 ? '\nReadings are more than 3h apart, so treat this comparison cautiously.' : ''), sources: ['OpenWeatherMap'] };
  }
  if (/which city|better air|best air|cleanest|worst|most polluted/.test(text)) {
    const r = (await Promise.all(CITIES.map(latest))).filter((x) => x && typeof x.aqi === 'number') as NonNullable<Awaited<ReturnType<typeof latest>>>[];
    if (!r.length) return { answer: 'No city data is available right now.', sources };
    r.sort((a, b) => a.aqi! - b.aqi!);
    return { answer: `Best right now: ${r[0].c.name} (AQI ${r[0].aqi}, ${r[0].cat}). Worst: ${r.at(-1)!.c.name} (AQI ${r.at(-1)!.aqi}, ${r.at(-1)!.cat}). Based on ${r.length} monitored cities.`, sources: ['OpenWeatherMap'] };
  }
  if (/risk|alert|warning/.test(text)) {
    const a = await Alert.find({ createdAt: { $gte: new Date(Date.now() - 12 * 3600_000) } }).sort({ createdAt: -1 }).limit(8).lean();
    return { answer: a.length ? 'Recent alerts (12h):\n' + a.map((x: any) => `• [${x.severity}] ${x.message}`).join('\n') : 'No alerts were raised in the last 12 hours.', sources: ['Alert history'] };
  }
  if (/7 days|seven days|week|changed|trend/.test(text)) {
    const d = aggregate(await getRange(city.id, new Date(Date.now() - 7 * 86400_000), new Date()), 'day', ['pm25']).filter((x) => x.pm25 !== null);
    if (d.length < 2) return { answer: `I have fewer than two days of stored data for ${city.name}. Run the backfill (npm run backfill) or let the collector run for a while.`, sources: ['MongoDB'] };
    const ch = ((d.at(-1)!.pm25 - d[0].pm25) / d[0].pm25) * 100;
    return { answer: `${city.name} daily PM2.5 went from ${d[0].pm25} to ${d.at(-1)!.pm25} µg/m³ over ${d.length} days (${ch >= 0 ? '+' : ''}${ch.toFixed(0)}%).`, sources: ['MongoDB history'] };
  }
  if (/tomorrow|will pollution|predict|forecast|increase/.test(text)) {
    const p = await predictCity(city.id, false);
    const h24 = p.horizons.find((h: any) => h.horizon === 24);
    if (h24?.pm25.status === 'ready') return { answer: `Our own ML model predicts PM2.5 ≈ ${h24.pm25.value} µg/m³ in 24h for ${city.name} (likely range ${h24.pm25.lo}–${h24.pm25.hi}; model ${h24.pm25.model}${h24.pm25.beatsPersistence ? '' : ', which does not beat a simple persistence baseline in testing'}).`, sources: ['ML model'] };
    const f = await getForecast(city.lat, city.lon).catch(() => null);
    const now = await latest(city);
    if (f?.air.length && now?.aqi != null) {
      const tm = f.air.filter((x: any) => x.aqi !== null && +new Date(x.ts) > Date.now() + 12 * 3600_000 && +new Date(x.ts) < Date.now() + 36 * 3600_000);
      if (tm.length) { const a = Math.round(tm.reduce((s: number, x: any) => s + x.aqi, 0) / tm.length); return { answer: `My own ML model is not ready for ${city.name} (${h24?.pm25.note ?? h24?.pm25.status ?? 'not trained'}). The official OpenWeather forecast suggests an average AQI around ${a} tomorrow versus ${now.aqi} now.`, sources: ['OpenWeatherMap official forecast'] }; }
    }
    return { answer: `No prediction is available for ${city.name}: ML model not ready and no provider forecast could be read.`, sources };
  }
  if (/\buv\b|sun/.test(text)) {
    const u = await getUv(city.lat, city.lon);
    return { answer: u.available ? `UV index in ${city.name}: ${u.uv} (${u.category}). Today's max: ${u.uvMax}. ${advisory(null, u.uv).uv}` : `UV data for ${city.name} is unavailable: ${u.reason}.`, sources: ['OpenUV'] };
  }
  const now = await latest(city);
  if (!now) return { answer: nodata, sources };
  if (/pm ?2\.?5/.test(text)) return { answer: `PM2.5 in ${city.name} is ${now.pm25?.toFixed(1)} µg/m³${stale(now)}.`, sources: ['OpenWeatherMap'] };
  if (/pm ?10/.test(text)) return { answer: `PM10 in ${city.name} is ${now.pm10?.toFixed(1)} µg/m³${stale(now)}.`, sources: ['OpenWeatherMap'] };
  if (/safe|outside|outdoor|go out|mask/.test(text)) {
    const u = await getUv(city.lat, city.lon);
    const a = advisory(now.aqi, u.available ? u.uv : null, now.pm25);
    return { answer: `${city.name}: AQI ${now.aqi ?? 'n/a'} (${now.cat ?? 'n/a'})${stale(now)}.\n${a.outdoor}\n${a.sensitive}\n${a.mask}${a.uv ? '\n' + a.uv : ''}\n${a.disclaimer}`, sources: ['OpenWeatherMap', 'OpenUV', 'CPCB AQI categories'] };
  }
  if (/temp|weather|hot|cold/.test(text)) return { answer: `${city.name} is ${now.temp}°C${stale(now)}.`, sources: ['OpenWeatherMap'] };
  return { answer: `${city.name}: AQI ${now.aqi ?? 'n/a'} (${now.cat ?? 'n/a'}), PM2.5 ${now.pm25?.toFixed(0)}, PM10 ${now.pm10?.toFixed(0)}, ${now.temp}°C${stale(now)}.\nTry: "Is it safe to go outside in Delhi?", "Compare Delhi and Mumbai", "Will pollution increase tomorrow?", "UV risk today", "What are the current risks?"`, sources: ['OpenWeatherMap'] };
}
