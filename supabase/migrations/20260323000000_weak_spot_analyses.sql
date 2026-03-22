-- Weak spot analyses (Task 8.1)
CREATE TABLE IF NOT EXISTS public.weak_spot_analyses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  top_three jsonb NOT NULL DEFAULT '[]'::jsonb,
  sessions_analyzed integer NOT NULL DEFAULT 0,
  insufficient_data boolean NOT NULL DEFAULT false,
  sessions_needed integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weak_spot_analyses_user_created_at_idx
  ON public.weak_spot_analyses (user_id, created_at DESC);

ALTER TABLE public.weak_spot_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own weak spot analyses"
  ON public.weak_spot_analyses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
