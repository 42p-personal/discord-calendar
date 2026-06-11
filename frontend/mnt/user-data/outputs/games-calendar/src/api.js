const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body:    body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  auth: {
    me:     ()       => request('GET',  '/auth/me'),
    logout: ()       => request('POST', '/auth/logout'),
  },
  games: {
    list:   ()       => request('GET',    '/api/games'),
    search: (q)      => request('GET',    `/api/games/search?q=${encodeURIComponent(q)}`),
    add:    (game)   => request('POST',   '/api/games', game),
    remove: (id)     => request('DELETE', `/api/games/${id}`),
    sync:   ()       => request('POST',   '/api/games/sync'),
  },
};
