/**
 * Indian National AQI (CPCB) sub-index method.
 * Breakpoints: [concLow, concHigh] per band, mapped onto index bands 0-50 ... 401-500.
 * Units: ug/m3 except CO (mg/m3). CPCB defines PM/NO2/SO2 on 24-h averages and CO/O3 on 8-h
 * averages; live feeds give instantaneous values, so results are an "instant CPCB-method AQI",
 * not the official bulletin AQI.
 */
export type Pollutant = 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3';
const IDX = [[0, 50], [51, 100], [101, 200], [201, 300], [301, 400], [401, 500]];
const C: Record<Pollutant, number[][]> = {
  pm25: [[0, 30], [30, 60], [60, 90], [90, 120], [120, 250], [250, 380]],
  pm10: [[0, 50], [50, 100], [100, 250], [250, 350], [350, 430], [430, 600]],
  no2: [[0, 40], [40, 80], [80, 180], [180, 280], [280, 400], [400, 800]],
  so2: [[0, 40], [40, 80], [80, 380], [380, 800], [800, 1600], [1600, 2400]],
  co: [[0, 1], [1, 2], [2, 10], [10, 17], [17, 34], [34, 50]],
  o3: [[0, 50], [50, 100], [100, 168], [168, 208], [208, 748], [748, 1000]],
};
export const CATEGORIES = [
  { max: 50, name: 'Good' }, { max: 100, name: 'Satisfactory' }, { max: 200, name: 'Moderate' },
  { max: 300, name: 'Poor' }, { max: 400, name: 'Very Poor' }, { max: 500, name: 'Severe' },
];
export const aqiCategory = (aqi: number) => (CATEGORIES.find((c) => aqi <= c.max) ?? CATEGORIES[5]).name;

export function subIndex(p: Pollutant, conc: number): number {
  const bands = C[p];
  const i = bands.findIndex(([, hi]) => conc <= hi);
  if (i === -1) return 500;
  const [cl, ch] = bands[i];
  const [il, ih] = IDX[i];
  return Math.round(((ih - il) / (ch - cl)) * (Math.max(conc, cl) - cl) + il);
}

export interface AqiResult { aqi: number; category: string; dominant: Pollutant; subIndices: Partial<Record<Pollutant, number>> }
/** Input in ug/m3 (CO also ug/m3; converted to mg/m3 here). minPollutants=3 per CPCB, incl. a PM. */
export function computeAqi(c: Partial<Record<Pollutant, number | null | undefined>>, minPollutants = 3): AqiResult | null {
  const sub: Partial<Record<Pollutant, number>> = {};
  (Object.keys(C) as Pollutant[]).forEach((p) => {
    const v = c[p];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) sub[p] = subIndex(p, p === 'co' ? v / 1000 : v);
  });
  const keys = Object.keys(sub) as Pollutant[];
  if (keys.length < minPollutants || (sub.pm25 === undefined && sub.pm10 === undefined)) return null;
  const dominant = keys.reduce((a, b) => (sub[a]! >= sub[b]! ? a : b));
  const aqi = sub[dominant]!;
  return { aqi, category: aqiCategory(aqi), dominant, subIndices: sub };
}
