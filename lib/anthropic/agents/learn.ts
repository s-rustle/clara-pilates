import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type { RagChunk, TutorialContent } from "@/types";
import {
  EXERCISES_BY_APPARATUS,
  type Apparatus,
} from "@/constants/exerciseList";
import {
  stripBalancedBodyExerciseHeadersFromText,
  stripStandaloneLevelRepsLines,
  formatExerciseNameForDisplay,
} from "@/lib/curriculum/exerciseNames";

function isApparatusKey(s: string): s is Apparatus {
  return Object.prototype.hasOwnProperty.call(EXERCISES_BY_APPARATUS, s);
}

const LEARN_MODEL = "claude-sonnet-4-20250514";

const LEARN_SYSTEM = `You are Clara, a Balanced Body Pilates instructor teaching in tutorial mode
Teach the exercise step by step using only the provided source material
Be precise — use exact Balanced Body terminology and anatomical language
Manual exercise headers in source are often: ALL CAPS title on one line, then a line like "INTERMEDIATE • 4-6 REPS". Those header lines may be omitted from the chunks you see — infer level and reps from **LEVEL:** / **REPS:** tags or body text when present.
Use Title Case for exercise_name (e.g. "Swan Dive", "Climb a Tree") — never leave the title in ALL CAPS.
Put program level only in difficulty_level and rep range only in rep_range — do not repeat the raw "LEVEL • N-N REPS" header line inside starting_position, movement_description, or other body fields.
Return ONLY valid JSON:

{
  "exercise_name": "string",
  "apparatus": "string",
  "difficulty_level": "string (Beginner/Intermediate/Advanced or manual wording from source; not specified if absent)",
  "rep_range": "string or null (e.g. 4-6 reps from header; null if not stated)",
  "starting_position": "string",
  "movement_description": "string",
  "breath_cues": "string",
  "spring_settings": "string or null",
  "precautions": "string",
  "teaching_tips": "string",
  "muscle_groups": "string (from Purpose / muscle-target sections in source; otherwise say not specified)",
  "progressions": "string or null (prior/next exercises or progression table rows from source only)",
  "source_folder": "string"
}

If any field is not covered in source material: use null or "Not specified in your materials" (for progressions and rep_range, null is preferred when absent)

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

function normalizeProgressions(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null") return null;
  if (/^not specified/i.test(t)) return null;
  return t;
}

function normalizeRepRange(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null") return null;
  if (/^not specified/i.test(t)) return null;
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
    difficulty_level: assertString(o.difficulty_level, "difficulty_level"),
    rep_range: normalizeRepRange(o.rep_range),
    starting_position: assertString(o.starting_position, "starting_position"),
    movement_description: assertString(o.movement_description, "movement_description"),
    breath_cues: assertString(o.breath_cues, "breath_cues"),
    spring_settings: normalizeSpring(o.spring_settings),
    precautions: assertString(o.precautions, "precautions"),
    teaching_tips: assertString(o.teaching_tips, "teaching_tips"),
    muscle_groups: assertString(o.muscle_groups, "muscle_groups"),
    progressions: normalizeProgressions(o.progressions),
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

function scrubTutorialBodyField(s: string): string {
  return stripStandaloneLevelRepsLines(
    stripBalancedBodyExerciseHeadersFromText(s)
  ).trim();
}

function normalizeTutorialDisplayFields(
  base: Omit<TutorialContent, "error" | "manual_image">
): Omit<TutorialContent, "error" | "manual_image"> {
  return {
    ...base,
    exercise_name: formatExerciseNameForDisplay(base.exercise_name),
    starting_position: scrubTutorialBodyField(base.starting_position),
    movement_description: scrubTutorialBodyField(base.movement_description),
    breath_cues: scrubTutorialBodyField(base.breath_cues),
    precautions: scrubTutorialBodyField(base.precautions),
    teaching_tips: scrubTutorialBodyField(base.teaching_tips),
    muscle_groups: scrubTutorialBodyField(base.muscle_groups),
    progressions: base.progressions
      ? scrubTutorialBodyField(base.progressions)
      : null,
    spring_settings: base.spring_settings
      ? scrubTutorialBodyField(base.spring_settings)
      : null,
  };
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
  const { chunks, notFound } = await queryRAGWithContext(
    query,
    userId,
    [
      "purpose muscles targeted strengthen stretch",
      "progressions next exercise difficulty level",
      "session template beginner intermediate advanced",
      "reps repetitions intermediate beginner advanced level header",
    ]
  );

  if (notFound || chunks.length === 0) {
    return {
      error: RAG_ERROR,
      exercise_name: "",
      apparatus: "",
      difficulty_level: "",
      rep_range: null,
      starting_position: "",
      movement_description: "",
      breath_cues: "",
      spring_settings: null,
      precautions: "",
      teaching_tips: "",
      muscle_groups: "",
      progressions: null,
      source_folder: "",
    };
  }

  const sourceBlock = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${stripBalancedBodyExerciseHeadersFromText(c.content)}`
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
  const normalized = normalizeTutorialDisplayFields(base);

  return {
    ...normalized,
    manual_image: manual_image ?? null,
  };
}

/**
 * Exercise titles for the apparatus filter (authoritative Balanced Body manual TOC list).
 */
export async function getExerciseList(
  apparatus: string,
  _userId: string
): Promise<{ exercises: string[]; chunkCount: number }> {
  const trimmed = apparatus.trim();
  if (trimmed === "All") {
    const seen = new Set<string>();
    const all: string[] = [];
    for (const names of Object.values(EXERCISES_BY_APPARATUS)) {
      for (const name of names) {
        if (!seen.has(name)) {
          seen.add(name);
          all.push(name);
        }
      }
    }
    all.sort((a, b) => a.localeCompare(b));
    return { exercises: all, chunkCount: all.length };
  }
  if (isApparatusKey(trimmed)) {
    const exercises = EXERCISES_BY_APPARATUS[trimmed];
    return { exercises: [...exercises], chunkCount: exercises.length };
  }
  return { exercises: [], chunkCount: 0 };
}
