-- Pitches: mirror the matches.invited / matches.creator_interested split — each side
-- owns its own decision, enforced by the update trigger, not just RLS row ownership.
-- Previously a creator could set their own pitch's status to 'accepted' (RLS allowed it
-- since they own the pitch; the old trigger only field-locked the brand side, never
-- restricted which status *values* either side could set). Now:
--   - creator: 'sent' -> 'withdrawn' only, any campaign state (always safe to withdraw).
--   - brand:   'sent' -> 'accepted'/'declined' only, and only while the campaign is
--     still published — a closed campaign can't be un-stalely accepted.
CREATE OR REPLACE FUNCTION public.enforce_pitch_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_creator boolean;
  campaign_status text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM creator_profiles c WHERE c.id = NEW.creator_id AND c.user_id = auth.uid())
    INTO is_creator;
  SELECT status::text FROM campaigns WHERE id = NEW.campaign_id INTO campaign_status;

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
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'sent' OR NEW.status NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION 'Brands may only accept or decline a pending pitch';
      END IF;
      IF campaign_status IS DISTINCT FROM 'published' THEN
        RAISE EXCEPTION 'This campaign is closed';
      END IF;
    END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'sent' OR NEW.status <> 'withdrawn' THEN
        RAISE EXCEPTION 'Creators may only withdraw a pending pitch';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
