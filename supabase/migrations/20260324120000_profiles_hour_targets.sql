ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS exam_target_date date,
ADD COLUMN IF NOT EXISTS hour_targets jsonb;
