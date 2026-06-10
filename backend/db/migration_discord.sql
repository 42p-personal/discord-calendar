-- ─────────────────────────────────────────────────────────────────
-- Discord Calendar — Migration for existing databases
-- Run this in Supabase SQL Editor if you already ran schema.sql
-- Skip this if you are setting up a fresh database (use schema.sql instead)
-- ─────────────────────────────────────────────────────────────────

-- Add Discord ID column to users (nullable — email users won't have one)
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id  TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url  TEXT;

-- Email is now optional (Discord users may not have a verified email)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
