
-- 1. Deals: block direct client updates (all deal transitions run through server logic)
DROP POLICY IF EXISTS "deals_update_party" ON public.deals;
REVOKE UPDATE ON public.deals FROM authenticated;

-- 2. Offers: only status may change
CREATE OR REPLACE FUNCTION public.enforce_offer_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.author_role IS DISTINCT FROM OLD.author_role
     OR NEW.compensation_type IS DISTINCT FROM OLD.compensation_type
     OR NEW.amount_inr IS DISTINCT FROM OLD.amount_inr
     OR NEW.deliverables IS DISTINCT FROM OLD.deliverables
     OR NEW.timeline IS DISTINCT FROM OLD.timeline
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.parent_offer_id IS DISTINCT FROM OLD.parent_offer_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the offer status can be changed';
  END IF;
  IF NEW.status NOT IN ('pending','accepted','declined','withdrawn','expired') THEN
    RAISE EXCEPTION 'Invalid offer status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_offer_update_scope ON public.offers;
CREATE TRIGGER enforce_offer_update_scope
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_offer_update_scope();

-- 3. Matches: make WITH CHECK match the party rule (field locks already enforced by trigger)
DROP POLICY IF EXISTS "parties update matches" ON public.matches;
CREATE POLICY "parties update matches" ON public.matches
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM creator_profiles c WHERE c.id = matches.creator_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns cm JOIN brand_profiles b ON b.id = cm.brand_id
             WHERE cm.id = matches.campaign_id AND b.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM creator_profiles c WHERE c.id = matches.creator_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM campaigns cm JOIN brand_profiles b ON b.id = cm.brand_id
             WHERE cm.id = matches.campaign_id AND b.user_id = auth.uid())
);

-- 4. entity_tags: scope reads to owner or publicly visible entities
DROP POLICY IF EXISTS "entity_tags_read_authenticated" ON public.entity_tags;
CREATE POLICY "entity_tags_read_scoped" ON public.entity_tags
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (entity_type = 'creator' AND EXISTS (
        SELECT 1 FROM creator_profiles c
        WHERE c.id = entity_tags.entity_id AND (c.is_public OR c.user_id = auth.uid())))
  OR (entity_type = 'brand' AND EXISTS (
        SELECT 1 FROM brand_profiles b
        WHERE b.id = entity_tags.entity_id AND (b.is_public OR b.user_id = auth.uid())))
  OR (entity_type = 'campaign' AND EXISTS (
        SELECT 1 FROM campaigns cm JOIN brand_profiles b2 ON b2.id = cm.brand_id
        WHERE cm.id = entity_tags.entity_id AND (cm.status = 'published' OR b2.user_id = auth.uid())))
  OR has_role(auth.uid(), 'admin'::app_role)
);
