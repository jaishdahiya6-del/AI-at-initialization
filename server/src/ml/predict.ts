import fs from 'fs';
import { ModelMeta, PredictionLog } from '../models';
import { HORIZONS, Target, TARGETS, featureRow, loadSeries } from './features';
import { applyNorm, predGBM, predMLP, predRidge } from './models';
import { modelPath } from './train';
import { computeAqi } from '../utils/aqi';

const loaded = new Map<string, any>();
const load = (city: string, t: Target, h: number) => {
  const p = modelPath(city, t, h);
  if (!fs.existsSync(p)) return null;
  const k = `${p}:${fs.statSync(p).mtimeMs}`;
  if (!loaded.has(k)) loaded.set(k, JSON.parse(fs.readFileSync(p, 'utf8')));
  return loaded.get(k);
};

export async function predictCity(city: string, log = true) {
  const { start, hours } = await loadSeries(city, 10);
  let last = hours.length - 1;
  while (last >= 0 && (!hours[last] || Number.isNaN(hours[last]!.pm25))) last--;
  const metas = await ModelMeta.find({ city }).lean();
  const nowH = Math.floor(Date.now() / 3600_000);
  const lastTs = last >= 0 ? new Date((start + last) * 3600_000) : null;
  const stale = last < 0 || nowH - (start + last) > 3;
  const result: any = { city, source: 'AI Atmosphere Intelligence ML model (own prediction, not a provider forecast)', basedOn: lastTs, stale, horizons: [] as any[] };
  for (const h of HORIZONS) {
    const row: any = { horizon: h, targetTime: lastTs ? new Date(lastTs.getTime() + h * 3600_000) : null };
    for (const t of TARGETS) {
      const meta = metas.find((m: any) => m.target === t && m.horizon === h);
      row[t] = { status: meta?.status ?? 'not_trained', note: meta?.note };
      const model = meta?.status === 'ready' ? load(city, t, h) : null;
      if (!model) continue;
      if (stale) { row[t].status = 'stale_input'; row[t].note = 'Latest data is older than 3 hours; refusing to predict.'; continue; }
      const f = featureRow(hours, start, last, h, t);
      if (!f) { row[t].status = 'insufficient_recent_data'; row[t].note = 'Not enough recent hourly history for the lag features.'; continue; }
      const x = applyNorm([f], model.norm);
      const raw = model.best === 'ridge' ? predRidge(model.ridge, x[0]) : model.best === 'gbm' ? predGBM(model.gbm, x[0]) : (await predMLP(model.mlp, x))[0];
      const v = Math.max(0, raw), band = 1.96 * model.sigma;
      row[t] = { status: 'ready', value: +v.toFixed(1), lo: +Math.max(0, v - band).toFixed(1), hi: +(v + band).toFixed(1), model: model.best, version: model.version, rmse: meta?.metrics?.[model.best]?.rmse, beatsPersistence: meta?.beatsPersistence };
      if (log && lastTs) await PredictionLog.updateOne({ city, target: t, horizon: h, madeAt: lastTs }, { $setOnInsert: { targetTime: row.targetTime, value: row[t].value, lo: row[t].lo, hi: row[t].hi, model: model.best, version: model.version } }, { upsert: true }).catch(() => {});
    }
    if (row.pm25.status === 'ready' || row.pm10.status === 'ready') {
      const a = computeAqi({ pm25: row.pm25.value, pm10: row.pm10.value }, 1);
      row.aqi = a ? { value: a.aqi, category: a.category, note: 'PM-based CPCB sub-index (other pollutants not modelled)' } : null;
    }
    result.horizons.push(row);
  }
  return result;
}

/** Predictions whose target time has passed, paired with what was actually measured. */
export async function evaluation(city: string, target: Target, horizon: number, days = 7) {
  const since = new Date(Date.now() - days * 86400_000);
  const logs = await PredictionLog.find({ city, target, horizon, targetTime: { $gte: since, $lte: new Date() } }).sort({ targetTime: 1 }).lean();
  const { start, hours } = await loadSeries(city, days + 2);
  const rows = logs.map((l: any) => {
    const i = Math.floor(+l.targetTime / 3600_000) - start;
    const a = hours[i]?.[target];
    return { targetTime: l.targetTime, predicted: l.value, lo: l.lo, hi: l.hi, actual: typeof a === 'number' && !Number.isNaN(a) ? +a.toFixed(1) : null };
  });
  const paired = rows.filter((r) => r.actual !== null);
  const mae = paired.length ? +(paired.reduce((a, r) => a + Math.abs(r.predicted - r.actual!), 0) / paired.length).toFixed(2) : null;
  return { rows, pairs: paired.length, liveMae: mae };
}
