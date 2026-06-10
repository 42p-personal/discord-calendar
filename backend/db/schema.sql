-- ─────────────────────────────────────────────────────────────────
-- Discord Calendar — PostgreSQL schema
-- Run once: psql $DATABASE_URL -f db/schema.sql
-- ─────────────────────────────────────────────────────────────────

-- Session store (used by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR     NOT NULL COLLATE "default",
  "sess"   JSON        NOT NULL,
  "expire" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users
CREATE TABLE IF NOT EXISTS users (
  id           TEXT        PRIMARY KEY,
  email        TEXT        UNIQUE NOT NULL,
  name         TEXT        NOT NULL,
  username     TEXT        UNIQUE NOT NULL,
  avatar_char  CHAR(1)     NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Pending OTPs (sign-up and sign-in codes)
CREATE TABLE IF NOT EXISTS pending_otps (
  email      TEXT        PRIMARY KEY,
  code       TEXT        NOT NULL,
  name       TEXT,
  username   TEXT,
  is_signin  BOOLEAN     DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  icon        TEXT        NOT NULL,
  color       TEXT        NOT NULL,
  created_by  TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id                    TEXT        PRIMARY KEY,
  activity_id           TEXT        REFERENCES activities(id) ON DELETE CASCADE,
  activity_name         TEXT        NOT NULL,
  activity_color        TEXT        NOT NULL,
  activity_icon         TEXT        NOT NULL,
  date                  DATE        NOT NULL,
  proposed_by           TEXT        REFERENCES users(id) ON DELETE SET NULL,
  proposed_by_name      TEXT,
  proposed_by_username  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);
