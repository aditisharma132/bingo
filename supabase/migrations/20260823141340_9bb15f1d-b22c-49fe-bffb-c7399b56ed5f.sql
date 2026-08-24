
ALTER TABLE public.conversations
  ALTER COLUMN brand_id DROP NOT NULL,
  ALTER COLUMN creator_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS party_a_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS party_b_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';

UPDATE public.conversations c
SET party_a_user_id = bp.user_id, party_b_user_id = cp.user_id
FROM public.brand_profiles bp, public.creator_profiles cp
WHERE bp.id = c.brand_id AND cp.id = c.creator_id AND c.party_a_user_id IS NULL;

DROP INDEX IF EXISTS public.conversations_unique_pair;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_parties ON public.conversations (
  LEAST(party_a_user_id, party_b_user_id),
  GREATEST(party_a_user_id, party_b_user_id),
  COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE party_a_user_id IS NOT NULL AND party_b_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_conversation_party(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    LEFT JOIN public.creator_profiles cp ON cp.id = c.creator_id
    LEFT JOIN public.brand_profiles bp ON bp.id = c.brand_id
    WHERE c.id = _conversation_id
      AND (_user_id = c.party_a_user_id OR _user_id = c.party_b_user_id
           OR cp.user_id = _user_id OR bp.user_id = _user_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_conversation_party(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS conversations_insert_party ON public.conversations;
CREATE POLICY conversations_insert_party ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = party_a_user_id OR auth.uid() = party_b_user_id
    OR EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.messaging_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_creator_requests boolean NOT NULL DEFAULT true,
  allow_brand_requests boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messaging_preferences TO authenticated;
GRANT ALL ON public.messaging_preferences TO service_role;
ALTER TABLE public.messaging_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messaging_prefs_own ON public.messaging_preferences;
CREATE POLICY messaging_prefs_own ON public.messaging_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_user_id, blocked_user_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_blocks_own ON public.user_blocks;
CREATE POLICY user_blocks_own ON public.user_blocks FOR ALL TO authenticated
  USING (blocker_user_id = auth.uid()) WITH CHECK (blocker_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_message_user(_target uuid, _sender uuid, _sender_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_user_id = _target AND b.blocked_user_id = _sender)
         OR (b.blocker_user_id = _sender AND b.blocked_user_id = _target)
    )
    AND COALESCE((
      SELECT CASE WHEN _sender_role = 'brand' THEN p.allow_brand_requests ELSE p.allow_creator_requests END
      FROM public.messaging_preferences p WHERE p.user_id = _target
    ), true);
$$;
REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid, text) FROM anon;

ALTER TABLE public.support_tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS contact_email text;
