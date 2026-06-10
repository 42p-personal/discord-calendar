/**
 * Discord Calendar - Cloudflare Worker
 *
 * Supports email OTP and Discord OAuth2 authentication.
 * Uses Supabase REST API for all database operations.
 *
 * Required environment variables (set via wrangler secret put):
 *   SUPABASE_URL          - https://xxxxxxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  - service_role JWT (encrypt this)
 *   SESSION_SECRET        - long random string (encrypt this)
 *   RESEND_API_KEY        - from resend.com (encrypt this)
 *   EMAIL_FROM            - e.g. noreply@yourdomain.co.uk
 *   FRONTEND_URL          - e.g. https://calendar.yourdomain.co.uk
 *   DISCORD_CLIENT_ID     - from discord.com/developers
 *   DISCORD_CLIENT_SECRET - from discord.com/developers (encrypt this)
 */

// ==============================================================
// SUPABASE REST HELPERS
// ==============================================================

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
  const res = await fetch(
    env.SUPABASE_URL + '/rest/v1/' + table + (filters ? '?' + filters : ''),
    { headers: sbHeaders(env) }
  );
  if (!res.ok) throw new Error('Supabase SELECT ' + table + ' failed: ' + await res.text());
  return res.json();
}

async function sbSelectOne(env, table, filters) {
  filters = filters || '';
  const rows = await sbSelect(env, table, filters + (filters ? '&' : '') + 'limit=1');
  return rows[0] || null;
}

async function sbInsert(env, table, data) {
  const res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table, {
    method:  'POST',
    headers: sbHeaders(env),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Supabase INSERT ' + table + ' failed: ' + await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpsert(env, table, data) {
  const res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table, {
    method:  'POST',
    headers: Object.assign({}, sbHeaders(env), { 'Prefer': 'resolution=merge-duplicates,return=representation' }),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Supabase UPSERT ' + table + ' failed: ' + await res.text());
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpdate(env, table, filters, data) {
  const res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table + '?' + filters, {
    method:  'PATCH',
    headers: sbHeaders(env),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Supabase UPDATE ' + table + ' failed: ' + await res.text());
}

async function sbDelete(env, table, filters) {
  const res = await fetch(env.SUPABASE_URL + '/rest/v1/' + table + '?' + filters, {
    method:  'DELETE',
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error('Supabase DELETE ' + table + ' failed: ' + await res.text());
}

// ==============================================================
// HELPERS
// ==============================================================

function newId() {
  return crypto.randomUUID();
}

// Returns CORS headers, using the request's actual Origin so it always matches
function getCorsHeaders(request, env) {
  const origin = (request && request.headers.get('Origin')) || env.FRONTEND_URL || '*';
  return {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Access-Control-Max-Age':           '86400',
  };
}

function jsonResponse(data, status, env, request) {
  status = status || 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, getCorsHeaders(request, env)),
  });
}

// ==============================================================
// SESSION HELPERS
// ==============================================================

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

// ==============================================================
// EMAIL HELPER
// ==============================================================

async function sendOtp(env, to, username, code, isSignIn) {
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    env.EMAIL_FROM,
      to:      to,
      subject: isSignIn ? 'Your Discord Calendar sign-in code' : 'Verify your Discord Calendar account',
      html:
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">' +
        '<h2 style="color:#1a1b2e">' + (isSignIn ? 'Welcome back, ' + username + '!' : 'Verify your account, ' + username + '!') + '</h2>' +
        '<p style="color:#5f6080">' + (isSignIn ? 'Use the code below to sign in.' : 'Use the code below to verify your account.') + ' Expires in 15 minutes.</p>' +
        '<div style="background:#f4f5fb;border-radius:12px;padding:24px;text-align:center;margin:24px 0">' +
        '<p style="font-size:12px;color:#9899b8;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em">Verification code</p>' +
        '<p style="font-size:38px;font-weight:700;letter-spacing:0.25em;color:#1a1b2e;margin:0">' + code + '</p>' +
        '</div>' +
        '<p style="font-size:12px;color:#9899b8">If you did not request this, you can safely ignore this email.</p>' +
        '</div>',
    }),
  });
}

// ==============================================================
// AUTH MIDDLEWARE
// ==============================================================

async function requireAuth(request, env) {
  var sess = await getSession(request, env);
  if (!sess || !sess.userId) return jsonResponse({ error: 'Unauthorised.' }, 401, env, request);
  request.session = sess;
  return null;
}

// ==============================================================
// SHARED: build session data from a user row
// ==============================================================

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

// ==============================================================
// ROW MAPPERS
// ==============================================================

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
  return {
    id:                  row.id,
    activityId:          row.activity_id,
    activityName:        row.activity_name,
    activityColor:       row.activity_color,
    activityIcon:        row.activity_icon,
    date:                row.date,
    proposedBy:          row.proposed_by,
    proposedByName:      row.proposed_by_name,
    proposedByUsername:  row.proposed_by_username,
    createdAt:           row.created_at,
  };
}

// ==============================================================
// MAIN REQUEST HANDLER
// ==============================================================

async function handleRequest(request, env) {
  var url    = new URL(request.url);
  var path   = url.pathname;
  var method = request.method.toUpperCase();

  // Handle ALL preflight OPTIONS requests immediately
  if (method === 'OPTIONS') {
    return new Response(null, {
      status:  204,
      headers: getCorsHeaders(request, env),
    });
  }

  // Health check
  if (path === '/health' && method === 'GET') {
    return jsonResponse({ status: 'ok' }, 200, env, request);
  }

  // ============================================================
  // DISCORD OAUTH
  // ============================================================

  // GET /auth/discord - redirect to Discord
  if (path === '/auth/discord' && method === 'GET') {
    var params = new URLSearchParams({
      client_id:     env.DISCORD_CLIENT_ID,
      redirect_uri:  new URL(request.url).origin + '/auth/discord/callback',
      response_type: 'code',
      scope:         'identify email',
    });
    return Response.redirect('https://discord.com/oauth2/authorize?' + params.toString(), 302);
  }

  // GET /auth/discord/callback - Discord redirects here
  if (path === '/auth/discord/callback' && method === 'GET') {
    var code  = url.searchParams.get('code');
    var oauthError = url.searchParams.get('error');

    if (oauthError || !code) {
      return Response.redirect(env.FRONTEND_URL + '?auth_error=discord_denied', 302);
    }

    try {
      // Exchange code for token
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
        console.error('[discord/callback] token exchange failed:', await tokenRes.text());
        return Response.redirect(env.FRONTEND_URL + '?auth_error=token_exchange', 302);
      }

      var tokenData = await tokenRes.json();

      // Fetch Discord user profile
      var profileRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });

      if (!profileRes.ok) {
        console.error('[discord/callback] profile fetch failed:', await profileRes.text());
        return Response.redirect(env.FRONTEND_URL + '?auth_error=profile_fetch', 302);
      }

      var profile     = await profileRes.json();
      var discordId   = profile.id;
      var discordName = profile.global_name || profile.username;
      var avatarUrl   = profile.avatar
        ? 'https://cdn.discordapp.com/avatars/' + profile.id + '/' + profile.avatar + '.png'
        : null;

      // Look up user by Discord ID
      var user = await sbSelectOne(env, 'users', 'discord_id=eq.' + encodeURIComponent(discordId));

      // If not found, try linking by email
      if (!user && profile.email) {
        user = await sbSelectOne(env, 'users', 'email=eq.' + encodeURIComponent(profile.email));
        if (user) {
          await sbUpdate(env, 'users', 'id=eq.' + encodeURIComponent(user.id), {
            discord_id: discordId,
            avatar_url: avatarUrl,
          });
          user = Object.assign({}, user, { discord_id: discordId, avatar_url: avatarUrl });
        }
      }

      // Create new user from Discord profile
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

      // Create session and redirect back to frontend
      var sessData  = buildSessionData(user);
      var sid       = await createSession(env, sessData);
      var redirectTo = env.FRONTEND_URL + '/?auth=success';

      return new Response(null, {
        status: 302,
        headers: {
          'Location':   redirectTo,
          'Set-Cookie': sessionCookie(sid),
        },
      });

    } catch (err) {
      console.error('[discord/callback] error:', err.message);
      return Response.redirect(env.FRONTEND_URL + '?auth_error=server_error', 302);
    }
  }

  // ============================================================
  // EMAIL OTP AUTH
  // ============================================================

  // POST /auth/request-code
  if (path === '/auth/request-code' && method === 'POST') {
    var body = await request.json();
    var email    = body.email;
    var name     = body.name;
    var username = body.username;
    var isSignup = body.isSignup;
    var normalEmail = (email || '').trim().toLowerCase();

    if (!normalEmail.includes('@')) {
      return jsonResponse({ error: 'Enter a valid email address.' }, 400, env, request);
    }

    try {
      if (isSignup) {
        if (!name || !name.trim())     return jsonResponse({ error: 'Display name is required.' }, 400, env, request);
        if (!username || !username.trim()) return jsonResponse({ error: 'Username is required.' }, 400, env, request);
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
          return jsonResponse({ error: 'Username must be 3-20 characters: letters, numbers and _ only.' }, 400, env, request);
        }
        var existingEmail = await sbSelectOne(env, 'users', 'email=eq.' + encodeURIComponent(normalEmail));
        if (existingEmail) return jsonResponse({ error: 'Email already registered. Sign in instead.' }, 409, env, request);
        var takenUser = await sbSelectOne(env, 'users', 'username=ilike.' + encodeURIComponent(username.trim()));
        if (takenUser) return jsonResponse({ error: 'Username already taken - try another.' }, 409, env, request);
      } else {
        var existingUser = await sbSelectOne(env, 'users', 'email=eq.' + encodeURIComponent(normalEmail));
        if (!existingUser) return jsonResponse({ error: 'No account found for that email. Sign up instead.' }, 404, env, request);
      }

      var otpCode    = String(Math.floor(100000 + Math.random() * 900000));
      var otpExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await sbUpsert(env, 'pending_otps', {
        email:      normalEmail,
        code:       otpCode,
        name:       (name && name.trim()) || null,
        username:   (username && username.trim()) || null,
        is_signin:  !isSignup,
        expires_at: otpExpires,
      });

      await sendOtp(env, normalEmail, isSignup ? name.trim() : 'there', otpCode, !isSignup);
      return jsonResponse({ ok: true }, 200, env, request);

    } catch (err) {
      console.error('[request-code]', err.message);
      return jsonResponse({ error: 'Failed to send code. Please try again.' }, 500, env, request);
    }
  }

  // POST /auth/verify
  if (path === '/auth/verify' && method === 'POST') {
    var verifyBody  = await request.json();
    var verifyEmail = (verifyBody.email || '').trim().toLowerCase();
    var verifyCode  = verifyBody.code;

    try {
      var pend = await sbSelectOne(env, 'pending_otps', 'email=eq.' + encodeURIComponent(verifyEmail));
      if (!pend)                              return jsonResponse({ error: 'No pending verification. Request a new code.' }, 400, env, request);
      if (new Date() > new Date(pend.expires_at)) return jsonResponse({ error: 'Code expired. Request a new one.' }, 400, env, request);
      if (verifyCode.trim() !== pend.code)    return jsonResponse({ error: 'Incorrect code - try again.' }, 400, env, request);

      await sbDelete(env, 'pending_otps', 'email=eq.' + encodeURIComponent(verifyEmail));

      var verifiedUser;
      if (pend.is_signin) {
        verifiedUser = await sbSelectOne(env, 'users', 'email=eq.' + encodeURIComponent(verifyEmail));
        if (!verifiedUser) return jsonResponse({ error: 'Account not found.' }, 404, env, request);
      } else {
        verifiedUser = await sbInsert(env, 'users', {
          id:          newId(),
          email:       verifyEmail,
          discord_id:  null,
          name:        pend.name,
          username:    pend.username,
          avatar_char: pend.name[0].toUpperCase(),
          avatar_url:  null,
        });
      }

      return await respondWithSession(env, verifiedUser, request);

    } catch (err) {
      console.error('[verify]', err.message);
      return jsonResponse({ error: 'Verification failed. Please try again.' }, 500, env, request);
    }
  }

  // GET /auth/me
  if (path === '/auth/me' && method === 'GET') {
    var sess = await getSession(request, env);
    if (!sess || !sess.userId) return jsonResponse({ error: 'Not signed in.' }, 401, env, request);
    return jsonResponse(sess, 200, env, request);
  }

  // POST /auth/logout
  if (path === '/auth/logout' && method === 'POST') {
    var logoutCookie = request.headers.get('Cookie') || '';
    var logoutMatch  = logoutCookie.match(/dc_session=([^;]+)/);
    var logoutSid    = logoutMatch ? decodeURIComponent(logoutMatch[1]) : 'none';
    await deleteSession(request, env);
    var logoutResponse = jsonResponse({ ok: true }, 200, env, request);
    logoutResponse.headers.append('Set-Cookie', sessionCookie(logoutSid, true));
    return logoutResponse;
  }

  // ============================================================
  // ACTIVITIES
  // ============================================================

  if (path === '/api/activities' && method === 'GET') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var actRows = await sbSelect(env, 'activities', 'order=created_at.asc');
      return jsonResponse(actRows.map(toActivity), 200, env, request);
    } catch (err) {
      console.error('[GET activities]', err.message);
      return jsonResponse({ error: 'Failed to load activities.' }, 500, env, request);
    }
  }

  if (path === '/api/activities' && method === 'POST') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var actBody = await request.json();
      var newAct  = await sbInsert(env, 'activities', {
        id:         actBody.id,
        name:       actBody.name.trim(),
        icon:       actBody.icon,
        color:      actBody.color,
        created_by: request.session.userId,
      });
      return jsonResponse(toActivity(newAct), 201, env, request);
    } catch (err) {
      console.error('[POST activities]', err.message);
      return jsonResponse({ error: 'Failed to create activity.' }, 500, env, request);
    }
  }

  var actMatch = path.match(/^\/api\/activities\/([^/]+)$/);
  if (actMatch && method === 'PUT') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var actId      = actMatch[1];
      var actPatch   = await request.json();
      await sbUpdate(env, 'activities', 'id=eq.' + encodeURIComponent(actId), {
        name: actPatch.name.trim(), icon: actPatch.icon, color: actPatch.color,
      });
      await sbUpdate(env, 'events', 'activity_id=eq.' + encodeURIComponent(actId), {
        activity_name: actPatch.name.trim(), activity_color: actPatch.color, activity_icon: actPatch.icon,
      });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) {
      console.error('[PUT activities]', err.message);
      return jsonResponse({ error: 'Failed to update activity.' }, 500, env, request);
    }
  }

  if (actMatch && method === 'DELETE') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      await sbDelete(env, 'activities', 'id=eq.' + encodeURIComponent(actMatch[1]));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) {
      console.error('[DELETE activities]', err.message);
      return jsonResponse({ error: 'Failed to delete activity.' }, 500, env, request);
    }
  }

  // ============================================================
  // EVENTS
  // ============================================================

  if (path === '/api/events' && method === 'GET') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var evRows = await sbSelect(env, 'events', 'order=date.asc,created_at.asc');
      return jsonResponse(evRows.map(toEvent), 200, env, request);
    } catch (err) {
      console.error('[GET events]', err.message);
      return jsonResponse({ error: 'Failed to load events.' }, 500, env, request);
    }
  }

  if (path === '/api/events' && method === 'POST') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var evBody = await request.json();
      var newEv  = await sbInsert(env, 'events', {
        id:                   evBody.id,
        activity_id:          evBody.activityId,
        activity_name:        evBody.activityName,
        activity_color:       evBody.activityColor,
        activity_icon:        evBody.activityIcon,
        date:                 evBody.date,
        proposed_by:          request.session.userId,
        proposed_by_name:     request.session.name,
        proposed_by_username: request.session.username,
      });
      return jsonResponse(toEvent(newEv), 201, env, request);
    } catch (err) {
      console.error('[POST events]', err.message);
      return jsonResponse({ error: 'Failed to create event.' }, 500, env, request);
    }
  }

  var evDateMatch = path.match(/^\/api\/events\/([^/]+)\/date$/);
  if (evDateMatch && method === 'PUT') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var evDateBody = await request.json();
      await sbUpdate(env, 'events', 'id=eq.' + encodeURIComponent(evDateMatch[1]), { date: evDateBody.date });
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) {
      console.error('[PUT events/date]', err.message);
      return jsonResponse({ error: 'Failed to move event.' }, 500, env, request);
    }
  }

  var evMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (evMatch && method === 'DELETE') {
    var authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      var evId = evMatch[1];
      var ev   = await sbSelectOne(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      if (!ev)                                       return jsonResponse({ error: 'Event not found.' }, 404, env, request);
      if (ev.proposed_by !== request.session.userId) return jsonResponse({ error: 'You can only remove your own events.' }, 403, env, request);
      await sbDelete(env, 'events', 'id=eq.' + encodeURIComponent(evId));
      return jsonResponse({ ok: true }, 200, env, request);
    } catch (err) {
      console.error('[DELETE events]', err.message);
      return jsonResponse({ error: 'Failed to delete event.' }, 500, env, request);
    }
  }

  return jsonResponse({ error: 'Not found.' }, 404, env, request);
}

// ==============================================================
// WORKER EXPORT
// ==============================================================

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      console.error('[unhandled]', err.message);
      return new Response(JSON.stringify({ error: 'Internal server error.' }), {
        status:  500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};