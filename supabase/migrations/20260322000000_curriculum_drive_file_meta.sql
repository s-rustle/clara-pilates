-- Link chunks to Google Drive source files for image previews in Study
ALTER TABLE public.curriculum_chunks
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS source_mime_type text;

CREATE INDEX IF NOT EXISTS curriculum_chunks_user_drive_file_idx
  ON public.curriculum_chunks (user_id, drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- Extend vector search to return Drive metadata for UI previews
CREATE OR REPLACE FUNCTION public.match_curriculum_chunks(
  query_embedding vector(1536),
  target_user_id uuid,
  folder_filter text DEFAULT NULL,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  content text,
  content_type text,
  folder_name text,
  file_name text,
  chunk_index int,
  similarity float,
  drive_file_id text,
  source_mime_type text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.content,
    c.content_type,
    c.folder_name,
    c.file_name,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.drive_file_id,
    c.source_mime_type
  FROM curriculum_chunks c
  WHERE c.user_id = target_user_id
    AND (folder_filter IS NULL OR c.folder_name = folder_filter)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
