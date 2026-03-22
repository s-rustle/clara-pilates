/**
 * RAG query utility - searches pgvector for relevant curriculum chunks.
 * Mock this module in tests to avoid Supabase/embedding calls.
 */
import OpenAI from "openai";
import { createServiceClient } from "@/lib/supabase/server";
import type { RagChunk, RAGResult } from "@/types";

const EMBEDDING_MODEL = "text-embedding-ada-002";
const SIMILARITY_THRESHOLD = 0.5;
const MATCH_COUNT = 5;

/** Optional tuning per call site (e.g. quiz needs more context across mixed folders). */
export type QueryRagOptions = {
  matchCount?: number;
  minSimilarity?: number;
};

export type QueryRagContextOptions = QueryRagOptions & {
  folderFilter?: string | null;
};

function chunkDedupeKey(c: RagChunk): string {
  return `${c.folder_name}\0${c.file_name}\0${c.content}`;
}

/**
 * Primary semantic search plus additional queries (purpose, precautions, progressions, etc.).
 * Merges chunks deduplicated by folder + file + content; returns up to 10 by highest similarity.
 */
export async function queryRAGWithContext(
  primaryQuery: string,
  userId: string,
  contextQueries: string[],
  options?: QueryRagContextOptions
): Promise<RAGResult> {
  const folderFilter = options?.folderFilter ?? null;
  const minSimilarity = options?.minSimilarity ?? SIMILARITY_THRESHOLD;
  const seen = new Set<string>();
  const merged: RagChunk[] = [];

  const addChunks = (chunks: RagChunk[]) => {
    for (const c of chunks) {
      const key = chunkDedupeKey(c);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
  };

  const primaryRes = await queryRAG(primaryQuery, userId, folderFilter, {
    matchCount: 6,
    minSimilarity,
  });
  addChunks(primaryRes.chunks);

  for (const cq of contextQueries) {
    const r = await queryRAG(cq, userId, folderFilter, {
      matchCount: 4,
      minSimilarity,
    });
    addChunks(r.chunks);
  }

  merged.sort((a, b) => b.similarity - a.similarity);
  const top = merged.slice(0, 10);

  if (top.length === 0) {
    return { chunks: [], notFound: true };
  }
  return { chunks: top, notFound: false };
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — cannot generate embeddings");
  }
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("Embedding returned empty");
  }
  return embedding;
}

export type { RagChunk, RAGResult };

export async function queryRAG(
  userQuery: string,
  userId: string,
  folderFilter?: string | null,
  options?: QueryRagOptions
): Promise<RAGResult> {
  try {
    const matchCount = options?.matchCount ?? MATCH_COUNT;
    const minSimilarity = options?.minSimilarity ?? SIMILARITY_THRESHOLD;

    const queryEmbedding = await generateEmbedding(userQuery);
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc("match_curriculum_chunks", {
      query_embedding: queryEmbedding,
      target_user_id: userId,
      folder_filter: folderFilter ?? null,
      match_count: matchCount,
    });

    if (error) {
      console.error("queryRAG: Supabase RPC failed:", error);
      return { chunks: [], notFound: true };
    }

    const typedChunks = (data ?? []) as Array<{
      content: string;
      content_type: string | null;
      folder_name: string;
      file_name: string;
      chunk_index: number;
      similarity: number;
      drive_file_id: string | null;
      source_mime_type: string | null;
    }>;

    const chunks: RagChunk[] = typedChunks
      .filter((c) => c.similarity >= minSimilarity)
      .map((c) => ({
        content: c.content,
        content_type:
          c.content_type === "diagram" || c.content_type === "handwritten"
            ? c.content_type
            : "text",
        folder_name: c.folder_name,
        file_name: c.file_name,
        similarity: c.similarity,
        drive_file_id: c.drive_file_id,
        source_mime_type: c.source_mime_type,
      }));

    if (chunks.length === 0) {
      return { chunks: [], notFound: true };
    }

    return { chunks, notFound: false };
  } catch (err) {
    console.error("queryRAG error:", err);
    return { chunks: [], notFound: true };
  }
}
