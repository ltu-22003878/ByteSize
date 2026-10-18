export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const KEY = 'alumable-partner-session';
export function getPartnerSession() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function savePartnerSession(session) { sessionStorage.setItem(KEY, JSON.stringify(session)); }
export function clearPartnerSession() { sessionStorage.removeItem(KEY); }
export async function api(path, options = {}) {
  const token = getPartnerSession()?.token;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (response.status === 401 && path !== '/api/auth/login') {
    clearPartnerSession();
    window.location.replace('/');
    throw new Error('Session expired. Please log in again.');
  }
  if (response.status === 403) throw new Error('Not allowed for your role');
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
