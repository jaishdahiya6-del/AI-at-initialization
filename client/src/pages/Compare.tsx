import { useEffect, useState } from 'react';
import { useGet } from '../hooks/useFetch';
import { api } from '../services/api';
import { Async, Card, Note, Page } from '../components/ui';
import { BarBox } from '../charts/Charts';
import { aqiCat, fmt, fmtTime } from '../utils/aqi';

const COLS: [string, string][] = [['aqi', 'AQI'], ['pm25', 'PM2.5'], ['pm10', 'PM10'], ['temp', 'Temp °C'], ['humidity', 'Humidity %'], ['windSpeed', 'Wind m/s'], ['uv', 'UV']];
export default function Compare() {
  const [cities, setCities] = useState<any[]>([]); const [sel, setSel] = useState(['delhi', 'mumbai', 'bengaluru']); const [metric, setMetric] = useState('aqi');
  useEffect(() => { api.get('/cities').then((r) => setCities(r.data)); }, []);
  const d = useGet(sel.length >= 2 ? '/compare' : null, { cities: sel.join(',') });
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 8 ? [...s, id] : s));
  return (
    <Page title="City comparison" sub="Cities are ranked only when their readings are within 3 hours of each other.">
      <Card title="Pick 2–8 cities"><div className="flex flex-wrap gap-2">{cities.map((c) => <button key={c.id} onClick={() => toggle(c.id)} aria-pressed={sel.includes(c.id)} className={`rounded-full border px-3 py-1 text-sm ${sel.includes(c.id) ? 'border-orange-500 bg-orange-500/25' : 'border-white/15 text-ash'}`}>{c.name}</button>)}</div></Card>
      {sel.length < 2 ? <Note>Select at least two cities.</Note> : (
        <Async s={d}>{(r) => (<>
          {r.excluded.length > 0 && <Note>Excluded from ranking because their readings are too far apart in time: {r.excluded.join(', ')}.</Note>}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Ranking (cleanest first)"><ol className="space-y-2">{r.ranking.map((x: any) => <li key={x.id} className="flex justify-between"><span>{x.rank}. {x.name}</span><b style={{ color: aqiCat(x.aqi).color }}>{x.aqi}</b></li>)}</ol></Card>
            <Card title="Graph" className="lg:col-span-2" right={<select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">{COLS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}>
              <BarBox data={r.rows.filter((x: any) => !x.error)} x="name" k={metric} name={COLS.find((c) => c[0] === metric)![1]} />
            </Card>
          </div>
          <Card title="All measurements"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-ash"><tr><th>City</th>{COLS.map(([, n]) => <th key={n}>{n}</th>)}<th>Time</th></tr></thead><tbody>{r.rows.map((x: any) => x.error ? <tr key={x.id}><td>{x.name}</td><td colSpan={8} className="text-red-300">Unavailable: {x.error}</td></tr> : (
            <tr key={x.id} className="border-t border-white/5"><td className="py-1.5 font-medium">{x.name}</td>{COLS.map(([k]) => <td key={k}>{x[k] === null || x[k] === undefined ? '–' : fmt(x[k], k === 'aqi' ? 0 : 1)}</td>)}<td className="text-xs text-ash">{fmtTime(x.ts)}</td></tr>))}</tbody></table></div></Card>
          <Card title="Highest and lowest"><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{COLS.map(([k, n]) => r.extremes[k] && <div key={k}><span className="text-ash">{n}</span><br />High: {r.extremes[k].highest} · Low: {r.extremes[k].lowest}</div>)}</div></Card>
        </>)}</Async>)}
    </Page>
  );
}
