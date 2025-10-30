-- Make story-images bucket public so images can be accessed via public URLs
UPDATE storage.buckets 
SET public = true 
WHERE name = 'story-images';