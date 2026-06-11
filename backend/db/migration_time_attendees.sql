-- Migration: add start_time, end_time and attendees to events
-- Run in Supabase SQL Editor

ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendees  TEXT DEFAULT '[]';
