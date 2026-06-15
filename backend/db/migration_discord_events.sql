-- Migration: sync calendar events to Discord's built-in scheduled events
-- Run in Supabase SQL Editor

-- Link a calendar event to the Discord scheduled event it created, so the
-- Worker can update/delete it when the calendar event changes.
ALTER TABLE events ADD COLUMN IF NOT EXISTS discord_event_id TEXT;

-- Per-guild settings: the timezone used to convert wall-clock event times to
-- UTC for Discord, and whether Discord sync is enabled.
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id     TEXT        PRIMARY KEY,
  timezone     TEXT        NOT NULL DEFAULT 'Europe/London',
  discord_sync BOOLEAN     NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
