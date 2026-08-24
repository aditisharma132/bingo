ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS creator_kind text NOT NULL DEFAULT 'content_creator';

ALTER TABLE public.creator_profiles
  DROP CONSTRAINT IF EXISTS creator_profiles_creator_kind_check;

ALTER TABLE public.creator_profiles
  ADD CONSTRAINT creator_profiles_creator_kind_check
  CHECK (creator_kind IN ('content_creator', 'ugc_creator', 'other'));