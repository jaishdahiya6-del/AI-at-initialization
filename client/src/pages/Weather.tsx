import { useMemo } from 'react';
import { useGet } from '../hooks/useFetch';
import { useLoc } from '../hooks/useLoc';
import { Async, Card, Note, Page, Stat } from '../components/ui';
import { LineBox } from '../charts/Charts';
import { fmt } from '../utils/aqi';

const dir = (d?: number) => (typeof d === 'number' ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8] : '–');
export default function Weather() {
  const { loc, params } = useLoc(); const cur = useGet('/current', params); const fc = useGet('/forecast', params);
  const daily = useMemo(() => {
    const m = new Map<string, any[]>();
    (fc.data?.weather ?? []).forEach((w: any) => { const k = new Date(w.ts).toLocaleDateString(); m.set(k, [...(m.get(k) ?? []), w]); });
    return [...m.entries()].map(([day, a]) => ({ day, min: Math.min(...a.map((x) => x.temp)), max: Math.max(...a.map((x) => x.temp)), pop: Math.max(...a.map((x) => x.pop)), rain: a.reduce((s, x) => s + x.rain, 0), cond: a[Math.floor(a.length / 2)].condition }));
  }, [fc.data]);
  return (
    <Page title={`Weather intelligence: ${loc.name}`} sub="All values below are the provider's official forecast (OpenWeatherMap, 3-hour steps). No ML weather model is shown.">
      <Async s={cur}>{(d) => (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Stat label="Temperature" value={fmt(d.weather.temp, 1)} unit="°C" /><Stat label="Feels like" value={fmt(d.weather.feelsLike, 1)} unit="°C" />
          <Stat label="Humidity" value={fmt(d.weather.humidity)} unit="%" /><Stat label="Pressure" value={fmt(d.weather.pressure)} unit="hPa" />
          <Stat label="Wind" value={`${fmt(d.weather.windSpeed, 1)} ${dir(d.weather.windDeg)}`} unit="m/s" /><Stat label="Cloud cover" value={fmt(d.weather.clouds)} unit="%" />
        </div>)}</Async>
      <Async s={fc}>{(f) => (<>
        <Card title="5-day outlook"><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{daily.map((d) => (
          <div key={d.day} className="glass p-3 text-sm"><div className="font-semibold">{d.day}</div><div>{d.cond}</div><div className="text-orange-200">{fmt(d.min)}° / {fmt(d.max)}°C</div><div className="text-xs text-ash">Rain chance {fmt(d.pop * 100)}% · {fmt(d.rain, 1)} mm</div></div>))}</div></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Temperature trend (°C)"><LineBox data={f.weather} bucket="hour" series={[{ k: 'temp', name: 'Temperature', color: '#fb923c' }]} height={220} /></Card>
          <Card title="Rainfall (mm per 3h) and probability"><LineBox data={f.weather.map((w: any) => ({ ...w, pop: Math.round(w.pop * 100) }))} bucket="hour" series={[{ k: 'rain', name: 'Rain mm', color: '#38bdf8' }, { k: 'pop', name: 'Rain chance %', color: '#a78bfa', dashed: true }]} height={220} /></Card>
          <Card title="Humidity (%)"><LineBox data={f.weather} bucket="hour" series={[{ k: 'humidity', name: 'Humidity', color: '#2dd4bf' }]} height={220} /></Card>
          <Card title="Wind speed (m/s)"><LineBox data={f.weather} bucket="hour" series={[{ k: 'windSpeed', name: 'Wind', color: '#facc15' }]} height={220} /></Card>
          <Card title="Pressure (hPa)"><LineBox data={f.weather} bucket="hour" series={[{ k: 'pressure', name: 'Pressure', color: '#f87171' }]} height={220} /></Card>
          <Card title="Cloud coverage (%)"><LineBox data={f.weather} bucket="hour" series={[{ k: 'clouds', name: 'Clouds', color: '#d6d3d1' }]} height={220} /></Card>
        </div>
        <Note>To compare weather across cities, use the City Comparison page.</Note>
      </>)}</Async>
    </Page>
  );
}
