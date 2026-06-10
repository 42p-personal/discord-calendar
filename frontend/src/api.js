/**
 * api.js
 * Centralises every HTTP call to the backend.
 * All functions throw on non-2xx responses so callers can catch cleanly.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body:    body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

/* ── Auth ── */
export const api = {
  auth: {
    me:          ()               => request('GET',  '/auth/me'),
    requestCode: (payload)        => request('POST', '/auth/request-code', payload),
    verify:      (email, code)    => request('POST', '/auth/verify', { email, code }),
    logout:      ()               => request('POST', '/auth/logout'),
  },

  /* ── Activities ── */
  activities: {
    list:   ()          => request('GET',    '/api/activities'),
    create: (activity)  => request('POST',   '/api/activities', activity),
    update: (id, patch) => request('PUT',    `/api/activities/${id}`, patch),
    remove: (id)        => request('DELETE', `/api/activities/${id}`),
  },

  /* ── Events ── */
  events: {
    list:       ()              => request('GET',    '/api/events'),
    create:     (event)         => request('POST',   '/api/events', event),
    move:       (id, date)      => request('PUT',    `/api/events/${id}/date`, { date }),
    remove:     (id)            => request('DELETE', `/api/events/${id}`),
  },
};
