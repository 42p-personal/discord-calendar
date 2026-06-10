# Discord Calendar — Complete Deployment Guide
### Hosting with Cloudflare

---

## Choosing your deployment approach

Cloudflare offers two ways to host this app. Read both options and pick the one
that suits your comfort level.

| | Option A — Full Cloudflare | Option B — Cloudflare + VPS |
|---|---|---|
| **Frontend** | Cloudflare Pages | Cloudflare Pages |
| **Backend** | Cloudflare Workers | Node.js on any VPS |
| **Database** | Cloudflare D1 (SQLite) | Supabase (PostgreSQL) |
| **Cost** | Entirely free | ~£5/month VPS |
| **Complexity** | Medium — requires rewriting backend for Workers | Lower — keeps the Express code as-is |
| **Best for** | Small friend groups, zero running cost | Anyone who wants to keep the existing Node.js code |

**Recommendation:** If you are comfortable with a small amount of code changes,
Option A (full Cloudflare) is the better long-term choice — it is free, scales
automatically, and has no server to maintain. Option B is faster to set up if
you already have a VPS.

---

## What you need before you start (both options)

| Account / service | Free tier | Link |
|---|---|---|
| Cloudflare account | Yes | cloudflare.com |
| Resend (email OTP) | 3 000 emails/month free | resend.com |
| Domain name (any registrar) | — | Already owned |
| Node.js 18+ on your local machine | — | nodejs.org |

---

## Part 1 — Add your domain to Cloudflare (both options)

This gives you Cloudflare's DNS, CDN, and free SSL for your domain.

1. Go to **https://dash.cloudflare.com** and create a free account.
2. Click **Add a site** → enter your domain (e.g. `yourdomain.co.uk`).
3. Select the **Free** plan → Continue.
4. Cloudflare scans your existing DNS records and imports them.
5. Cloudflare gives you **two nameserver addresses**, e.g.:
   ```
   arlo.ns.cloudflare.com
   uma.ns.cloudflare.com
   ```
6. Log in to wherever your domain is registered (123reg, GoDaddy, etc.) and
   replace the existing nameservers with the two Cloudflare ones.
   - On **123reg**: Control Panel → Domain Management → Manage Domain →
     Change Nameservers → enter both Cloudflare nameservers → Save.
7. Back in Cloudflare, click **Done, check nameservers**.
8. Propagation takes 5–30 minutes. You'll get an email when it's active.

> Once your domain points to Cloudflare, **all DNS changes are made in the
> Cloudflare dashboard**, not at your registrar.

---

## Part 2 — Set up Resend (email, both options)

1. Go to **https://resend.com** and create a free account.
2. Click **API Keys → Create API Key**. Name it "Discord Calendar". Copy the key.
3. To send from your own domain (e.g. `noreply@yourdomain.co.uk`):
   - In Resend → **Domains → Add Domain** → enter your domain.
   - Resend shows you DNS records (TXT, DKIM, and optionally MX).
   - In **Cloudflare dashboard → your domain → DNS → Records**:
     - Click **Add record** for each one Resend gives you.
     - For TXT and DKIM records, set **Proxy status to DNS only** (grey cloud,
       not orange) — mail records must not be proxied.
   - Back in Resend, click **Verify Domain**. Once all records show green, done.
4. Note your `EMAIL_FROM` address, e.g. `noreply@yourdomain.co.uk`.

---

---
# OPTION A — Full Cloudflare (Pages + Workers + D1)
---

## A1 — Install the Cloudflare CLI (Wrangler)

```bash
npm install -g wrangler
wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

---

## A2 — Create the D1 database

Cloudflare D1 is a serverless SQLite database that runs at the edge.

```bash
wrangler d1 create discord-calendar
```

Copy the output — it looks like this:
```
[[d1_databases]]
binding = "DB"
database_name = "discord-calendar"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

You will paste this into `wrangler.toml` in the next step.

Run the schema against D1:

```bash
# From the backend/ folder:
wrangler d1 execute discord-calendar --remote --file=db/schema-d1.sql
```

> D1 uses SQLite syntax, which differs slightly from PostgreSQL.
> Use `schema-d1.sql` (provided below) instead of `schema.sql`.

**`backend/db/schema-d1.sql`** — create this file with these contents:

```sql
CREATE TABLE IF NOT EXISTS session (
  sid     TEXT PRIMARY KEY,
  sess    TEXT NOT NULL,
  expire  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  username     TEXT UNIQUE NOT NULL,
  avatar_char  TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_otps (
  email      TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  name       TEXT,
  username   TEXT,
  is_signin  INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id                    TEXT PRIMARY KEY,
  activity_id           TEXT,
  activity_name         TEXT NOT NULL,
  activity_color        TEXT NOT NULL,
  activity_icon         TEXT NOT NULL,
  date                  TEXT NOT NULL,
  proposed_by           TEXT,
  proposed_by_name      TEXT,
  proposed_by_username  TEXT,
  created_at            TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);
```

---

## A3 — Rewrite the backend as a Cloudflare Worker

Cloudflare Workers run a subset of the Web Platform API — they do **not**
support Express, `pg`, or Node.js built-ins like `crypto`. The backend needs
to be rewritten using the Workers-compatible `itty-router` library and D1's
built-in query API.

### Install dependencies

```bash
cd backend
npm install itty-router uuid
npm install --save-dev wrangler
```

### Create `backend/wrangler.toml`

```toml
name = "discord-calendar-api"
main = "src/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "discord-calendar"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"

[vars]
FRONTEND_URL = "https://calendar.yourdomain.co.uk"

# Secrets are added via `wrangler secret put` — do not put them here
# Required secrets: SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM
```

### Add secrets (never stored in files)

```bash
wrangler secret put SESSION_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
```

Each command prompts you to type the value.

### Create `backend/src/worker.js`

```js
import { Router } from 'itty-router';
import { v4 as uuid } from 'uuid';

const router = Router();

// ── CORS helper ───────────────────────────────────────────────
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin':      env.FRONTEND_URL,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
  };
}

function json(data, status = 200, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

// ── Session helpers (stored in D1) ────────────────────────────
async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const sid = decodeURIComponent(match[1]);
  const row = await env.DB.prepare('SELECT sess FROM session WHERE sid=? AND expire>?')
    .bind(sid, Date.now()).first();
  return row ? JSON.parse(row.sess) : null;
}

async function setSession(response, data, env) {
  const sid     = uuid();
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  await env.DB.prepare('INSERT OR REPLACE INTO session (sid,sess,expire) VALUES (?,?,?)')
    .bind(sid, JSON.stringify(data), expires).run();
  response.headers.append('Set-Cookie',
    `session=${encodeURIComponent(sid)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*60*60}`);
  return response;
}

async function clearSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/session=([^;]+)/);
  if (match) {
    await env.DB.prepare('DELETE FROM session WHERE sid=?').bind(decodeURIComponent(match[1])).run();
  }
}

// ── Email via Resend ──────────────────────────────────────────
async function sendOtp(env, to, username, code, isSignIn) {
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    env.EMAIL_FROM,
      to,
      subject: isSignIn ? 'Your Discord Calendar sign-in code' : 'Verify your Discord Calendar account',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1a1b2e">${isSignIn ? `Welcome back, ${username}!` : `Verify your account, ${username}!`}</h2>
        <p style="color:#5f6080">${isSignIn ? 'Use the code below to sign in.' : 'Use the code below to verify your account.'} Expires in 15 minutes.</p>
        <div style="background:#f4f5fb;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="font-size:38px;font-weight:700;letter-spacing:0.25em;color:#1a1b2e;margin:0">${code}</p>
        </div>
        <p style="font-size:12px;color:#9899b8">If you didn't request this, ignore this email.</p>
      </div>`,
    }),
  });
}

// ── Auth middleware ───────────────────────────────────────────
async function requireAuth(request, env) {
  const sess = await getSession(request, env);
  if (!sess?.userId) return json({ error: 'Unauthorised.' }, 401, env);
  request.session = sess;
}

// ── OPTIONS preflight ─────────────────────────────────────────
router.options('*', (req, env) => new Response(null, { status: 204, headers: corsHeaders(env) }));

// ── Auth routes ───────────────────────────────────────────────
router.post('/auth/request-code', async (request, env) => {
  const { email, name, username, isSignup } = await request.json();
  const normalEmail = email?.trim().toLowerCase();
  if (!normalEmail?.includes('@')) return json({ error: 'Enter a valid email address.' }, 400, env);

  if (isSignup) {
    if (!name?.trim())     return json({ error: 'Display name is required.' }, 400, env);
    if (!username?.trim()) return json({ error: 'Username is required.' }, 400, env);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return json({ error: 'Username must be 3–20 characters.' }, 400, env);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(normalEmail).first();
    if (exists) return json({ error: 'Email already registered.' }, 409, env);
    const uTaken = await env.DB.prepare('SELECT id FROM users WHERE LOWER(username)=LOWER(?)').bind(username).first();
    if (uTaken) return json({ error: 'Username already taken.' }, 409, env);
  } else {
    const user = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(normalEmail).first();
    if (!user) return json({ error: 'No account found for that email.' }, 404, env);
  }

  const code    = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT OR REPLACE INTO pending_otps (email,code,name,username,is_signin,expires_at) VALUES (?,?,?,?,?,?)'
  ).bind(normalEmail, code, name?.trim() ?? null, username?.trim() ?? null, isSignup ? 0 : 1, expires).run();

  await sendOtp(env, normalEmail, isSignup ? name.trim() : 'there', code, !isSignup);
  return json({ ok: true }, 200, env);
});

router.post('/auth/verify', async (request, env) => {
  const { email, code } = await request.json();
  const normalEmail = email?.trim().toLowerCase();
  const pend = await env.DB.prepare('SELECT * FROM pending_otps WHERE email=?').bind(normalEmail).first();
  if (!pend)                              return json({ error: 'No pending verification.' }, 400, env);
  if (new Date() > new Date(pend.expires_at)) return json({ error: 'Code expired.' }, 400, env);
  if (code.trim() !== pend.code)          return json({ error: 'Incorrect code.' }, 400, env);

  await env.DB.prepare('DELETE FROM pending_otps WHERE email=?').bind(normalEmail).run();

  let user;
  if (pend.is_signin) {
    user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(normalEmail).first();
  } else {
    const id = uuid();
    await env.DB.prepare(
      'INSERT INTO users (id,email,name,username,avatar_char) VALUES (?,?,?,?,?)'
    ).bind(id, normalEmail, pend.name, pend.username, pend.name[0].toUpperCase()).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  }

  const userData = { userId: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar_char };
  let response   = json({ id: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar_char }, 200, env);
  response = await setSession(response, userData, env);
  return response;
});

router.get('/auth/me', async (request, env) => {
  const sess = await getSession(request, env);
  if (!sess?.userId) return json({ error: 'Not signed in.' }, 401, env);
  return json({ id: sess.userId, email: sess.email, name: sess.name, username: sess.username, avatar: sess.avatar }, 200, env);
});

router.post('/auth/logout', async (request, env) => {
  await clearSession(request, env);
  return json({ ok: true }, 200, env);
});

// ── Activities ────────────────────────────────────────────────
router.get('/api/activities', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { results } = await env.DB.prepare('SELECT * FROM activities ORDER BY created_at').all();
  return json(results.map(r => ({ id:r.id, name:r.name, icon:r.icon, color:r.color, createdBy:r.created_by })), 200, env);
});

router.post('/api/activities', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { id, name, icon, color } = await request.json();
  await env.DB.prepare('INSERT INTO activities (id,name,icon,color,created_by) VALUES (?,?,?,?,?)')
    .bind(id, name, icon, color, request.session.userId).run();
  return json({ id, name, icon, color, createdBy: request.session.userId }, 201, env);
});

router.put('/api/activities/:id', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { name, icon, color } = await request.json();
  await env.DB.prepare('UPDATE activities SET name=?,icon=?,color=? WHERE id=?').bind(name, icon, color, request.params.id).run();
  await env.DB.prepare('UPDATE events SET activity_name=?,activity_color=?,activity_icon=? WHERE activity_id=?').bind(name, color, icon, request.params.id).run();
  return json({ ok: true }, 200, env);
});

router.delete('/api/activities/:id', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  await env.DB.prepare('DELETE FROM activities WHERE id=?').bind(request.params.id).run();
  return json({ ok: true }, 200, env);
});

// ── Events ────────────────────────────────────────────────────
router.get('/api/events', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY date, created_at').all();
  return json(results.map(r => ({
    id:r.id, activityId:r.activity_id, activityName:r.activity_name,
    activityColor:r.activity_color, activityIcon:r.activity_icon, date:r.date,
    proposedBy:r.proposed_by, proposedByName:r.proposed_by_name, proposedByUsername:r.proposed_by_username
  })), 200, env);
});

router.post('/api/events', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { id, activityId, activityName, activityColor, activityIcon, date } = await request.json();
  await env.DB.prepare(
    'INSERT INTO events (id,activity_id,activity_name,activity_color,activity_icon,date,proposed_by,proposed_by_name,proposed_by_username) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, activityId, activityName, activityColor, activityIcon, date, request.session.userId, request.session.name, request.session.username).run();
  return json({ id, activityId, activityName, activityColor, activityIcon, date, proposedBy:request.session.userId, proposedByName:request.session.name, proposedByUsername:request.session.username }, 201, env);
});

router.put('/api/events/:id/date', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const { date } = await request.json();
  await env.DB.prepare('UPDATE events SET date=? WHERE id=?').bind(date, request.params.id).run();
  return json({ ok: true }, 200, env);
});

router.delete('/api/events/:id', async (request, env) => {
  const authErr = await requireAuth(request, env); if (authErr) return authErr;
  const ev = await env.DB.prepare('SELECT proposed_by FROM events WHERE id=?').bind(request.params.id).first();
  if (!ev)                                   return json({ error: 'Not found.' }, 404, env);
  if (ev.proposed_by !== request.session.userId) return json({ error: 'Forbidden.' }, 403, env);
  await env.DB.prepare('DELETE FROM events WHERE id=?').bind(request.params.id).run();
  return json({ ok: true }, 200, env);
});

// ── Worker export ─────────────────────────────────────────────
export default {
  fetch: (request, env, ctx) => router.handle(request, env, ctx)
    .catch(err => new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })),
};
```

### Deploy the Worker

```bash
cd backend
wrangler deploy
```

Wrangler prints your Worker URL:
```
https://discord-calendar-api.YOUR-SUBDOMAIN.workers.dev
```

---

## A4 — Update the frontend API URL

In `frontend/src/api.js`, the `BASE` variable reads from `VITE_API_URL`.
Before building, create `frontend/.env.production`:

```env
VITE_API_URL=https://discord-calendar-api.YOUR-SUBDOMAIN.workers.dev
```

Then build the frontend:

```bash
cd frontend
npm run build
```

---

## A5 — Deploy the frontend to Cloudflare Pages

### Option 1 — Direct upload (no Git required)

```bash
cd frontend
npx wrangler pages deploy dist --project-name discord-calendar
```

On first run, Wrangler creates the Pages project and gives you a URL like:
```
https://discord-calendar.pages.dev
```

### Option 2 — Connect GitHub (auto-deploys on every push)

1. Push your `frontend/` folder to a GitHub repository.
2. In **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Select your repository.
4. Set:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Under **Environment variables**, add:
   ```
   VITE_API_URL = https://discord-calendar-api.YOUR-SUBDOMAIN.workers.dev
   ```
6. Click **Save and Deploy**.

---

## A6 — Add a custom domain to Pages

1. In Cloudflare dashboard → **Workers & Pages → discord-calendar → Custom domains**.
2. Click **Set up a custom domain** → enter `calendar.yourdomain.co.uk`.
3. Cloudflare adds the DNS record automatically (since your domain already uses
   Cloudflare nameservers). Done.

---

## A7 — Add a custom domain to the Worker

1. In Cloudflare dashboard → **Workers & Pages → discord-calendar-api → Settings → Domains & Routes**.
2. Click **Add** → **Custom Domain** → enter `api.yourdomain.co.uk`.
3. Cloudflare provisions SSL automatically.
4. Update `VITE_API_URL` in your Pages environment variables to
   `https://api.yourdomain.co.uk` and redeploy.

---

---
# OPTION B — Cloudflare (DNS + CDN) + VPS backend
---

This option keeps the existing Express backend unchanged and uses Cloudflare
only for DNS, SSL, and CDN. The frontend still goes on Cloudflare Pages for free.

## B1 — Set up a VPS

Get a VPS from any provider (Hetzner, DigitalOcean, Vultr — all ~£4–5/month).
SSH in and install Node.js 20 and PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib nginx
npm install -g pm2
```

Create the database:

```bash
sudo -u postgres psql << 'SQL'
CREATE USER calendar_user WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE discord_calendar OWNER calendar_user;
GRANT ALL PRIVILEGES ON DATABASE discord_calendar TO calendar_user;
SQL
```

Run the schema:

```bash
psql "postgresql://calendar_user:password@localhost:5432/discord_calendar" \
  -f /path/to/backend/db/schema.sql
```

## B2 — Deploy the backend

Upload your `backend/` folder to the VPS (via Git or SFTP), then:

```bash
cd /var/www/discord-calendar
npm install --omit=dev
```

Create `/var/www/discord-calendar/.env`:

```env
DATABASE_URL=postgresql://calendar_user:your_password@localhost:5432/discord_calendar
SESSION_SECRET=your_long_random_secret
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.co.uk
FRONTEND_URL=https://calendar.yourdomain.co.uk
NODE_ENV=production
PORT=4000
```

Start with PM2:

```bash
pm2 start src/index.js --name discord-calendar
pm2 save && pm2 startup
```

## B3 — Configure Nginx + SSL

```bash
apt install -y certbot python3-certbot-nginx
nano /etc/nginx/sites-available/discord-calendar
```

Paste:

```nginx
server {
    listen 80;
    server_name api.yourdomain.co.uk;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name api.yourdomain.co.uk;
    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.co.uk/privkey.pem;
    location / {
        proxy_pass         http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/discord-calendar /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.yourdomain.co.uk
```

## B4 — Add DNS record for the backend in Cloudflare

In **Cloudflare dashboard → your domain → DNS → Records**:

| Type | Name | Content       | Proxy |
|------|------|---------------|-------|
| A    | api  | YOUR.VPS.IP   | Proxied (orange cloud) |

This routes `api.yourdomain.co.uk` through Cloudflare's CDN and handles SSL.

> **Important:** Set the SSL/TLS mode to **Full** in Cloudflare → SSL/TLS →
> Overview. This tells Cloudflare to use HTTPS between itself and your VPS.

## B5 — Build and deploy the frontend to Cloudflare Pages

Create `frontend/.env.production`:

```env
VITE_API_URL=https://api.yourdomain.co.uk
```

Build:
```bash
cd frontend && npm run build
```

Deploy:
```bash
npx wrangler pages deploy dist --project-name discord-calendar
```

Then add `calendar.yourdomain.co.uk` as a custom domain in Pages (same as A6).

---

---
# Part 3 — Cloudflare security settings (both options)
---

In **Cloudflare dashboard → your domain**:

### SSL/TLS
- **SSL/TLS → Overview:** Set to **Full (strict)** for Option A,
  **Full** for Option B.
- **Edge Certificates:** Enable **Always Use HTTPS** and
  **Automatic HTTPS Rewrites**.

### Security
- **Security → Settings:** Set Security Level to **Medium**.
- **Security → Bots:** Enable **Bot Fight Mode** (free, blocks basic scrapers).

### Speed
- **Speed → Optimization:** Enable **Auto Minify** (JS, CSS, HTML).

---

---
# Part 4 — Resend DNS records via Cloudflare (both options)
---

When Resend gives you DNS records to verify your sending domain, add them in
Cloudflare as follows. **All mail/DKIM records must have the orange proxy
cloud turned OFF (grey = DNS only):**

| Type  | Name                        | Content (from Resend)    | Proxied |
|-------|-----------------------------|--------------------------|---------|
| TXT   | `@` or `resend._domainkey`  | Resend's TXT value       | DNS only |
| MX    | `@` or `send`               | Resend's MX value        | DNS only |
| CNAME | `resend._domainkey`         | Resend's DKIM value      | DNS only |

---

---
# Summary checklist
---

## Option A — Full Cloudflare

| Step | Task | Done |
|---|---|---|
| 1 | Add domain to Cloudflare, update nameservers | ☐ |
| 2 | Set up Resend, verify domain in Cloudflare DNS | ☐ |
| 3 | Install Wrangler, `wrangler login` | ☐ |
| 4 | Create D1 database, run `schema-d1.sql` | ☐ |
| 5 | Create `backend/wrangler.toml`, add secrets | ☐ |
| 6 | Create `backend/src/worker.js` | ☐ |
| 7 | `wrangler deploy` — note your Worker URL | ☐ |
| 8 | Create `frontend/.env.production` with Worker URL | ☐ |
| 9 | `npm run build` in frontend | ☐ |
| 10 | Deploy frontend to Pages (`wrangler pages deploy dist`) | ☐ |
| 11 | Add custom domain to Pages (`calendar.yourdomain.co.uk`) | ☐ |
| 12 | Add custom domain to Worker (`api.yourdomain.co.uk`) | ☐ |
| 13 | Update Pages env var to use custom API domain, redeploy | ☐ |
| 14 | Test sign-up, OTP email, and event creation | ☐ |

## Option B — Cloudflare + VPS

| Step | Task | Done |
|---|---|---|
| 1 | Add domain to Cloudflare, update nameservers | ☐ |
| 2 | Set up Resend, verify domain in Cloudflare DNS | ☐ |
| 3 | Provision VPS, install Node.js 20 + PostgreSQL + Nginx | ☐ |
| 4 | Create database and run `schema.sql` | ☐ |
| 5 | Deploy backend, create `.env`, start with PM2 | ☐ |
| 6 | Configure Nginx reverse proxy + Certbot SSL | ☐ |
| 7 | Add A record for `api.yourdomain.co.uk` in Cloudflare | ☐ |
| 8 | Create `frontend/.env.production` with API URL | ☐ |
| 9 | `npm run build` in frontend | ☐ |
| 10 | Deploy frontend to Pages | ☐ |
| 11 | Add custom domain to Pages | ☐ |
| 12 | Test sign-up, OTP email, and event creation | ☐ |

---

## Troubleshooting

**CORS errors in the browser:**
The Worker's `FRONTEND_URL` secret must exactly match the Pages URL
(including `https://` and no trailing slash). Update the secret:
```bash
wrangler secret put FRONTEND_URL
```

**OTP emails not arriving:**
Check Resend dashboard → Logs. Verify all DNS records in Cloudflare are
set to **DNS only** (grey cloud), not proxied.

**Worker returns 500:**
```bash
wrangler tail   # streams live logs from the Worker
```

**Pages shows old version after deploy:**
In Cloudflare → Caching → Configuration → click **Purge Everything**.

**D1 query errors:**
D1 is SQLite — it does not support PostgreSQL syntax like `ON CONFLICT DO UPDATE`
in older Workers runtimes. Ensure `compatibility_date` in `wrangler.toml` is
`2024-01-01` or later.
