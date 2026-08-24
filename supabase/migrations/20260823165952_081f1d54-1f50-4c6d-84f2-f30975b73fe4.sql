DROP POLICY IF EXISTS conversations_select_party ON public.conversations;

CREATE POLICY conversations_select_party ON public.conversations
FOR SELECT TO authenticated
USING (
  auth.uid() = party_a_user_id
  OR auth.uid() = party_b_user_id
  OR EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = conversations.creator_id AND cp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = conversations.brand_id AND bp.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

DROP POLICY IF EXISTS conversations_update_party ON public.conversations;

CREATE POLICY conversations_update_party ON public.conversations
FOR UPDATE TO authenticated
USING (
  auth.uid() = party_a_user_id
  OR auth.uid() = party_b_user_id
  OR EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = conversations.creator_id AND cp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = conversations.brand_id AND bp.user_id = auth.uid())
)
WITH CHECK (
  auth.uid() = party_a_user_id
  OR auth.uid() = party_b_user_id
  OR EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = conversations.creator_id AND cp.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = conversations.brand_id AND bp.user_id = auth.uid())
);