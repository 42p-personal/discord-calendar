-- Migration: add guild_id to events, activities and watched_games
-- Also clears all existing data as per decision 3
-- Run in Supabase SQL Editor

-- Clear existing data
DELETE FROM events;
DELETE FROM activities;
DELETE FROM watched_games;
DELETE FROM session;

-- Add guild_id to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS guild_id TEXT;
CREATE INDEX IF NOT EXISTS idx_activities_guild ON activities (guild_id);

-- Add guild_id to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS guild_id TEXT;
CREATE INDEX IF NOT EXISTS idx_events_guild ON events (guild_id);

-- Add guild_id to watched_games
ALTER TABLE watched_games ADD COLUMN IF NOT EXISTS guild_id TEXT;
CREATE INDEX IF NOT EXISTS idx_watched_games_guild ON watched_games (guild_id);

-- Store Discord access token in session for guild lookups
-- (no schema change needed - stored in the sess JSON column)
