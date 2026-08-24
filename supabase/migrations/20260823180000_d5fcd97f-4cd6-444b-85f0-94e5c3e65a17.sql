-- AI scoring engine: primary category classification + brand preference learning loop.

-- 1. Single, confident, brand-facing primary category per creator (categories[] stays
--    as-is for matching.ts's overlap scoring — this is a separate, one-value field).
ALTER TABLE public.creator_profiles
  ADD COLUMN primary_category text,
  ADD COLUMN category_confidence numeric(3,2),
  ADD COLUMN category_source text CHECK (category_source IN ('social','portfolio','manual'));

CREATE INDEX creator_profiles_primary_category_idx ON public.creator_profiles (primary_category);

-- 2. Learned per-brand weights over a creator's own tags (categories + creator_types).
--    Cold start: no row -> pref_adjustment is 0 -> ranking is pure content fit.
CREATE TABLE public.match_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL UNIQUE REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  category_weights jsonb NOT NULL DEFAULT '{}',
  tone_weights jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.match_weights TO authenticated;
GRANT ALL ON public.match_weights TO service_role;
ALTER TABLE public.match_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own match weights read" ON public.match_weights FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_weights.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own match weights write" ON public.match_weights FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_weights.brand_id AND b.user_id = auth.uid()));
CREATE POLICY "own match weights update" ON public.match_weights FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_weights.brand_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_weights.brand_id AND b.user_id = auth.uid()));

CREATE TRIGGER match_weights_updated_at BEFORE UPDATE ON public.match_weights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Raw accept/reject events — a rejection reason is a clean signal, acceptance is noisy
--    (price, availability), so the two are weighted asymmetrically at write time (app layer).
CREATE TABLE public.match_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('accepted','rejected')),
  reason_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.match_feedback TO authenticated;
GRANT ALL ON public.match_feedback TO service_role;
ALTER TABLE public.match_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own match feedback read" ON public.match_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_feedback.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own match feedback insert" ON public.match_feedback FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = match_feedback.brand_id AND b.user_id = auth.uid()));

CREATE INDEX match_feedback_brand_idx ON public.match_feedback (brand_id, created_at DESC);

-- 4. Weight history — lets the learning loop actually be shown (before/after a rejection),
--    not just asserted.
CREATE TABLE public.weight_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.match_feedback(id) ON DELETE SET NULL,
  weights_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.weight_history TO authenticated;
GRANT ALL ON public.weight_history TO service_role;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own weight history read" ON public.weight_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = weight_history.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own weight history insert" ON public.weight_history FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = weight_history.brand_id AND b.user_id = auth.uid()));

-- 5. Atomic write: feedback row + weight upsert + history row in one statement/transaction.
--    Plain SECURITY INVOKER function (the default) so it runs as the calling authenticated
--    user and is still governed by the RLS policies above — no hand-rolled auth check needed.
CREATE OR REPLACE FUNCTION public.apply_match_feedback(
  p_match_id uuid,
  p_brand_id uuid,
  p_creator_id uuid,
  p_action text,
  p_reason_text text,
  p_category_weights jsonb,
  p_tone_weights jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_feedback_id uuid;
BEGIN
  INSERT INTO public.match_feedback (match_id, brand_id, creator_id, action, reason_text)
  VALUES (p_match_id, p_brand_id, p_creator_id, p_action, p_reason_text)
  RETURNING id INTO v_feedback_id;

  INSERT INTO public.match_weights (brand_id, category_weights, tone_weights)
  VALUES (p_brand_id, p_category_weights, p_tone_weights)
  ON CONFLICT (brand_id) DO UPDATE
    SET category_weights = excluded.category_weights,
        tone_weights = excluded.tone_weights,
        updated_at = now();

  INSERT INTO public.weight_history (brand_id, event_id, weights_snapshot)
  VALUES (p_brand_id, v_feedback_id, jsonb_build_object(
    'category_weights', p_category_weights, 'tone_weights', p_tone_weights
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_match_feedback(uuid, uuid, uuid, text, text, jsonb, jsonb) TO authenticated, service_role;
