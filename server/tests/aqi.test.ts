import { computeAqi, subIndex, aqiCategory } from '../src/utils/aqi';
describe('CPCB AQI', () => {
  it('maps PM2.5 breakpoints', () => { expect(subIndex('pm25', 30)).toBe(50); expect(subIndex('pm25', 60)).toBe(100); expect(subIndex('pm25', 90)).toBe(200); expect(subIndex('pm25', 120)).toBe(300); });
  it('uses mg/m3 for CO', () => { expect(subIndex('co', 2)).toBe(100); });
  it('takes the max sub-index as AQI and names dominant pollutant', () => {
    const r = computeAqi({ pm25: 120, pm10: 80, no2: 20 })!;
    expect(r.aqi).toBe(300); expect(r.dominant).toBe('pm25'); expect(r.category).toBe('Poor');
  });
  it('needs 3 pollutants incl. a PM, otherwise null (never invents)', () => {
    expect(computeAqi({ pm25: 50, pm10: 60 })).toBeNull();
    expect(computeAqi({ no2: 10, so2: 5, o3: 20 })).toBeNull();
  });
  it('is not US AQI', () => { expect(computeAqi({ pm25: 35, pm10: 50, no2: 10 })!.aqi).toBe(Math.round(subIndex('pm25', 35))); });
  it('categories', () => { expect(aqiCategory(45)).toBe('Good'); expect(aqiCategory(450)).toBe('Severe'); });
});
