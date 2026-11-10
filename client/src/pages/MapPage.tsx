import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { useGet } from '../hooks/useFetch';
import { useApp } from '../context/AppContext';
import { Async, Card, Note, Page } from '../components/ui';
import { CATS, aqiCat, fmt, fmtTime } from '../utils/aqi';
import { useNavigate } from 'react-router-dom';

function Fly({ lat, lon }: { lat: number; lon: number }) { const m = useMap(); useEffect(() => { m.flyTo([lat, lon], Math.max(m.getZoom(), 6), { duration: 0.8 }); }, [lat, lon, m]); return null; }
export default function MapPage() {
  const { loc, setLoc } = useApp(); const all = useGet('/overview'); const nav = useNavigate();
  return (
    <Page title="India pollution map" sub="Markers exist only where we have a real reading. Nothing is interpolated between cities.">
      <Card>
        <div className="relative">
          <MapContainer center={[22.5, 79]} zoom={5} style={{ height: '70vh', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Fly lat={loc.lat} lon={loc.lon} />
            {(all.data ?? []).filter((c: any) => !c.error).map((c: any) => { const cat = aqiCat(c.aqi); return (
              <CircleMarker key={c.id} center={[c.lat, c.lon]} radius={c.id === loc.id ? 16 : 12} pathOptions={{ color: '#fff', weight: c.id === loc.id ? 3 : 1, fillColor: cat.color, fillOpacity: 0.85 }}>
                <Popup><div className="text-sm text-black"><b>{c.name}</b>, {c.state}<br />AQI <b>{c.aqi ?? '–'}</b> ({cat.name})<br />PM2.5 {fmt(c.pm25, 1)} · PM10 {fmt(c.pm10, 1)}<br />{fmt(c.temp, 1)}°C · {fmt(c.humidity)}% · {c.condition}<br /><span className="text-xs">{fmtTime(c.ts)}</span><br />
                  <button className="mt-1 underline" onClick={() => { setLoc({ id: c.id, name: c.name, lat: c.lat, lon: c.lon }); nav('/'); }}>Open full profile</button></div></Popup>
              </CircleMarker>); })}
          </MapContainer>
          <div className="glass absolute bottom-3 left-3 z-[1000] p-2 text-xs"><div className="mb-1 font-semibold">AQI (CPCB)</div>{CATS.map((c) => <div key={c.name} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />{c.name}</div>)}</div>
        </div>
      </Card>
      <Async s={{ ...all, data: all.data?.some((c: any) => c.error) ? all.data : null }}>{(rows: any[]) => <Note>Some cities have no reading right now: {rows.filter((c) => c.error).map((c) => c.name).join(', ')}.</Note>}</Async>
      <Note>A heatmap layer is intentionally not drawn: 13 city points are too sparse to show density without inventing values. Use the search box (or "Current location") to jump to any place; unmonitored places show on the Overview page.</Note>
    </Page>
  );
}
