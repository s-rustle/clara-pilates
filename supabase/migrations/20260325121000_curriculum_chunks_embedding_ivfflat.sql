-- Approximate vector index for similarity search (create after embeddings exist; tune lists for row count).
CREATE INDEX IF NOT EXISTS curriculum_chunks_embedding_ivfflat_idx
ON public.curriculum_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
