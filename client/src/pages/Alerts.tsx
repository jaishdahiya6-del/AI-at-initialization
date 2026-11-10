import { useState } from 'react';
import { useGet } from '../hooks/useFetch';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Async, Badge, Card, Note, Page } from '../components/ui';
import { fmtTime } from '../utils/aqi';

const SEV: Record<string, string> = { critical: '#ef4444', warning: '#fb923c', info: '#38bdf8' };
export default function Alerts() {
  const { refresh } = useApp(); const [page, setPage] = useState(1); const [unread, setUnread] = useState(false);
  const d = useGet('/alerts', { page, unread: unread ? 'true' : undefined });
  const mark = async (ids?: string[]) => { await api.post('/alerts/read', { ids }); refresh(); };
  return (
    <Page title="Environmental alerts" sub="Raised by the background collector against your thresholds (Settings). New alerts also arrive live.">
      <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} /> Unread only</label><button className="btn" onClick={() => mark()}>Mark all read</button></div>
      <Async s={d}>{(r) => !r.items.length ? <Note>No alerts. They appear when a reading crosses a threshold; the same alert type for a city repeats at most every 6 hours.</Note> : (
        <Card><ul className="divide-y divide-white/5">{r.items.map((a: any) => (
          <li key={a._id} className={`flex items-start gap-3 py-3 ${a.read ? 'opacity-60' : ''}`}>
            <Badge color={SEV[a.severity]}>{a.severity}</Badge>
            <div className="flex-1"><div className="text-sm">{a.message}</div><div className="text-xs text-ash">{a.type.replace('_', ' ')} · {fmtTime(a.createdAt)}</div></div>
            {!a.read && <button className="text-xs underline" onClick={() => mark([a._id])}>Mark read</button>}
          </li>))}</ul>
          <div className="mt-3 flex items-center gap-3 text-sm"><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>Page {page} of {Math.max(1, Math.ceil(r.total / 25))}<button className="btn" disabled={page * 25 >= r.total} onClick={() => setPage(page + 1)}>Next</button></div></Card>)}</Async>
    </Page>
  );
}
