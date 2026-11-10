import { ReactNode } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

export const Card = ({ title, children, className = '', right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) => (
  <section className={`glass p-4 ${className}`}>{(title || right) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-base font-semibold text-orange-100">{title}</h2>{right}</div>}{children}</section>
);
export const Stat = ({ label, value, unit, color }: { label: string; value: ReactNode; unit?: string; color?: string }) => (
  <div className="glass p-3"><div className="text-xs text-ash">{label}</div><div className="mt-1 text-2xl font-semibold" style={{ color }}>{value}<span className="ml-1 text-sm font-normal text-ash">{unit}</span></div></div>
);
export const Loading = () => <div className="flex items-center gap-2 p-6 text-ash"><Loader2 className="animate-spin" size={18} /> Loading data…</div>;
export const ErrorBox = ({ msg }: { msg: string }) => <div className="glass flex items-start gap-2 border-red-500/40 p-4 text-red-200"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div>{msg}</div></div>;
export const Note = ({ children }: { children: ReactNode }) => <div className="rounded-lg border border-orange-400/20 bg-orange-500/5 p-3 text-sm text-orange-100/80">{children}</div>;
export const Badge = ({ children, color = '#ea580c' }: { children: ReactNode; color?: string }) => <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: color + '33', color, border: `1px solid ${color}77` }}>{children}</span>;
export function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <div className="space-y-4"><div><h1 className="text-2xl font-bold">{title}</h1>{sub && <p className="text-sm text-ash">{sub}</p>}</div>{children}</div>;
}
export function Async({ s, children }: { s: { data: any; error: string | null; loading: boolean }; children: (d: any) => ReactNode }) {
  if (s.loading && !s.data) return <Loading />;
  if (s.error) return <ErrorBox msg={s.error} />;
  return s.data ? <>{children(s.data)}</> : null;
}
