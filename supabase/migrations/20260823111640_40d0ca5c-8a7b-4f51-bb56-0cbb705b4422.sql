-- profile social fields
ALTER TABLE public.creator_profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.brand_profiles ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE public.deals ALTER COLUMN campaign_id DROP NOT NULL;

-- ============ conversations ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair
  ON public.conversations (brand_id, creator_id, COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.is_conversation_party(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.creator_profiles cp ON cp.id = c.creator_id
    JOIN public.brand_profiles bp ON bp.id = c.brand_id
    WHERE c.id = _conversation_id AND (cp.user_id = _user_id OR bp.user_id = _user_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_conversation_party(uuid, uuid) FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_select_party ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_party(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY conversations_insert_party ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid())
  );
CREATE POLICY conversations_update_party ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_party(id, auth.uid()))
  WITH CHECK (public.is_conversation_party(id, auth.uid()));
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ offers ============
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role public.app_role NOT NULL,
  compensation_type public.compensation_type NOT NULL DEFAULT 'paid',
  amount_inr integer,
  deliverables text[] NOT NULL DEFAULT '{}',
  timeline text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  parent_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY offers_select_party ON public.offers FOR SELECT TO authenticated
  USING (public.is_conversation_party(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY offers_insert_party ON public.offers FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_conversation_party(conversation_id, auth.uid()));
CREATE POLICY offers_update_party ON public.offers FOR UPDATE TO authenticated
  USING (public.is_conversation_party(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_party(conversation_id, auth.uid()));
CREATE TRIGGER offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ conversation messages ============
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text',
  body text,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx ON public.conversation_messages (conversation_id, created_at);
GRANT SELECT, INSERT ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_messages_select_party ON public.conversation_messages FOR SELECT TO authenticated
  USING (public.is_conversation_party(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY conv_messages_insert_party ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_party(conversation_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_reads TO authenticated;
GRANT ALL ON public.conversation_reads TO service_role;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_reads_own ON public.conversation_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ deals: allow party writes ============
CREATE POLICY deals_insert_party ON public.deals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND cp.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid())
  );
CREATE POLICY deals_update_party ON public.deals FOR UPDATE TO authenticated
  USING (public.is_deal_party(id, auth.uid()))
  WITH CHECK (public.is_deal_party(id, auth.uid()));

-- ============ tags ============
CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'label',
  is_preset boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon;
GRANT SELECT, INSERT ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_read_all ON public.tags FOR SELECT USING (true);
CREATE POLICY tags_insert_authenticated ON public.tags FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS entity_tags_entity_idx ON public.entity_tags (entity_type, entity_id);
GRANT SELECT ON public.entity_tags TO anon;
GRANT SELECT, INSERT, DELETE ON public.entity_tags TO authenticated;
GRANT ALL ON public.entity_tags TO service_role;
ALTER TABLE public.entity_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_tags_read_all ON public.entity_tags FOR SELECT USING (true);
CREATE POLICY entity_tags_write_own ON public.entity_tags FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY entity_tags_delete_own ON public.entity_tags FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============ brand posts + subscriptions ============
CREATE TABLE IF NOT EXISTS public.brand_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'update',
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  cta_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_posts_brand_idx ON public.brand_posts (brand_id, created_at DESC);
GRANT SELECT ON public.brand_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_posts TO authenticated;
GRANT ALL ON public.brand_posts TO service_role;
ALTER TABLE public.brand_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_posts_read_published ON public.brand_posts FOR SELECT
  USING (is_published = true);
CREATE POLICY brand_posts_manage_own ON public.brand_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid()));
CREATE TRIGGER brand_posts_updated_at BEFORE UPDATE ON public.brand_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.brand_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.brand_subscriptions TO authenticated;
GRANT ALL ON public.brand_subscriptions TO service_role;
ALTER TABLE public.brand_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_subs_select ON public.brand_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.brand_profiles bp WHERE bp.id = brand_id AND bp.user_id = auth.uid()));
CREATE POLICY brand_subs_insert_own ON public.brand_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY brand_subs_delete_own ON public.brand_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ payments visibility ============
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS funded_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'manual';