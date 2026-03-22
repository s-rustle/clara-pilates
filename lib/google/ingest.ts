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

const IMAGE_EXTRACTION_SYSTEM_PROMPT = `You are extracting content from a photographed page of a Pilates curriculum manual.

Extract all printed text faithfully and completely.
Describe any anatomical diagrams or movement illustrations in detail — prefix with [DIAGRAM:].
Extract handwritten annotations — prefix with [HANDWRITTEN:].
Preserve all exercise names, spring settings, anatomical terms, and rep counts exactly as written.

Return ONLY a valid JSON object with no markdown, no backticks, no explanation.
Format: {"printed_text": "all extracted content here as a single string"}
Include all text, diagram descriptions prefixed with [DIAGRAM:], and handwritten notes prefixed with [HANDWRITTEN:].
Escape quotes (\\"), backslashes (\\\\), and newlines (\\n) inside the string.`;

const PDF_TEXT_MODEL = "claude-sonnet-4-20250514";

/** Full rewrite with inline tags — only for short PDFs that fit in model output. */
const PDF_EXERCISE_TAGGING_SYSTEM = `You are formatting raw text extracted from a Balanced Body Pilates certification manual (PDF).

Requirements:
1. Preserve the complete source text: every instruction, bullet, precaution, rep count, spring setting, and heading. Do not summarize, condense, or drop substantive content.
2. Identify each distinct exercise name exactly as it appears in the text (manuals often use ALL CAPS for exercise titles).
3. For each exercise you identify, ensure it is tagged using exactly this format (Markdown bold, with square brackets around the name):
**EXERCISE: [EXERCISE NAME]**
   The substring inside the brackets must match the manual's spelling and capitalization. Place each tag on its own line, typically where that exercise is first introduced in a section. Do not repeat the same tag for every mention of the same exercise.
4. Tag only names that clearly appear in the source — never invent exercises.

Return ONLY valid JSON (no markdown code fences, no commentary):
{"printed_text":"..."}
The printed_text value must be a single JSON string. Escape double quotes and newlines inside it as JSON requires.`;

/** For long PDFs: emit tags only; we prepend to raw text so chunks still contain **EXERCISE: [name]** markers. */
const PDF_EXERCISE_LIST_SYSTEM = `You are reading text extracted from a Balanced Body Pilates certification manual (PDF).

Find every distinct exercise name that appears, spelled exactly as in the manual (often ALL CAPS). Do not treat these as exercises if they appear only as section headers: STARTING POSITION, MOVEMENT SEQUENCE, ARM VARIATIONS, PRECAUTIONS, NOTES, TIPS, INHALE, EXHALE, HANDWRITTEN NOTE, or the words REPS, ADVANCED, BEGINNER, INTERMEDIATE alone.

Return ONLY valid JSON:
{"exercise_tags":"**EXERCISE: [NAME]**\\n**EXERCISE: [NAME]**\\n..."}
Each line in exercise_tags must be exactly **EXERCISE: [EXERCISE NAME]** with square brackets around the name. One exercise per line. Use \\n between lines inside the JSON string. If none, use {"exercise_tags":""}.`;

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
 * Parses Claude vision JSON: {"printed_text": "..."}. Used by processImage only.
 */
function parseImageExtractionResponse(text: string): string | null {
  const unescapeJsonString = (s: string): string => {
    try {
      return JSON.parse('"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') as string;
    } catch {
      return s.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  };

  const stripMarkdown = (s: string) =>
    s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "").trim();
  const stripped = stripMarkdown(text);

  const tryParse = (str: string): string | null => {
    try {
      const parsed = JSON.parse(str) as { printed_text?: unknown };
      if (typeof parsed.printed_text === "string") return parsed.printed_text;
    } catch {
      // ignore
    }
    return null;
  };

  let result = tryParse(stripped);
  if (result !== null) return result;

  const repaired = stripped.replace(/,(\s*[}\]])/g, "$1").trim();
  result = tryParse(repaired);
  if (result !== null) return result;

  const regexMatch = stripped.match(/"printed_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (regexMatch) return unescapeJsonString(regexMatch[1]);

  const key = '"printed_text"';
  const idx = stripped.indexOf(key);
  if (idx === -1) return null;

  const afterKey = stripped.slice(idx + key.length);
  const colonMatch = afterKey.match(/^\s*:\s*"/);
  if (!colonMatch) return null;

  const start = colonMatch[0].length;
  let value = "";
  let i = start;
  while (i < afterKey.length) {
    const c = afterKey[i];
    if (c === "\\" && i + 1 < afterKey.length) {
      value += afterKey.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '"') break;
    value += c;
    i++;
  }
  return value ? unescapeJsonString(value) : null;
}

/** Parses Claude JSON: {"exercise_tags":"**EXERCISE: [A]**\\n..."} from PDF list pass. */
function parsePdfExerciseTagsField(text: string): string | null {
  const unescapeJsonString = (s: string): string => {
    try {
      return JSON.parse(
        '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'
      ) as string;
    } catch {
      return s
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  };

  const stripMarkdown = (s: string) =>
    s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "").trim();
  const stripped = stripMarkdown(text);

  const tryParse = (str: string): string | null => {
    try {
      const parsed = JSON.parse(str) as { exercise_tags?: unknown };
      if (typeof parsed.exercise_tags === "string") return parsed.exercise_tags;
    } catch {
      // ignore
    }
    return null;
  };

  let tags = tryParse(stripped);
  if (tags !== null) return tags;

  const repaired = stripped.replace(/,(\s*[}\]])/g, "$1").trim();
  tags = tryParse(repaired);
  if (tags !== null) return tags;

  const regexMatch = stripped.match(/"exercise_tags"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (regexMatch) return unescapeJsonString(regexMatch[1]);

  const key = '"exercise_tags"';
  const idx = stripped.indexOf(key);
  if (idx === -1) return null;

  const afterKey = stripped.slice(idx + key.length);
  const colonMatch = afterKey.match(/^\s*:\s*"/);
  if (!colonMatch) return null;

  const start = colonMatch[0].length;
  let value = "";
  let i = start;
  while (i < afterKey.length) {
    const c = afterKey[i];
    if (c === "\\" && i + 1 < afterKey.length) {
      value += afterKey.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '"') break;
    value += c;
    i++;
  }
  return value ? unescapeJsonString(value) : null;
}

/**
 * Converts parsed printed_text (with [DIAGRAM:] and [HANDWRITTEN:] inline) to ExtractedContent.
 */
function toExtractedContent(
  printedText: string,
  fileName: string,
  folderName: string
): ExtractedContent {
  return {
    printed_text: printedText,
    diagrams: [],
    handwritten_notes: [],
    fileName,
    folderName,
  };
}

export async function processPdf(
  pdfBuffer: Buffer,
  fileName: string,
  folderName: string
): Promise<ProcessImageResult> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(pdfBuffer);
    const fullText = pdfData.text.trim();

    if (!fullText) {
      return {
        error: "PDF contains no extractable text",
        fileName,
      };
    }

    const maxChars = 200_000;
    const smallPdfChars = 6000;

    try {
      if (fullText.length <= smallPdfChars) {
        const response = await anthropic.messages.create({
          model: PDF_TEXT_MODEL,
          max_tokens: 8192,
          system: PDF_EXERCISE_TAGGING_SYSTEM,
          messages: [
            {
              role: "user",
              content: `File: ${fileName}\nFolder (curriculum category): ${folderName}\n\n--- Extracted PDF text ---\n\n${fullText}`,
            },
          ],
        });

        const raw =
          response.content
            .filter((block) => block.type === "text")
            .map((block) =>
              "text" in block ? (block as { text: string }).text : ""
            )
            .join("") ?? "";

        const tagged = parseImageExtractionResponse(raw);
        if (tagged && tagged.trim().length > 0) {
          return toExtractedContent(tagged, fileName, folderName);
        }
      } else {
        const body =
          fullText.length > maxChars
            ? `${fullText.slice(0, maxChars)}\n\n[Truncated: PDF text exceeded ${maxChars} characters for exercise tagging; later pages omitted from this pass only — full raw text is still stored below.]`
            : fullText;

        const response = await anthropic.messages.create({
          model: PDF_TEXT_MODEL,
          max_tokens: 4096,
          system: PDF_EXERCISE_LIST_SYSTEM,
          messages: [
            {
              role: "user",
              content: `File: ${fileName}\nFolder (curriculum category): ${folderName}\n\n--- Extracted PDF text ---\n\n${body}`,
            },
          ],
        });

        const raw =
          response.content
            .filter((block) => block.type === "text")
            .map((block) =>
              "text" in block ? (block as { text: string }).text : ""
            )
            .join("") ?? "";

        const tagBlock = parsePdfExerciseTagsField(raw);
        if (tagBlock && tagBlock.trim().length > 0) {
          return toExtractedContent(
            `${tagBlock.trim()}\n\n---\n\n${fullText}`,
            fileName,
            folderName
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        "[ingest] PDF exercise tagging failed, using raw pdf-parse text:",
        msg
      );
    }

    return toExtractedContent(fullText, fileName, folderName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `PDF extraction failed: ${message}`,
      fileName,
    };
  }
}

export async function processImage(
  imageBuffer: Buffer,
  fileName: string,
  folderName: string
): Promise<ProcessImageResult> {
  const base64 = imageBuffer.toString("base64");
  const mediaType = getMediaType(fileName);
  const userContent = [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaType,
        data: base64,
      },
    },
    {
      type: "text" as const,
      text: `Extract all content from this image. File: ${fileName}, Folder: ${folderName}.`,
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: VISION_MODEL,
      max_tokens: 4096,
      system: IMAGE_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const text =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? (block as { text: string }).text : ""))
        .join("") ?? "";

    if (!text.trim()) {
      return {
        error: "Claude returned empty response",
        fileName,
      };
    }

    const parsed = parseImageExtractionResponse(text);
    if (!parsed) {
      return {
        error: "Claude returned invalid JSON structure",
        fileName,
      };
    }

    return toExtractedContent(parsed, fileName, folderName);
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
  fileName: string,
  sourceMeta?: { driveFileId: string; mimeType: string }
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;

  const src =
    sourceMeta != null
      ? {
          drive_file_id: sourceMeta.driveFileId,
          source_mime_type: sourceMeta.mimeType,
        }
      : { drive_file_id: null as string | null, source_mime_type: null as string | null };

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
          ...src,
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
        ...src,
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
        ...src,
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
        ...src,
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
          drive_file_id: chunk.drive_file_id ?? null,
          source_mime_type: chunk.source_mime_type ?? null,
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

  const finalPayload = {
    status: allFailed ? ("failed" as const) : ("complete" as const),
    last_ingested_at: new Date().toISOString(),
    file_count: chunks_stored,
    error_message: allFailed ? errorSummary : null,
  };

  let updateError: { message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase
      .from("curriculum_uploads")
      .update(finalPayload)
      .eq("id", uploadId);
    if (!error) {
      updateError = null;
      break;
    }
    updateError = error;
    if (attempt < 3) {
      await delay(300 * (attempt + 1));
    }
  }

  if (updateError) {
    errors.push(
      `Failed to update curriculum_uploads after retries: ${updateError.message}`
    );
    const { error: fallbackErr } = await supabase
      .from("curriculum_uploads")
      .update({
        status: "failed",
        error_message: `Ingest finished but could not save final status (${updateError.message}). Re-ingest if needed.`,
      })
      .eq("id", uploadId);

    if (fallbackErr) {
      throw new Error(
        `curriculum_uploads could not be updated: ${updateError.message}`
      );
    }
  }

  return {
    success: !allFailed && errors.length === 0,
    chunks_stored,
    errors,
  };
}

/**
 * Counts existing rows in curriculum_chunks for this upload + file name.
 * Used before ingest to skip files that are already fully processed (additive ingest).
 */
export async function countChunksForUploadFile(
  uploadId: string,
  fileName: string
): Promise<number> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("curriculum_chunks")
    .select("*", { count: "exact", head: true })
    .eq("upload_id", uploadId)
    .eq("file_name", fileName);

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}
