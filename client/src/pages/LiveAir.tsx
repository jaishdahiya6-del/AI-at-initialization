import { useGet } from '../hooks/useFetch';
import { useLoc } from '../hooks/useLoc';
import { Async, Card, Note, Page, Stat } from '../components/ui';
import Gauge from '../components/Gauge';
import { LineBox } from '../charts/Charts';
import { aqiCat, fmt, fmtTime } from '../utils/aqi';

const P: [string, string, string][] = [['pm25', 'PM2.5', 'µg/m³'], ['pm10', 'PM10', 'µg/m³'], ['no2', 'NO₂', 'µg/m³'], ['so2', 'SO₂', 'µg/m³'], ['o3', 'O₃', 'µg/m³'], ['co', 'CO', 'µg/m³']];
export default function LiveAir() {
  const { loc, params } = useLoc(); const cur = useGet('/current', params); const fc = useGet('/forecast', params);
  return (
    <Page title={`Live air quality: ${loc.name}`} sub="Current pollutant levels and CPCB sub-indices.">
      <Async s={cur}>{(d) => (<>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="AQI"><Gauge aqi={d.aqi?.aqi} /><p className="text-center text-xs text-ash">Updated {fmtTime(d.airTs)}</p></Card>
          <Card title="Pollutant sub-indices" className="lg:col-span-2">
            <div className="space-y-2">{P.map(([k, n, u]) => { const si = d.aqi?.subIndices?.[k]; const c = aqiCat(si); return (
              <div key={k}><div className="flex justify-between text-sm"><span>{n} <span className="text-ash">{fmt(d.air[k], 1)} {u}</span></span><span style={{ color: c.color }}>{si ?? '–'}</span></div>
                <div className="h-2 rounded bg-white/10"><div className="h-2 rounded" style={{ width: `${Math.min((si ?? 0) / 5, 100)}%`, background: c.color }} /></div></div>); })}</div>
          </Card>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="UV index" value={d.uv.available ? fmt(d.uv.uv, 1) : 'n/a'} unit={d.uv.category} />
          <Stat label="UV max today" value={d.uv.available ? fmt(d.uv.uvMax, 1) : 'n/a'} />
          <Stat label="Ozone (OpenUV)" value={d.uv.available ? fmt(d.uv.ozone, 0) : 'n/a'} unit="DU" />
          <Stat label="Safe exposure (skin type II)" value={d.uv.available && d.uv.safeExposure?.st2 ? fmt(d.uv.safeExposure.st2) : 'n/a'} unit="min" />
        </div>
        {!d.uv.available && <Note>UV unavailable: {d.uv.reason}. The OpenUV free plan has a small daily quota, so UV is cached for 3 hours.</Note>}
      </>)}</Async>
      <Card title="Official provider AQI forecast (OpenWeatherMap, not our ML)">
        <Async s={fc}>{(f) => f.air.length ? <LineBox data={f.air} series={[{ k: 'aqi', name: 'AQI (CPCB method on provider forecast)', color: '#ef4444' }, { k: 'pm25', name: 'PM2.5', color: '#fb923c' }]} bucket="hour" /> : <Note>Air forecast unavailable: {f.airError ?? 'no data'}</Note>}</Async>
      </Card>
    </Page>
  );
}
