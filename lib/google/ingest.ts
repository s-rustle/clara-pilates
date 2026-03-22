import OpenAI from "openai";
import { anthropic } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";
import type { ExtractedContent, ContentChunk } from "@/types";
import { extractPdfTextOrientationAware } from "@/lib/google/pdfTextExtract";

const EMBEDDING_MODEL = "text-embedding-ada-002";
const EMBEDDING_DIM = 1536;
/** Chunks per OpenAI embeddings API call (was 1 request/chunk — major ingest speedup). */
const EMBEDDING_BATCH_SIZE = 48;
/** Brief pause between embedding batches to stay under TPM burst limits. */
const EMBEDDING_BATCH_DELAY_MS = 50;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One OpenAI call for many chunk texts — order matches input (by `index` on each item).
 */
async function createEmbeddingsBatch(
  openai: OpenAI,
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  const byIndex = new Map<number, number[]>();
  for (const item of response.data) {
    if (item.embedding?.length === EMBEDDING_DIM) {
      byIndex.set(item.index, item.embedding);
    }
  }
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const emb = byIndex.get(i);
    if (!emb) {
      throw new Error(`Embedding batch missing index ${i}`);
    }
    out.push(emb);
  }
  return out;
}

const VISION_MODEL = "claude-sonnet-4-20250514";

const IMAGE_EXTRACTION_SYSTEM_PROMPT = `You are extracting content from a photographed page of a Balanced Body Pilates curriculum manual.

ORIENTATION: If the page appears rotated (including upside down), mentally correct to normal reading orientation before transcribing — output text as if the page were upright.

MANUAL EXERCISE HEADERS (typical layout):
- Line 1: large ALL CAPS exercise title (e.g. SWAN DIVE, SHORT BOX ABDOMINAL SERIES).
- Line 2: smaller ALL CAPS metadata: program level, a middle dot or bullet (•), and rep range (e.g. INTERMEDIATE • 4-6 REPS). Map these into **LEVEL:** and **REPS:** below.

Extract all printed text faithfully and completely.
Describe any anatomical diagrams or movement illustrations in detail — prefix with [DIAGRAM:].
Extract handwritten annotations — prefix with [HANDWRITTEN:].
Preserve exercise names, spring settings, anatomical terms, and rep counts exactly as written.

When you identify a distinct exercise entry on the page, structure that entry using these lines (omit a line if not present on the page):
**EXERCISE: [name]**
**LEVEL: [Beginner / Intermediate / Advanced — from header or body; use manual wording]**
**REPS: [recommended rep range from header if shown, e.g. 4-6 or 3-5; omit if not stated]**
**PURPOSE: [muscles and goals]**
**STARTING POSITION: [description]**
**MOVEMENT: [sequence]**
**BREATH: [cues]**
**PRECAUTIONS: [contraindications]**
**PROGRESSIONS: [next or prior exercises if listed]**
**SPRING SETTINGS: [if applicable]**

For a progression table: **PROGRESSION TABLE: [movement category]** then **LEVEL 1:**, **LEVEL 2:**, **LEVEL 3:** with exercises per level.
For a session template: **SESSION TEMPLATE: [level/population]** then **SEQUENCE:** with an ordered exercise list.

Return ONLY a valid JSON object with no markdown fences, no explanation.
Format: {"printed_text": "all extracted content here as a single string"}
Include all text, diagram descriptions prefixed with [DIAGRAM:], and handwritten notes prefixed with [HANDWRITTEN:].
Escape quotes (\\"), backslashes (\\\\), and newlines (\\n) inside the string.`;

const PDF_TEXT_MODEL = "claude-sonnet-4-20250514";

/** Full rewrite with inline tags — only for short PDFs that fit in model output. */
const PDF_EXERCISE_TAGGING_SYSTEM = `You are formatting raw text extracted from a Balanced Body Pilates certification manual (PDF).

SOURCE ORIENTATION: Extracted text may have come from pages that were visually upside down in the scan; infer correct reading order so exercise blocks read top-to-bottom like an upright manual.

MANUAL EXERCISE HEADERS (recognize and tag):
- First line: large ALL CAPS exercise title.
- Next line: smaller ALL CAPS line with program level, often a middle dot (•), then rep range (e.g. INTERMEDIATE • 4-6 REPS). Map level into **LEVEL:** and the numeric rep range into **REPS:** (e.g. **REPS: 4-6**).

Requirements:
1. Preserve the complete source text: every instruction, bullet, precaution, rep count, spring setting, and heading. Do not summarize, condense, or drop substantive content.
2. When you find a distinct exercise entry, insert (or wrap) structured lines immediately before or at the start of that entry — use exactly these labels (Markdown bold). Only include lines that appear in the source; use "Not stated" only when the manual explicitly leaves a subsection empty, otherwise omit the line.
**EXERCISE: [name]**  (name must match the manual; square brackets around the name)
**LEVEL: [Beginner / Intermediate / Advanced when stated in header or body]**
**REPS: [recommended rep range from exercise header when shown, e.g. 4-6; omit if absent]**
**PURPOSE: [muscles and goals]**
**STARTING POSITION: [description]**
**MOVEMENT: [sequence]**
**BREATH: [cues]**
**PRECAUTIONS: [contraindications]**
**PROGRESSIONS: [next exercises if listed]**
**SPRING SETTINGS: [if applicable]**
3. When you find a progression table, structure it as:
**PROGRESSION TABLE: [movement category]**
**LEVEL 1: [exercises]**
**LEVEL 2: [exercises]**
**LEVEL 3: [exercises]**
4. When you find a session template, structure it as:
**SESSION TEMPLATE: [level/population]**
**SEQUENCE: [ordered exercise list]**
5. Tag only content that clearly appears in the source — never invent exercises or templates.

Return ONLY valid JSON (no markdown code fences, no commentary):
{"printed_text":"..."}
The printed_text value must be a single JSON string. Escape double quotes and newlines inside it as JSON requires.`;

/** For long PDFs: emit tags only; we prepend to raw text so chunks still contain **EXERCISE: [name]** markers. */
const PDF_EXERCISE_LIST_SYSTEM = `You are reading text extracted from a Balanced Body Pilates certification manual (PDF).

Find every distinct exercise and any progression tables or session templates visible in this excerpt.

For each exercise, output a block (separate blocks with a blank line — use \\n\\n in the JSON string) using these lines only when the source supports them:
**EXERCISE: [EXERCISE NAME]**
**LEVEL: [...]** (from ALL CAPS header line before the rep cue, e.g. INTERMEDIATE)
**REPS: [...]** (numeric range from header, e.g. 4-6, when shown as "4-6 REPS" or after •)
**PURPOSE: [...]**
**STARTING POSITION: [...]**
**MOVEMENT: [...]**
**BREATH: [...]**
**PRECAUTIONS: [...]**
**PROGRESSIONS: [...]**
**SPRING SETTINGS: [...]**

For progression tables in the excerpt:
**PROGRESSION TABLE: [movement category]**
**LEVEL 1: [exercises]**
**LEVEL 2: [exercises]**
**LEVEL 3: [exercises]**

For session templates in the excerpt:
**SESSION TEMPLATE: [level/population]**
**SEQUENCE: [ordered exercise list]**

Do not treat section headers alone as exercises: STARTING POSITION, MOVEMENT SEQUENCE, PURPOSE, PRECAUTIONS, NOTES, TIPS, INHALE, EXHALE, HANDWRITTEN NOTE alone. (INTERMEDIATE / BEGINNER / ADVANCED / rep lines are metadata for the exercise above them, not standalone exercises.)

Return ONLY valid JSON:
{"exercise_tags":"...all blocks concatenated..."}
The exercise_tags value is one JSON string; use \\n for newlines and \\n\\n between exercise blocks. If none, use {"exercise_tags":""}.`;

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
    const { text: extracted } = await extractPdfTextOrientationAware(pdfBuffer);
    const fullText = extracted.trim();

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
 * Uses batched OpenAI embeddings (many chunks per request) + multi-row insert when possible.
 */
export async function embedAndStore(
  chunks: ContentChunk[],
  userId: string,
  uploadId: string
): Promise<EmbedAndStoreResult> {
  const errors: string[] = [];
  let chunks_stored = 0;
  const supabase = createServiceClient();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      chunks_stored: 0,
      errors: ["OPENAI_API_KEY is not set — cannot generate embeddings"],
    };
  }
  const openai = new OpenAI({ apiKey });

  async function insertRowsWithFallback(
    batch: ContentChunk[],
    embeddings: number[][]
  ): Promise<void> {
    const rows = batch.map((chunk, j) => ({
      user_id: userId,
      upload_id: uploadId,
      folder_name: chunk.folder_name,
      file_name: chunk.file_name,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      content_type: chunk.content_type,
      embedding: embeddings[j],
      drive_file_id: chunk.drive_file_id ?? null,
      source_mime_type: chunk.source_mime_type ?? null,
    }));

    const { error: bulkErr } = await supabase.from("curriculum_chunks").insert(rows);
    if (!bulkErr) {
      chunks_stored += batch.length;
      return;
    }

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const { error: rowErr } = await supabase.from("curriculum_chunks").insert(rows[j]);
      if (rowErr) {
        errors.push(
          `Chunk ${chunk.chunk_index} (${chunk.file_name}): ${rowErr.message} (bulk: ${bulkErr.message})`
        );
      } else {
        chunks_stored += 1;
      }
    }
  }

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    try {
      const embeddings = await createEmbeddingsBatch(
        openai,
        batch.map((c) => c.content)
      );
      await insertRowsWithFallback(batch, embeddings);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const chunk of batch) {
        errors.push(`Chunk ${chunk.chunk_index} (${chunk.file_name}): ${message}`);
      }
    }

    if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
      await delay(EMBEDDING_BATCH_DELAY_MS);
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
