-- Fix stories.user_id nullable issue
-- First, check if there are any NULL user_id records and delete them (orphaned stories)
DELETE FROM stories WHERE user_id IS NULL;

-- Make user_id column NOT NULL to enforce ownership at database level
ALTER TABLE stories ALTER COLUMN user_id SET NOT NULL;