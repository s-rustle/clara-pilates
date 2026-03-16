import { anthropic } from "@/lib/anthropic/client";
import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type { CurriculumResponse, RagChunk } from "@/types";

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
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${c.content}`
    )
    .join("\n\n---\n\n");
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
    };
  }

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
  };
}
