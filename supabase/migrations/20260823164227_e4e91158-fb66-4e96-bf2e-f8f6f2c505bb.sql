
CREATE OR REPLACE FUNCTION public.is_shared_media(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.creator_profiles p WHERE p.avatar_url = _name OR p.cover_url = _name)
      OR EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.logo_url = _name OR b.cover_url = _name)
      OR EXISTS (SELECT 1 FROM public.brand_posts bp WHERE bp.image_url = _name);
$$;

REVOKE ALL ON FUNCTION public.is_shared_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shared_media(text) TO authenticated, service_role;

DROP POLICY IF EXISTS media_read_authenticated ON storage.objects;

CREATE POLICY media_read_own_or_shared ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.is_shared_media(name)
  )
);
