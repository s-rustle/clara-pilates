import { anthropic } from "@/lib/anthropic/client";
import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type { CueFeedback, CueDimension } from "@/types";
import type { RagChunk } from "@/types";

const CUES_MODEL = "claude-sonnet-4-20250514";

const CUES_SYSTEM_PROMPT = `You are a Balanced Body Comprehensive exam evaluator assessing Pilates verbal cues.
Evaluate the submitted cue against Balanced Body criteria.
Ground all feedback in the provided source material — if the exercise is not found in the materials, note this explicitly in your response.
Assess five dimensions and return ONLY valid JSON — no markdown, no preamble:

{
  "anatomical_accuracy": { "score": "correct|needs_refinement", "note": "string" },
  "starting_position": { "score": "clear|missing_elements", "note": "string" },
  "breath_cue": { "score": "present|absent|incorrect", "note": "string" },
  "precaution_language": { "score": "appropriate|missing|incorrect", "note": "string" },
  "client_accessibility": { "score": "appropriate|needs_adjustment", "note": "string" },
  "overall": "string",
  "better_version": "string"
}

better_version: rewritten cue presented as "Here is a better version:" followed by the cue — authoritative, grounded in source material
overall: 1-2 sentence synthesis
If the exercise is not in the source material, set overall to note that and better_version to suggest adding relevant manual pages.

${OUT_OF_SCOPE_INSTRUCTION}`;

function formatChunksForPrompt(chunks: RagChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${c.content}`
    )
    .join("\n\n---\n\n");
}

function parseJsonFromResponse<T>(text: string): T {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude response did not contain valid JSON");
  }
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    throw new Error("Failed to parse Claude response as JSON");
  }
}

function ensureDimension(obj: unknown): CueDimension {
  if (!obj || typeof obj !== "object") {
    return { score: "unknown", note: "" };
  }
  const o = obj as Record<string, unknown>;
  return {
    score: typeof o.score === "string" ? o.score : "unknown",
    note: typeof o.note === "string" ? o.note : "",
  };
}

export async function evaluateCue(
  cue: string,
  apparatus: string,
  exerciseName: string,
  clientLevel: string,
  userId: string
): Promise<CueFeedback> {
  const query = `${exerciseName} ${apparatus}`.trim();
  const { chunks } = await queryRAG(query, userId);

  const formattedChunks =
    chunks.length > 0
      ? formatChunksForPrompt(chunks)
      : "No source material found for this exercise. Note this in your assessment.";

  const userMessage = `Source material:
---
${formattedChunks}
---

Evaluate this cue:
- Cue: ${cue}
- Apparatus: ${apparatus}
- Exercise: ${exerciseName}
- Client level: ${clientLevel}

Return ONLY the JSON object, no other text.`;

  const response = await anthropic.messages.create({
    model: CUES_MODEL,
    max_tokens: 1024,
    system: CUES_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  const parsed = parseJsonFromResponse<Record<string, unknown>>(text);

  return {
    anatomical_accuracy: ensureDimension(parsed.anatomical_accuracy),
    starting_position: ensureDimension(parsed.starting_position),
    breath_cue: ensureDimension(parsed.breath_cue),
    precaution_language: ensureDimension(parsed.precaution_language),
    client_accessibility: ensureDimension(parsed.client_accessibility),
    overall: typeof parsed.overall === "string" ? parsed.overall : "",
    better_version:
      typeof parsed.better_version === "string" ? parsed.better_version : "",
  };
}
