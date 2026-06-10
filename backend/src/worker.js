/**
 * Discord Calendar — Cloudflare Worker
 *
 * Supports both email OTP and Discord OAuth2 authentication.
 * Uses Supabase REST API for all database operations.
 *
 * Environment variables (set via wrangler secret put):
 *   SUPABASE_URL          — https://xxxxxxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role JWT (encrypt)
 *   SESSION_SECRET        — long random string (encrypt)
 *   RESEND_API_KEY        — from resend.com (encrypt)
 *   EMAIL_FROM            — e.g. noreply@yourdomain.co.uk
 *   FRONTEND_URL          — e.g. https://calendar.yourdomain.co.uk
 *   DISCORD_CLIENT_ID     — from discord.com/developers
 *   DISCORD_CLIENT_SECRET — from discord.com/developers (encrypt)
 */

// ─── Supabase REST helpers ────────────────────────────────────

function sbHeaders(env) {
  return {
    'Content-Type':  'application/json',
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Prefer':        'return=representation',
  };
}

async function sbSelect(env, table, filters = '') {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/${table}${filters ? '?' + filters : ''}`,
    { headers: sbHeaders(env) }
  );
  if (!res.ok) throw new Error(`Supabase SELECT ${table} failed: ${await res.text()}`);
  return res.json();
}

async function sbSelectOne(env, table, filters = '') {
  const rows = await sbSelect(env, table, filters + (filters ? '&' : '') + 'limit=1');
  return rows[0] ?? null;
}

async function sbInsert(env, table, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: sbHeaders(env),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase INSERT ${table} failed: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpsert(env, table, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...sbHeaders(env), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT ${table} failed: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function sbUpdate(env, table, filters, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    method:  'PATCH',
    headers: sbHeaders(env),
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase UPDATE ${table} failed: ${await res.text()}`);
}

async function sbDelete(env, table, filters) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${filters}`, {
    method:  'DELETE',
    headers: sbHeaders(env),
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${table} failed: ${await res.text()}`);
}

// ─── Helpers ──────────────────────────────────────────────────

function newId() { return crypto.randomUUID(); }

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin':      env.FRONTEND_URL ?? '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
  };
}

function jsonResponse(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

// ─── Session helpers ──────────────────────────────────────────

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match  = cookie.match(/dc_session=([^;]+)/);
  if (!match) return null;
  const sid = decodeURIComponent(match[1]);
  const now = new Date().toISOString();
  const row = await sbSelectOne(env, 'session',
    `sid=eq.${encodeURIComponent(sid)}&expire=gt.${encodeURIComponent(now)}`);
  if (!row) return null;
  try { return JSON.parse(row.sess); } catch { return null; }
}

async function createSession(env, data) {
  const sid     = newId();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sbUpsert(env, 'session', { sid, sess: JSON.stringify(data), expire: expires });
  return sid;
}

async function deleteSession(request, env) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match  = cookie.match(/dc_session=([^;]+)/);
  if (match) {
    await sbDelete(env, 'session',
      `sid=eq.${encodeURIComponent(decodeURIComponent(match[1]))}`).catch(() => {});
  }
}

function sessionCookie(sid, clear = false) {
  const maxAge = clear ? 0 : 30 * 24 * 60 * 60;
  return `dc_session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`;
}

// ─── Email helper ─────────────────────────────────────────────

async function sendOtp(env, to, username, code, isSignIn) {
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    env.EMAIL_FROM,
      to,
      subject: isSignIn
        ? 'Your Discord Calendar sign-in code'
        : 'Verify your Discord Calendar account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <div style="width:40px;height:40px;border-radius:10px;background:#6366f1;display:flex;align-items:center;justify-content:center">
              <span style="font-size:20px">📅</span>
            </div>
            <span style="font-size:18px;font-weight:700;color:#1a1b2e">Discord Calendar</span>
          </div>
          <h2 style="font-size:20px;color:#1a1b2e;margin:0 0 8px">
            ${isSignIn ? `Welcome back, ${username}!` : `Verify your account, ${username}!`}
          </h2>
          <p style="color:#5f6080;margin:0 0 24px">
            ${isSignIn ? 'Use the code below to sign in.' : 'Use the code below to verify your account.'}
            It expires in 15 minutes.
          </p>
          <div style="background:#f4f5fb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 8px;font-size:12px;color:#9899b8;letter-spacing:0.06em;text-transform:uppercase">
              Verification code
            </p>
            <p style="margin:0;font-size:38px;font-weight:700;letter-spacing:0.25em;color:#1a1b2e">
              ${code}
            </p>
          </div>
          <p style="font-size:12px;color:#9899b8;margin:0">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
  });
}

// ─── Auth middleware ───────────────────────────────────────────

async function requireAuth(request, env) {
  const sess = await getSession(request, env);
  if (!sess?.userId) return jsonResponse({ error: 'Unauthorised.' }, 401, env);
  request.session = sess;
  return null;
}

// ─── Shared: build session data and set cookie ────────────────

function buildSessionData(user) {
  return {
    userId:    user.id,
    email:     user.email     ?? null,
    discordId: user.discord_id ?? null,
    name:      user.name,
    username:  user.username,
    avatar:    user.avatar_char,
    avatarUrl: user.avatar_url ?? null,
  };
}

async function respondWithSession(env, user) {
  const sessData = buildSessionData(user);
  const sid      = await createSession(env, sessData);
  const response = jsonResponse(sessData, 200, env);
  response.headers.append('Set-Cookie', sessionCookie(sid));
  return response;
}

// ─── Main request handler ─────────────────────────────────────

async function handleRequest(request, env) {
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method.toUpperCase();

  // Preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  // Health check
  if (path === '/health' && method === 'GET') {
    return jsonResponse({ status: 'ok' }, 200, env);
  }

  // ════════════════════════════════════════════════
  // DISCORD OAUTH
  // ════════════════════════════════════════════════

  // GET /auth/discord — redirect user to Discord authorisation page
  if (path === '/auth/discord' && method === 'GET') {
    const params = new URLSearchParams({
      client_id:     env.DISCORD_CLIENT_ID,
      redirect_uri:  `${new URL(request.url).origin}/auth/discord/callback`,
      response_type: 'code',
      scope:         'identify email',
    });
    return Response.redirect(
      `https://discord.com/oauth2/authorize?${params.toString()}`,
      302
    );
  }

  // GET /auth/discord/callback — Discord redirects here with ?code=
  if (path === '/auth/discord/callback' && method === 'GET') {
    const code  = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error || !code) {
      return Response.redirect(`${env.FRONTEND_URL}?auth_error=discord_denied`, 302);
    }

    try {
      // Exchange code for access token
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          client_id:     env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type:    'authorization_code',
          code,
          redirect_uri:  `${new URL(request.url).origin}/auth/discord/callback`,
        }),
      });

      if (!tokenRes.ok) {
        console.error('[discord/callback] token exchange failed:', await tokenRes.text());
        return Response.redirect(`${env.FRONTEND_URL}?auth_error=token_exchange`, 302);
      }

      const tokenData = await tokenRes.json();

      // Fetch Discord user profile
      const profileRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!profileRes.ok) {
        console.error('[discord/callback] profile fetch failed:', await profileRes.text());
        return Response.redirect(`${env.FRONTEND_URL}?auth_error=profile_fetch`, 302);
      }

      const profile = await profileRes.json();
      // profile fields: id, username, global_name, email, avatar

      const discordId  = profile.id;
      const discordName = profile.global_name || profile.username;
      const avatarUrl  = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;

      // Check if user already exists (by Discord ID or email)
      let user = await sbSelectOne(env, 'users', `discord_id=eq.${encodeURIComponent(discordId)}`);

      if (!user && profile.email) {
        // Link Discord to an existing email account if emails match
        user = await sbSelectOne(env, 'users', `email=eq.${encodeURIComponent(profile.email)}`);
        if (user) {
          // Update existing user with Discord info
          await sbUpdate(env, 'users', `id=eq.${encodeURIComponent(user.id)}`, {
            discord_id: discordId,
            avatar_url: avatarUrl,
          });
          user = { ...user, discord_id: discordId, avatar_url: avatarUrl };
        }
      }

      if (!user) {
        // New user — create account using Discord profile
        // Generate a unique username from Discord username
        let baseUsername = profile.username.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 18);
        let username     = baseUsername;
        let suffix       = 1;

        // Ensure username is unique
        while (await sbSelectOne(env, 'users', `username=ilike.${encodeURIComponent(username)}`)) {
          username = `${baseUsername}${suffix}`;
          suffix++;
        }

        user = await sbInsert(env, 'users', {
          id:          newId(),
          email:       profile.email ?? null,
          discord_id:  discordId,
          name:        discordName,
          username,
          avatar_char: discordName[0].toUpperCase(),
          avatar_url:  avatarUrl,
        });
      }

      // Create session and redirect to frontend
      const sessData = buildSessionData(user);
      const sid      = await createSession(env, sessData);

      const redirectUrl  = new URL(env.FRONTEND_URL);
      redirectUrl.pathname = '/';
      redirectUrl.searchParams.set('auth', 'success');

      const response = Response.redirect(redirectUrl.toString(), 302);
      // Note: Response.redirect creates an immutable response, so we use a
      // manual redirect response to allow setting the cookie header
      return new Response(null, {
        status: 302,
        headers: {
          'Location':   redirectUrl.toString(),
          'Set-Cookie': sessionCookie(sid),
        },
      });

    } catch (err) {
      console.error('[discord/callback] unhandled error:', err.message);
      return Response.redirect(`${env.FRONTEND_URL}?auth_error=server_error`, 302);
    }
  }

  // ════════════════════════════════════════════════
  // EMAIL OTP AUTH
  // ════════════════════════════════════════════════

  // POST /auth/request-code
  if (path === '/auth/request-code' && method === 'POST') {
    const { email, name, username, isSignup } = await request.json();
    const normalEmail = email?.trim().toLowerCase();

    if (!normalEmail?.includes('@')) {
      return jsonResponse({ error: 'Enter a valid email address.' }, 400, env);
    }

    try {
      if (isSignup) {
        if (!name?.trim())     return jsonResponse({ error: 'Display name is required.' }, 400, env);
        if (!username?.trim()) return jsonResponse({ error: 'Username is required.' }, 400, env);
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
          return jsonResponse({ error: 'Username must be 3–20 characters: letters, numbers and _ only.' }, 400, env);
        }
        const existing = await sbSelectOne(env, 'users', `email=eq.${encodeURIComponent(normalEmail)}`);
        if (existing) return jsonResponse({ error: 'Email already registered. Sign in instead.' }, 409, env);
        const takenUser = await sbSelectOne(env, 'users', `username=ilike.${encodeURIComponent(username.trim())}`);
        if (takenUser)  return jsonResponse({ error: 'Username already taken — try another.' }, 409, env);
      } else {
        const user = await sbSelectOne(env, 'users', `email=eq.${encodeURIComponent(normalEmail)}`);
        if (!user) return jsonResponse({ error: 'No account found for that email. Sign up instead.' }, 404, env);
      }

      const code    = String(Math.floor(100_000 + Math.random() * 900_000));
      const expires = new Date(Date.now() + 15 * 60 * 1_000).toISOString();

      await sbUpsert(env, 'pending_otps', {
        email:     normalEmail,
        code,
        name:      name?.trim()     ?? null,
        username:  username?.trim() ?? null,
        is_signin: !isSignup,
        expires_at: expires,
      });

      await sendOtp(env, normalEmail, isSignup ? name.trim() : 'there', code, !isSignup);
      return jsonResponse({ ok: true }, 200, env);

    } catch (err) {
      console.error('[request-code]', err.message);
      return jsonResponse({ error: 'Failed to send code. Please try again.' }, 500, env);
    }
  }

  // POST /auth/verify
  if (path === '/auth/verify' && method === 'POST') {
    const { email, code } = await request.json();
    const normalEmail = email?.trim().toLowerCase();

    try {
      const pend = await sbSelectOne(env, 'pending_otps', `email=eq.${encodeURIComponent(normalEmail)}`);
      if (!pend)                                return jsonResponse({ error: 'No pending verification. Request a new code.' }, 400, env);
      if (new Date() > new Date(pend.expires_at)) return jsonResponse({ error: 'Code expired. Request a new one.' }, 400, env);
      if (code.trim() !== pend.code)            return jsonResponse({ error: 'Incorrect code — try again.' }, 400, env);

      await sbDelete(env, 'pending_otps', `email=eq.${encodeURIComponent(normalEmail)}`);

      let user;
      if (pend.is_signin) {
        user = await sbSelectOne(env, 'users', `email=eq.${encodeURIComponent(normalEmail)}`);
        if (!user) return jsonResponse({ error: 'Account not found.' }, 404, env);
      } else {
        user = await sbInsert(env, 'users', {
          id:          newId(),
          email:       normalEmail,
          discord_id:  null,
          name:        pend.name,
          username:    pend.username,
          avatar_char: pend.name[0].toUpperCase(),
          avatar_url:  null,
        });
      }

      return await respondWithSession(env, user);

    } catch (err) {
      console.error('[verify]', err.message);
      return jsonResponse({ error: 'Verification failed. Please try again.' }, 500, env);
    }
  }

  // GET /auth/me
  if (path === '/auth/me' && method === 'GET') {
    const sess = await getSession(request, env);
    if (!sess?.userId) return jsonResponse({ error: 'Not signed in.' }, 401, env);
    return jsonResponse(sess, 200, env);
  }

  // POST /auth/logout
  if (path === '/auth/logout' && method === 'POST') {
    const cookie = request.headers.get('Cookie') ?? '';
    const match  = cookie.match(/dc_session=([^;]+)/);
    const sid    = match ? decodeURIComponent(match[1]) : 'none';
    await deleteSession(request, env);
    const response = jsonResponse({ ok: true }, 200, env);
    response.headers.append('Set-Cookie', sessionCookie(sid, true));
    return response;
  }

  // ════════════════════════════════════════════════
  // ACTIVITIES
  // ════════════════════════════════════════════════

  if (path === '/api/activities' && method === 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const rows = await sbSelect(env, 'activities', 'order=created_at.asc');
      return jsonResponse(rows.map(toActivity), 200, env);
    } catch (err) {
      console.error('[GET activities]', err.message);
      return jsonResponse({ error: 'Failed to load activities.' }, 500, env);
    }
  }

  if (path === '/api/activities' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const { id, name, icon, color } = await request.json();
      const row = await sbInsert(env, 'activities', {
        id, name: name.trim(), icon, color,
        created_by: request.session.userId,
      });
      return jsonResponse(toActivity(row), 201, env);
    } catch (err) {
      console.error('[POST activities]', err.message);
      return jsonResponse({ error: 'Failed to create activity.' }, 500, env);
    }
  }

  const actMatch = path.match(/^\/api\/activities\/([^/]+)$/);
  if (actMatch && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const actId = actMatch[1];
      const { name, icon, color } = await request.json();
      await sbUpdate(env, 'activities', `id=eq.${encodeURIComponent(actId)}`, { name: name.trim(), icon, color });
      await sbUpdate(env, 'events', `activity_id=eq.${encodeURIComponent(actId)}`, {
        activity_name: name.trim(), activity_color: color, activity_icon: icon,
      });
      return jsonResponse({ ok: true }, 200, env);
    } catch (err) {
      console.error('[PUT activities]', err.message);
      return jsonResponse({ error: 'Failed to update activity.' }, 500, env);
    }
  }

  if (actMatch && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      await sbDelete(env, 'activities', `id=eq.${encodeURIComponent(actMatch[1])}`);
      return jsonResponse({ ok: true }, 200, env);
    } catch (err) {
      console.error('[DELETE activities]', err.message);
      return jsonResponse({ error: 'Failed to delete activity.' }, 500, env);
    }
  }

  // ════════════════════════════════════════════════
  // EVENTS
  // ════════════════════════════════════════════════

  if (path === '/api/events' && method === 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const rows = await sbSelect(env, 'events', 'order=date.asc,created_at.asc');
      return jsonResponse(rows.map(toEvent), 200, env);
    } catch (err) {
      console.error('[GET events]', err.message);
      return jsonResponse({ error: 'Failed to load events.' }, 500, env);
    }
  }

  if (path === '/api/events' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const { id, activityId, activityName, activityColor, activityIcon, date } = await request.json();
      const row = await sbInsert(env, 'events', {
        id,
        activity_id:          activityId,
        activity_name:        activityName,
        activity_color:       activityColor,
        activity_icon:        activityIcon,
        date,
        proposed_by:          request.session.userId,
        proposed_by_name:     request.session.name,
        proposed_by_username: request.session.username,
      });
      return jsonResponse(toEvent(row), 201, env);
    } catch (err) {
      console.error('[POST events]', err.message);
      return jsonResponse({ error: 'Failed to create event.' }, 500, env);
    }
  }

  const evDateMatch = path.match(/^\/api\/events\/([^/]+)\/date$/);
  if (evDateMatch && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const { date } = await request.json();
      await sbUpdate(env, 'events', `id=eq.${encodeURIComponent(evDateMatch[1])}`, { date });
      return jsonResponse({ ok: true }, 200, env);
    } catch (err) {
      console.error('[PUT events/date]', err.message);
      return jsonResponse({ error: 'Failed to move event.' }, 500, env);
    }
  }

  const evMatch = path.match(/^\/api\/events\/([^/]+)$/);
  if (evMatch && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    try {
      const evId = evMatch[1];
      const ev   = await sbSelectOne(env, 'events', `id=eq.${encodeURIComponent(evId)}`);
      if (!ev)                                       return jsonResponse({ error: 'Event not found.' }, 404, env);
      if (ev.proposed_by !== request.session.userId) return jsonResponse({ error: 'You can only remove your own events.' }, 403, env);
      await sbDelete(env, 'events', `id=eq.${encodeURIComponent(evId)}`);
      return jsonResponse({ ok: true }, 200, env);
    } catch (err) {
      console.error('[DELETE events]', err.message);
      return jsonResponse({ error: 'Failed to delete event.' }, 500, env);
    }
  }

  return jsonResponse({ error: 'Not found.' }, 404, env);
}

// ─── Row mappers ──────────────────────────────────────────────

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

// ─── Worker export ────────────────────────────────────────────

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
