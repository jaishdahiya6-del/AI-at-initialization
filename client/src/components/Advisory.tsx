import { ShieldCheck } from 'lucide-react';
import { Card } from './ui';
export default function Advisory({ a }: { a: any }) {
  if (!a?.category) return <Card title="Health & environmental advisory"><p className="text-sm text-ash">No AQI available, so no advisory can be given.</p></Card>;
  const rows = [['Outdoor activity', a.outdoor], ['Masks', a.mask], ['Ventilation', a.ventilation], ['Sensitive groups', a.sensitive], ['UV protection', a.uv]].filter((r) => r[1]);
  return (
    <Card title="Health & environmental advisory" right={<ShieldCheck size={18} className="text-orange-300" />}>
      <dl className="space-y-2 text-sm">{rows.map(([k, v]) => <div key={k}><dt className="text-ash">{k}</dt><dd>{v}</dd></div>)}</dl>
      {a.warnings?.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-red-300">{a.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul>}
      <p className="mt-3 text-xs text-ash">{a.disclaimer}</p>
    </Card>
  );
}
