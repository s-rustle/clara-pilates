import OpenAI from "openai";
import { anthropic } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ContentChunk,
  ExerciseChunkSections,
  ExtractedContent,
  PdfExerciseSegment,
} from "@/types";
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

/** Second line of exercise header: level + rep cue (Balanced Body PDFs). */
function isLevelRepsLine(line: string): boolean {
  const t = line.trim();
  if (!/\bREPS?\b/i.test(t)) return false;
  return /\b(SUPER\s+ADVANCED|BEGINNER|INTERMEDIATE|ADVANCED)\b/i.test(t);
}

/** Line immediately above the level/reps line — exercise title in ALL CAPS. */
function isAllCapsTitleLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || isLevelRepsLine(t)) return false;
  const alpha = t.match(/[A-Za-z]/g);
  if (!alpha || alpha.length < 2) return false;
  const lower = t.match(/[a-z]/g) ?? [];
  if (lower.length / alpha.length > 0.15) return false;
  if (!/^[A-Z0-9]/.test(t)) return false;
  return /^[A-Z0-9][A-Z0-9\s\-–—&.',:]+$/.test(t);
}

function toTitleCaseFromAllCaps(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseDifficultyFromLevelLine(line: string): string | null {
  if (/SUPER\s+ADVANCED/i.test(line)) return "Super Advanced";
  if (/\bBEGINNER\b/i.test(line)) return "Beginner";
  if (/\bINTERMEDIATE\b/i.test(line)) return "Intermediate";
  if (/\bADVANCED\b/i.test(line)) return "Advanced";
  return null;
}

function parseRepRangeFromLevelLine(line: string): string | null {
  const m = line.match(/(\d+(?:\s*[-–]\s*\d+)?)\s*REPS?\b/i);
  if (m) return m[1].replace(/\s+/g, "");
  const m2 = line.match(/\b(\d+)\s*[-–]\s*(\d+)\b/);
  if (m2) return `${m2[1]}-${m2[2]}`;
  return null;
}

const SECTION_PATTERNS: {
  re: RegExp;
  key: keyof ExerciseChunkSections;
}[] = [
  { re: /^STARTING\s+POSITION\b/i, key: "starting_position" },
  { re: /^MOVEMENT\s+SEQUENCE\b/i, key: "movement_sequence" },
  { re: /^MOVEMENT\b(?!\s+SEQUENCE)/i, key: "movement_sequence" },
  { re: /^MODIFICATIONS\b/i, key: "modifications" },
  { re: /^OPTIMUM\s+FORM\b/i, key: "optimum_form" },
  { re: /^TRANSITION\b/i, key: "transition" },
  { re: /^CUEING\s+AND\s+IMAGERY\b/i, key: "cueing_and_imagery" },
  { re: /^CUEING\b/i, key: "cueing_and_imagery" },
  { re: /^IMAGERY\b/i, key: "cueing_and_imagery" },
  { re: /^PURPOSE\b/i, key: "purpose" },
  { re: /^PRECAUTIONS\b/i, key: "precautions" },
];

const SECTION_ORDER: (keyof ExerciseChunkSections)[] = [
  "starting_position",
  "movement_sequence",
  "modifications",
  "optimum_form",
  "transition",
  "cueing_and_imagery",
  "purpose",
  "precautions",
];

function parseExerciseBody(body: string): {
  sections: ExerciseChunkSections;
  content: string;
} {
  const lines = body.split(/\r?\n/);
  let current: keyof ExerciseChunkSections | null = null;
  const buffers: Partial<Record<keyof ExerciseChunkSections, string[]>> = {};

  const append = (line: string) => {
    if (!current) return;
    if (!buffers[current]) buffers[current] = [];
    buffers[current]!.push(line);
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      append("");
      continue;
    }
    let hit: keyof ExerciseChunkSections | null = null;
    for (const { re, key } of SECTION_PATTERNS) {
      if (re.test(trimmed)) {
        hit = key;
        const rest = trimmed.replace(re, "").replace(/^[:.\s]+/, "").trim();
        current = key;
        if (!buffers[key]) buffers[key] = [];
        if (rest) buffers[key]!.push(rest);
        break;
      }
    }
    if (!hit) append(line);
  }

  const sections: ExerciseChunkSections = {};
  for (const k of SECTION_ORDER) {
    const parts = buffers[k];
    if (parts?.length) {
      const text = parts.join("\n").trim();
      if (text) sections[k] = text;
    }
  }

  const contentParts: string[] = [];
  for (const k of SECTION_ORDER) {
    if (sections[k]) contentParts.push(sections[k]!);
  }

  if (contentParts.length === 0 && body.trim()) {
    return { sections: {}, content: body.trim() };
  }

  return { sections, content: contentParts.join("\n\n").trim() };
}

type Boundary = { titleLine: number; levelLine: number };

function findExerciseBoundaries(lines: string[]): Boundary[] {
  const out: Boundary[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i].trim();
    const b = lines[i + 1].trim();
    if (isAllCapsTitleLine(a) && isLevelRepsLine(b)) {
      out.push({ titleLine: i, levelLine: i + 1 });
    }
  }
  return out;
}

/**
 * Split raw PDF text into exercise blocks using ALL CAPS title + level/reps header pair.
 */
function splitPdfTextIntoExercises(fullText: string): {
  preamble: string | null;
  segments: PdfExerciseSegment[];
} {
  const lines = fullText.split(/\r?\n/);
  const boundaries = findExerciseBoundaries(lines);
  if (boundaries.length === 0) {
    return { preamble: null, segments: [] };
  }

  const firstTitle = boundaries[0].titleLine;
  const preambleRaw = lines.slice(0, firstTitle).join("\n").trim();
  const preamble =
    preambleRaw.length >= 40 ? preambleRaw : null;

  const segments: PdfExerciseSegment[] = [];
  for (let b = 0; b < boundaries.length; b++) {
    const { titleLine, levelLine } = boundaries[b];
    const title = lines[titleLine].trim();
    const levelLineText = lines[levelLine].trim();
    const bodyStart = levelLine + 1;
    const bodyEnd =
      b + 1 < boundaries.length ? boundaries[b + 1].titleLine : lines.length;
    const body = lines.slice(bodyStart, bodyEnd).join("\n");
    const { sections, content } = parseExerciseBody(body);
    const exercise_name = toTitleCaseFromAllCaps(title);
    const difficulty = parseDifficultyFromLevelLine(levelLineText);
    const rep_range = parseRepRangeFromLevelLine(levelLineText);
    const finalContent =
      content ||
      [title, levelLineText, body.trim()].filter(Boolean).join("\n").trim();

    segments.push({
      exercise_name,
      difficulty,
      rep_range,
      content: finalContent,
      sections,
    });
  }

  return { preamble, segments };
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

    const { preamble, segments } = splitPdfTextIntoExercises(fullText);

    const base: ExtractedContent = {
      printed_text: fullText,
      diagrams: [],
      handwritten_notes: [],
      fileName,
      folderName,
    };

    if (segments.length > 0) {
      base.pdf_exercise_segments = segments;
      if (preamble) base.pdf_preamble = preamble;
    }

    return base;
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

  const { printed_text, diagrams, handwritten_notes, pdf_exercise_segments, pdf_preamble } =
    extractedContent;

  if (pdf_exercise_segments?.length) {
    if (pdf_preamble?.trim()) {
      chunks.push({
        content: pdf_preamble.trim(),
        content_type: "text",
        upload_id: uploadId,
        folder_name: folderName,
        file_name: fileName,
        chunk_index: chunkIndex++,
        exercise_name: null,
        difficulty: null,
        rep_range: null,
        sections: null,
        ...src,
      });
    }

    for (const seg of pdf_exercise_segments) {
      const hasSections = Object.keys(seg.sections).length > 0;
      chunks.push({
        content: seg.content,
        content_type: "text",
        upload_id: uploadId,
        folder_name: folderName,
        file_name: fileName,
        chunk_index: chunkIndex++,
        exercise_name: seg.exercise_name,
        difficulty: seg.difficulty,
        rep_range: seg.rep_range,
        sections: hasSections ? seg.sections : null,
        ...src,
      });
    }
  } else if (printed_text.trim()) {
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
          exercise_name: null,
          difficulty: null,
          rep_range: null,
          sections: null,
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
        exercise_name: null,
        difficulty: null,
        rep_range: null,
        sections: null,
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
        exercise_name: null,
        difficulty: null,
        rep_range: null,
        sections: null,
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
        exercise_name: null,
        difficulty: null,
        rep_range: null,
        sections: null,
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
      exercise_name: chunk.exercise_name ?? null,
      difficulty: chunk.difficulty ?? null,
      rep_range: chunk.rep_range ?? null,
      sections:
        chunk.sections && Object.keys(chunk.sections).length > 0
          ? chunk.sections
          : null,
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
