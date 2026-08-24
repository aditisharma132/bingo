ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS related text[] NOT NULL DEFAULT '{}';
GRANT UPDATE ON public.tags TO service_role;