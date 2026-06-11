const BASE = import.meta.env.VITE_API_URL ?? '';

// guildId is set by App.jsx after server selection
let currentGuildId = null;
export function setGuildId(id) { currentGuildId = id; }
export function getGuildId()   { return currentGuildId; }

async function request(method, path, body, skipGuild) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (!skipGuild && currentGuildId) headers['X-Guild-ID'] = currentGuildId;

  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  auth: {
    me:     ()            => request('GET',  '/auth/me',     null, true),
    logout: ()            => request('POST', '/auth/logout', null, true),
  },
  guilds: {
    list:   ()            => request('GET', '/api/guilds', null, true),
  },
  activities: {
    list:   ()            => request('GET',    '/api/activities'),
    create: (a)           => request('POST',   '/api/activities', a),
    update: (id, patch)   => request('PUT',    `/api/activities/${id}`, patch),
    remove: (id)          => request('DELETE', `/api/activities/${id}`),
  },
  events: {
    list:   ()            => request('GET',    '/api/events'),
    create: (ev)          => request('POST',   '/api/events', ev),
    move:   (id, date)    => request('PUT',    `/api/events/${id}/date`, { date }),
    remove: (id)          => request('DELETE', `/api/events/${id}`),
    join:   (id)          => request('POST',   `/api/events/${id}/join`),
    leave:  (id)          => request('POST',   `/api/events/${id}/leave`),
  },
  games: {
    list:   ()            => request('GET',    '/api/games'),
    search: (q)           => request('GET',    `/api/games/search?q=${encodeURIComponent(q)}`, null, true),
    add:    (game)        => request('POST',   '/api/games', game),
    remove: (id)          => request('DELETE', `/api/games/${id}`),
    sync:   ()            => request('POST',   '/api/games/sync'),
  },
};
