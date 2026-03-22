import { anthropic } from "@/lib/anthropic/client";
import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { createServiceClient } from "@/lib/supabase/server";
import type { RagChunk, TutorialContent } from "@/types";

const LEARN_MODEL = "claude-sonnet-4-20250514";

const LEARN_SYSTEM = `You are Clara, a Balanced Body Pilates instructor teaching in tutorial mode
Teach the exercise step by step using only the provided source material
Be precise — use exact Balanced Body terminology, exercise names, and anatomical language
Return ONLY valid JSON:

{
  "exercise_name": "string",
  "apparatus": "string",
  "starting_position": "string",
  "movement_description": "string",
  "breath_cues": "string",
  "spring_settings": "string or null",
  "precautions": "string",
  "teaching_tips": "string",
  "source_folder": "string"
}

If any field is not covered in source material: use null or "Not specified in your materials"

${OUT_OF_SCOPE_INSTRUCTION}`;

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

function assertString(v: unknown, path: string): string {
  if (v === null || v === undefined) {
    return "Not specified in your materials";
  }
  if (typeof v !== "string") {
    throw new Error(`Invalid tutorial field: ${path}`);
  }
  return v;
}

function normalizeSpring(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null") return null;
  return t;
}

function validateTutorialPayload(raw: unknown): Omit<TutorialContent, "error" | "manual_image"> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid tutorial: root must be an object");
  }
  const o = raw as Record<string, unknown>;

  return {
    exercise_name: assertString(o.exercise_name, "exercise_name"),
    apparatus: assertString(o.apparatus, "apparatus"),
    starting_position: assertString(o.starting_position, "starting_position"),
    movement_description: assertString(o.movement_description, "movement_description"),
    breath_cues: assertString(o.breath_cues, "breath_cues"),
    spring_settings: normalizeSpring(o.spring_settings),
    precautions: assertString(o.precautions, "precautions"),
    teaching_tips: assertString(o.teaching_tips, "teaching_tips"),
    source_folder: assertString(o.source_folder, "source_folder"),
  };
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|tif)$/i;

function pickManualImageFromChunks(
  chunks: RagChunk[]
): { file_name: string; folder_name: string } | null {
  for (const c of chunks) {
    if (!c.drive_file_id) continue;
    const mime = c.source_mime_type?.toLowerCase() ?? "";
    const isImageMime = mime.startsWith("image/");
    const looksLikeImageFile = IMAGE_EXT.test(c.file_name);
    if (isImageMime || looksLikeImageFile) {
      return { file_name: c.file_name, folder_name: c.folder_name };
    }
  }
  return null;
}

const RAG_ERROR =
  "No curriculum material found for this topic. Please ingest relevant materials first.";

const EXERCISE_FROM_CHUNK = /\*\*([^*]{2,72})\*\*/g;

const TITLE_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "fig",
  "figure",
  "page",
  "see",
  "note",
]);

function plausibleExerciseTitle(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 72) return false;
  if (/^\d+$/.test(t)) return false;
  const lower = t.toLowerCase();
  if (TITLE_STOP.has(lower)) return false;
  if (/^chunk\s*\d/i.test(t)) return false;
  return true;
}

function extractExerciseNamesFromContents(contents: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of contents) {
    EXERCISE_FROM_CHUNK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EXERCISE_FROM_CHUNK.exec(text)) !== null) {
      const name = m[1].replace(/\s+/g, " ").trim();
      if (!plausibleExerciseTitle(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out.slice(0, 200);
}

/**
 * Generates structured tutorial content from RAG + Claude.
 */
export async function generateTutorial(
  apparatus: string,
  exerciseOrMuscle: string,
  userId: string
): Promise<TutorialContent> {
  const query = `${apparatus} ${exerciseOrMuscle}`.trim();
  const { chunks, notFound } = await queryRAG(query, userId);

  if (notFound || chunks.length === 0) {
    return {
      error: RAG_ERROR,
      exercise_name: "",
      apparatus: "",
      starting_position: "",
      movement_description: "",
      breath_cues: "",
      spring_settings: null,
      precautions: "",
      teaching_tips: "",
      source_folder: "",
    };
  }

  const sourceBlock = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${c.content}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Source material (ground every claim here only):
---
${sourceBlock}
---

User request: Teach a tutorial for apparatus/context "${apparatus}" focused on: ${exerciseOrMuscle}

Return the JSON object with all fields.`;

  const response = await anthropic.messages.create({
    model: LEARN_MODEL,
    max_tokens: 4096,
    system: LEARN_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  if (!text.trim()) {
    throw new Error("Claude returned an empty response");
  }

  const parsed = parseJsonFromResponse<unknown>(text);
  const base = validateTutorialPayload(parsed);
  const manual_image = pickManualImageFromChunks(chunks);

  return {
    ...base,
    manual_image: manual_image ?? null,
  };
}

/**
 * Lists plausible exercise titles inferred from **bold** mentions in chunk text for the apparatus filter.
 */
export async function getExerciseList(
  apparatus: string,
  userId: string
): Promise<string[]> {
  try {
    const supabase = createServiceClient();
    let q = supabase
      .from("curriculum_chunks")
      .select("content")
      .eq("user_id", userId);

    if (apparatus && apparatus !== "All") {
      if (apparatus === "Mat") {
        q = q.ilike("folder_name", "%Mat%");
      } else if (apparatus === "Reformer") {
        q = q.ilike("folder_name", "%Reformer%");
      } else {
        q = q.eq("folder_name", apparatus);
      }
    }

    const { data, error } = await q.limit(500);

    if (error) {
      console.error("[learn] getExerciseList query failed:", error.message);
      return [];
    }

    const contents = (data ?? []).map(
      (row) => (row as { content: string | null }).content ?? ""
    );
    return extractExerciseNamesFromContents(contents);
  } catch (err) {
    console.error("[learn] getExerciseList failed:", err);
    return [];
  }
}
