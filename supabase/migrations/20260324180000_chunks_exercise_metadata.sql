-- Exercise metadata per chunk (PDF ingestion by exercise boundary)
ALTER TABLE public.curriculum_chunks
  ADD COLUMN IF NOT EXISTS exercise_name text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS rep_range text,
  ADD COLUMN IF NOT EXISTS sections jsonb;
