-- Phase 1: Database Migrations for all features

-- 1. Preview Mode: Add preview image columns to pages table
ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS preview_image_url text,
ADD COLUMN IF NOT EXISTS is_high_res boolean DEFAULT false;

-- 2. Interactive Elements: Add questions and activities to pages table
ALTER TABLE pages 
ADD COLUMN IF NOT EXISTS questions_for_child jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS activities jsonb DEFAULT '[]'::jsonb;

-- 3. Character Interests: Add interests array to characters table
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT ARRAY[]::text[];

-- Add index for better query performance on character interests
CREATE INDEX IF NOT EXISTS idx_characters_interests ON characters USING GIN(interests);

-- Add index for pages with high-res vs preview
CREATE INDEX IF NOT EXISTS idx_pages_is_high_res ON pages(is_high_res);

-- Update the update_updated_at trigger for characters table to capture interest changes
-- (trigger already exists, no changes needed)