/**
 * Discord Calendar - Cloudflare Worker
 *
 * Auth:       Discord OAuth2 only
 * Database:   Supabase REST API
 * Features:   Events with start/end time, attendee join/leave
 *
 * Secrets (wrangler secret put):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, SESSION_SECRET,
 *   RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL,
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
 */

// ============================================================
// SUPABASE HELPERS
// ============================================================

function sbHeaders(env) {
  return {
    'Content-Type':  'application/json',
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
    'Prefer':        'return=representation',
  };
}

async function sbSelect(env, table, filters) {
  filters = filters || '';
  var res = await fetch(
    env.SUPABASE_URL + '/rest/v1/' + table + (filters ? '?' + filters : ''),
    { headers: sbHeaders(env) }
  );
  if (!res.ok) throw new Error('SB SELECT ' + table + ': ' + await res.text());
  return res.json();
}

async function sbSelectOne(env, table, filters) {
  var rows = await sbSelect(env, table, (filters || '') + (filters ? '&' : '') + 'limit=1');
  return rows[0] || null;
}

async function sbInsert(env, table, data) {
  var res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: sbHeaders(env), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('SB INSERT ' + table + ': ' + await res.text());
  var rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpsert(env, table, data) {
  var res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: Object.assign({}, sbHeaders(env), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('SB UPSERT ' + table + ': ' + await res.text());
  var rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpdate(env, table, filters, data) {
  var res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table + '?' + filters, {
    method: 'PATCH', headers: sbHeaders(env), body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('SB UPDATE ' + table + ': ' + await res.text());
}

async function sbDelete(env, table, filters) {
  var res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table + '?' + filters, {
    method: 'DELETE', headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error('SB DELETE ' + table + ': ' + await res.text());
}

// ============================================================
// HELPERS
// ============================================================

function newId() { return crypto.randomUUID(); }

function getCorsHeaders(request, env) {
  var origin = (request && request.headers.get('Origin')) || env.FRONTEND_URL || '*';
  return {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Access-Control-Max-Age':           '86400',
  };
}

function jsonResponse(data, status, env, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, getCorsHeaders(request, env)),
  });
}

// ============================================================
// SESSION
// ============================================================

async function getSession(request, env) {
  var cookie = request.headers.get('Cookie') || '';
  var match  = cookie.match(/dc_session=([^;]+)/);
  if (!match) return null;
  var sid = decodeURIComponent(match[1]);
  var now = new Date().toISOString();
  var row = await sbSelectOne(env, 'session',
    'sid=eq.' + encodeURIComponent(sid) + '&expire=gt.' + encodeURIComponent(now));
  if (!row) return null;
  try { return JSON.parse(row.sess); } catch (e) { return null; }
}

async function createSession(env, data) {
  var sid     = newId();
  var expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sbUpsert(env, 'session', { sid: sid, sess: JSON.stringify(data), expire: expires });
  return sid;
}

async function deleteSession(request, env) {
  var cookie = request.headers.get('Cookie') || '';
  var match  = cookie.match(/dc_session=([^;]+)/);
  if (match) {
    await sbDelete(env, 'session',
      'sid=eq.' + encodeURIComponent(decodeURIComponent(match[1]))).catch(function() {});
  }
}

function sessionCookie(sid, clear) {
  var maxAge = clear ? 0 : 30 * 24 * 60 * 60;
  return 'dc_session=' + encodeURIComponent(sid) + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=' + maxAge;
}

async function requireAuth(request, env) {
  var sess = await getSession(request, env);
  if (!sess || !sess.userId) return jsonResponse({ error: 'Unauthorised.' }, 401, env, request);
  request.session = sess;
  return null;
}

// ============================================================
// USER / SESSION BUILDERS
// ============================================================

function buildSessionData(user) {
  return {
    userId:    user.id,
    email:     user.email     || null,
    discordId: user.discord_id || null,
    name:      user.name,
    username:  user.username,
    avatar:    user.avatar_char,
    avatarUrl: user.avatar_url || null,
  };
}

async function respondWithSession(env, user, request) {
  var sessData = buildSessionData(user);
  var sid      = await createSession(env, sessData);
  var response = jsonResponse(sessData, 200, env, request);
  response.headers.append('Set-Cookie', sessionCookie(sid));
  return response;
}

// ============================================================
// ROW MAPPERS
// ============================================================

function toActivity(row) {
  return {
    id:        row.id,
    name:      row.name,
    icon:      row.icon,
    color:     row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toEvent(row) {
  var attendees = [];
  try { attendees = JSON.parse(row.attendees || '[]'); } catch (e) {}
  return {
    id:                  row.id,
    activityId:          row.activity_id,
    activityName:        row.activity_name,
    activityColor:       row.activity_color,
    activityIcon:        row.activity_icon,
    date:                row.date,
    startTime:           row.start_time || null,
    endTime:             row.end_time   || null,
    proposedBy:          row.proposed_by,
    proposedByName:      row.proposed_by_name,
    proposedByUsername:  row.proposed_by_username,
    attendees:           attendees,
    createdAt:           row.created_at,
  };
}

// ============================================================
// REQUEST HANDLER
// ============================================================

async function handleRequest(request, env) {
  var url    = new URL(request.url);
  var path   = url.pathname;
  var method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request, env) });
  }

  if (path === '/health' && method === 'GET') {
    return jsonResponse({ status: 'ok' }, 200, env, request);
  }

  // ----------------------------------------------------------
  // DISCORD OAUTH
  // ----------------------------------------------------------

  if (path === '/auth/discord' && method === 'GET') {
    var params = new URLSearchParams({
      client_id:     env.DISCORD_CLIENT_ID,
      redirect_uri:  new URL(request.url).origin + '/auth/discord/callback',
      response_type: 'code',
      scope:         'identify email',
    });
    return Response.redirect('https://discord.com/oauth2/authorize?' + params.toString(), 302);
  }

  if (path === '/auth/discord/callback' && method === 'GET') {
    var code       = url.searchParams.get('code');
    var oauthError = url.searchParams.get('error');

    if (oauthError || !code) {
      return Response.redirect(env.FRONTEND_URL + '?auth_error=discord_denied', 302);
    }

    try {
      var tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          client_id:     env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type:    'authorization_code',
          code:          code,
          redirect_uri:  new URL(request.url).origin + '/auth/discord/callback',
        }),
      });

      if (!tokenRes.ok) {
        console.error('[discord/callback] token failed:', await tokenRes.text());
        return Response.redirect(env.FRONTEND_URL + '?auth_error=token_exchange', 302);
      }

      var tokenData  = await tokenRes.json();
      var profileRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });

      if (!profileRes.ok) {
        console.error('[discord/callback] profile failed:', await profileRes.text());
        return Response.redirect(env.FRONTEND_URL + '?auth_error=profile_fetch', 302);
      }

      var profile     = await profileRes.json();
      var discordId   = profile.id;
      var discordName = profile.global_name || profile.username;
      var avatarUrl   = profile.avatar
        ? 'https://cdn.discordapp.com/avatars/' + profile.id + '/' + profile.avatar + '.png'
        : null;

      var user = await sbSelectOne(env, 'users', 'discord_id=eq.' + encodeURIComponent(discordId));

      if (!user && profile.email) {
        user = await sbSelectOne(env, 'users', 'email=eq.' + encodeURIComponent(profile.email));
        if (user) {
          await sbUpdate(env, 'users', 'id=eq.' + encodeURIComponent(user.id), {
            discord_id: discordId, avatar_url: avatarUrl,
          });
          user = Object.assign({}, user, { discord_id: discordId, avatar_url: avatarUrl });
        }
      }

      if (!user) {
        var baseUsername = profile.username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 18);
        var username     = baseUsername;
        var suffix       = 1;
        while (await sbSelectOne(env, 'users', 'username=ilike.' + encodeURIComponent(username))) {
          username = baseUsername + suffix;
          suffix++;
        }
        user = await sbInsert(env, 'users', {
          id:          newId(),
          email:       profile.email || null,
          discord_id:  discordId,
          name:        discordName,
          username:    username,
          avatar_char: discordName[0].toUpperCase(),
          avatar_url:  avatarUrl,
        });
      }

      var sessData  = buildSessionData(user);
      var sid       = await createSession(env, sessData);

      return new Response(null, {
        status: 302,
        headers: {
          'Location':   env.FRONTEND_URL + '/?auth=success',
          'Set-Cookie': sessionCookie(sid),
        },
      });

    } catch (err) {
      console.error('[discord/callback] error:', err.message);
      return Response.redirect(env.FRONTEND_URL + '?auth_error=server_error', 302);
    }
  }

  if (path === '/auth/me' && method === 'GET') {
    var sess = await getSession(request, env);
    if (!sess || !sess.userId) return jsonResponse({ error: 'Not signed in.' }, 401, env, request);
    return jsonResponse(sess, 200, env, request);
  }

  if (path === '/auth/logout' && method === 'POST') {
    var lCookie = request.headers.get('Cookie') || '';
    var lMatch  = lCookie.match(/dc_session=([^;]+)/);
    var lSid    = lMatch ? decodeURIComponent(lMatch[1]) : 'none';
    await deleteSession(request, env);
    var lRes = jsonResponse({ ok: true }, 200, env, request);
    lRes.headers.append('Set-Cookie', sessionCookie(lSid, true));
    return lRes;
  }

  // ----------------------------------------------------------
  // ACTIVITIES
  // ----------------------------------------------------------

  if (path === '/api/activities' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var rows = await sbSelect(env, 'activities', 'order=created_at.asc');
      return jsonResponse(rows.map(toActivity), 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to load activities.' }, 500, env, request); }
  }

  if (path === '/api/activities' && method === 'POST') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var b   = await request.json();
      var row = await sbInsert(env, 'activities', {
        id: b.id, name: b.name.trim(), icon: b.icon, color: b.color,
        created_by: request.session.userId,
      });
      return jsonResponse(toActivity(row), 201, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to create activity.' }, 500, env, request); }
  }

  var actMatch = path.match(/^\/api\/activities\/([^/]+)$/);

  if (actMatch && method === 'PUT') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var b = await request.json();
      await sbUpdate(env, 'activities', 'id=eq.' + encodeURIComponent(actMatch[1]),
        { name: b.name.trim(), icon: b.icon, color: b.color });
      await sbUpdate(env, 'events', 'activity_id=eq.' + encodeURIComponent(actMatch[1]),
        { activity_name: b.name.trim(), activity_color: b.color, activity_icon: b.icon });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to update activity.' }, 500, env, request); }
  }

  if (actMatch && method === 'DELETE') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      await sbDelete(env, 'activities', 'id=eq.' + encodeURIComponent(actMatch[1]));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to delete activity.' }, 500, env, request); }
  }

  // ----------------------------------------------------------
  // EVENTS
  // ----------------------------------------------------------

  if (path === '/api/events' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var rows = await sbSelect(env, 'events', 'order=date.asc,created_at.asc');
      return jsonResponse(rows.map(toEvent), 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to load events.' }, 500, env, request); }
  }

  if (path === '/api/events' && method === 'POST') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var b   = await request.json();
      var row = await sbInsert(env, 'events', {
        id:                   b.id,
        activity_id:          b.activityId,
        activity_name:        b.activityName,
        activity_color:       b.activityColor,
        activity_icon:        b.activityIcon,
        date:                 b.date,
        start_time:           b.startTime  || null,
        end_time:             b.endTime    || null,
        proposed_by:          request.session.userId,
        proposed_by_name:     request.session.name,
        proposed_by_username: request.session.username,
        attendees:            '[]',
      });
      return jsonResponse(toEvent(row), 201, env, request);
    } catch (err) {
      console.error('[POST events]', err.message);
      return jsonResponse({ error: 'Failed to create event.' }, 500, env, request);
    }
  }

  // PUT /api/events/:id/date  (drag reschedule)
  var evDateMatch = path.match(/^\/api\/events\/([^/]+)\/date$/);
  if (evDateMatch && method === 'PUT') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var b = await request.json();
      await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evDateMatch[1]), { date: b.date });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to move event.' }, 500, env, request); }
  }

  // POST /api/events/:id/join
  var evJoinMatch = path.match(/^\/api\/events\/([^/]+)\/join$/);
  if (evJoinMatch && method === 'POST') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var evId  = evJoinMatch[1];
      var evRow = await sbSelectOne(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      if (!evRow) return jsonResponse({ error: 'Event not found.' }, 404, env, request);

      var attendees = [];
      try { attendees = JSON.parse(evRow.attendees || '[]'); } catch (e) {}

      var userId = request.session.userId;
      if (!attendees.find(function(a) { return a.id === userId; })) {
        attendees.push({
          id:       userId,
          name:     request.session.name,
          username: request.session.username,
          avatar:   request.session.avatar,
        });
        await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evId),
          { attendees: JSON.stringify(attendees) });
      }

      return jsonResponse({ ok: true, attendees: attendees }, 200, env, request);
    } catch (err) {
      console.error('[join]', err.message);
      return jsonResponse({ error: 'Failed to join event.' }, 500, env, request);
    }
  }

  // POST /api/events/:id/leave
  var evLeaveMatch = path.match(/^\/api\/events\/([^/]+)\/leave$/);
  if (evLeaveMatch && method === 'POST') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var evId  = evLeaveMatch[1];
      var evRow = await sbSelectOne(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      if (!evRow) return jsonResponse({ error: 'Event not found.' }, 404, env, request);

      var attendees = [];
      try { attendees = JSON.parse(evRow.attendees || '[]'); } catch (e) {}

      var userId    = request.session.userId;
      var filtered  = attendees.filter(function(a) { return a.id !== userId; });
      await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evId),
        { attendees: JSON.stringify(filtered) });

      return jsonResponse({ ok: true, attendees: filtered }, 200, env, request);
    } catch (err) {
      console.error('[leave]', err.message);
      return jsonResponse({ error: 'Failed to leave event.' }, 500, env, request);
    }
  }

  // DELETE /api/events/:id
  var evMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (evMatch && method === 'DELETE') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var evId = evMatch[1];
      var ev   = await sbSelectOne(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      if (!ev) return jsonResponse({ error: 'Event not found.' }, 404, env, request);
      if (ev.proposed_by !== request.session.userId)
        return jsonResponse({ error: 'You can only remove your own events.' }, 403, env, request);
      await sbDelete(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to delete event.' }, 500, env, request); }
  }

  return jsonResponse({ error: 'Not found.' }, 404, env, request);
}

// ============================================================
// EXPORT
// ============================================================

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('[unhandled]', err.message);
      return new Response(JSON.stringify({ error: 'Internal server error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
