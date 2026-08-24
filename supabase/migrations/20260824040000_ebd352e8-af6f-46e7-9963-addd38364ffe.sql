-- Invites: brand may withdraw an invite (invited true -> false) only while it's still
-- pending — locked the instant the creator has accepted (creator_interested = true),
-- mirroring the pitch-side rule (creator can withdraw a pending pitch, but a brand's
-- acceptance of it is likewise final).
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

  IF NEW.invited IS DISTINCT FROM OLD.invited THEN
    IF NOT is_brand THEN
      RAISE EXCEPTION 'Only the campaign brand can change invitation status';
    END IF;
    IF OLD.creator_interested IS TRUE THEN
      RAISE EXCEPTION 'Cannot change the invitation after the creator has accepted';
    END IF;
  END IF;

  IF NEW.creator_interested IS DISTINCT FROM OLD.creator_interested AND NOT is_creator THEN
    RAISE EXCEPTION 'Only the creator can change interest status';
  END IF;

  RETURN NEW;
END;
$$;
