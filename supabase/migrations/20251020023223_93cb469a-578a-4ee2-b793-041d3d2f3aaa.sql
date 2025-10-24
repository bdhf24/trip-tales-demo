-- Create reference_images table to store story pages marked as character references
CREATE TABLE public.reference_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(character_id, page_id)
);

-- Add appearance_notes to characters table for user feedback
ALTER TABLE public.characters ADD COLUMN appearance_notes text;

-- Enable RLS on reference_images
ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;

-- Create policies for reference_images
CREATE POLICY "Anyone can view reference images"
  ON public.reference_images FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create reference images"
  ON public.reference_images FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete reference images"
  ON public.reference_images FOR DELETE
  USING (true);