import axios from 'axios';
import { env } from '../config/env';
import { cached } from '../utils/cache';
import { computeAqi } from '../utils/aqi';

export class ProviderError extends Error {
  constructor(msg: string, public status = 502) { super(msg); }
}
const wrap = (e: any, name: string) => {
  const s = e?.response?.status;
  if (s === 401) return new ProviderError(`${name} rejected the API key. New OpenWeather keys can take a couple of hours to activate.`);
  if (s === 403) return new ProviderError(`${name} denied access. This endpoint may not be included in your plan.`);
  if (s === 429) return new ProviderError(`${name} rate limit reached. Try again shortly.`, 429);
  if (e?.code === 'ECONNABORTED') return new ProviderError(`${name} timed out.`, 504);
  return new ProviderError(`${name} request failed${s ? ` (HTTP ${s})` : ''}.`);
};
const owm = axios.create({ baseURL: 'https://api.openweathermap.org', timeout: 10000 });
export async function owmGet(path: string, params: Record<string, any>) {
  try { return (await owm.get(path, { params: { ...params, appid: env.OPENWEATHER_API_KEY } })).data; }
  catch (e) { throw wrap(e, 'OpenWeatherMap'); }
}
const ttl = env.CACHE_TTL_SECONDS * 1000;
const key = (p: string, lat: number, lon: number) => `${p}:${lat.toFixed(2)},${lon.toFixed(2)}`;

export const normAir = (c: any) => ({ pm25: c.pm2_5, pm10: c.pm10, co: c.co, no: c.no, no2: c.no2, so2: c.so2, o3: c.o3, nh3: c.nh3 });
export const normWeather = (w: any) => ({
  temp: w.main?.temp, feelsLike: w.main?.feels_like, humidity: w.main?.humidity, pressure: w.main?.pressure,
  windSpeed: w.wind?.speed, windDeg: w.wind?.deg, clouds: w.clouds?.all, rain: w.rain?.['1h'] ?? 0,
  condition: w.weather?.[0]?.main, description: w.weather?.[0]?.description, icon: w.weather?.[0]?.icon,
});

export type Snapshot = Awaited<ReturnType<typeof getCurrent>>;
export const getCurrent = (lat: number, lon: number) => cached(key('cur', lat, lon), ttl, async () => {
  const [w, a] = await Promise.all([
    owmGet('/data/2.5/weather', { lat, lon, units: 'metric' }),
    owmGet('/data/2.5/air_pollution', { lat, lon }),
  ]);
  const air = normAir(a.list[0].components);
  return {
    ts: new Date(w.dt * 1000).toISOString(),
    airTs: new Date(a.list[0].dt * 1000).toISOString(),
    weather: normWeather(w), air, aqi: computeAqi(air), fetchedAt: new Date().toISOString(),
  };
});

export const getForecast = (lat: number, lon: number) => cached(key('fc', lat, lon), 30 * 60 * 1000, async () => {
  const [w, a] = await Promise.allSettled([
    owmGet('/data/2.5/forecast', { lat, lon, units: 'metric' }),
    owmGet('/data/2.5/air_pollution/forecast', { lat, lon }),
  ]);
  if (w.status === 'rejected') throw w.reason;
  return {
    source: 'OpenWeatherMap (official provider forecast)',
    weather: w.value.list.map((i: any) => ({
      ts: new Date(i.dt * 1000).toISOString(), temp: i.main.temp, humidity: i.main.humidity, pressure: i.main.pressure,
      windSpeed: i.wind.speed, windDeg: i.wind.deg, clouds: i.clouds.all, pop: i.pop ?? 0,
      rain: i.rain?.['3h'] ?? 0, condition: i.weather[0].main, icon: i.weather[0].icon,
    })),
    air: a.status === 'fulfilled'
      ? a.value.list.map((i: any) => { const air = normAir(i.components); return { ts: new Date(i.dt * 1000).toISOString(), ...air, aqi: computeAqi(air)?.aqi ?? null }; })
      : [],
    airError: a.status === 'rejected' ? (a.reason as Error).message : null,
  };
});

export const geocode = (q: string) => cached(`geo:${q.toLowerCase()}`, 3600_000, async () =>
  (await owmGet('/geo/1.0/direct', { q, limit: 5 })).map((g: any) => ({ name: g.name, state: g.state, country: g.country, lat: g.lat, lon: g.lon })));

export async function fetchAirHistory(lat: number, lon: number, startSec: number, endSec: number) {
  const r = await owmGet('/data/2.5/air_pollution/history', { lat, lon, start: startSec, end: endSec });
  return r.list.map((i: any) => ({ ts: new Date(i.dt * 1000), ...normAir(i.components) }));
}

// ---- OpenUV (free plan is ~50 requests/day, so lookups are cached + budgeted) ----
let uvDay = ''; let uvCount = 0;
export const uvCategory = (uv: number) => uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme';
export interface UvResult { available: boolean; reason?: string; uv?: number; uvMax?: number; category?: string; ozone?: number; safeExposure?: Record<string, number>; ts?: string }
export const getUv = (lat: number, lon: number): Promise<UvResult> =>
  cached<UvResult>(key('uv', lat, lon), (v) => (v.available ? 3 * 3600_000 : 10 * 60_000), async () => {
    if (!env.OPENUV_API_KEY) return { available: false, reason: 'OpenUV key not configured' };
    const day = new Date().toISOString().slice(0, 10);
    if (day !== uvDay) { uvDay = day; uvCount = 0; }
    if (uvCount >= env.UV_DAILY_BUDGET) return { available: false, reason: 'Daily OpenUV request budget used; try again tomorrow' };
    uvCount++;
    try {
      const r = (await axios.get('https://api.openuv.io/api/v1/uv', { params: { lat, lng: lon }, headers: { 'x-access-token': env.OPENUV_API_KEY }, timeout: 10000 })).data.result;
      return { available: true, uv: r.uv, uvMax: r.uv_max, category: uvCategory(r.uv), ozone: r.ozone, safeExposure: r.safe_exposure_time, ts: r.uv_time };
    } catch (e: any) {
      const s = e?.response?.status;
      return { available: false, reason: s === 403 ? 'OpenUV rejected the API key' : s === 429 ? 'OpenUV quota exhausted' : 'OpenUV unavailable' };
    }
  });
