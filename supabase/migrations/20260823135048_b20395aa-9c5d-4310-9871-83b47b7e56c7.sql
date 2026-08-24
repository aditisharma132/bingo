CREATE TABLE public.ai_profile_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('creator','brand')),
  source text NOT NULL DEFAULT 'instagram',
  field text NOT NULL,
  label text NOT NULL,
  current_value jsonb,
  suggested_value jsonb NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_profile_suggestions TO authenticated;
GRANT ALL ON public.ai_profile_suggestions TO service_role;

ALTER TABLE public.ai_profile_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile suggestions"
ON public.ai_profile_suggestions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER ai_profile_suggestions_updated_at
BEFORE UPDATE ON public.ai_profile_suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ai_profile_suggestions_user_status_idx ON public.ai_profile_suggestions (user_id, status);