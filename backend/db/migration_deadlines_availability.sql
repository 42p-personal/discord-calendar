-- Migration: vote round deadlines + "Who's Around" availability
-- Run in Supabase SQL Editor

-- Vote rounds can have an optional closing time. When past, the round
-- auto-closes server-side and voting/nominating is locked.
ALTER TABLE vote_rounds ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;

-- Per-user weekly availability, scoped by guild. `slots` is a JSON array of
-- strings like "1-eve" (weekday 0=Sun..6=Sat, bucket morn/aft/eve/late).
CREATE TABLE IF NOT EXISTS availability (
  guild_id    TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,
  user_name   TEXT,
  slots       TEXT        NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_availability_guild ON availability (guild_id);
