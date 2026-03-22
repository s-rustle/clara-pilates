import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type {
  ExerciseItem,
  RagChunk,
  SessionFeedback,
  SessionMode,
  SessionType,
  WarmUpMove,
} from "@/types";

const SESSIONS_MODEL = "claude-sonnet-4-20250514";

const SESSION_EVALUATOR_SYSTEM = `You are a Balanced Body Comprehensive session evaluator
Evaluate the session across five dimensions grounded in source material
Standard rep range reference: 8-12 reps

When the source chunks describe program levels (Mat 1 / Mat 2 / Mat 3, Reformer 1 / 2 / 3), prerequisites, recommended order, movement patterns, session templates, or specific exercise progression tables, use them to judge progression_logic and sequence_alignment—not from general knowledge.

For progression_logic specifically, check whether: (1) warm-up progresses logically into the main sequence; (2) exercises are ordered by difficulty (easier → harder) where the material implies levels; (3) the sequence matches a known Balanced Body session template for the stated client level (Beginner, Intermediate, Advanced, Prenatal, etc.) when templates appear in the chunks; (4) muscle groups or themes are concentrated and built upon progressively. If the chunks include a matching session template (e.g. "Advanced Session"), name it explicitly in your feedback.

Return ONLY valid JSON — no markdown, no preamble:

{
  "progression_logic": { "score": "sound|needs_adjustment", "note": "string" },
  "contraindication_flags": { "score": "none|flagged", "flags": [{"exercise_name": "string", "flag": "string", "recommendation": "string"}] },
  "volume_assessment": { "score": "appropriate|needs_adjustment", "note": "string", "flagged_exercises": [] },
  "muscle_group_balance": { "score": "balanced|imbalanced", "note": "string", "gaps": [] },
  "sequence_alignment": { "score": "aligned|partially_aligned|not_verified", "note": "string" },
  "overall": "string",
  "suggested_adjustments": ["string"]
}

If source material not found for an exercise: flag as 'not_verified' rather than invent

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

const SESSION_MODES: SessionMode[] = ["plan", "log"];
const SESSION_TYPES: SessionType[] = ["teaching", "personal"];

function isSessionMode(v: unknown): v is SessionMode {
  return typeof v === "string" && SESSION_MODES.includes(v as SessionMode);
}

function isSessionType(v: unknown): v is SessionType {
  return typeof v === "string" && SESSION_TYPES.includes(v as SessionType);
}

function parseWarmUpMoves(raw: unknown): WarmUpMove[] {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid field: warm_up (expected array)");
  }
  const out: WarmUpMove[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid warm_up entry");
    }
    const o = item as Record<string, unknown>;
    if (
      typeof o.move_name !== "string" ||
      typeof o.sets !== "number" ||
      Number.isNaN(o.sets) ||
      typeof o.reps !== "number" ||
      Number.isNaN(o.reps)
    ) {
      throw new Error("Invalid warm_up entry: move_name, sets, and reps required");
    }
    out.push({ move_name: o.move_name, sets: o.sets, reps: o.reps });
  }
  return out;
}

function parseExerciseItems(raw: unknown): ExerciseItem[] {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid field: exercise_sequence (expected array)");
  }
  const out: ExerciseItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid exercise_sequence entry");
    }
    const o = item as Record<string, unknown>;
    if (
      typeof o.exercise_name !== "string" ||
      typeof o.sets !== "number" ||
      Number.isNaN(o.sets) ||
      typeof o.reps !== "number" ||
      Number.isNaN(o.reps)
    ) {
      throw new Error(
        "Invalid exercise_sequence entry: exercise_name, sets, and reps required"
      );
    }
    const row: ExerciseItem = {
      exercise_name: o.exercise_name,
      sets: o.sets,
      reps: o.reps,
    };
    if (o.notes !== undefined) {
      if (typeof o.notes !== "string") {
        throw new Error("Invalid exercise_sequence entry: notes must be a string");
      }
      row.notes = o.notes;
    }
    out.push(row);
  }
  return out;
}

function parseSessionEvaluationInput(raw: unknown): {
  mode: SessionMode;
  session_type: SessionType;
  apparatus: string;
  client_level?: string;
  warm_up: WarmUpMove[];
  exercise_sequence: ExerciseItem[];
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Missing required field: session payload");
  }
  const b = raw as Record<string, unknown>;

  if (!isSessionMode(b.mode)) {
    throw new Error("Missing or invalid field: mode");
  }
  if (!isSessionType(b.session_type)) {
    throw new Error("Missing or invalid field: session_type");
  }
  if (!b.apparatus || typeof b.apparatus !== "string") {
    throw new Error("Missing required field: apparatus");
  }

  let client_level: string | undefined;
  if (b.client_level !== undefined && b.client_level !== null) {
    if (typeof b.client_level !== "string") {
      throw new Error("Invalid field: client_level");
    }
    client_level = b.client_level;
  }

  const warm_up = parseWarmUpMoves(b.warm_up);
  const exercise_sequence = parseExerciseItems(b.exercise_sequence);

  return {
    mode: b.mode,
    session_type: b.session_type,
    apparatus: b.apparatus,
    client_level,
    warm_up,
    exercise_sequence,
  };
}

function assertString(v: unknown, path: string): asserts v is string {
  if (typeof v !== "string") {
    throw new Error(`Invalid SessionFeedback from model: ${path} must be a string`);
  }
}

function validateSessionFeedback(raw: unknown): SessionFeedback {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid SessionFeedback from model: root must be an object");
  }
  const o = raw as Record<string, unknown>;

  const pl = o.progression_logic;
  if (!pl || typeof pl !== "object") {
    throw new Error("Invalid SessionFeedback from model: progression_logic");
  }
  const plObj = pl as Record<string, unknown>;
  assertString(plObj.score, "progression_logic.score");
  assertString(plObj.note, "progression_logic.note");

  const cf = o.contraindication_flags;
  if (!cf || typeof cf !== "object") {
    throw new Error("Invalid SessionFeedback from model: contraindication_flags");
  }
  const cfObj = cf as Record<string, unknown>;
  assertString(cfObj.score, "contraindication_flags.score");
  if (!Array.isArray(cfObj.flags)) {
    throw new Error("Invalid SessionFeedback from model: contraindication_flags.flags");
  }
  for (const f of cfObj.flags) {
    if (!f || typeof f !== "object") {
      throw new Error("Invalid SessionFeedback from model: contraindication_flags.flags entry");
    }
    const fe = f as Record<string, unknown>;
    assertString(fe.exercise_name, "flag.exercise_name");
    assertString(fe.flag, "flag.flag");
    assertString(fe.recommendation, "flag.recommendation");
  }

  const va = o.volume_assessment;
  if (!va || typeof va !== "object") {
    throw new Error("Invalid SessionFeedback from model: volume_assessment");
  }
  const vaObj = va as Record<string, unknown>;
  assertString(vaObj.score, "volume_assessment.score");
  assertString(vaObj.note, "volume_assessment.note");
  if (!Array.isArray(vaObj.flagged_exercises)) {
    throw new Error("Invalid SessionFeedback from model: volume_assessment.flagged_exercises");
  }
  for (const x of vaObj.flagged_exercises) {
    if (typeof x !== "string") {
      throw new Error(
        "Invalid SessionFeedback from model: volume_assessment.flagged_exercises must be strings"
      );
    }
  }

  const mb = o.muscle_group_balance;
  if (!mb || typeof mb !== "object") {
    throw new Error("Invalid SessionFeedback from model: muscle_group_balance");
  }
  const mbObj = mb as Record<string, unknown>;
  assertString(mbObj.score, "muscle_group_balance.score");
  assertString(mbObj.note, "muscle_group_balance.note");
  if (!Array.isArray(mbObj.gaps)) {
    throw new Error("Invalid SessionFeedback from model: muscle_group_balance.gaps");
  }
  for (const g of mbObj.gaps) {
    if (typeof g !== "string") {
      throw new Error(
        "Invalid SessionFeedback from model: muscle_group_balance.gaps must be strings"
      );
    }
  }

  const sa = o.sequence_alignment;
  if (!sa || typeof sa !== "object") {
    throw new Error("Invalid SessionFeedback from model: sequence_alignment");
  }
  const saObj = sa as Record<string, unknown>;
  assertString(saObj.score, "sequence_alignment.score");
  assertString(saObj.note, "sequence_alignment.note");

  assertString(o.overall, "overall");
  if (!Array.isArray(o.suggested_adjustments)) {
    throw new Error("Invalid SessionFeedback from model: suggested_adjustments");
  }
  for (const adj of o.suggested_adjustments) {
    if (typeof adj !== "string") {
      throw new Error(
        "Invalid SessionFeedback from model: suggested_adjustments must be strings"
      );
    }
  }

  return raw as SessionFeedback;
}

export type SessionEvaluationInput = {
  mode: SessionMode;
  session_type: SessionType;
  apparatus: string;
  client_level?: string;
  warm_up: WarmUpMove[];
  exercise_sequence: ExerciseItem[];
};

/**
 * Evaluates a session plan against curriculum RAG context and returns structured feedback.
 */
export async function evaluateSession(
  sessionData: unknown,
  userId: string
): Promise<SessionFeedback> {
  const input = parseSessionEvaluationInput(sessionData);

  const exerciseNames = input.exercise_sequence.map((e) => e.exercise_name);
  const ragQuery = [
    input.apparatus,
    exerciseNames.join(" "),
    "Balanced Body sequencing progression order muscle groups",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const { chunks } = await queryRAGWithContext(
    ragQuery,
    userId,
    [
      "specific exercise progressions sequence order difficulty",
      "session template beginner intermediate advanced prenatal",
      "purpose muscles strengthen stretch",
    ],
    { folderFilter: null, minSimilarity: 0.42 }
  );
  const sourceBlock =
    chunks.length > 0
      ? formatChunksForPrompt(chunks)
      : "(No matching curriculum chunks retrieved. Use sequence_alignment score not_verified and do not invent exercise details.)";

  const userMessage = `Session to evaluate:

mode: ${input.mode}
session_type: ${input.session_type}
apparatus: ${input.apparatus}
client_level: ${input.client_level ?? "(not specified)"}

warm_up:
${JSON.stringify(input.warm_up, null, 2)}

exercise_sequence:
${JSON.stringify(input.exercise_sequence, null, 2)}

Source material (ground claims only here; gaps imply not_verified):
${sourceBlock}`;

  const response = await anthropic.messages.create({
    model: SESSIONS_MODEL,
    max_tokens: 4096,
    system: SESSION_EVALUATOR_SYSTEM,
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
  return validateSessionFeedback(parsed);
}
