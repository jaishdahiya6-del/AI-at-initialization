import { useState } from 'react';
import { useGet } from '../hooks/useFetch';
import { useApp } from '../context/AppContext';
import { api, errMsg } from '../services/api';
import { Async, Badge, Card, Note, Page } from '../components/ui';
import { LineBox } from '../charts/Charts';
import { aqiCat, fmt, fmtTime } from '../utils/aqi';

const H = [6, 12, 24, 48, 72];
export default function Predictions() {
  const { loc, user, refresh } = useApp(); const id = loc.id;
  const [target, setTarget] = useState<'pm25' | 'pm10'>('pm25'); const [hz, setHz] = useState(24);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const pred = useGet(id ? `/predictions/${id}` : null); const status = useGet('/ml/status', id ? { city: id } : undefined);
  const ev = useGet(id ? `/predictions/${id}/evaluation` : null, { target, horizon: hz });
  const cur = useGet('/current', id ? { city: id } : undefined); const fc = useGet(id ? '/forecast' : null, { city: id });
  const run = async (label: string, fn: () => Promise<any>) => { setBusy(label); setMsg(''); try { setMsg(await fn()); refresh(); } catch (e) { setMsg(errMsg(e)); } setBusy(''); };
  if (!id) return <Page title="AI predictions"><Note>Predictions are trained per monitored city (history is stored only for them). Pick one of the 13 cities from the search box.</Note></Page>;
  const official = fc.data?.air?.filter((a: any) => a.aqi !== null) ?? [];
  return (
    <Page title={`AI predictions: ${loc.name}`} sub="Own ML models (ridge, gradient boosting, TensorFlow.js MLP), evaluated on a chronological hold-out. Provider forecasts are shown separately.">
      <div className="flex flex-wrap items-center gap-2">
        <select value={target} onChange={(e) => setTarget(e.target.value as any)} aria-label="Pollutant"><option value="pm25">PM2.5</option><option value="pm10">PM10</option></select>
        <select value={hz} onChange={(e) => setHz(+e.target.value)} aria-label="Horizon">{H.map((h) => <option key={h} value={h}>{h}h ahead</option>)}</select>
        <button className="btn" disabled={!user || !!busy} title={user ? '' : 'Log in in Settings to use this'} onClick={() => run('bf', async () => `Backfilled ${(await api.post('/backfill', { city: id, days: 30 })).data.rows} hourly rows`)}>{busy === 'bf' ? 'Backfilling…' : 'Backfill 30 days'}</button>
        <button className="btn" disabled={!user || !!busy} title={user ? '' : 'Log in in Settings to use this'} onClick={() => run('tr', async () => { const r = (await api.post('/ml/train', { city: id })).data; return `Trained ${r.trained}/${r.total} models`; })}>{busy === 'tr' ? 'Training…' : 'Retrain models'}</button>
        {!user && <span className="text-xs text-ash">Log in to backfill or retrain.</span>}
        {msg && <span className="text-sm text-orange-200">{msg}</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="A. Official API forecast (OpenWeatherMap)">
          <Async s={cur}>{(d) => <p className="mb-2 text-sm">Measured now: AQI <b style={{ color: aqiCat(d.aqi?.aqi).color }}>{d.aqi?.aqi ?? '–'}</b>, PM2.5 {fmt(d.air.pm25, 1)}, PM10 {fmt(d.air.pm10, 1)} <span className="text-ash">({fmtTime(d.ts)})</span></p>}</Async>
          <LineBox data={official} bucket="hour" height={200} series={[{ k: 'aqi', name: 'Provider AQI forecast', color: '#38bdf8' }]} />
        </Card>
        <Card title="B. Our ML prediction">
          <Async s={pred}>{(p) => (<>
            {p.stale && <Note>The newest stored reading is older than 3 hours, so predictions are withheld. Use Refresh or wait for the next collection.</Note>}
            <table className="mt-2 w-full text-sm"><thead className="text-left text-ash"><tr><th>Ahead</th><th>PM2.5</th><th>PM10</th><th>AQI (PM-based)</th></tr></thead><tbody>{p.horizons.map((h: any) => (
              <tr key={h.horizon} className="border-t border-white/5"><td className="py-1.5">+{h.horizon}h</td>
                {['pm25', 'pm10'].map((t) => <td key={t}>{h[t].status === 'ready' ? <>{h[t].value} <span className="text-xs text-ash">({h[t].lo}–{h[t].hi})</span></> : <Badge color="#78716c">{h[t].status.replace(/_/g, ' ')}</Badge>}</td>)}
                <td>{h.aqi ? <span style={{ color: aqiCat(h.aqi.value).color }}>{h.aqi.value} {h.aqi.category}</span> : '–'}</td></tr>))}</tbody></table>
            <p className="mt-2 text-xs text-ash">Ranges are ±1.96σ of hold-out error (approx. 95% interval). Based on data up to {fmtTime(p.basedOn)}.</p>
          </>)}</Async>
        </Card>
      </div>
      <Card title={`Actual vs predicted (${target === 'pm25' ? 'PM2.5' : 'PM10'}, ${hz}h ahead, last 7 days)`}>
        <Async s={ev}>{(e) => e.pairs ? <><LineBox data={e.rows} x="targetTime" bucket="hour" series={[{ k: 'actual', name: 'Actual', color: '#22c55e' }, { k: 'predicted', name: 'Predicted', color: '#ea580c', dashed: true }, { k: 'hi', name: 'Upper bound', color: '#78716c', dashed: true }, { k: 'lo', name: 'Lower bound', color: '#78716c', dashed: true }]} /><p className="text-sm text-ash">Live MAE over {e.pairs} matched predictions: {e.liveMae}</p></> : <Note>No past prediction has been matched with a measurement yet. Predictions are logged hourly once a model is ready.</Note>}</Async>
      </Card>
      <Card title="Model status & evaluation">
        <Async s={status}>{(s) => !s.models.length ? <Note>No models trained yet. Backfill history, then retrain (or run <code>npm run backfill</code> and <code>npm run train</code>).</Note> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-ash"><tr><th>Target</th><th>Horizon</th><th>Status</th><th>Best</th><th>MAE</th><th>RMSE</th><th>R²</th><th>vs persistence</th><th>Train/Test</th><th>Trained</th><th>v</th></tr></thead><tbody>{s.models.map((m: any) => { const x = m.metrics?.[m.best]; return (
            <tr key={m._id} className="border-t border-white/5"><td>{m.target}</td><td>+{m.horizon}h</td><td>{m.status === 'ready' ? <Badge color="#22c55e">ready</Badge> : <Badge color="#facc15">insufficient data</Badge>}</td>
              <td>{m.best ?? '–'}</td><td>{x?.mae ?? '–'}</td><td>{x?.rmse ?? '–'}</td><td>{x?.r2 ?? '–'}</td>
              <td>{m.status === 'ready' ? (m.beatsPersistence ? <Badge color="#22c55e">better</Badge> : <Badge color="#ef4444">not better</Badge>) : '–'}</td>
              <td>{m.nTrain}/{m.nTest}</td><td>{fmtTime(m.trainedAt)}</td><td>{m.version ?? '–'}</td></tr>); })}</tbody></table>
            {s.models.filter((m: any) => m.note).slice(0, 1).map((m: any) => <p key={m._id} className="mt-2 text-xs text-ash">{m.note}</p>)}</div>)}</Async>
      </Card>
    </Page>
  );
}
