-- Create image_library table to catalog reusable images
CREATE TABLE IF NOT EXISTS public.image_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  
  -- Searchable metadata extracted from image_prompt_spec
  characters JSONB NOT NULL,
  scene_type TEXT NOT NULL,
  location TEXT,
  landmark TEXT,
  mood TEXT NOT NULL,
  time_of_day TEXT,
  art_style TEXT NOT NULL,
  
  -- Quality and usage tracking
  quality_score FLOAT DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  reuse_count INT DEFAULT 0,
  user_rating INT CHECK (user_rating >= 1 AND user_rating <= 5),
  
  -- Searchable tags
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reused_at TIMESTAMPTZ,
  
  CONSTRAINT image_library_page_id_unique UNIQUE (page_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_image_library_characters ON public.image_library USING GIN (characters);
CREATE INDEX IF NOT EXISTS idx_image_library_location ON public.image_library (location);
CREATE INDEX IF NOT EXISTS idx_image_library_scene_type ON public.image_library (scene_type);
CREATE INDEX IF NOT EXISTS idx_image_library_mood ON public.image_library (mood);
CREATE INDEX IF NOT EXISTS idx_image_library_art_style ON public.image_library (art_style);
CREATE INDEX IF NOT EXISTS idx_image_library_quality ON public.image_library (quality_score DESC, reuse_count DESC);
CREATE INDEX IF NOT EXISTS idx_image_library_tags ON public.image_library USING GIN (tags);

-- Add cost tracking to stories table
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS images_generated INT DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS images_reused INT DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,4) DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS cost_saved NUMERIC(10,4) DEFAULT 0;

-- Enable RLS
ALTER TABLE public.image_library ENABLE ROW LEVEL SECURITY;

-- RLS Policies for image_library
CREATE POLICY "Library images viewable by everyone"
  ON public.image_library FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert library entries"
  ON public.image_library FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update library ratings"
  ON public.image_library FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete library entries"
  ON public.image_library FOR DELETE
  USING (true);