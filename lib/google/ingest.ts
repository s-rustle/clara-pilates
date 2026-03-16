import OpenAI from "openai";
import { anthropic } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";
import type { ExtractedContent, ContentChunk } from "@/types";

const EMBEDDING_MODEL = "text-embedding-ada-002";
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a 1536-dimensional embedding via OpenAI text-embedding-ada-002.
 * Compatible with pgvector vector(1536).
 */
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
  if (!embedding || embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding returned unexpected length: expected ${EMBEDDING_DIM}, got ${embedding?.length ?? 0}`
    );
  }
  return embedding;
}

const VISION_MODEL = "claude-sonnet-4-20250514";

const EXTRACTION_SYSTEM_PROMPT = `You are extracting content from a photographed page of a Pilates curriculum manual.

Extract all printed text faithfully and completely.
Describe any anatomical diagrams or movement illustrations in detail — include muscle names, body positions, movement directions.
Extract handwritten annotations separately, prefixed with HANDWRITTEN NOTE:
Preserve all exercise names, spring settings, anatomical terms, and rep counts exactly as written.

Return a JSON object with this exact structure — no markdown, no preamble, only valid JSON:
{
  "printed_text": "string",
  "diagrams": ["string"],
  "handwritten_notes": ["string"]
}

CRITICAL: Output must be valid JSON parseable by JSON.parse(). Escape all quotes (\\"), backslashes (\\\\), and control chars inside strings. Use \\n for newlines within printed_text.`;

const CHARS_PER_TOKEN = 4;
const OVERLAP_CHARS = 50 * CHARS_PER_TOKEN;

function getMediaType(fileName: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
    case "heic":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

export type ProcessImageSuccess = ExtractedContent;
export type ProcessImageError = { error: string; fileName: string };
export type ProcessImageResult = ProcessImageSuccess | ProcessImageError;

/**
 * Extracts text from a PDF buffer via unpdf (serverless PDF.js), then structures it
 * via Claude using the same extraction prompt (sent as text content). Returns ExtractedContent format.
 * On failure returns { error, fileName }.
 */
function parseStructuredResponse(text: string): {
  printed_text: string;
  diagrams: string[];
  handwritten_notes: string[];
} | null {
  const jsonStr = text.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    const parsed = JSON.parse(jsonStr) as {
      printed_text?: string;
      diagrams?: string[];
      handwritten_notes?: string[];
    };
    const printed_text = typeof parsed.printed_text === "string" ? parsed.printed_text : "";
    const diagrams = Array.isArray(parsed.diagrams)
      ? parsed.diagrams.filter((d): d is string => typeof d === "string")
      : [];
    const handwritten_notes = Array.isArray(parsed.handwritten_notes)
      ? parsed.handwritten_notes.filter((h): h is string => typeof h === "string")
      : [];
    return { printed_text, diagrams, handwritten_notes };
  } catch {
    return null;
  }
}

export async function processPdf(
  pdfBuffer: Buffer,
  fileName: string,
  folderName: string
): Promise<ProcessImageResult> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const { text: pageTexts } = await extractText(pdf, { mergePages: false });

    const pages = Array.isArray(pageTexts) ? pageTexts : [];
    const nonEmpty = pages
      .map((p, i) => ({ pageNum: i + 1, text: (p ?? "").trim() }))
      .filter((p) => p.text);

    if (nonEmpty.length === 0) {
      return {
        error: "PDF contains no extractable text",
        fileName,
      };
    }

    const combined: { printed_text: string[]; diagrams: string[]; handwritten_notes: string[] } = {
      printed_text: [],
      diagrams: [],
      handwritten_notes: [],
    };
    const PDF_PAGES_PER_BATCH = 20;

    for (let i = 0; i < nonEmpty.length; i += PDF_PAGES_PER_BATCH) {
      const batch = nonEmpty.slice(i, i + PDF_PAGES_PER_BATCH);
      const batchText = batch
        .map((p) => `--- Page ${p.pageNum} ---\n${p.text}`)
        .join("\n\n");

      const response = await anthropic.messages.create({
        model: VISION_MODEL,
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Structure this extracted PDF content (pages ${batch[0].pageNum}-${batch[batch.length - 1].pageNum}) into the required format. File: ${fileName}, Folder: ${folderName}.\n\n--- PDF content ---\n\n${batchText}`,
          },
        ],
      });

      const text =
        response.content
          .filter((block) => block.type === "text")
          .map((block) => ("text" in block ? (block as { text: string }).text : ""))
          .join("") ?? "";

      if (!text.trim()) {
        return {
          error: `Claude returned empty response for pages ${batch[0].pageNum}-${batch[batch.length - 1].pageNum}`,
          fileName,
        };
      }

      const parsed = parseStructuredResponse(text);
      if (!parsed) {
        return {
          error: `Claude returned invalid JSON for pages ${batch[0].pageNum}-${batch[batch.length - 1].pageNum}`,
          fileName,
        };
      }

      if (parsed.printed_text) combined.printed_text.push(parsed.printed_text);
      combined.diagrams.push(...parsed.diagrams);
      combined.handwritten_notes.push(...parsed.handwritten_notes);
    }

    return {
      printed_text: combined.printed_text.join("\n\n"),
      diagrams: combined.diagrams,
      handwritten_notes: combined.handwritten_notes,
      fileName,
      folderName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `PDF extraction failed: ${message}`,
      fileName,
    };
  }
}

/**
 * Sends image to Claude vision API and extracts structured content.
 * On failure returns { error, fileName }.
 */
export async function processImage(
  imageBuffer: Buffer,
  fileName: string,
  folderName: string
): Promise<ProcessImageResult> {
  const base64 = imageBuffer.toString("base64");
  const mediaType = getMediaType(fileName);

  try {
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 8192,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract all content from this image. File: ${fileName}, Folder: ${folderName}.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => "text" in block ? (block as { text: string }).text : "")
        .join("") ?? "";

    if (!text.trim()) {
      return {
        error: "Claude returned empty response",
        fileName,
      };
    }

    const jsonStr = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(jsonStr) as {
      printed_text?: string;
      diagrams?: string[];
      handwritten_notes?: string[];
    };

    const printed_text = typeof parsed.printed_text === "string" ? parsed.printed_text : "";
    const diagrams = Array.isArray(parsed.diagrams)
      ? parsed.diagrams.filter((d): d is string => typeof d === "string")
      : [];
    const handwritten_notes = Array.isArray(parsed.handwritten_notes)
      ? parsed.handwritten_notes.filter((h): h is string => typeof h === "string")
      : [];

    return {
      printed_text,
      diagrams,
      handwritten_notes,
      fileName,
      folderName,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Vision extraction failed: ${message}`,
      fileName,
    };
  }
}

/**
 * Chunks extracted content for embedding storage.
 * Returns array of ContentChunk objects.
 */
export function chunkContent(
  extractedContent: ExtractedContent,
  uploadId: string,
  folderName: string,
  fileName: string
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;

  const { printed_text, diagrams, handwritten_notes } = extractedContent;

  if (printed_text.trim()) {
    const paragraphs = printed_text.split(/\n\s*\n/).filter((p) => p.trim());
    let currentChunk = "";
    let tokenCount = 0;

    for (const para of paragraphs) {
      const paraLen = para.length;
      const paraTokens = Math.ceil(paraLen / CHARS_PER_TOKEN);

      if (tokenCount + paraTokens > 500 && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          content_type: "text",
          upload_id: uploadId,
          folder_name: folderName,
          file_name: fileName,
          chunk_index: chunkIndex++,
        });
        const overlap = currentChunk.slice(-Math.min(OVERLAP_CHARS, currentChunk.length));
        currentChunk = overlap + "\n\n" + para;
        tokenCount = Math.ceil(overlap.length / CHARS_PER_TOKEN) + paraTokens;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n\n" + para : para;
        tokenCount += paraTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        content_type: "text",
        upload_id: uploadId,
        folder_name: folderName,
        file_name: fileName,
        chunk_index: chunkIndex++,
      });
    }
  }

  for (const desc of diagrams) {
    if (desc.trim()) {
      chunks.push({
        content: desc.trim(),
        content_type: "diagram",
        upload_id: uploadId,
        folder_name: folderName,
        file_name: fileName,
        chunk_index: chunkIndex++,
      });
    }
  }

  for (const note of handwritten_notes) {
    if (note.trim()) {
      const content = note.startsWith("HANDWRITTEN NOTE:")
        ? note.trim()
        : `HANDWRITTEN NOTE: ${note.trim()}`;
      chunks.push({
        content,
        content_type: "handwritten",
        upload_id: uploadId,
        folder_name: folderName,
        file_name: fileName,
        chunk_index: chunkIndex++,
      });
    }
  }

  return chunks;
}

export type EmbedAndStoreResult = {
  success: boolean;
  chunks_stored: number;
  errors: string[];
};

/**
 * Embeds chunks and stores them in curriculum_chunks.
 * Processes in batches of 10 with 200ms delay between batches to avoid rate limits.
 * Uses Supabase service role client for database writes.
 * Every error is captured and returned — no silent failures.
 */
export async function embedAndStore(
  chunks: ContentChunk[],
  userId: string,
  uploadId: string
): Promise<EmbedAndStoreResult> {
  const errors: string[] = [];
  let chunks_stored = 0;
  const supabase = createServiceClient();

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    for (const chunk of batch) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        const { error } = await supabase.from("curriculum_chunks").insert({
          user_id: userId,
          upload_id: uploadId,
          folder_name: chunk.folder_name,
          file_name: chunk.file_name,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          content_type: chunk.content_type,
          embedding,
        });

        if (error) {
          errors.push(
            `Chunk ${chunk.chunk_index} (${chunk.file_name}): ${error.message}`
          );
        } else {
          chunks_stored += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(
          `Chunk ${chunk.chunk_index} (${chunk.file_name}): ${message}`
        );
      }
    }

    if (i + BATCH_SIZE < chunks.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  const allFailed = chunks_stored === 0 && chunks.length > 0;
  const errorSummary =
    allFailed && errors.length > 0
      ? `${errors.length} of ${chunks.length} chunks failed: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`
      : null;

  const { error: updateError } = await supabase
    .from("curriculum_uploads")
    .update({
      status: allFailed ? "failed" : "complete",
      last_ingested_at: new Date().toISOString(),
      file_count: chunks_stored,
      error_message: allFailed ? errorSummary : null,
    })
    .eq("id", uploadId);

  if (updateError) {
    errors.push(`Failed to update curriculum_uploads: ${updateError.message}`);
  }

  return {
    success: !allFailed && errors.length === 0,
    chunks_stored,
    errors,
  };
}
