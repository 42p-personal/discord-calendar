# Discord Calendar

A shared event planning calendar for friend groups.
Built with React (Vite) + Node.js (Express) + PostgreSQL.

## Features

- Email-based authentication with one-time codes
- Drag-and-drop events onto the calendar
- Month, week and day views
- Light and dark mode
- Configurable shared activity library
- Each event shows who proposed it

## Project structure

```
discord-calendar/
├── frontend/          React + Vite (UI)
│   ├── src/
│   │   ├── App.jsx              Main calendar component
│   │   ├── api.js               All API calls in one place
│   │   ├── constants.js         Shared data and theme helpers
│   │   └── components/
│   │       ├── AuthScreen.jsx   Sign-in / sign-up / OTP verification
│   │       ├── ActivityManager.jsx  Dark modal for managing activities
│   │       └── EventPopover.jsx     Click-to-view event details
│   └── index.html
│
├── backend/           Node.js + Express (API + static file server)
│   ├── src/
│   │   ├── index.js             Express app entry point
│   │   ├── db/pool.js           PostgreSQL connection pool
│   │   └── routes/
│   │       ├── auth.js          OTP request, verify, me, logout
│   │       └── data.js          Activities and events CRUD
│   ├── db/schema.sql            Run once to create all tables
│   └── .env.example             Template for environment variables
│
└── DEPLOYMENT_GUIDE.md          Step-by-step guide for 123reg VPS
```

## Quick start (local development)

**1. Backend**
```bash
cd backend
cp .env.example .env        # fill in your values
npm install
# Run the schema against your local or remote database:
psql $DATABASE_URL -f db/schema.sql
npm run dev                 # starts on http://localhost:4000
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:3000
```

The Vite dev server proxies `/api` and `/auth` to `localhost:4000`.

## Deploying to production

See **DEPLOYMENT_GUIDE.md** for full step-by-step instructions for 123reg VPS hosting.
