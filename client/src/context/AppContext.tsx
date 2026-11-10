import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

export interface Loc { id?: string; name: string; lat: number; lon: number }
const DEFAULT: Loc = { id: 'delhi', name: 'Delhi', lat: 28.6139, lon: 77.209 };
interface Ctx {
  loc: Loc; setLoc: (l: Loc) => void; refreshKey: number; refresh: () => void;
  user: any; login: (t: string, u: any) => void; logout: () => void; setUser: (u: any) => void;
  unread: number; setUnread: (n: number) => void; toast: any; clearToast: () => void;
}
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loc, setLocState] = useState<Loc>(() => { try { return JSON.parse(localStorage.getItem('loc') ?? '') ?? DEFAULT; } catch { return DEFAULT; } });
  const [refreshKey, setKey] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<any>(null);
  const setLoc = (l: Loc) => { localStorage.setItem('loc', JSON.stringify(l)); setLocState(l); };
  const refresh = useCallback(() => setKey((k) => k + 1), []);
  const login = (t: string, u: any) => { localStorage.setItem('token', t); setUser(u); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  useEffect(() => { if (localStorage.getItem('token')) api.get('/auth/me').then((r) => setUser(r.data)).catch(() => localStorage.removeItem('token')); }, []);
  useEffect(() => { api.get('/alerts?unread=true').then((r) => setUnread(r.data.unread)).catch(() => {}); }, [refreshKey]);
  useEffect(() => {
    const s = io((import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/api$/, ''));
    s.on('alert', (a) => {
      setUnread((n) => n + 1); setToast(a);
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`Environmental alert: ${a.city}`, { body: a.message });
    });
    s.on('data:update', () => setKey((k) => k + 1));
    return () => { s.close(); };
  }, []);
  return <C.Provider value={{ loc, setLoc, refreshKey, refresh, user, login, logout, setUser, unread, setUnread, toast, clearToast: () => setToast(null) }}>{children}</C.Provider>;
}
