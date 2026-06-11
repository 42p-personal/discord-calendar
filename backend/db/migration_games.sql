-- Migration: game release tracking
-- Run in Supabase SQL Editor

-- Stores games we are watching (both auto-discovered and manually added)
CREATE TABLE IF NOT EXISTS watched_games (
  id              TEXT        PRIMARY KEY,
  rawg_id         INTEGER     UNIQUE,        -- null for manually added games
  name            TEXT        NOT NULL,
  release_date    TEXT,                      -- YYYY-MM-DD
  cover_url       TEXT,
  platforms       TEXT,                      -- comma-separated display string
  is_manual       BOOLEAN     DEFAULT FALSE,
  added_by        TEXT        REFERENCES users(id) ON DELETE SET NULL,
  calendar_event_id TEXT,                   -- set once the event has been created
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watched_games_release ON watched_games (release_date);
CREATE INDEX IF NOT EXISTS idx_watched_games_rawg    ON watched_games (rawg_id);
