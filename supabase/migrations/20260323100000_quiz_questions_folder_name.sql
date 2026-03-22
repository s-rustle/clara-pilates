-- Track curriculum folder per quiz question (readiness / curriculum coverage)
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS folder_name text;
