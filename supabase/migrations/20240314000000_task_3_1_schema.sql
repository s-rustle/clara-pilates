-- Task 3.1: Add Google OAuth token columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text;

-- Temporary function for schema verification (remove after Task 3.1)
CREATE OR REPLACE FUNCTION public.check_curriculum_schema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  col_result jsonb;
  idx_result jsonb;
BEGIN
  SELECT jsonb_build_object('column_name', column_name, 'udt_name', udt_name)
  INTO col_result
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'curriculum_chunks' AND column_name = 'embedding';

  SELECT COALESCE(jsonb_agg(indexname), '[]'::jsonb)
  INTO idx_result
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'curriculum_chunks';

  RETURN jsonb_build_object('embedding_column', col_result, 'indexes', idx_result);
END;
$$;
