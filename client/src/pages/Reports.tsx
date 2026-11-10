import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { api, download, errMsg } from '../services/api';
import { useApp } from '../context/AppContext';
import { Card, Note, Page } from '../components/ui';

const TYPES: [string, string][] = [['daily', 'Daily pollution report (last 24h)'], ['weekly', 'Weekly pollution report (7 days)'], ['monthly', 'Monthly environmental report (30 days)'], ['comparison', 'City comparison report (7 days)'], ['prediction', 'AI prediction report (with model evaluation)']];
export default function Reports() {
  const { loc } = useApp(); const [cities, setCities] = useState<any[]>([]); const [type, setType] = useState('daily'); const [sel, setSel] = useState<string[]>([loc.id ?? 'delhi']); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { api.get('/cities').then((r) => setCities(r.data)); }, []);
  const multi = type === 'comparison'; const ids = multi ? sel : sel.slice(0, 1);
  const go = async (format: 'pdf' | 'csv') => { setBusy(format); setErr(''); try { await download(`/reports/${type}`, { cities: ids.join(','), format }, `${type}-report.${format}`); } catch (e: any) { setErr(e?.response?.data instanceof Blob ? 'Report failed. Check that data exists for the selected city.' : errMsg(e)); } setBusy(''); };
  return (
    <Page title="Reports" sub="Generated from stored observations. PDFs include measurements, charts, predictions and model evaluation where relevant.">
      <Card>
        <div className="space-y-4">
          <label className="block text-sm">Report type<select className="mt-1 block w-full max-w-md" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          <div><div className="mb-1 text-sm">{multi ? 'Cities (2–8)' : 'City'}</div><div className="flex flex-wrap gap-2">{cities.map((c) => <button key={c.id} aria-pressed={sel.includes(c.id)} onClick={() => setSel((s) => multi ? (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]) : [c.id])} className={`rounded-full border px-3 py-1 text-sm ${sel.includes(c.id) ? 'border-orange-500 bg-orange-500/25' : 'border-white/15 text-ash'}`}>{c.name}</button>)}</div></div>
          <div className="flex gap-2"><button className="btn" disabled={!!busy || !ids.length || (multi && ids.length < 2)} onClick={() => go('pdf')}><FileDown size={16} />{busy === 'pdf' ? 'Building…' : 'Download PDF'}</button><button className="btn" disabled={!!busy || !ids.length} onClick={() => go('csv')}><FileDown size={16} />{busy === 'csv' ? 'Building…' : 'Download CSV'}</button></div>
          {err && <p className="text-sm text-red-300">{err}</p>}
        </div>
      </Card>
      <Note>Reports only contain data the app has stored. For a newly set-up install, run the backfill first (npm run backfill) or let the collector run for a while.</Note>
    </Page>
  );
}
