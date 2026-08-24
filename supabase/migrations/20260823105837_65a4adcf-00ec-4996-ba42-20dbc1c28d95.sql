-- 1. Brand contacts split
CREATE TABLE public.brand_contacts (
  brand_id uuid PRIMARY KEY REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  contact_person text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_contacts TO authenticated;
GRANT ALL ON public.brand_contacts TO service_role;
ALTER TABLE public.brand_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own brand contacts read" ON public.brand_contacts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_contacts.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own brand contacts insert" ON public.brand_contacts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_contacts.brand_id AND b.user_id = auth.uid()));
CREATE POLICY "own brand contacts update" ON public.brand_contacts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_contacts.brand_id AND b.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_contacts.brand_id AND b.user_id = auth.uid()));

CREATE TRIGGER brand_contacts_updated_at BEFORE UPDATE ON public.brand_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.brand_contacts (brand_id, contact_person, contact_email, contact_phone)
SELECT id, contact_person, contact_email, contact_phone FROM public.brand_profiles
WHERE contact_person IS NOT NULL OR contact_email IS NOT NULL OR contact_phone IS NOT NULL;

ALTER TABLE public.brand_profiles
  DROP COLUMN contact_person,
  DROP COLUMN contact_email,
  DROP COLUMN contact_phone;

-- 2. profiles: owner/admin only
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3. brand_dna: owner/admin only
DROP POLICY IF EXISTS "brand dna readable" ON public.brand_dna;
CREATE POLICY "brand dna readable" ON public.brand_dna FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_dna.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));

-- 4. creator_dna: public creators, owner, admin
DROP POLICY IF EXISTS "creator dna readable" ON public.creator_dna;
CREATE POLICY "creator dna readable" ON public.creator_dna FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.creator_profiles c
               WHERE c.id = creator_dna.creator_id
                 AND (c.is_public OR c.user_id = auth.uid()))
       OR public.has_role(auth.uid(), 'admin'));

-- 5. brand_updates: published only, unless owner/admin
ALTER TABLE public.brand_updates ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
DROP POLICY IF EXISTS "brand updates readable" ON public.brand_updates;
CREATE POLICY "brand updates readable" ON public.brand_updates FOR SELECT TO authenticated
USING (is_published
       OR EXISTS (SELECT 1 FROM public.brand_profiles b WHERE b.id = brand_updates.brand_id AND b.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));

-- 6. social_accounts: never expose token column to client roles
REVOKE SELECT ON public.social_accounts FROM authenticated;
GRANT SELECT (id, user_id, platform, handle, external_id, followers, engagement_rate,
              profile_data, connected_via_oauth, token_expires_at, last_synced_at,
              created_at, updated_at) ON public.social_accounts TO authenticated;
REVOKE UPDATE ON public.social_accounts FROM authenticated;
GRANT UPDATE (platform, handle, external_id, followers, engagement_rate, profile_data,
              connected_via_oauth, last_synced_at, updated_at) ON public.social_accounts TO authenticated;

-- 7. SECURITY DEFINER function execute privileges
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_deal_party(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_deal_party(uuid, uuid) TO authenticated, service_role;