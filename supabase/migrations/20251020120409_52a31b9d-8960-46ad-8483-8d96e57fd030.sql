-- Create pdf_exports table for caching
CREATE TABLE public.pdf_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL,
  pdf_url TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT pdf_exports_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.pdf_exports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "PDF exports are viewable by everyone"
  ON public.pdf_exports
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create PDF exports"
  ON public.pdf_exports
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update PDF exports"
  ON public.pdf_exports
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete PDF exports"
  ON public.pdf_exports
  FOR DELETE
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pdf_exports_updated_at
  BEFORE UPDATE ON public.pdf_exports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-pdfs', 'story-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PDFs
CREATE POLICY "PDF files are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'story-pdfs');

CREATE POLICY "Anyone can upload PDFs"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'story-pdfs');

CREATE POLICY "Anyone can update PDFs"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'story-pdfs');

CREATE POLICY "Anyone can delete PDFs"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'story-pdfs');