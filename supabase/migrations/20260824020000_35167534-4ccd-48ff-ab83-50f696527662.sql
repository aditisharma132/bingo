-- Per-user, per-action rate limiting for AI-triggered endpoints (DNA/brief generation,
-- Instagram analysis, tag mapping, feedback classification) — previously unbounded, a real
-- cost/abuse risk since every call is a billed Gemini request.
CREATE TABLE public.rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, action)
);
GRANT SELECT, INSERT, UPDATE ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rate limit rows" ON public.rate_limits FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
