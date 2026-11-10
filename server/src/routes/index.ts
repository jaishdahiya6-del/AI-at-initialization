import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Alert, ModelMeta, Observation, User } from '../models';
import { AuthReq, requireAuth, signToken, wrap } from '../middleware';
import { CITIES, getCity } from '../utils/cities';
import { geocode, getCurrent, getForecast, getUv, ProviderError } from '../services/provider';
import { advisory } from '../services/advisory';
import { getThresholds, setThresholds, DEFAULT_THRESHOLDS } from '../services/alerts';
import { aggregate, getRange, METRICS, seasonal, stats, toCsv } from '../services/history';
import { evaluation, predictCity } from '../ml/predict';
import { trainCity } from '../ml/train';
import { collectAll, backfillCity } from '../services/collector';
import { ask } from '../services/assistant';
import { buildReport } from '../services/reports';
import { mapLimit } from '../utils/cache';
import { HORIZONS } from '../ml/features';

export const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const heavy = rateLimit({ windowMs: 60_000, limit: 20 });

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const locQ = z.object({ city: z.string().optional(), lat: num(-90, 90).optional(), lon: num(-180, 180).optional(), name: z.string().max(80).optional() });
function loc(q: any) {
  const p = locQ.parse(q);
  const c = getCity(p.city);
  if (c) return { lat: c.lat, lon: c.lon, name: c.name, id: c.id };
  if (p.city) throw new ProviderError('Unknown city', 404);
  if (p.lat === undefined || p.lon === undefined) throw new ProviderError('Provide city or lat & lon', 400);
  return { lat: p.lat, lon: p.lon, name: p.name ?? 'Selected location', id: undefined };
}
const cityId = (v: any) => { const c = getCity(String(v)); if (!c) throw new ProviderError('Unknown or unmonitored city', 404); return c; };

router.get('/health', (_q, r) => r.json({ ok: true, time: new Date().toISOString() }));
router.get('/cities', (_q, r) => r.json(CITIES));

// ---- auth ----
const creds = z.object({ email: z.string().email().max(120), password: z.string().min(8).max(100), name: z.string().max(60).optional() });
const pub = (u: any) => ({ id: u._id, email: u.email, name: u.name, savedCities: u.savedCities, favorites: u.favorites, notify: u.notify });
router.post('/auth/register', authLimit, wrap(async (req, res) => {
  const b = creds.parse(req.body);
  const u = await User.create({ email: b.email, name: b.name, passwordHash: await bcrypt.hash(b.password, 11) });
  res.status(201).json({ token: signToken(String(u._id)), user: pub(u) });
}));
router.post('/auth/login', authLimit, wrap(async (req, res) => {
  const b = creds.pick({ email: true, password: true }).parse(req.body);
  const u = await User.findOne({ email: b.email.toLowerCase() });
  if (!u || !(await bcrypt.compare(b.password, u.passwordHash))) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: signToken(String(u._id)), user: pub(u) });
}));
router.get('/auth/me', requireAuth, wrap(async (req: AuthReq, res) => { const u = await User.findById(req.userId); u ? res.json(pub(u)) : res.status(401).json({ error: 'Unknown user' }); }));
router.put('/auth/prefs', requireAuth, wrap(async (req: AuthReq, res) => {
  const b = z.object({ savedCities: z.array(z.string()).max(30).optional(), notify: z.boolean().optional(), favorites: z.array(z.object({ name: z.string().max(80), lat: num(-90, 90), lon: num(-180, 180) })).max(30).optional() }).parse(req.body);
  res.json(pub(await User.findByIdAndUpdate(req.userId, b, { new: true })));
}));

// ---- live data ----
router.get('/current', wrap(async (req, res) => {
  const l = loc(req.query);
  const [snap, uv] = await Promise.all([getCurrent(l.lat, l.lon), getUv(l.lat, l.lon)]);
  res.json({ location: l, ...snap, uv, advisory: advisory(snap.aqi?.aqi, uv.available ? uv.uv : null, snap.air.pm25), source: 'OpenWeatherMap + OpenUV' });
}));
router.get('/forecast', wrap(async (req, res) => { const l = loc(req.query); res.json({ location: l, ...(await getForecast(l.lat, l.lon)) }); }));
router.get('/geocode', wrap(async (req, res) => res.json(await geocode(z.string().min(2).max(80).parse(req.query.q)))));
router.get('/overview', wrap(async (_q, res) => {
  const rows = await mapLimit(CITIES, 4, async (c) => {
    try {
      const s = await getCurrent(c.lat, c.lon);
      return { ...c, aqi: s.aqi?.aqi ?? null, category: s.aqi?.category ?? null, dominant: s.aqi?.dominant ?? null, pm25: s.air.pm25, pm10: s.air.pm10, temp: s.weather.temp, humidity: s.weather.humidity, windSpeed: s.weather.windSpeed, condition: s.weather.condition, ts: s.ts };
    } catch (e: any) { return { ...c, error: e.message }; }
  });
  res.json(rows);
}));

// ---- history ----
const histQ = z.object({ city: z.string(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), bucket: z.enum(['hour', 'day', 'week', 'month']).default('day'), metrics: z.string().optional() });
function histArgs(q: any) {
  const p = histQ.parse(q); const to = p.to ?? new Date(); const from = p.from ?? new Date(+to - 30 * 86400_000);
  if (+to - +from > 400 * 86400_000) throw new ProviderError('Range too large (max 400 days)', 400);
  const metrics = p.metrics ? p.metrics.split(',').filter((m) => (METRICS as readonly string[]).includes(m)) : [...METRICS];
  return { ...p, to, from, metrics, c: cityId(p.city) };
}
router.get('/history', wrap(async (req, res) => {
  const a = histArgs(req.query); const docs = await getRange(a.c.id, a.from, a.to);
  res.json({ city: a.c.id, from: a.from, to: a.to, bucket: a.bucket, series: aggregate(docs, a.bucket, a.metrics), stats: await stats(a.c.id, a.from, a.to, docs) });
}));
router.get('/history/export.csv', wrap(async (req, res) => {
  const a = histArgs(req.query);
  res.type('text/csv').attachment(`${a.c.id}-history.csv`).send(toCsv(await getRange(a.c.id, a.from, a.to)));
}));
router.get('/seasonal', wrap(async (req, res) => {
  const p = z.object({ city: z.string(), pollutant: z.enum(['pm25', 'pm10', 'aqi', 'no2', 'so2', 'o3', 'co', 'temp', 'humidity']).default('pm25') }).parse(req.query);
  res.json(await seasonal(cityId(p.city).id, p.pollutant));
}));

// ---- comparison (only readings within 3h of each other are ranked) ----
router.get('/compare', wrap(async (req, res) => {
  const ids = z.string().parse(req.query.cities).split(',').slice(0, 8).map((i) => cityId(i));
  if (ids.length < 2) throw new ProviderError('Pick at least two cities', 400);
  const rows = await Promise.all(ids.map(async (c) => {
    try {
      const [s, uv] = await Promise.all([getCurrent(c.lat, c.lon), getUv(c.lat, c.lon)]);
      return { id: c.id, name: c.name, ts: s.ts, aqi: s.aqi?.aqi ?? null, pm25: s.air.pm25, pm10: s.air.pm10, temp: s.weather.temp, humidity: s.weather.humidity, windSpeed: s.weather.windSpeed, uv: uv.available ? uv.uv : null };
    } catch (e: any) { return { id: c.id, name: c.name, error: e.message }; }
  }));
  const ok = rows.filter((r: any) => !r.error) as any[];
  const ref = Math.max(0, ...ok.map((r) => +new Date(r.ts)));
  const comparable = ok.filter((r) => ref - +new Date(r.ts) <= 3 * 3600_000);
  const ranking = comparable.filter((r) => r.aqi !== null).sort((a, b) => a.aqi - b.aqi).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, aqi: r.aqi }));
  const ext = (k: string) => { const v = comparable.filter((r) => r[k] !== null && r[k] !== undefined); return v.length ? { highest: v.reduce((a, b) => (b[k] > a[k] ? b : a)).name, lowest: v.reduce((a, b) => (b[k] < a[k] ? b : a)).name } : null; };
  res.json({ rows, ranking, extremes: Object.fromEntries(['aqi', 'pm25', 'pm10', 'temp', 'humidity', 'windSpeed', 'uv'].map((k) => [k, ext(k)])), excluded: ok.filter((r) => !comparable.includes(r)).map((r) => r.name) });
}));

// ---- ML ----
router.get('/predictions/:city', wrap(async (req, res) => res.json(await predictCity(cityId(req.params.city).id))));
router.get('/predictions/:city/evaluation', wrap(async (req, res) => {
  const p = z.object({ target: z.enum(['pm25', 'pm10']).default('pm25'), horizon: z.coerce.number().refine((h) => HORIZONS.includes(h)).default(24) }).parse(req.query);
  res.json(await evaluation(cityId(req.params.city).id, p.target, p.horizon));
}));
router.get('/ml/status', wrap(async (req, res) => {
  const q = req.query.city ? { city: cityId(req.query.city).id } : {};
  const [metas, counts] = await Promise.all([ModelMeta.find(q).sort({ city: 1, target: 1, horizon: 1 }).lean(), Observation.aggregate([{ $group: { _id: '$city', n: { $sum: 1 }, first: { $min: '$ts' }, last: { $max: '$ts' } } }])]);
  res.json({ models: metas, data: counts });
}));
router.post('/ml/train', requireAuth, heavy, wrap(async (req, res) => {
  const c = cityId(z.object({ city: z.string() }).parse(req.body).city);
  const r = await trainCity(c.id); res.json({ city: c.id, trained: r.filter((x) => x.r).length, total: r.length });
}));
router.post('/collect', requireAuth, heavy, wrap(async (_q, res) => res.json({ collected: await collectAll() })));
router.post('/backfill', requireAuth, heavy, wrap(async (req, res) => {
  const b = z.object({ city: z.string(), days: z.coerce.number().int().min(1).max(90).default(30) }).parse(req.body);
  res.json({ rows: await backfillCity(cityId(b.city), b.days) });
}));

// ---- alerts & settings ----
router.get('/alerts', wrap(async (req, res) => {
  const p = z.object({ page: z.coerce.number().int().min(1).default(1), unread: z.string().optional() }).parse(req.query);
  const f = p.unread === 'true' ? { read: false } : {};
  const [items, total, unread] = await Promise.all([Alert.find(f).sort({ createdAt: -1 }).skip((p.page - 1) * 25).limit(25).lean(), Alert.countDocuments(f), Alert.countDocuments({ read: false })]);
  res.json({ items, total, unread, page: p.page });
}));
router.post('/alerts/read', wrap(async (req, res) => {
  const b = z.object({ ids: z.array(z.string()).optional() }).parse(req.body);
  await Alert.updateMany(b.ids?.length ? { _id: { $in: b.ids } } : {}, { read: true }); res.json({ ok: true });
}));
router.get('/settings/thresholds', wrap(async (_q, res) => res.json({ values: await getThresholds(), defaults: DEFAULT_THRESHOLDS })));
router.put('/settings/thresholds', requireAuth, wrap(async (req, res) => {
  const shape = Object.fromEntries(Object.keys(DEFAULT_THRESHOLDS).map((k) => [k, z.coerce.number().min(0).max(1000).optional()]));
  res.json(await setThresholds(z.object(shape).parse(req.body)));
}));

// ---- assistant & reports ----
router.post('/assistant', rateLimit({ windowMs: 60_000, limit: 40 }), wrap(async (req, res) => {
  const b = z.object({ message: z.string().min(1).max(300), city: z.string().default('delhi') }).parse(req.body);
  res.json(await ask(b.message, b.city));
}));
router.get('/reports/:type', heavy, wrap(async (req, res) => {
  const type = z.enum(['daily', 'weekly', 'monthly', 'comparison', 'prediction']).parse(req.params.type);
  const p = z.object({ cities: z.string(), format: z.enum(['csv', 'pdf']).default('pdf') }).parse(req.query);
  const r = await buildReport(type, p.cities.split(',').slice(0, 8), p.format);
  res.type(r.mime).attachment(`${type}-report.${p.format}`).send(r.body);
}));
