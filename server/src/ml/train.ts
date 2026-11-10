import fs from 'fs';
import path from 'path';
import { ModelMeta } from '../models';
import { Target, TARGETS, HORIZONS, MIN_ROWS, buildRows, loadSeries } from './features';
import { applyNorm, fitGBM, fitMLP, fitNorm, fitRidge, metrics, predGBM, predMLP, predRidge } from './models';
import { logger } from '../utils/logger';

export const MODEL_DIR = path.resolve(__dirname, '../../../trained-models');
export const modelPath = (city: string, t: Target, h: number) => path.join(MODEL_DIR, city, `${t}_${h}.json`);

export async function trainOne(city: string, hours: any[], start: number, target: Target, h: number) {
  const key = { city, target, horizon: h };
  const { X, y, idx } = buildRows(hours, start, target, h);
  if (X.length < MIN_ROWS) {
    await ModelMeta.updateOne(key, { $set: { status: 'insufficient_data', nTrain: X.length, nTest: 0, trainedAt: new Date(), note: `Need at least ${MIN_ROWS} usable hourly samples; have ${X.length}.` }, $inc: { version: 0 } }, { upsert: true });
    return null;
  }
  // Chronological split + embargo of h hours so no training target overlaps the test period.
  const split = Math.floor(X.length * 0.8), testStartIdx = idx[split];
  const trainI = idx.map((v, k) => k).filter((k) => k < split && idx[k] + h < testStartIdx);
  const testI = idx.map((_, k) => k).filter((k) => k >= split);
  if (trainI.length < 100 || testI.length < 30) {
    await ModelMeta.updateOne(key, { $set: { status: 'insufficient_data', nTrain: trainI.length, nTest: testI.length, trainedAt: new Date(), note: 'Too few samples after chronological split.' } }, { upsert: true });
    return null;
  }
  const norm = fitNorm(trainI.map((k) => X[k]));
  const Xtr = applyNorm(trainI.map((k) => X[k]), norm), ytr = trainI.map((k) => y[k]);
  const Xte = applyNorm(testI.map((k) => X[k]), norm), yte = testI.map((k) => y[k]);

  const ridge = fitRidge(Xtr, ytr, 5), gbm = fitGBM(Xtr, ytr);
  const preds: Record<string, number[]> = {
    persistence: testI.map((k) => X[k][0]),
    ridge: Xte.map((x) => predRidge(ridge, x)),
    gbm: Xte.map((x) => predGBM(gbm, x)),
  };
  let mlp: any = null;
  try { mlp = await fitMLP(Xtr, ytr); preds.mlp = await predMLP(mlp, Xte); } catch (e: any) { logger.warn(`mlp skipped: ${e.message}`); }
  const m: Record<string, any> = {};
  for (const k of Object.keys(preds)) m[k] = metrics(yte, preds[k]);
  const cands = Object.keys(m).filter((k) => k !== 'persistence');
  const best = cands.reduce((a, b) => (m[a].rmse <= m[b].rmse ? a : b));
  const sigma = Math.sqrt(preds[best].reduce((a, p, i) => a + (yte[i] - p) ** 2, 0) / yte.length);

  const prev = await ModelMeta.findOne(key).lean();
  const version = (prev?.version ?? 0) + 1;
  fs.mkdirSync(path.dirname(modelPath(city, target, h)), { recursive: true });
  fs.writeFileSync(modelPath(city, target, h), JSON.stringify({ best, norm, sigma, version, ridge, gbm: best === 'gbm' ? gbm : undefined, mlp: best === 'mlp' ? mlp : undefined }));
  await ModelMeta.updateOne(key, { $set: { status: 'ready', version, trainedAt: new Date(), best, nTrain: trainI.length, nTest: testI.length, sigma: +sigma.toFixed(3), metrics: m, beatsPersistence: m[best].rmse < m.persistence.rmse, note: undefined } }, { upsert: true });
  return { best, metrics: m };
}

export async function trainCity(city: string) {
  const { start, hours } = await loadSeries(city);
  const out: any[] = [];
  for (const target of TARGETS) for (const h of HORIZONS) {
    try { out.push({ target, h, r: await trainOne(city, hours, start, target, h) }); } catch (e: any) { logger.error(`train ${city} ${target} ${h}: ${e.message}`); }
  }
  return out;
}
