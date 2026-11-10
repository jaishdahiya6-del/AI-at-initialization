import { Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout';
import Overview from './pages/Overview';
import LiveAir from './pages/LiveAir';
import Weather from './pages/Weather';
import Predictions from './pages/Predictions';
import MapPage from './pages/MapPage';
import HistoryPage from './pages/History';
import Compare from './pages/Compare';
import Alerts from './pages/Alerts';
import Assistant from './pages/Assistant';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <Routes><Route element={<Layout />}>
      <Route index element={<Overview />} /><Route path="air" element={<LiveAir />} /><Route path="weather" element={<Weather />} />
      <Route path="predictions" element={<Predictions />} /><Route path="map" element={<MapPage />} /><Route path="history" element={<HistoryPage />} />
      <Route path="compare" element={<Compare />} /><Route path="alerts" element={<Alerts />} /><Route path="assistant" element={<Assistant />} />
      <Route path="reports" element={<Reports />} /><Route path="settings" element={<SettingsPage />} />
    </Route></Routes>
  );
}
