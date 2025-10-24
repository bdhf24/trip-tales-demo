-- Create users table (simple version, can link to auth.users later)
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Public access for now (add proper auth later)
CREATE POLICY "Users are viewable by everyone" 
ON public.users FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.users FOR INSERT WITH CHECK (true);

-- Create kids table
CREATE TABLE public.kids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  descriptor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kids are viewable by everyone" 
ON public.kids FOR SELECT USING (true);

CREATE POLICY "Anyone can create kids" 
ON public.kids FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update kids" 
ON public.kids FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete kids" 
ON public.kids FOR DELETE USING (true);

-- Create kid_photos table
CREATE TABLE public.kid_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kid_id UUID NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.character_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Character photos are viewable by everyone" 
ON public.character_photos FOR SELECT USING (true);

CREATE POLICY "Anyone can create character photos" 
ON public.character_photos FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete character photos" 
ON public.character_photos FOR DELETE USING (true);

-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  month TEXT NOT NULL,
  length INTEGER NOT NULL,
  tone TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  characters_json JSONB NOT NULL,
  art_style TEXT NOT NULL,
  outline_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stories are viewable by everyone" 
ON public.stories FOR SELECT USING (true);

CREATE POLICY "Anyone can create stories" 
ON public.stories FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update stories" 
ON public.stories FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete stories" 
ON public.stories FOR DELETE USING (true);

-- Create pages table
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  heading TEXT NOT NULL,
  text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  image_prompt_spec JSONB NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, page_number)
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pages are viewable by everyone" 
ON public.pages FOR SELECT USING (true);

CREATE POLICY "Anyone can create pages" 
ON public.pages FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update pages" 
ON public.pages FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete pages" 
ON public.pages FOR DELETE USING (true);

-- Create storage bucket for character photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('character-photos', 'character-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for character photos
CREATE POLICY "Character photos are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'character-photos');

CREATE POLICY "Anyone can upload character photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'character-photos');

CREATE POLICY "Anyone can update character photos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'character-photos');

CREATE POLICY "Anyone can delete character photos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'character-photos');

-- Trigger for updating updated_at on characters
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
BEFORE UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();