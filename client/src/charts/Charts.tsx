import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, ReferenceArea } from 'recharts';
import { fmtShort } from '../utils/aqi';

const tip = { contentStyle: { background: '#1c110c', border: '1px solid #7c3a1a', borderRadius: 8, color: '#fff' } };
export interface Ser { k: string; name: string; color: string; dashed?: boolean }
export function LineBox({ data, series, x = 'ts', bucket = 'day', height = 260, unit }: { data: any[]; series: Ser[]; x?: string; bucket?: string; height?: number; unit?: string }) {
  if (!data?.length) return <div className="p-6 text-sm text-ash">No data for this selection yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -10, right: 10, top: 5 }}>
        <CartesianGrid stroke="rgba(255,255,255,.07)" />
        <XAxis dataKey={x} tickFormatter={(v) => fmtShort(v, bucket)} stroke="#a8998f" fontSize={11} minTickGap={30} />
        <YAxis stroke="#a8998f" fontSize={11} unit={unit} />
        <Tooltip {...tip} labelFormatter={(v) => new Date(v).toLocaleString()} />
        <Legend />
        {series.map((s) => <Line key={s.k} dataKey={s.k} name={s.name} stroke={s.color} strokeWidth={2} dot={false} connectNulls strokeDasharray={s.dashed ? '5 4' : undefined} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
export function BarBox({ data, k, x, color = '#ea580c', height = 240, name }: { data: any[]; k: string; x: string; color?: string; height?: number; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -10 }}>
        <CartesianGrid stroke="rgba(255,255,255,.07)" />
        <XAxis dataKey={x} stroke="#a8998f" fontSize={11} /><YAxis stroke="#a8998f" fontSize={11} />
        <Tooltip {...tip} /><Bar dataKey={k} name={name ?? k} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
export { ReferenceArea };
