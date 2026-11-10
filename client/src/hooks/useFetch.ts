import { useEffect, useState } from 'react';
import { api, errMsg } from '../services/api';
import { useApp } from '../context/AppContext';

/** GET helper that reloads when the global refresh key (top-bar refresh / live update) changes. */
export function useGet<T = any>(url: string | null, params?: Record<string, any>, extraDeps: any[] = []) {
  const { refreshKey } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!url) { setData(null); setLoading(false); return; }
    let live = true; setLoading(true);
    api.get(url, { params }).then((r) => { if (live) { setData(r.data); setError(null); } }).catch((e) => live && setError(errMsg(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, refreshKey, ...extraDeps]);
  return { data, error, loading };
}
