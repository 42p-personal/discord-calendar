import 'dotenv/config';
import path           from 'path';
import { fileURLToPath } from 'url';
import express         from 'express';
import helmet          from 'helmet';
import cors            from 'cors';
import session         from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg              from 'pg';

import authRouter from './routes/auth.js';
import dataRouter from './routes/data.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PgSession  = connectPgSimple(session);
const { Pool }   = pg;

const app  = express();
const PORT = process.env.PORT || 4000;
const PROD = process.env.NODE_ENV === 'production';

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      fontSrc:    ["'self'", 'cdn.jsdelivr.net'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

// ── CORS (development only — in production the backend serves the frontend) ──
if (!PROD) {
  app.use(cors({
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }));
}

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json());

// ── Sessions ──────────────────────────────────────────────────
const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(session({
  store: new PgSession({
    pool:        sessionPool,
    tableName:   'session',
    createTableIfMissing: false, // table is created by schema.sql
  }),
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   PROD,   // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   30 * 24 * 60 * 60 * 1_000, // 30 days
  },
}));

// ── API routes ────────────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/api',  dataRouter);

// ── Serve the built React frontend ───────────────────────────
// In production the backend serves the frontend's dist/ folder.
// The Vite build output should be copied to backend/public/ (see deployment guide).
if (PROD) {
  const staticDir = path.join(__dirname, '..', 'public');
  app.use(express.static(staticDir));
  // All non-API routes fall through to index.html (React client-side routing)
  app.get(/^(?!\/api|\/auth).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Discord Calendar API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});

export default app;
