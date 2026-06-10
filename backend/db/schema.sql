-- ─────────────────────────────────────────────────────────────────
-- Discord Calendar — PostgreSQL schema for Supabase
-- Run once: paste into Supabase SQL Editor and click Run
-- ─────────────────────────────────────────────────────────────────

-- Session store
CREATE TABLE IF NOT EXISTS session (
  sid     TEXT        PRIMARY KEY,
  sess    TEXT        NOT NULL,
  expire  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);

-- Users (supports both email OTP and Discord OAuth)
CREATE TABLE IF NOT EXISTS users (
  id           TEXT        PRIMARY KEY,
  email        TEXT        UNIQUE,
  discord_id   TEXT        UNIQUE,
  name         TEXT        NOT NULL,
  username     TEXT        UNIQUE NOT NULL,
  avatar_char  TEXT        NOT NULL,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Pending OTPs (sign-up and sign-in verification codes)
CREATE TABLE IF NOT EXISTS pending_otps (
  email       TEXT        PRIMARY KEY,
  code        TEXT        NOT NULL,
  name        TEXT,
  username    TEXT,
  is_signin   BOOLEAN     DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  icon        TEXT        NOT NULL,
  color       TEXT        NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id                    TEXT        PRIMARY KEY,
  activity_id           TEXT,
  activity_name         TEXT        NOT NULL,
  activity_color        TEXT        NOT NULL,
  activity_icon         TEXT        NOT NULL,
  date                  TEXT        NOT NULL,
  proposed_by           TEXT,
  proposed_by_name      TEXT,
  proposed_by_username  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);
