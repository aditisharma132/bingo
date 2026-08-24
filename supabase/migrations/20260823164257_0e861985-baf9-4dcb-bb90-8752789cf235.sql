
DROP POLICY IF EXISTS media_read_own_or_shared ON storage.objects;
DROP FUNCTION IF EXISTS public.is_shared_media(text);

CREATE POLICY media_read_own_or_shared ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.creator_profiles p WHERE p.avatar_url = storage.objects.name OR p.cover_url = storage.objects.name)
    OR EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.logo_url = storage.objects.name OR b.cover_url = storage.objects.name)
    OR EXISTS (SELECT 1 FROM public.brand_posts bp WHERE bp.image_url = storage.objects.name)
  )
);
