import { aqiCategory } from '../utils/aqi';

const AQI_TEXT: Record<string, string> = {
  Good: 'Air quality is good. Normal outdoor activity is fine.',
  Satisfactory: 'Air quality is acceptable. Unusually sensitive people may notice minor breathing discomfort.',
  Moderate: 'People with lung or heart disease, children and older adults may feel breathing discomfort. Consider lighter outdoor exertion.',
  Poor: 'Most people may feel discomfort with prolonged exposure. Reduce prolonged or heavy outdoor exertion.',
  'Very Poor': 'Prolonged exposure may cause respiratory illness. Avoid outdoor exertion; sensitive groups should stay indoors where possible.',
  Severe: 'Air quality affects healthy people and seriously affects those with existing conditions. Avoid outdoor physical activity.',
};
export const DISCLAIMER = 'Informational only. This is not a medical diagnostic system; follow guidance from your doctor and local authorities.';

export function advisory(aqi?: number | null, uv?: number | null, pm25?: number | null) {
  const out = { category: null as string | null, outdoor: '', mask: '', ventilation: '', uv: '', sensitive: '', warnings: [] as string[], disclaimer: DISCLAIMER };
  if (typeof aqi === 'number') {
    const c = aqiCategory(aqi);
    out.category = c;
    out.outdoor = AQI_TEXT[c];
    out.mask = aqi > 200
      ? 'A well-fitted N95/FFP2-type respirator can reduce exposure to fine particles outdoors. Cloth or surgical masks give limited protection against PM2.5.'
      : 'A mask is not generally needed at this level.';
    out.ventilation = aqi > 200
      ? 'Keep windows closed during high-pollution hours; a HEPA air purifier can help indoors.'
      : aqi <= 100 ? 'Good time to ventilate indoor spaces.' : 'Ventilate briefly when outdoor levels dip (often midday).';
    out.sensitive = aqi > 100 ? 'Children, older adults and people with heart or lung conditions should limit time outdoors.' : 'No special precautions for sensitive groups at this level.';
    if (aqi > 300) out.warnings.push('Very poor or severe air quality');
  }
  if (typeof pm25 === 'number' && pm25 > 120) out.warnings.push(`High PM2.5 (${Math.round(pm25)} µg/m³)`);
  if (typeof uv === 'number') {
    out.uv = uv < 3 ? 'UV is low; no special protection needed.'
      : uv < 6 ? 'Moderate UV: seek shade near midday; use sunscreen and a hat.'
      : uv < 8 ? 'High UV: protection required: sunscreen, hat, sunglasses, shade at midday.'
      : uv < 11 ? 'Very high UV: extra protection needed; avoid being outside at midday.'
      : 'Extreme UV: avoid midday sun and cover up.';
    if (uv >= 8) out.warnings.push(`High UV index (${uv})`);
  }
  return out;
}
