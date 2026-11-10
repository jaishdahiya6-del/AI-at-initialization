// Small dependency-free regressors (ridge, gradient boosting) + optional TensorFlow.js MLP.
export interface Norm { mean: number[]; std: number[] }
export const fitNorm = (X: number[][]): Norm => {
  const d = X[0].length, mean: number[] = [], std: number[] = [];
  for (let j = 0; j < d; j++) {
    const col = X.map((r) => r[j]).filter((x) => !Number.isNaN(x));
    const m = col.length ? col.reduce((a, b) => a + b, 0) / col.length : 0;
    const s = col.length > 1 ? Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) : 1;
    mean.push(m); std.push(s > 1e-9 ? s : 1);
  }
  return { mean, std };
};
/** Standardise with TRAIN statistics; missing values become 0 (= train mean). */
export const applyNorm = (X: number[][], n: Norm) => X.map((r) => r.map((x, j) => (Number.isNaN(x) ? 0 : (x - n.mean[j]) / n.std[j])));

export function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
export interface Ridge { w: number[]; b: number }
export function fitRidge(X: number[][], y: number[], lambda = 1): Ridge {
  const d = X[0].length, n = X.length, ym = y.reduce((a, c) => a + c, 0) / n;
  const xm = Array.from({ length: d }, (_, j) => X.reduce((a, r) => a + r[j], 0) / n);
  const A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? lambda : 0)));
  const b = new Array(d).fill(0);
  for (let r = 0; r < n; r++) for (let i = 0; i < d; i++) {
    const xi = X[r][i] - xm[i];
    b[i] += xi * (y[r] - ym);
    for (let j = 0; j < d; j++) A[i][j] += xi * (X[r][j] - xm[j]);
  }
  const w = solve(A, b);
  return { w, b: ym - w.reduce((a, wi, i) => a + wi * xm[i], 0) };
}
export const predRidge = (m: Ridge, x: number[]) => m.b + m.w.reduce((a, w, i) => a + w * x[i], 0);

type Node = { f: number; t: number; l: Node; r: Node } | { v: number };
export interface GBM { base: number; lr: number; trees: Node[] }
function grow(X: number[][], res: number[], ids: number[], depth: number, ths: number[][]): Node {
  const mean = ids.reduce((a, i) => a + res[i], 0) / ids.length;
  if (depth === 0 || ids.length < 20) return { v: mean };
  let best = { gain: 0, f: -1, t: 0 };
  const total = ids.reduce((a, i) => a + res[i], 0);
  for (let f = 0; f < ths.length; f++) for (const t of ths[f]) {
    let ls = 0, ln = 0;
    for (const i of ids) if (X[i][f] <= t) { ls += res[i]; ln++; }
    const rn = ids.length - ln;
    if (ln < 10 || rn < 10) continue;
    const gain = (ls * ls) / ln + ((total - ls) ** 2) / rn - (total * total) / ids.length;
    if (gain > best.gain) best = { gain, f, t };
  }
  if (best.f < 0) return { v: mean };
  return { f: best.f, t: best.t, l: grow(X, res, ids.filter((i) => X[i][best.f] <= best.t), depth - 1, ths), r: grow(X, res, ids.filter((i) => X[i][best.f] > best.t), depth - 1, ths) };
}
const walk = (n: Node, x: number[]): number => ('v' in n ? n.v : walk(x[n.f] <= n.t ? n.l : n.r, x));
export function fitGBM(X: number[][], y: number[], nTrees = 60, lr = 0.1, depth = 3): GBM {
  const base = y.reduce((a, b) => a + b, 0) / y.length;
  const ths = X[0].map((_, f) => { const s = X.map((r) => r[f]).sort((a, b) => a - b); return [...new Set([1, 2, 3, 4, 5, 6, 7, 8, 9].map((q) => s[Math.floor((q / 10) * (s.length - 1))]))]; });
  const pred = new Array(y.length).fill(base), trees: Node[] = [], ids = y.map((_, i) => i);
  for (let k = 0; k < nTrees; k++) {
    const res = y.map((v, i) => v - pred[i]);
    const tree = grow(X, res, ids, depth, ths);
    trees.push(tree);
    for (let i = 0; i < y.length; i++) pred[i] += lr * walk(tree, X[i]);
  }
  return { base, lr, trees };
}
export const predGBM = (m: GBM, x: number[]) => m.trees.reduce((a, t) => a + m.lr * walk(t, x), m.base);

// ---- TensorFlow.js MLP (pure-JS backend, so no native build on Windows) ----
export interface MLP { weights: number[][]; shapes: number[][]; ym: number; ys: number }
const build = (tf: any, d: number) => {
  const m = tf.sequential();
  m.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [d] }));
  m.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  m.add(tf.layers.dense({ units: 1 }));
  return m;
};
export async function fitMLP(X: number[][], y: number[]): Promise<MLP> {
  const tf = await import('@tensorflow/tfjs');
  const ym = y.reduce((a, b) => a + b, 0) / y.length, ys = Math.sqrt(y.reduce((a, b) => a + (b - ym) ** 2, 0) / y.length) || 1;
  const model = build(tf, X[0].length);
  model.compile({ optimizer: tf.train.adam(0.005), loss: 'meanSquaredError' });
  const xs = tf.tensor2d(X), yt = tf.tensor2d(y.map((v) => [(v - ym) / ys]));
  await model.fit(xs, yt, { epochs: 60, batchSize: 64, verbose: 0 });
  const w = model.getWeights();
  const out = { weights: w.map((t: any) => Array.from(t.dataSync() as Float32Array)), shapes: w.map((t: any) => t.shape as number[]), ym, ys };
  xs.dispose(); yt.dispose(); model.dispose();
  return out;
}
export async function predMLP(m: MLP, X: number[][]): Promise<number[]> {
  const tf = await import('@tensorflow/tfjs');
  const model = build(tf, X[0].length);
  model.setWeights(m.weights.map((w, i) => tf.tensor(w, m.shapes[i])));
  const t = model.predict(tf.tensor2d(X)) as any;
  const out = Array.from(t.dataSync() as Float32Array).map((v: number) => v * m.ys + m.ym);
  t.dispose(); model.dispose();
  return out;
}

export const metrics = (y: number[], p: number[]) => {
  const n = y.length, ym = y.reduce((a, b) => a + b, 0) / n;
  const mae = y.reduce((a, v, i) => a + Math.abs(v - p[i]), 0) / n;
  const sse = y.reduce((a, v, i) => a + (v - p[i]) ** 2, 0), sst = y.reduce((a, v) => a + (v - ym) ** 2, 0);
  return { mae: +mae.toFixed(3), rmse: +Math.sqrt(sse / n).toFixed(3), r2: sst > 0 ? +(1 - sse / sst).toFixed(4) : 0 };
};
