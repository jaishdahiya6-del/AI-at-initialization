import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Bell, Bot, BrainCircuit, CloudSun, FileText, GitCompare, History, LocateFixed, Map, Menu, RefreshCw, Search, Settings, User, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const NAV = [
  ['/', 'Overview', BarChart3], ['/air', 'Live Air Quality', Activity], ['/weather', 'Weather Intelligence', CloudSun],
  ['/predictions', 'AI Predictions', BrainCircuit], ['/map', 'India Pollution Map', Map], ['/history', 'Historical Analytics', History],
  ['/compare', 'City Comparison', GitCompare], ['/alerts', 'Environmental Alerts', Bell], ['/assistant', 'AI Assistant', Bot],
  ['/reports', 'Reports', FileText], ['/settings', 'Settings', Settings],
] as const;

function SearchBox() {
  const { setLoc } = useApp(); const [q, setQ] = useState(''); const [res, setRes] = useState<any[]>([]); const [cities, setCities] = useState<any[]>([]);
  const t = useRef<any>();
  useEffect(() => { api.get('/cities').then((r) => setCities(r.data)); }, []);
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setRes([]); return; }
    const local = cities.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).map((c) => ({ ...c, label: `${c.name} (monitored)` }));
    setRes(local);
    t.current = setTimeout(() => api.get('/geocode', { params: { q } }).then((r) => setRes([...local, ...r.data.map((g: any) => ({ name: g.name, lat: g.lat, lon: g.lon, label: [g.name, g.state, g.country].filter(Boolean).join(', ') }))])).catch(() => {}), 400);
  }, [q, cities]);
  return (
    <div className="relative w-full max-w-xs">
      <Search size={16} className="absolute left-3 top-2.5 text-ash" />
      <input aria-label="Search location" className="w-full pl-9" placeholder="Search location" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.length > 0 && <ul className="glass absolute z-50 mt-1 max-h-64 w-full overflow-auto p-1 text-sm">{res.map((r, i) => <li key={i}><button className="w-full rounded px-2 py-1.5 text-left hover:bg-orange-500/20" onClick={() => { setLoc({ id: r.id, name: r.name, lat: r.lat, lon: r.lon }); setQ(''); setRes([]); }}>{r.label}</button></li>)}</ul>}
    </div>
  );
}

export default function Layout() {
  const { loc, setLoc, refresh, unread, user, toast, clearToast } = useApp();
  const [open, setOpen] = useState(false); const [now, setNow] = useState(new Date()); const nav = useNavigate();
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  const here = () => navigator.geolocation?.getCurrentPosition((p) => setLoc({ name: 'My location', lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4) }), () => alert('Location permission was denied.'));
  return (
    <div className="flex min-h-full">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-orange-900/40 bg-ink/95 p-4 transition lg:static lg:translate-x-0 ${open ? '' : '-translate-x-full'}`}>
        <div className="mb-6 flex items-center justify-between"><div className="text-lg font-bold leading-tight">Atmosphere<br /><span className="text-ember">Intelligence</span></div><button className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button></div>
        <nav className="space-y-1">{NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-orange-500/20 text-orange-100 ring-1 ring-orange-500/40' : 'text-ash hover:bg-white/5'}`}><Icon size={17} />{label}</NavLink>))}</nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-orange-900/30 bg-ink/80 px-4 py-3 backdrop-blur">
          <button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
          <SearchBox />
          <button className="btn" onClick={here} title="Use my current location"><LocateFixed size={16} /><span className="hidden sm:inline">Current location</span></button>
          <span className="rounded-lg bg-white/5 px-3 py-2 text-sm">{loc.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-ash md:block">{now.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <button className="btn" onClick={refresh} aria-label="Refresh data"><RefreshCw size={16} /></button>
            <button className="btn relative" onClick={() => nav('/alerts')} aria-label="Notifications"><Bell size={16} />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-blood px-1.5 text-xs">{unread}</span>}</button>
            <button className="btn" onClick={() => nav('/settings')} aria-label="Profile"><User size={16} /><span className="hidden sm:inline">{user?.name || user?.email?.split('@')[0] || 'Guest'}</span></button>
          </div>
        </header>
        {toast && <div className="fixed right-4 top-20 z-50 max-w-sm rounded-xl border border-red-500/50 bg-soot p-3 text-sm shadow-xl" role="alert"><div className="font-semibold text-red-300">New {toast.severity} alert</div>{toast.message}<button className="mt-2 block text-xs text-ash underline" onClick={clearToast}>Dismiss</button></div>}
        <main className="p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
