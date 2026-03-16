-- Task 4.1: RPC for pgvector similarity search on curriculum_chunks
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
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.content,
    c.content_type,
    c.folder_name,
    c.file_name,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM curriculum_chunks c
  WHERE c.user_id = target_user_id
    AND (folder_filter IS NULL OR c.folder_name = folder_filter)
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
