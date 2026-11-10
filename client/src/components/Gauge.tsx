import { motion } from 'framer-motion';
import { aqiCat } from '../utils/aqi';

/** Half-circle AQI dial (0–500). The arc length animates to the current value. */
export default function Gauge({ aqi, size = 260 }: { aqi?: number | null; size?: number }) {
  const cat = aqiCat(aqi); const frac = typeof aqi === 'number' ? Math.min(aqi / 500, 1) : 0;
  const d = 'M 20 120 A 100 100 0 0 1 220 120';
  return (
    <div style={{ width: size }} className="mx-auto text-center" role="img" aria-label={`AQI ${aqi ?? 'no data'}, ${cat.name}`}>
      <svg viewBox="0 0 240 140" width="100%">
        <path d={d} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="16" strokeLinecap="round" />
        <motion.path d={d} fill="none" stroke={cat.color} strokeWidth="16" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${cat.color})` }}
          initial={{ pathLength: 0 }} animate={{ pathLength: frac }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <text x="120" y="100" textAnchor="middle" fontSize="44" fontWeight="700" fill="#fff">{typeof aqi === 'number' ? aqi : '–'}</text>
        <text x="120" y="124" textAnchor="middle" fontSize="13" fill={cat.color}>{cat.name}</text>
      </svg>
    </div>
  );
}
