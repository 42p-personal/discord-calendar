-- Migration: add steam_url to watched_games and events
-- Run in Supabase SQL Editor

ALTER TABLE watched_games ADD COLUMN IF NOT EXISTS steam_url TEXT;
ALTER TABLE events        ADD COLUMN IF NOT EXISTS steam_url TEXT;
