-- 1. entity_tags: authenticated-only reads
DROP POLICY IF EXISTS entity_tags_read_all ON public.entity_tags;
CREATE POLICY entity_tags_read_authenticated ON public.entity_tags
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.entity_tags FROM anon;

-- 2. media bucket: authenticated-only reads
DROP POLICY IF EXISTS media_read_all ON storage.objects;
CREATE POLICY media_read_authenticated ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'media');

-- 3. matches: lock scoring columns
CREATE OR REPLACE FUNCTION public.enforce_match_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_creator boolean;
  is_brand boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM creator_profiles c WHERE c.id = NEW.creator_id AND c.user_id = auth.uid())
    INTO is_creator;
  SELECT EXISTS (
    SELECT 1 FROM campaigns cm JOIN brand_profiles b ON b.id = cm.brand_id
    WHERE cm.id = NEW.campaign_id AND b.user_id = auth.uid()
  ) INTO is_brand;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
     OR NEW.score IS DISTINCT FROM OLD.score
     OR NEW.fit IS DISTINCT FROM OLD.fit
     OR NEW.signals IS DISTINCT FROM OLD.signals
     OR NEW.reasons IS DISTINCT FROM OLD.reasons
     OR NEW.gaps IS DISTINCT FROM OLD.gaps
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Match scoring fields cannot be modified';
  END IF;

  IF NEW.invited IS DISTINCT FROM OLD.invited AND NOT is_brand THEN
    RAISE EXCEPTION 'Only the campaign brand can change invitation status';
  END IF;

  IF NEW.creator_interested IS DISTINCT FROM OLD.creator_interested AND NOT is_creator THEN
    RAISE EXCEPTION 'Only the creator can change interest status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_match_update_scope ON public.matches;
CREATE TRIGGER enforce_match_update_scope
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_update_scope();

-- 4. pitches: brands may only change status
CREATE OR REPLACE FUNCTION public.enforce_pitch_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_creator boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM creator_profiles c WHERE c.id = NEW.creator_id AND c.user_id = auth.uid())
    INTO is_creator;

  IF NOT is_creator THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
       OR NEW.creator_id IS DISTINCT FROM OLD.creator_id
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.portfolio_url IS DISTINCT FROM OLD.portfolio_url
       OR NEW.proposed_price_inr IS DISTINCT FROM OLD.proposed_price_inr
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the pitch status can be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_pitch_update_scope ON public.pitches;
CREATE TRIGGER enforce_pitch_update_scope
  BEFORE UPDATE ON public.pitches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pitch_update_scope();