-- Row Level Security for user-owned data (defense in depth with anon/authenticated clients).
-- Service role bypasses RLS.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hour_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;

-- profiles: row key is auth user id
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users manage own hour_logs" ON public.hour_logs;
CREATE POLICY "Users manage own hour_logs" ON public.hour_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own session_plans" ON public.session_plans;
CREATE POLICY "Users manage own session_plans" ON public.session_plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own curriculum_chunks" ON public.curriculum_chunks;
CREATE POLICY "Users manage own curriculum_chunks" ON public.curriculum_chunks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own curriculum_uploads" ON public.curriculum_uploads;
CREATE POLICY "Users manage own curriculum_uploads" ON public.curriculum_uploads
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own quiz_sessions" ON public.quiz_sessions;
CREATE POLICY "Users manage own quiz_sessions" ON public.quiz_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access quiz_questions via own sessions" ON public.quiz_questions;
CREATE POLICY "Users access quiz_questions via own sessions" ON public.quiz_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions s
      WHERE s.id = quiz_questions.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_sessions s
      WHERE s.id = quiz_questions.session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own readiness_snapshots" ON public.readiness_snapshots;
CREATE POLICY "Users manage own readiness_snapshots" ON public.readiness_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
