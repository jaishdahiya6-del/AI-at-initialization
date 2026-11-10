import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api', timeout: 60000 });
api.interceptors.request.use((c) => { const t = localStorage.getItem('token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
export const errMsg = (e: any) => e?.response?.data?.error ?? (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the backend running?' : e?.message ?? 'Something went wrong');
export async function download(url: string, params: any, filename: string) {
  const r = await api.get(url, { params, responseType: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
