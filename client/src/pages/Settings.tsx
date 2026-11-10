import { useEffect, useState } from 'react';
import { api, errMsg } from '../services/api';
import { useApp } from '../context/AppContext';
import { useGet } from '../hooks/useFetch';
import { Card, Note, Page } from '../components/ui';

const LABELS: Record<string, string> = { aqi: 'AQI at or above', pm25: 'PM2.5 (µg/m³)', pm10: 'PM10 (µg/m³)', uv: 'UV index', tempHigh: 'High temperature (°C)', tempLow: 'Low temperature (°C)', wind: 'Wind (m/s)', rain3h: 'Rain in 3h (mm)', tempSwing: 'Forecast temp swing in 12h (°C)', spikePct: 'PM2.5 spike (% in ~3h)', spikeMinDelta: 'PM2.5 spike minimum rise (µg/m³)' };
export default function SettingsPage() {
  const { user, login, logout, setUser } = useApp(); const [mode, setMode] = useState<'login' | 'register'>('login');
  const [f, setF] = useState({ email: '', password: '', name: '' }); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const th = useGet('/settings/thresholds'); const [vals, setVals] = useState<any>({}); const [cities, setCities] = useState<any[]>([]);
  useEffect(() => { if (th.data) setVals(th.data.values); }, [th.data]);
  useEffect(() => { api.get('/cities').then((r) => setCities(r.data)); }, []);
  const submit = async () => { setErr(''); try { const r = await api.post(`/auth/${mode}`, mode === 'login' ? { email: f.email, password: f.password } : f); login(r.data.token, r.data.user); setF({ email: '', password: '', name: '' }); } catch (e) { setErr(errMsg(e)); } };
  const prefs = async (b: any) => { try { setUser((await api.put('/auth/prefs', b)).data); } catch (e) { setMsg(errMsg(e)); } };
  const saveTh = async () => { try { await api.put('/settings/thresholds', vals); setMsg('Thresholds saved.'); } catch (e) { setMsg(errMsg(e)); } };
  const notif = async () => { if (!('Notification' in window)) return setMsg('This browser does not support notifications.'); setMsg(`Browser notifications: ${await Notification.requestPermission()}`); };
  return (
    <Page title="Settings" sub="Guest mode works for viewing. An account is needed to save cities, change thresholds, retrain models and trigger collection.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={user ? 'Account' : mode === 'login' ? 'Log in' : 'Create account'}>
          {user ? (<div className="space-y-3 text-sm"><p>Signed in as <b>{user.email}</b></p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={user.notify} onChange={(e) => prefs({ notify: e.target.checked })} /> Show alert notifications</label>
            <button className="btn" onClick={notif}>Enable browser notifications</button> <button className="btn" onClick={logout}>Log out</button></div>
          ) : (<div className="space-y-2">
            {mode === 'register' && <input className="w-full" placeholder="Name" aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
            <input className="w-full" type="email" placeholder="Email" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="w-full" type="password" placeholder="Password (min 8 characters)" aria-label="Password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {err && <p className="text-sm text-red-300">{err}</p>}
            <div className="flex items-center gap-3"><button className="btn" onClick={submit}>{mode === 'login' ? 'Log in' : 'Create account'}</button><button className="text-sm underline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account?' : 'Have an account?'}</button></div>
            <p className="text-xs text-ash">Not logging in keeps you in guest mode.</p></div>)}
        </Card>
        <Card title="Saved cities">{user ? <div className="flex flex-wrap gap-2">{cities.map((c) => { const on = user.savedCities.includes(c.id); return <button key={c.id} aria-pressed={on} onClick={() => prefs({ savedCities: on ? user.savedCities.filter((x: string) => x !== c.id) : [...user.savedCities, c.id] })} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-orange-500 bg-orange-500/25' : 'border-white/15 text-ash'}`}>{c.name}</button>; })}</div> : <p className="text-sm text-ash">Log in to save favourite cities.</p>}</Card>
      </div>
      <Card title="Alert thresholds" right={<button className="btn" disabled={!user} onClick={saveTh}>Save thresholds</button>}>
        {!user && <Note>Log in to change thresholds. They apply to all users of this server.</Note>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.keys(LABELS).map((k) => <label key={k} className="text-sm text-ash">{LABELS[k]}<input type="number" className="mt-1 w-full" disabled={!user} value={vals[k] ?? ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>)}</div>
        {msg && <p className="mt-2 text-sm text-orange-200">{msg}</p>}
      </Card>
      <Note>AI Atmosphere Intelligence is informational and not a medical diagnostic system. AQI values are an instant CPCB-method estimate from provider data and may differ from official CPCB bulletins.</Note>
    </Page>
  );
}
