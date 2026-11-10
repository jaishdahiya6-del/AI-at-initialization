import { render, screen } from '@testing-library/react';
import { aqiCat } from '../utils/aqi';
import Gauge from '../components/Gauge';
describe('aqi utils', () => {
  it('categorises', () => { expect(aqiCat(45).name).toBe('Good'); expect(aqiCat(null).name).toBe('No data'); expect(aqiCat(320).name).toBe('Very Poor'); });
  it('gauge shows value and category', () => { render(<Gauge aqi={156} />); expect(screen.getByText('156')).toBeTruthy(); expect(screen.getByText('Moderate')).toBeTruthy(); });
});
