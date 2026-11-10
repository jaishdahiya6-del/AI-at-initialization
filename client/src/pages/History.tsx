import { useState } from 'react';
import { Download } from 'lucide-react';
import { useGet } from '../hooks/useFetch';
import { useApp } from '../context/AppContext';
import { download, errMsg } from '../services/api';
import { Async, Card, Note, Page, Stat } from '../components/ui';
import { BarBox, LineBox } from '../charts/Charts';
import { aqiCat } from '../utils/aqi';

const RANGES: Record<string, number> = { '7 days': 7, '30 days': 30, '90 days': 90, '1 year': 365 };
const M = [['pm25', 'PM2.5'], ['pm10', 'PM10'], ['aqi', 'AQI'], ['temp', 'Temperature'], ['humidity', 'Humidity'], ['windSpeed', 'Wind speed']];
const COL = ['#fb923c', '#ef4444', '#facc15', '#38bdf8', '#2dd4bf', '#a78bfa'];
export default function HistoryPage() {
  const { loc } = useApp(); const id = loc.id;
  const [range, setRange] = useState('30 days'); const [bucket, setBucket] = useState('day'); const [poll, setPoll] = useState('pm25'); const [err, setErr] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const q: any = { city: id, bucket, ...(range === 'custom' ? { from: from || undefined, to: to ? to + 'T23:59:59' : undefined } : { from: new Date(Date.now() - RANGES[range] * 86400000).toISOString() }) };
  const h = useGet(id ? '/history' : null, q); const sea = useGet(id ? '/seasonal' : null, { city: id, pollutant: poll });
  const ev = useGet(id ? `/predictions/${id}/evaluation` : null, { target: 'pm25', horizon: 24 });
  if (!id) return <Page title="Historical analytics"><Note>History is stored for the 13 monitored cities. Pick one from the search box.</Note></Page>;
  return (
    <Page title={`Historical analytics: ${loc.name}`} sub="Only real stored observations (live collection, provider history backfill, or admin CSV imports).">
      <div className="flex flex-wrap items-center gap-2">
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range">{[...Object.keys(RANGES), 'custom'].map((r) => <option key={r}>{r}</option>)}</select>
        {range === 'custom' && <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></>}
        <select value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Group by">{['hour', 'day', 'week', 'month'].map((b) => <option key={b} value={b}>per {b}</option>)}</select>
        <button className="btn" onClick={() => download('/history/export.csv', { city: id, from: q.from, to: q.to }, `${id}-history.csv`).catch((e) => setErr(errMsg(e)))}><Download size={16} />Export CSV</button>
        {err && <span className="text-sm text-red-300">{err}</span>}
      </div>
      <Async s={h}>{(d) => (<>
        {d.stats.samples === 0 && <Note>No stored observations in this range. Run <code>npm run backfill</code> for pollutant history, and keep the server running so the collector adds weather.</Note>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Average AQI" value={d.stats.avgAqi ?? '–'} color={aqiCat(d.stats.avgAqi).color} />
          <Stat label="Highest day" value={d.stats.highestDay?.aqi ?? '–'} unit={d.stats.highestDay ? new Date(d.stats.highestDay.date).toLocaleDateString() : ''} />
          <Stat label="Lowest day" value={d.stats.lowestDay?.aqi ?? '–'} unit={d.stats.lowestDay ? new Date(d.stats.lowestDay.date).toLocaleDateString() : ''} />
          <Stat label="Change vs previous period" value={d.stats.changePct === null ? '–' : `${d.stats.changePct > 0 ? '+' : ''}${d.stats.changePct}`} unit="%" />
        </div>
        {d.stats.note && <p className="text-xs text-ash">{d.stats.note}</p>}
        <div className="grid gap-4 lg:grid-cols-2">{M.map(([k, n], i) => <Card key={k} title={`${n} trend`}><LineBox data={d.series} bucket={bucket} height={210} series={[{ k, name: n, color: COL[i] }]} /></Card>)}</div>
      </>)}</Async>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Seasonal pattern (monthly average)" right={<select value={poll} onChange={(e) => setPoll(e.target.value)} aria-label="Pollutant">{['pm25', 'pm10', 'aqi', 'temp', 'humidity'].map((p) => <option key={p}>{p}</option>)}</select>}>
          <Async s={sea}>{(rows) => <BarBox data={rows.map((r: any) => ({ ...r, m: new Date(2000, r.month - 1).toLocaleString([], { month: 'short' }) }))} x="m" k="avg" name={poll} />}</Async>
          <p className="text-xs text-ash">Months without data show no bar; patterns need at least a year of history.</p>
        </Card>
        <Card title="Actual vs predicted PM2.5 (24h ahead)">
          <Async s={ev}>{(e) => e.pairs ? <LineBox data={e.rows} x="targetTime" bucket="hour" height={230} series={[{ k: 'actual', name: 'Actual', color: '#22c55e' }, { k: 'predicted', name: 'Predicted', color: '#ea580c', dashed: true }]} /> : <Note>No matched predictions yet.</Note>}</Async>
        </Card>
      </div>
    </Page>
  );
}
