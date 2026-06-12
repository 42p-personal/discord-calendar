# 42p Calendar

A shared event calendar for Discord friend groups, available at [calendar.42p.uk](https://calendar.42p.uk).

## What it does

- Discord OAuth sign-in — access is tied to your Discord servers
- Per-server (guild) calendar with month, week, and day views
- Drag activities onto days to propose events; set start/end times
- Join and leave events; see who's attending
- Configurable activity library with emoji or custom image icons
- Game release tracking via [42p Games](https://games.42p.uk) — games added there appear automatically as calendar events
- Daily cron sync keeps upcoming game release dates up to date
- Light and dark mode

## Architecture

```
calendar.42p.uk   →  Cloudflare Pages  (React 18 + Vite)
api.42p.uk        →  Cloudflare Worker (single worker.js)
                       ├── Supabase PostgreSQL (REST API)
                       ├── Discord OAuth2
                       └── RAWG.io (game release data)
```

## Repo structure

```
discord-calendar/
├── .github/workflows/
│   └── deploy-worker.yml     Auto-deploys Worker on push to backend/
├── backend/
│   ├── src/worker.js         Entire backend in one file
│   ├── wrangler.toml         Worker config + cron trigger (08:00 UTC daily)
│   └── db/
│       ├── schema.sql        Full schema — run once on a fresh DB
│       └── migration_*.sql   Incremental migrations
└── frontend/
    └── src/
        ├── App.jsx           Main calendar app
        ├── api.js            All API calls; exports setGuildId/getGuildId
        ├── constants.js      Theme, colours, date helpers
        └── components/
            ├── AuthScreen.jsx
            ├── ActivityManager.jsx
            ├── EventPopover.jsx
            ├── TimePickerModal.jsx
            ├── GuildPicker.jsx
            └── GuildSwitcher.jsx
```

## Local development

**Frontend**
```bash
cd frontend
npm install
# Create .env.local:
# VITE_API_URL=https://api.42p.uk
npm run dev
```

**Worker (backend)**
```bash
cd backend
npm install
npx wrangler dev src/worker.js --name discord-calendar --compatibility-date 2025-01-01
# Add secrets to .dev.vars for local use
```

## Deployment

**Deploy Worker**
```bash
cd backend
npm run deploy
# Verify api.42p.uk custom domain is still active after deploy:
# Cloudflare → Workers & Pages → discord-calendar → Settings → Domains & Routes
```

**Deploy frontend**
```bash
cd frontend
npm run build
git add . && git commit -m "..." && git push
# Cloudflare Pages auto-rebuilds from GitHub (project: discord-calendar)
```

**Update Worker secrets**
```bash
# Edit secrets.json (never commit this file)
npx wrangler secret:bulk secrets.json --name discord-calendar
rm secrets.json
```

## Related

- **[games-calendar](https://github.com/42p-personal/games-calendar)** — companion game discovery frontend (games.42p.uk)
