export const CATS = [
  { max: 50, name: 'Good', color: '#22c55e' }, { max: 100, name: 'Satisfactory', color: '#a3e635' },
  { max: 200, name: 'Moderate', color: '#facc15' }, { max: 300, name: 'Poor', color: '#fb923c' },
  { max: 400, name: 'Very Poor', color: '#ef4444' }, { max: 500, name: 'Severe', color: '#be123c' },
];
export const aqiCat = (aqi?: number | null) => (typeof aqi === 'number' ? CATS.find((c) => aqi <= c.max) ?? CATS[5] : { max: 0, name: 'No data', color: '#78716c' });
export const fmt = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '–');
export const fmtTime = (s?: string | Date) => (s ? new Date(s).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
export const fmtShort = (s: string, bucket = 'day') => new Date(s).toLocaleString([], bucket === 'hour' ? { day: 'numeric', hour: '2-digit' } : { day: 'numeric', month: 'short' });
