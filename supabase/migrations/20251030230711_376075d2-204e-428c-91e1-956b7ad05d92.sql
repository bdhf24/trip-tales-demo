-- Add gender field to kids table
CREATE TYPE public.gender AS ENUM ('male', 'female', 'non-binary');

ALTER TABLE public.kids 
ADD COLUMN gender public.gender;

-- Update existing records to have a default (users can update later)
UPDATE public.kids 
SET gender = 'male' 
WHERE gender IS NULL;