import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { createServiceClient } from "@/lib/supabase/server";
import type { RagChunk, TutorialContent } from "@/types";

const LEARN_MODEL = "claude-sonnet-4-20250514";

const LEARN_SYSTEM = `You are Clara, a Balanced Body Pilates instructor teaching in tutorial mode
Teach the exercise step by step using only the provided source material
Be precise — use exact Balanced Body terminology, exercise names, and anatomical language
Manuals often use an exercise header: large ALL CAPS title, then a line like "INTERMEDIATE • 4-6 REPS". When **LEVEL:** or **REPS:** (or equivalent) appears in the chunks, copy those facts exactly into difficulty_level and rep_range.
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

/** Explicit tags from ingestion (PDF / vision). */
const EXERCISE_TAGGED =
  /\*\*EXERCISE:\s*\[([^\]\*]+)\]\*\*/gi;
const EXERCISE_TAGGED_UNBRACKETED =
  /\*\*EXERCISE:\s*([^*\n]+?)\*\*/gi;

/** Other **bold** spans in manuals (exercise names); exclude section labels. */
const BOLD_SPAN = /\*\*([^*]{2,100})\*\*/g;

const BOLD_SECTION_PREFIX =
  /^(EXERCISE|PURPOSE|MOVEMENT|LEVEL|PRECAUTIONS|BREATH|SESSION|PROGRESSION|SPRING|STARTING|NOTES?|TIPS?)\b/i;

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

/** Full-line (normalized) all-caps headers to skip — not exercise titles. */
const IGNORE_ALL_CAPS_LINES = new Set(
  [
    "STARTING POSITION",
    "MOVEMENT SEQUENCE",
    "MOVEMENT",
    "PURPOSE",
    "BREATH",
    "PROGRESSIONS",
    "SPRING SETTINGS",
    "SESSION TEMPLATE",
    "PROGRESSION TABLE",
    "SEQUENCE",
    "LEVEL",
    "ARM VARIATIONS",
    "REPS",
    "ADVANCED",
    "BEGINNER",
    "INTERMEDIATE",
    "PRECAUTIONS",
    "NOTES",
    "TIPS",
    "INHALE",
    "EXHALE",
    "HANDWRITTEN NOTE",
  ].map((s) => s.toUpperCase())
);

/**
 * If every token on the line is one of these, treat as non-title (section junk).
 * Single-word lines like "SIDE" still need at least one non-ignore token for multi-word titles.
 */
const IGNORE_ALL_CAPS_TOKENS = new Set(
  [
    "STARTING",
    "POSITION",
    "MOVEMENT",
    "SEQUENCE",
    "ARM",
    "VARIATIONS",
    "REPS",
    "REP",
    "ADVANCED",
    "BEGINNER",
    "INTERMEDIATE",
    "PRECAUTIONS",
    "PURPOSE",
    "PROGRESSIONS",
    "PROGRESSION",
    "TABLE",
    "SESSION",
    "TEMPLATE",
    "SEQUENCE",
    "SPRING",
    "SETTINGS",
    "BREATH",
    "LEVEL",
    "MOVEMENT",
    "NOTES",
    "TIPS",
    "INHALE",
    "EXHALE",
    "HANDWRITTEN",
    "NOTE",
    "THE",
    "AND",
    "OR",
    "OF",
    "TO",
    "IN",
    "FOR",
    "A",
    "AN",
    "FIG",
    "FIGURE",
    "PAGE",
    "SEE",
  ].map((s) => s.toUpperCase())
);

/** EXERCISE NAME followed by level / rep cue (whole-line or substring). */
const LEVEL_SUFFIX =
  /\s+(ADVANCED|BEGINNER|INTERMEDIATE|(\d+\s*[-–]\s*\d+\s*REPS?))\s*$/i;

function plausibleExerciseTitle(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 100) return false;
  if (/^\d+$/.test(t)) return false;
  const lower = t.toLowerCase();
  if (TITLE_STOP.has(lower)) return false;
  if (/^chunk\s*\d/i.test(t)) return false;
  if (/^exercise:\s*/i.test(t)) return false;
  return true;
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isAllCapsLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 88) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (/[a-z]/.test(t)) return false;
  return /^[A-Z0-9'’\s.,&\-–—]+$/u.test(t);
}

function shouldSkipAllCapsLine(line: string): boolean {
  const u = normalizeSpaces(line).toUpperCase();
  if (IGNORE_ALL_CAPS_LINES.has(u)) return true;
  const tokens = u.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.every((tok) => IGNORE_ALL_CAPS_TOKENS.has(tok))) return true;
  return false;
}

const BANNED_TITLE_LINE_START =
  /^(The|This|When|For|If|In|As|At|To|On|Your|Use|Keep|Repeat|Note|See|Figure|Chapter|Table|Each|Both|Place|Hold|Start|Begin|With|From|After|Before|During|Do|Never|Always|There|These|Those|Some|Many|Most|All|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/i;

/** Per-token Title Case, including hyphenated exercise names (e.g. Sit-Up, Side-to-Side). */
function isTitleCaseExerciseToken(w: string): boolean {
  if (/^\d+([-–]\d+)?$/.test(w)) return true;
  const segments = w.split("-");
  for (const seg of segments) {
    if (!seg.length) return false;
    if (!/^[A-Z][a-z0-9']{0,28}$/.test(seg)) return false;
  }
  return segments.length > 0;
}

/** Balanced Body PDFs often use Title Case exercise headings (not ALL CAPS). */
function isLikelyTitleCaseExerciseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 8 || t.length > 78) return false;
  if (/^\d+[\.)]\s/.test(t)) return false;
  if (/^[\W\d]/.test(t)) return false;
  const words = normalizeSpaces(t).split(/\s+/);
  if (words.length < 2 || words.length > 8) return false;
  if (BANNED_TITLE_LINE_START.test(words[0])) return false;
  for (const w of words) {
    if (!isTitleCaseExerciseToken(w)) return false;
  }
  return true;
}

/** Strip trailing page refs / ellipsis from numbered manual lines. */
function stripNumberedLineNoise(s: string): string {
  let t = normalizeSpaces(s.replace(/\*+/g, "").trim());
  t = t.replace(/\s*\.{2,}.*$/, "").trim();
  t = t.replace(/\s*[-–—]\s*p\.?\s*\d+.*$/i, "").trim();
  return t;
}

/** Lines like "1. Roll Down" or "12) Side Sit Up" (common in pdf-parse output). */
function titleFromNumberedLine(line: string): string | null {
  const trimmed = line.trim();
  const dotted = /^\s*\d{1,2}[\.)]\s+(.+)$/.exec(trimmed);
  if (dotted) {
    const inner = stripNumberedLineNoise(dotted[1]);
    return inner.length >= 3 ? inner : null;
  }
  const spaced = /^\s*\d{1,2}\s+([A-Z][^\n]{2,90})$/.exec(trimmed);
  if (spaced) {
    const inner = stripNumberedLineNoise(spaced[1]);
    return inner.length >= 3 ? inner : null;
  }
  return null;
}

function stripLevelSuffix(s: string): string {
  let t = normalizeSpaces(s);
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(LEVEL_SUFFIX, "").trim();
  }
  return t;
}

function extractFromExerciseLevelPattern(text: string, seen: Set<string>, out: string[]): void {
  const re =
    /(^|\n)\s*([A-Z][A-Z0-9'’\s\-–—]{1,70}?)\s+(ADVANCED|BEGINNER|INTERMEDIATE|\d+\s*[-–]\s*\d+\s*REPS?)\s*(?=\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = normalizeSpaces(m[2]);
    if (raw.length < 2) continue;
    const base = stripLevelSuffix(raw);
    if (base.length < 2 || shouldSkipAllCapsLine(base)) continue;
    const key = base.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(base);
  }
}

export function extractExerciseNamesFromContents(contents: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const pushTitle = (raw: string) => {
    const name = normalizeSpaces(raw);
    if (!plausibleExerciseTitle(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  for (const text of contents) {
    if (!text) continue;

    EXERCISE_TAGGED.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EXERCISE_TAGGED.exec(text)) !== null) {
      pushTitle(m[1]);
    }

    EXERCISE_TAGGED_UNBRACKETED.lastIndex = 0;
    while ((m = EXERCISE_TAGGED_UNBRACKETED.exec(text)) !== null) {
      const inner = m[1].trim();
      const unbracket = inner.replace(/^\[|\]$/g, "").trim();
      pushTitle(unbracket);
    }

    extractFromExerciseLevelPattern(text, seen, out);

    BOLD_SPAN.lastIndex = 0;
    while ((m = BOLD_SPAN.exec(text)) !== null) {
      const inner = normalizeSpaces(m[1].trim());
      if (/^exercise:\s*/i.test(inner)) continue;
      if (BOLD_SECTION_PREFIX.test(inner)) continue;
      pushTitle(inner);
    }

    const lines = text.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const numberedTitle = titleFromNumberedLine(trimmed);
      if (numberedTitle) {
        pushTitle(numberedTitle);
        continue;
      }
      if (isAllCapsLine(trimmed)) {
        if (shouldSkipAllCapsLine(trimmed)) continue;
        const wc = normalizeSpaces(trimmed).split(/\s+/).filter(Boolean).length;
        const base = stripLevelSuffix(trimmed);
        if (wc >= 2) {
          if (
            base.length >= 2 &&
            isAllCapsLine(base) &&
            !shouldSkipAllCapsLine(base) &&
            normalizeSpaces(base).split(/\s+/).filter(Boolean).length >= 2
          ) {
            pushTitle(base);
          }
        } else if (wc === 1) {
          const tok = normalizeSpaces(base);
          if (
            tok.length >= 5 &&
            tok.length <= 36 &&
            isAllCapsLine(tok) &&
            !shouldSkipAllCapsLine(tok)
          ) {
            pushTitle(tok);
          }
        }
      } else if (isLikelyTitleCaseExerciseLine(trimmed)) {
        pushTitle(trimmed);
      }
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
): Promise<{ exercises: string[]; chunkCount: number }> {
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
      } else if (apparatus === "Barrels") {
        // Matches "Barrels", "Arc Barrel", "Ladder Barrel", etc. (substring "Barrel").
        q = q.ilike("folder_name", "%Barrel%");
      } else if (apparatus === "Trapeze Cadillac") {
        q = q.ilikeAnyOf("folder_name", ["%Trapeze%", "%Cadillac%"]);
      } else {
        const needle = apparatus.replace(/%/g, "\\%").replace(/_/g, "\\_");
        q = q.ilike("folder_name", `%${needle}%`);
      }
    }

    const { data, error } = await q
      .order("file_name", { ascending: true })
      .order("chunk_index", { ascending: true })
      .limit(1200);

    if (error) {
      console.error("[learn] getExerciseList query failed:", error.message);
      return { exercises: [], chunkCount: 0 };
    }

    const rows = data ?? [];
    const contents = rows.map(
      (row) => (row as { content: string | null }).content ?? ""
    );
    return {
      exercises: extractExerciseNamesFromContents(contents),
      chunkCount: rows.length,
    };
  } catch (err) {
    console.error("[learn] getExerciseList failed:", err);
    return { exercises: [], chunkCount: 0 };
  }
}
