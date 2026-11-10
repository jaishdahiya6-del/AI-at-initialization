import { motion } from 'framer-motion';
import { useGet } from '../hooks/useFetch';
import { useLoc } from '../hooks/useLoc';
import { useApp } from '../context/AppContext';
import { Async, Card, Page, Stat } from '../components/ui';
import Gauge from '../components/Gauge';
import Advisory from '../components/Advisory';
import { aqiCat, fmt, fmtTime } from '../utils/aqi';

export default function Overview() {
  const { loc, params } = useLoc(); const { setLoc } = useApp();
  const cur = useGet('/current', params); const all = useGet('/overview');
  return (
    <Page title={`Overview: ${loc.name}`} sub="Live readings from OpenWeatherMap and OpenUV. AQI uses the Indian CPCB method.">
      <Async s={cur}>{(d) => (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card title="Air Quality Index (CPCB)" className="xl:col-span-1">
            <Gauge aqi={d.aqi?.aqi} />
            <p className="mt-2 text-center text-sm text-ash">{d.aqi ? `Dominant pollutant: ${d.aqi.dominant.toUpperCase()}` : 'AQI could not be computed from the available pollutants.'}</p>
            <p className="mt-1 text-center text-xs text-ash">Last updated {fmtTime(d.ts)}</p>
          </Card>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:col-span-2">
            <Stat label="PM2.5" value={fmt(d.air.pm25, 1)} unit="µg/m³" />
            <Stat label="PM10" value={fmt(d.air.pm10, 1)} unit="µg/m³" />
            <Stat label="Temperature" value={fmt(d.weather.temp, 1)} unit="°C" />
            <Stat label="Humidity" value={fmt(d.weather.humidity)} unit="%" />
            <Stat label="Wind" value={fmt(d.weather.windSpeed, 1)} unit="m/s" />
            <Stat label="UV index" value={d.uv.available ? fmt(d.uv.uv, 1) : 'n/a'} unit={d.uv.available ? d.uv.category : ''} />
            <div className="glass col-span-2 p-3 sm:col-span-3"><div className="text-xs text-ash">Conditions</div><div className="text-lg capitalize">{d.weather.description ?? d.weather.condition}</div>{!d.uv.available && <div className="text-xs text-ash">UV unavailable: {d.uv.reason}</div>}</div>
          </div>
          <div className="xl:col-span-3"><Advisory a={d.advisory} /></div>
        </div>)}</Async>
      <Card title="Monitored cities">
        <Async s={all}>{(rows: any[]) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{rows.map((c, i) => { const cat = aqiCat(c.aqi); return (
            <motion.button key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} onClick={() => setLoc({ id: c.id, name: c.name, lat: c.lat, lon: c.lon })}
              className="glass p-3 text-left hover:ring-1 hover:ring-orange-500/60" style={{ borderLeft: `4px solid ${cat.color}` }}>
              <div className="flex items-center justify-between"><span className="font-semibold">{c.name}</span><span className="text-xs text-ash">{c.state}</span></div>
              {c.error ? <p className="mt-2 text-sm text-red-300">Unavailable: {c.error}</p> : <>
                <div className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-bold" style={{ color: cat.color }}>{c.aqi ?? '–'}</span><span className="text-sm" style={{ color: cat.color }}>{cat.name}</span></div>
                <div className="mt-1 text-xs text-ash">PM2.5 {fmt(c.pm25)} · PM10 {fmt(c.pm10)} · {fmt(c.temp)}°C · {c.condition}</div></>}
            </motion.button>); })}</div>)}</Async>
      </Card>
    </Page>
  );
}
