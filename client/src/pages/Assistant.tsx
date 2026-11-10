import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { api, errMsg } from '../services/api';
import { useApp } from '../context/AppContext';
import { Card, Page } from '../components/ui';

const SUGG = ['Is it safe to go outside today?', 'What is the current PM2.5 level?', 'Will pollution increase tomorrow?', 'Compare Delhi and Mumbai pollution', 'Which city has better air quality right now?', 'What is the UV risk today?', 'How has pollution changed over the last seven days?', 'What are the current environmental risks?'];
export default function Assistant() {
  const { loc } = useApp();
  const [msgs, setMsgs] = useState<{ role: 'user' | 'bot'; text: string; src?: string[] }[]>([{ role: 'bot', text: `Ask me about air quality, weather, UV or predictions. I answer only from live data and stored history, and I will say so when data is missing. Default city: ${loc.name}.` }]);
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  const send = async (text: string) => {
    if (!text.trim() || busy) return; setQ(''); setBusy(true); setMsgs((m) => [...m, { role: 'user', text }]);
    try { const r = (await api.post('/assistant', { message: text, city: loc.id ?? 'delhi' })).data; setMsgs((m) => [...m, { role: 'bot', text: r.answer, src: r.sources }]); }
    catch (e) { setMsgs((m) => [...m, { role: 'bot', text: errMsg(e) }]); }
    setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };
  return (
    <Page title="AI environmental assistant" sub="Rule-based and data-grounded. No LLM or paid service involved.">
      <Card>
        <div className="max-h-[55vh] min-h-[40vh] space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-orange-600/30' : 'bg-white/5'}`}>{m.text}{m.src && m.src.length > 0 && <div className="mt-1 text-xs text-ash">Source: {m.src.join(', ')}</div>}</div>)}
          {busy && <div className="text-sm text-ash">Checking data…</div>}<div ref={end} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{SUGG.map((s) => <button key={s} className="rounded-full border border-white/15 px-3 py-1 text-xs text-ash hover:border-orange-500" onClick={() => send(s)}>{s}</button>)}</div>
        <div className="mt-3 flex gap-2"><input className="flex-1" placeholder="Ask a question…" aria-label="Message" value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(q)} /><button className="btn" onClick={() => send(q)} disabled={busy}><Send size={16} />Send</button></div>
      </Card>
    </Page>
  );
}
