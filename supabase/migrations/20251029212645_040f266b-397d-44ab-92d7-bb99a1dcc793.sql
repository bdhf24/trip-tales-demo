-- ============================================
-- SECURITY FIX: Implement Proper Access Control
-- ============================================

-- Step 1: Drop all insecure "Anyone can" policies
DROP POLICY IF EXISTS "Anyone can create kids" ON public.kids;
DROP POLICY IF EXISTS "Anyone can delete kids" ON public.kids;
DROP POLICY IF EXISTS "Anyone can update kids" ON public.kids;
DROP POLICY IF EXISTS "Kids are viewable by everyone" ON public.kids;

DROP POLICY IF EXISTS "Anyone can create stories" ON public.stories;
DROP POLICY IF EXISTS "Anyone can delete stories" ON public.stories;
DROP POLICY IF EXISTS "Anyone can update stories" ON public.stories;
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;

DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

DROP POLICY IF EXISTS "Anyone can create pages" ON public.pages;
DROP POLICY IF EXISTS "Anyone can delete pages" ON public.pages;
DROP POLICY IF EXISTS "Anyone can update pages" ON public.pages;
DROP POLICY IF EXISTS "Pages are viewable by everyone" ON public.pages;

DROP POLICY IF EXISTS "Anyone can create kid photos" ON public.kid_photos;
DROP POLICY IF EXISTS "Anyone can delete kid photos" ON public.kid_photos;
DROP POLICY IF EXISTS "Kid photos are viewable by everyone" ON public.kid_photos;

DROP POLICY IF EXISTS "Anyone can create reference images" ON public.reference_images;
DROP POLICY IF EXISTS "Anyone can delete reference images" ON public.reference_images;
DROP POLICY IF EXISTS "Anyone can view reference images" ON public.reference_images;

DROP POLICY IF EXISTS "Anyone can create PDF exports" ON public.pdf_exports;
DROP POLICY IF EXISTS "Anyone can delete PDF exports" ON public.pdf_exports;
DROP POLICY IF EXISTS "Anyone can update PDF exports" ON public.pdf_exports;
DROP POLICY IF EXISTS "PDF exports are viewable by everyone" ON public.pdf_exports;

-- Step 2: Create secure user-scoped policies

-- Users table policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Kids table policies
CREATE POLICY "Users can view own kids"
  ON public.kids FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own kids"
  ON public.kids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own kids"
  ON public.kids FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own kids"
  ON public.kids FOR DELETE
  USING (auth.uid() = user_id);

-- Stories table policies
CREATE POLICY "Users can view own stories"
  ON public.stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON public.stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = user_id);

-- Pages table policies (via story ownership)
CREATE POLICY "Users can view pages of own stories"
  ON public.pages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pages.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert pages for own stories"
  ON public.pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pages.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update pages of own stories"
  ON public.pages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pages.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete pages of own stories"
  ON public.pages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pages.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- Kid photos policies (via kid ownership)
CREATE POLICY "Users can view photos of own kids"
  ON public.kid_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = kid_photos.kid_id
      AND kids.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert photos for own kids"
  ON public.kid_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = kid_photos.kid_id
      AND kids.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete photos of own kids"
  ON public.kid_photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = kid_photos.kid_id
      AND kids.user_id = auth.uid()
    )
  );

-- Reference images policies (via kid ownership)
CREATE POLICY "Users can view reference images of own kids"
  ON public.reference_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = reference_images.kid_id
      AND kids.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reference images for own kids"
  ON public.reference_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = reference_images.kid_id
      AND kids.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reference images of own kids"
  ON public.reference_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kids
      WHERE kids.id = reference_images.kid_id
      AND kids.user_id = auth.uid()
    )
  );

-- PDF exports policies (via story ownership)
CREATE POLICY "Users can view own PDF exports"
  ON public.pdf_exports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pdf_exports.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert PDF exports for own stories"
  ON public.pdf_exports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pdf_exports.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own PDF exports"
  ON public.pdf_exports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = pdf_exports.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- Step 3: Make storage buckets private
UPDATE storage.buckets 
SET public = false 
WHERE name IN ('kid-photos', 'story-images', 'story-pdfs');

-- Step 4: Add RLS policies for storage
CREATE POLICY "Users can view own kid photos in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'kid-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own kid photos in storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'kid-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own kid photos in storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'kid-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own story images in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'story-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own story images in storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own story PDFs in storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'story-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload own story PDFs in storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );