-- Optional free-text client context (special populations, injuries, etc.)
ALTER TABLE public.session_plans
ADD COLUMN IF NOT EXISTS client_notes text;
