import { anthropic } from "@/lib/anthropic/client";
import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { stripBalancedBodyExerciseHeadersFromText } from "@/lib/curriculum/exerciseNames";
import type {
  CurriculumResponse,
  RagChunk,
  SourceDocument,
  SourceFigure,
  SourceImage,
} from "@/types";

const CURRICULUM_MODEL = "claude-sonnet-4-20250514";

export const CURRICULUM_SYSTEM_PROMPT = `You are Clara, a Pilates study assistant for Balanced Body Comprehensive certification exam preparation.
Answer questions exclusively from the source material provided.
Always cite the source folder: "Based on your [folder_name] materials..."
Never infer, extrapolate, or use general Pilates knowledge beyond the provided chunks.
Be precise with anatomical terminology — never paraphrase exercise names or body part names.

At the end of your response, add exactly one line: [CONFIDENCE: confident] or [CONFIDENCE: partial].
Use confident if your answer is fully supported by the chunks; use partial if only partially covered.

${OUT_OF_SCOPE_INSTRUCTION}`;

function formatChunksForPrompt(chunks: RagChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${stripBalancedBodyExerciseHeadersFromText(c.content)}`
    )
    .join("\n\n---\n\n");
}

const MAX_FIGURES = 6;

/**
 * Surfaces diagram chunks and [DIAGRAM: ...] passages from RAG chunks for the Study UI.
 * (Curriculum ingest stores figures as text descriptions, not image binaries.)
 */
function extractFiguresFromChunks(chunks: RagChunk[]): SourceFigure[] {
  const out: SourceFigure[] = [];
  const seen = new Set<string>();

  const push = (
    file_name: string,
    description: string,
    content_type: "diagram" | "text",
    drive_file_id?: string | null
  ) => {
    const d = description.trim();
    if (!d) return;
    const key = `${file_name}|${d.slice(0, 120)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ file_name, description: d, content_type, drive_file_id: drive_file_id ?? null });
  };

  for (const c of chunks) {
    if (c.content_type === "diagram") {
      push(c.file_name, c.content, "diagram", c.drive_file_id);
    }

    const diagramTag = /\[DIAGRAM:\s*([\s\S]*?)\]/gi;
    let m: RegExpExecArray | null;
    const content = c.content;
    diagramTag.lastIndex = 0;
    while ((m = diagramTag.exec(content)) !== null) {
      push(c.file_name, m[1], "text", c.drive_file_id);
    }
  }

  return out.slice(0, MAX_FIGURES);
}

const MAX_SOURCE_IMAGES = 8;

function extractSourceImages(chunks: RagChunk[]): SourceImage[] {
  const seen = new Set<string>();
  const out: SourceImage[] = [];
  for (const c of chunks) {
    const id = c.drive_file_id;
    const mime = c.source_mime_type;
    if (!id || !mime || !mime.startsWith("image/")) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      drive_file_id: id,
      file_name: c.file_name,
      mime_type: mime,
    });
  }
  return out.slice(0, MAX_SOURCE_IMAGES);
}

const MAX_SOURCE_DOCS = 5;

function extractSourceDocuments(chunks: RagChunk[]): SourceDocument[] {
  const seen = new Set<string>();
  const out: SourceDocument[] = [];
  for (const c of chunks) {
    const id = c.drive_file_id;
    const mime = c.source_mime_type;
    if (!id || !mime) continue;
    if (mime.startsWith("image/")) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      drive_file_id: id,
      file_name: c.file_name,
      mime_type: mime,
    });
  }
  return out.slice(0, MAX_SOURCE_DOCS);
}

export async function askCurriculum(
  query: string,
  userId: string,
  folderFilter?: string
): Promise<CurriculumResponse> {
  const { chunks, notFound } = await queryRAG(query, userId, folderFilter);

  if (notFound || chunks.length === 0) {
    const folderLabel = folderFilter ?? "curriculum";
    return {
      answer: `I couldn't find this in your uploaded materials. Consider adding relevant pages from your ${folderLabel} folder.`,
      confidence: "not_found",
      source_folder: folderFilter ?? null,
      chunks_used: 0,
      figures: [],
      source_images: [],
      source_documents: [],
    };
  }

  const figures = extractFiguresFromChunks(chunks);
  const source_images = extractSourceImages(chunks);
  const source_documents = extractSourceDocuments(chunks);
  const formattedChunks = formatChunksForPrompt(chunks);
  const userMessage = `${query}\n\n--- Source material ---\n\n${formattedChunks}`;

  const response = await anthropic.messages.create({
    model: CURRICULUM_MODEL,
    max_tokens: 2048,
    system: CURRICULUM_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  const confidenceMatch = text.match(/\[CONFIDENCE:\s*(confident|partial)\]/i);
  const confidence =
    confidenceMatch?.[1]?.toLowerCase() === "partial" ? "partial" : "confident";
  text = text.replace(/\n?\[CONFIDENCE:\s*(confident|partial)\]\s*/gi, "").trim();

  const sourceFolder = chunks[0]?.folder_name ?? null;

  return {
    answer: text,
    confidence,
    source_folder: sourceFolder,
    chunks_used: chunks.length,
    figures,
    source_images,
    source_documents,
  };
}
