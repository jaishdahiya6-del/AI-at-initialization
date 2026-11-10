import { useApp } from '../context/AppContext';
/** Query params for the selected location (monitored city id, or raw coordinates). */
export function useLoc() {
  const { loc } = useApp();
  return { loc, params: loc.id ? { city: loc.id } : { lat: loc.lat, lon: loc.lon, name: loc.name } };
}
