/**
 * Discord Calendar - Cloudflare Worker
 *
 * Auth:       Discord OAuth2 (guilds scope)
 * Database:   Supabase REST API
 * Features:   Per-server (guild) calendar, events, activities, games
 *
 * Secrets (wrangler secret put):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, SESSION_SECRET,
 *   RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL,
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET,
 *   RAWG_API_KEY
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
    'Access-Control-Allow-Headers':     'Content-Type, X-Guild-ID',
    'Access-Control-Max-Age':           '86400',
  };
}

function jsonResponse(data, status, env, request) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, getCorsHeaders(request, env)),
  });
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function futureStr(days) {
  var d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ============================================================
// SESSION — stateless JWT (HMAC-SHA256), no DB round-trip
// ============================================================

function _b64url(data) {
  var bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function _fromb64url(s) {
  var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  var bin = atob(b64);
  var buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

async function _hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, [usage]
  );
}

async function _jwtSign(payload, secret) {
  var hdr  = _b64url('{"alg":"HS256","typ":"JWT"}');
  var body = _b64url(JSON.stringify(payload));
  var msg  = hdr + '.' + body;
  var key  = await _hmacKey(secret, 'sign');
  var sig  = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return msg + '.' + _b64url(sig);
}

async function _jwtVerify(token, secret) {
  var parts = token.split('.');
  if (parts.length !== 3) return null;
  var key = await _hmacKey(secret, 'verify');
  var ok  = await crypto.subtle.verify('HMAC', key, _fromb64url(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) return null;
  var payload = JSON.parse(new TextDecoder().decode(_fromb64url(parts[1])));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function getSession(request, env) {
  var cookie = request.headers.get('Cookie') || '';
  var match  = cookie.match(/dc_session=([^;]+)/);
  if (!match) return null;
  try { return await _jwtVerify(decodeURIComponent(match[1]), env.SESSION_SECRET); }
  catch (e) { return null; }
}

async function createSession(env, data) {
  var payload = Object.assign({}, data, { exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 });
  return _jwtSign(payload, env.SESSION_SECRET);
}

// JWT sessions are stateless — logout just clears the cookie client-side
async function deleteSession(request, env) {}

function sessionCookie(token, clear) {
  var maxAge = clear ? 0 : 30 * 24 * 60 * 60;
  return 'dc_session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=' + maxAge;
}

async function requireAuth(request, env) {
  var sess = await getSession(request, env);
  if (!sess || !sess.userId) return jsonResponse({ error: 'Unauthorised.' }, 401, env, request);
  request.session = sess;
  return null;
}

// Guild ID from request header
function getGuildId(request) {
  return request.headers.get('X-Guild-ID') || null;
}

async function requireAuthAndGuild(request, env) {
  var authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  var guildId = getGuildId(request);
  if (!guildId) return jsonResponse({ error: 'No server selected. Please select a Discord server.' }, 400, env, request);
  request.guildId = guildId;
  return null;
}

// ============================================================
// USER / SESSION BUILDERS
// ============================================================

function buildSessionData(user, accessToken) {
  return {
    userId:       user.id,
    email:        user.email        || null,
    discordId:    user.discord_id   || null,
    name:         user.name,
    username:     user.username,
    avatar:       user.avatar_char,
    avatarUrl:    user.avatar_url   || null,
    accessToken:  accessToken       || null,
  };
}

async function respondWithSession(env, user, accessToken, request) {
  var sessData = buildSessionData(user, accessToken);
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
    guildId:   row.guild_id,
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
    startTime:           row.start_time  || null,
    endTime:             row.end_time    || null,
    guildId:             row.guild_id,
    proposedBy:          row.proposed_by,
    proposedByName:      row.proposed_by_name,
    proposedByUsername:  row.proposed_by_username,
    attendees:           attendees,
    steamUrl:            row.steam_url    || null,
    createdAt:           row.created_at,
  };
}

function toGame(row) {
  return {
    id:              row.id,
    rawgId:          row.rawg_id,
    name:            row.name,
    releaseDate:     row.release_date,
    coverUrl:        row.cover_url,
    platforms:       row.platforms,
    steamUrl:        row.steam_url       || null,
    guildId:         row.guild_id,
    isManual:        row.is_manual,
    addedBy:         row.added_by,
    calendarEventId: row.calendar_event_id,
    createdAt:       row.created_at,
  };
}

// ============================================================
// DISCORD GUILD HELPERS
// ============================================================

async function fetchUserGuilds(accessToken) {
  var res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) throw new Error('Failed to fetch guilds: ' + res.status);
  return res.json();
}

function formatGuild(g) {
  var iconUrl = g.icon
    ? 'https://cdn.discordapp.com/icons/' + g.id + '/' + g.icon + '.png'
    : null;
  return {
    id:      g.id,
    name:    g.name,
    iconUrl: iconUrl,
    owner:   g.owner,
  };
}

// ============================================================
// RAWG HELPERS
// ============================================================

async function fetchUpcomingSurvivalGames(env, page) {
  page = page || 1;
  var url = 'https://api.rawg.io/api/games'
    + '?key='        + encodeURIComponent(env.RAWG_API_KEY)
    + '&tags=799,7'
    + '&dates='      + todayStr() + ',' + futureStr(365)
    + '&ordering=released'
    + '&page_size=40'
    + '&page='       + page;
  var res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 300 } });
  if (!res.ok) throw new Error('RAWG fetch failed: ' + res.status);
  return res.json();
}

async function searchRawgGames(env, query) {
  var url = 'https://api.rawg.io/api/games'
    + '?key='    + encodeURIComponent(env.RAWG_API_KEY)
    + '&search=' + encodeURIComponent(query)
    + '&page_size=10';
  var res = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 300 } });
  if (!res.ok) throw new Error('RAWG search failed: ' + res.status);
  return res.json();
}

// ============================================================
// CRON: sync upcoming survival multiplayer games
// Runs for ALL guilds that have at least one watched game
// ============================================================

async function runGameSync(env) {
  console.log('[cron] Starting game sync...');

  var rawgData;
  try {
    rawgData = await fetchUpcomingSurvivalGames(env, 1);
  } catch (err) {
    console.error('[cron] RAWG fetch failed:', err.message);
    return;
  }

  // One query: batch-fetch all auto-tracked games (guild IDs + rawg IDs)
  var allWatched = await sbSelect(env, 'watched_games',
    'is_manual=eq.false&select=guild_id,rawg_id').catch(function() { return []; });
  var guildIds   = [...new Set(allWatched.map(function(g) { return g.guild_id; }).filter(Boolean))];

  if (guildIds.length === 0) {
    console.log('[cron] No guilds with watched games yet, skipping.');
    return;
  }

  // Build O(1) lookup set: "guildId:rawgId"
  var watchedSet = new Set(allWatched.map(function(r) { return r.guild_id + ':' + r.rawg_id; }));

  var games = rawgData.results || [];
  var added = 0;

  for (var gi = 0; gi < guildIds.length; gi++) {
    var guildId = guildIds[gi];

    for (var i = 0; i < games.length; i++) {
      var game = games[i];
      if (!game.released) continue;

      var key = guildId + ':' + game.id;
      if (watchedSet.has(key)) continue;
      watchedSet.add(key); // deduplicate within this run

      var platforms = '';
      if (game.platforms && game.platforms.length) {
        platforms = game.platforms.map(function(p) { return p.platform.name; }).slice(0, 4).join(', ');
      }

      // Pre-generate eventId so no follow-up UPDATE is needed
      var eventId = newId();
      await sbInsert(env, 'watched_games', {
        id: newId(), rawg_id: game.id, name: game.name,
        release_date: game.released, cover_url: game.background_image || null,
        platforms: platforms, is_manual: false, added_by: null,
        calendar_event_id: eventId, guild_id: guildId,
      });

      await sbInsert(env, 'events', {
        id: eventId, activity_id: null, activity_name: game.name,
        activity_color: '#7c3aed', activity_icon: '🎮',
        date: game.released, start_time: null, end_time: null,
        proposed_by: null, proposed_by_name: game.name,
        proposed_by_username: 'game-release', attendees: '[]',
        guild_id: guildId,
      });

      added++;
    }
  }

  // Purge expired legacy sessions left over from pre-JWT era
  await sbDelete(env, 'session',
    'expire=lt.' + encodeURIComponent(new Date().toISOString())).catch(function() {});

  console.log('[cron] Sync complete. Added:', added);
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
      redirect_uri:  url.origin + '/auth/discord/callback',
      response_type: 'code',
      scope:         'identify email guilds',
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
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type:    'authorization_code',
          code:          code,
          redirect_uri:  url.origin + '/auth/discord/callback',
        }),
      });
      if (!tokenRes.ok) {
        console.error('[discord/callback] token failed:', await tokenRes.text());
        return Response.redirect(env.FRONTEND_URL + '?auth_error=token_exchange', 302);
      }
      var tokenData  = await tokenRes.json();
      var accessToken = tokenData.access_token;

      var profileRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + accessToken },
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
          await sbUpdate(env, 'users', 'id=eq.' + encodeURIComponent(user.id),
            { discord_id: discordId, avatar_url: avatarUrl });
          user = Object.assign({}, user, { discord_id: discordId, avatar_url: avatarUrl });
        }
      }
      if (!user) {
        var baseUsername = profile.username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 18);
        var username     = baseUsername;
        var suffix       = 1;
        while (await sbSelectOne(env, 'users', 'username=ilike.' + encodeURIComponent(username))) {
          username = baseUsername + suffix; suffix++;
        }
        user = await sbInsert(env, 'users', {
          id: newId(), email: profile.email || null, discord_id: discordId,
          name: discordName, username: username,
          avatar_char: discordName[0].toUpperCase(), avatar_url: avatarUrl,
        });
      }

      // Store access token in session for guild lookups
      var sessData = buildSessionData(user, accessToken);
      var sid      = await createSession(env, sessData);

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
    // Never expose the access token to the frontend
    var safe = Object.assign({}, sess);
    delete safe.accessToken;
    return jsonResponse(safe, 200, env, request);
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
  // GUILDS — returns the user's Discord servers
  // ----------------------------------------------------------

  if (path === '/api/guilds' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    var accessToken = request.session.accessToken;
    if (!accessToken) {
      return jsonResponse({ error: 'Session expired. Please sign in again.' }, 401, env, request);
    }
    try {
      var guilds = await fetchUserGuilds(accessToken);
      return jsonResponse(guilds.map(formatGuild), 200, env, request);
    } catch (err) {
      console.error('[GET guilds]', err.message);
      return jsonResponse({ error: 'Failed to load your servers. Please sign in again.' }, 500, env, request);
    }
  }

  // ----------------------------------------------------------
  // ACTIVITIES (all scoped by guild_id)
  // ----------------------------------------------------------

  if (path === '/api/activities' && method === 'GET') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var rows = await sbSelect(env, 'activities',
        'guild_id=eq.' + encodeURIComponent(request.guildId) + '&order=created_at.asc');
      return jsonResponse(rows.map(toActivity), 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to load activities.' }, 500, env, request); }
  }

  if (path === '/api/activities' && method === 'POST') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var b   = await request.json();
      var row = await sbInsert(env, 'activities', {
        id: b.id, name: b.name.trim(), icon: b.icon, color: b.color,
        created_by: request.session.userId, guild_id: request.guildId,
      });
      return jsonResponse(toActivity(row), 201, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to create activity.' }, 500, env, request); }
  }

  var actMatch = path.match(/^\/api\/activities\/([^/]+)$/);
  if (actMatch && method === 'PUT') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var b = await request.json();
      await sbUpdate(env, 'activities', 'id=eq.' + encodeURIComponent(actMatch[1]),
        { name: b.name.trim(), icon: b.icon, color: b.color });
      await sbUpdate(env, 'events',
        'activity_id=eq.' + encodeURIComponent(actMatch[1]) + '&guild_id=eq.' + encodeURIComponent(request.guildId),
        { activity_name: b.name.trim(), activity_color: b.color, activity_icon: b.icon });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to update activity.' }, 500, env, request); }
  }

  if (actMatch && method === 'DELETE') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      await sbDelete(env, 'activities', 'id=eq.' + encodeURIComponent(actMatch[1]));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to delete activity.' }, 500, env, request); }
  }

  // ----------------------------------------------------------
  // EVENTS (all scoped by guild_id)
  // ----------------------------------------------------------

  if (path === '/api/events' && method === 'GET') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var rows = await sbSelect(env, 'events',
        'guild_id=eq.' + encodeURIComponent(request.guildId) + '&order=date.asc,created_at.asc');
      return jsonResponse(rows.map(toEvent), 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to load events.' }, 500, env, request); }
  }

  if (path === '/api/events' && method === 'POST') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var b   = await request.json();
      var row = await sbInsert(env, 'events', {
        id: b.id, activity_id: b.activityId, activity_name: b.activityName,
        activity_color: b.activityColor, activity_icon: b.activityIcon,
        date: b.date, start_time: b.startTime || null, end_time: b.endTime || null,
        proposed_by: request.session.userId, proposed_by_name: request.session.name,
        proposed_by_username: request.session.username, attendees: '[]',
        guild_id: request.guildId,
      });
      return jsonResponse(toEvent(row), 201, env, request);
    } catch (err) {
      console.error('[POST events]', err.message);
      return jsonResponse({ error: 'Failed to create event.' }, 500, env, request);
    }
  }

  var evDateMatch = path.match(/^\/api\/events\/([^/]+)\/date$/);
  if (evDateMatch && method === 'PUT') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var b = await request.json();
      await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evDateMatch[1]), { date: b.date });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to move event.' }, 500, env, request); }
  }

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
        attendees.push({ id: userId, name: request.session.name, username: request.session.username, avatar: request.session.avatar });
        await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evId), { attendees: JSON.stringify(attendees) });
      }
      return jsonResponse({ ok: true, attendees: attendees }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to join event.' }, 500, env, request); }
  }

  var evLeaveMatch = path.match(/^\/api\/events\/([^/]+)\/leave$/);
  if (evLeaveMatch && method === 'POST') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var evId  = evLeaveMatch[1];
      var evRow = await sbSelectOne(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      if (!evRow) return jsonResponse({ error: 'Event not found.' }, 404, env, request);
      var attendees = [];
      try { attendees = JSON.parse(evRow.attendees || '[]'); } catch (e) {}
      var filtered  = attendees.filter(function(a) { return a.id !== request.session.userId; });
      await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evId), { attendees: JSON.stringify(filtered) });
      return jsonResponse({ ok: true, attendees: filtered }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to leave event.' }, 500, env, request); }
  }

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

  // ----------------------------------------------------------
  // GAMES (all scoped by guild_id)
  // ----------------------------------------------------------

  if (path === '/api/games' && method === 'GET') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var rows = await sbSelect(env, 'watched_games',
        'guild_id=eq.' + encodeURIComponent(request.guildId) + '&order=release_date.asc');
      return jsonResponse(rows.map(toGame), 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to load games.' }, 500, env, request); }
  }

  // GET /api/rawg/games — flexible RAWG proxy for games.42p.uk
  // Accepts: page, genres, tags, platforms, dates, ordering, search
  if (path === '/api/rawg/games' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var rawgParams = new URLSearchParams();
      rawgParams.set('key', env.RAWG_API_KEY);
      rawgParams.set('page_size', '40');

      var page          = url.searchParams.get('page')          || '1';
      var genres        = url.searchParams.get('genres')        || '';
      var tags          = url.searchParams.get('tags')          || '';
      var platforms     = url.searchParams.get('platforms')     || '';
      var dates         = url.searchParams.get('dates')         || '';
      var ordering      = url.searchParams.get('ordering')      || '';
      var search        = url.searchParams.get('search')        || '';
      var searchPrecise = url.searchParams.get('search_precise')|| '';
      var tba           = url.searchParams.get('tba')           || '';

      rawgParams.set('page', page);
      // When tba=true, ordering by release date returns no results (TBA games have no date).
      // The frontend sends ordering=-added for TBA; fall back to -added here as a safety net.
      if (tba) {
        rawgParams.set('ordering', ordering && ordering !== '-released' ? ordering : '-added');
      } else {
        rawgParams.set('ordering', ordering || '-released');
      }
      if (genres)         rawgParams.set('genres',         genres);
      if (tags)           rawgParams.set('tags',           tags);
      if (platforms)      rawgParams.set('platforms',      platforms);
      if (dates)          rawgParams.set('dates',          dates);
      if (tba)            rawgParams.set('tba',            tba);
      if (search)         rawgParams.set('search',         search);
      if (searchPrecise)  rawgParams.set('search_precise', searchPrecise);

      var rawgRes = await fetch('https://api.rawg.io/api/games?' + rawgParams.toString(),
        { cf: { cacheEverything: true, cacheTtl: 300 } });
      if (!rawgRes.ok) throw new Error('RAWG error: ' + rawgRes.status);
      var data    = await rawgRes.json();

      var results = (data.results || []).map(function(g) {
        var ps = '';
        if (g.platforms && g.platforms.length) {
          ps = g.platforms.map(function(p) { return p.platform.name; }).slice(0, 4).join(', ');
        }
        var genreList = '';
        if (g.genres && g.genres.length) {
          genreList = g.genres.map(function(x) { return x.name; }).slice(0, 3).join(', ');
        }
        return {
          rawgId:      g.id,
          slug:        g.slug,
          name:        g.name,
          releaseDate: g.released   || null,
          tba:         g.tba        || false,
          coverUrl:    g.background_image || null,
          platforms:   ps,
          genres:      genreList,
          rating:      g.rating     || null,
          ratingsCount:g.ratings_count || 0,
        };
      });

      return jsonResponse({
        results: results,
        count:   data.count || 0,
        next:    !!data.next,
      }, 200, env, request);
    } catch (err) {
      console.error('[GET rawg/games]', err.message);
      return jsonResponse({ error: 'Failed to fetch games from RAWG.' }, 500, env, request);
    }
  }

  // GET /api/rawg/games/:rawgId/stores — return store URLs for a game (used to get Steam link)
  var storesMatch = path.match(/^\/api\/rawg\/games\/(\d+)\/stores$/);
  if (storesMatch && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var rawgId = storesMatch[1];
      var storesRes = await fetch(
        'https://api.rawg.io/api/games/' + rawgId + '/stores?key=' + encodeURIComponent(env.RAWG_API_KEY),
        { cf: { cacheEverything: true, cacheTtl: 86400 } }
      );
      if (!storesRes.ok) throw new Error('RAWG stores error: ' + storesRes.status);
      var storesData = await storesRes.json();
      // store_id 1 = Steam
      var steamEntry = (storesData.results || []).find(function(s) { return s.store_id === 1; });
      return jsonResponse({ steamUrl: steamEntry ? steamEntry.url : null }, 200, env, request);
    } catch (err) {
      console.error('[GET rawg stores]', err.message);
      return jsonResponse({ steamUrl: null }, 200, env, request);
    }
  }

  // Keep the old /api/rawg/upcoming route as an alias for backwards compat
  if (path === '/api/rawg/upcoming' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    try {
      var data = await fetchUpcomingSurvivalGames(env, parseInt(url.searchParams.get('page') || '1', 10));
      var results = (data.results || []).map(function(g) {
        var ps = '';
        if (g.platforms && g.platforms.length) ps = g.platforms.map(function(p) { return p.platform.name; }).slice(0, 4).join(', ');
        return { rawgId: g.id, slug: g.slug, name: g.name, releaseDate: g.released || null, coverUrl: g.background_image || null, platforms: ps };
      });
      return jsonResponse({ results: results, next: !!data.next }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to fetch games from RAWG.' }, 500, env, request); }
  }

  if (path === '/api/games/search' && method === 'GET') {
    var ae = await requireAuth(request, env); if (ae) return ae;
    var query = url.searchParams.get('q');
    if (!query || query.trim().length < 2) {
      return jsonResponse({ error: 'Search query must be at least 2 characters.' }, 400, env, request);
    }
    try {
      var data    = await searchRawgGames(env, query.trim());
      var results = (data.results || []).map(function(g) {
        var platforms = '';
        if (g.platforms && g.platforms.length) {
          platforms = g.platforms.map(function(p) { return p.platform.name; }).slice(0, 4).join(', ');
        }
        return { rawgId: g.id, slug: g.slug, name: g.name, releaseDate: g.released || null, coverUrl: g.background_image || null, platforms: platforms };
      });
      return jsonResponse(results, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Search failed.' }, 500, env, request); }
  }

  if (path === '/api/games' && method === 'POST') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var b = await request.json();
      if (b.rawgId) {
        var exists = await sbSelectOne(env, 'watched_games',
          'rawg_id=eq.' + encodeURIComponent(b.rawgId) + '&guild_id=eq.' + encodeURIComponent(request.guildId));
        if (exists) return jsonResponse({ error: 'This game is already being tracked.' }, 409, env, request);
      }
      // Games are not activities — they go straight to the calendar as named events.
      // No activity is created or linked; the game name is the event name.
      var saved = await sbInsert(env, 'watched_games', {
        id: newId(), rawg_id: b.rawgId || null, name: b.name,
        release_date: b.releaseDate || null, cover_url: b.coverUrl || null,
        platforms: b.platforms || '', steam_url: b.steamUrl || null,
        is_manual: true, added_by: request.session.userId,
        calendar_event_id: null, guild_id: request.guildId,
      });
      if (b.releaseDate) {
        var eventId = newId();
        await sbInsert(env, 'events', {
          id: eventId, activity_id: null, activity_name: b.name,
          activity_color: '#7c3aed', activity_icon: '🎮',
          date: b.releaseDate, start_time: null, end_time: null,
          proposed_by: null, proposed_by_name: b.name,
          proposed_by_username: 'game-release', attendees: '[]',
          steam_url: b.steamUrl || null,
          guild_id: request.guildId,
        });
        await sbUpdate(env, 'watched_games', 'id=eq.' + encodeURIComponent(saved.id), { calendar_event_id: eventId });
        saved.calendar_event_id = eventId;
      }
      return jsonResponse(toGame(saved), 201, env, request);
    } catch (err) {
      console.error('[POST games]', err.message);
      return jsonResponse({ error: 'Failed to add game.' }, 500, env, request);
    }
  }

  var gameMatch = path.match(/^\/api\/games\/([^/]+)$/);
  if (gameMatch && method === 'DELETE') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      var gameRow = await sbSelectOne(env, 'watched_games', 'id=eq.' + encodeURIComponent(gameMatch[1]));
      if (!gameRow) return jsonResponse({ error: 'Game not found.' }, 404, env, request);
      if (gameRow.calendar_event_id) {
        await sbDelete(env, 'events', 'id=eq.' + encodeURIComponent(gameRow.calendar_event_id)).catch(function() {});
      }
      await sbDelete(env, 'watched_games', 'id=eq.' + encodeURIComponent(gameMatch[1]));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Failed to remove game.' }, 500, env, request); }
  }

  if (path === '/api/games/sync' && method === 'POST') {
    var ae = await requireAuthAndGuild(request, env); if (ae) return ae;
    try {
      await runGameSync(env);
      return jsonResponse({ ok: true, message: 'Sync complete.' }, 200, env, request);
    } catch (err) { return jsonResponse({ error: 'Sync failed: ' + err.message }, 500, env, request); }
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
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runGameSync(env));
  },
};
