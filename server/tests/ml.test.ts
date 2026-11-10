// Synthetic fixtures: used ONLY in tests, never stored or shown as environmental data.
import { fitRidge, predRidge, fitGBM, predGBM, metrics, fitNorm, applyNorm } from '../src/ml/models';
import { bucket, buildRows } from '../src/ml/features';

const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
describe('ml', () => {
  it('ridge recovers a linear relation', () => {
    const X = Array.from({ length: 200 }, () => [rnd(), rnd()]); const y = X.map(([a, b]) => 3 * a - 2 * b + 1);
    const m = fitRidge(X, y, 1e-6); expect(metrics(y, X.map((x) => predRidge(m, x))).r2).toBeGreaterThan(0.99);
  });
  it('gbm fits a non-linear step', () => {
    const X = Array.from({ length: 300 }, () => [rnd(), rnd()]); const y = X.map(([a]) => (a > 0.5 ? 10 : 0));
    const m = fitGBM(X, y, 30); expect(metrics(y, X.map((x) => predGBM(m, x))).r2).toBeGreaterThan(0.9);
  });
  it('normalisation imputes missing with train mean (0 after scaling)', () => {
    const n = fitNorm([[1], [3]]); expect(applyNorm([[NaN]], n)[0][0]).toBe(0);
  });
  it('feature rows only look backwards and target is h hours ahead', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const rows = Array.from({ length: 120 }, (_, i) => ({ ts: t0 + i * 3600_000, pm25: 100 + i, pm10: 150 + i, temp: 20, hum: 50, wind: 2, pres: 1000, rain: 0 }));
    const { start, hours } = bucket(rows); const { X, y, idx } = buildRows(hours, start, 'pm25', 6);
    expect(X.length).toBeGreaterThan(50); expect(y[0]).toBe(100 + idx[0] + 6); expect(X[0][0]).toBe(100 + idx[0]);
  });
});
