import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { stripBalancedBodyExerciseHeadersFromText } from "@/lib/curriculum/exerciseNames";
import { validateSessionFeedback } from "@/lib/sessionFeedback/validate";
import type {
  ExerciseItem,
  RagChunk,
  SessionFeedback,
  SessionMode,
  SessionType,
  WarmUpMove,
} from "@/types";

const SESSIONS_MODEL = "claude-sonnet-4-20250514";

const SESSION_EVALUATOR_SYSTEM = `CRITICAL: Your response must be a single valid JSON object containing ALL of the following top-level keys: special_populations, alignment_and_form, breathing, cueing_clarity, client_progression, safety, session_flow_ergonomics, overall, suggested_adjustments. Omitting any key is an error.

You are a Balanced Body Comprehensive session evaluator.
Before any other dimension, reason about SPECIAL POPULATIONS from client_notes (and exercise/teaching notes when relevant).
Then evaluate six pedagogical dimensions (the first five plus session flow & ergonomics), grounded in the source material when it applies.
Standard rep range reference: 8-12 reps.

STEP 0 — SPECIAL POPULATIONS (always output "special_populations" first in your reasoning, but include it in the JSON as shown)
- Scan client_notes for flags: pregnancy trimester or month, postpartum, acute injury, chronic conditions (e.g. osteoporosis, hypertension, scoliosis), balance or fall risk, cardiac or respiratory limits, diastasis, age-related frailty, etc.
- If nothing relevant: set special_populations.applies to false; use empty arrays and "" where strings are required; trimester_or_condition_notes null.
- If something relevant: set applies true; fill flags_detected with short labels (e.g. "Third trimester pregnancy", "Osteoporosis").
- contraindications_this_session: what matters FOR THIS SUBMITTED warm-up + exercise_sequence (not a generic textbook list).
- exercises_modify_or_remove: concrete items (match submitted move/exercise names) to change, regress, or omit for this client context.
- curriculum_substitutions: Balanced Body–appropriate alternatives; ground in retrieved chunks when possible. If chunks do not name a substitution, recommend conservative Balanced Body vocabulary (e.g. supported standing, side-lying, reduced flexion) and mark limits in the note rather than inventing a precise exercise name.
- trimester_or_condition_notes: concise guidance (e.g. third trimester: limit prolonged supine after ~20 weeks; avoid strong supine compressions, deep spinal rotation, and prolonged prone; avoid Valsalva; cue for diastasis and blood pressure symptoms; modify flexion load as appropriate). Tailor to detected flags.

Dimensions 1–5:
1) alignment_and_form — joint alignment, stability, and movement quality implied by the exercise list and notes.
2) breathing — breath cues or pattern fit; flag if absent when the repertoire expects it.
3) cueing_clarity — teaching notes specific enough for a student teacher.
4) client_progression — warm-up → main work → cool-down arc, difficulty order, template fit for client level using chunk evidence when present.
5) safety — precautions, contraindications, volume; use "flags" for per-exercise concerns.

Dimension 6 — session_flow_ergonomics:
- Infer a primary body position per main exercise (and mention warm-up in the note if needed): supine, prone, side_lying, seated, standing, kneeling, quadruped, or other/transition.
- Flag unnecessary position changes between consecutive exercises when the same goals could be achieved by batching same-position work (e.g. prone → supine → prone without a deliberate reason).
- suggested_reorder MUST be an ordered list of exercise names (strings) covering EVERY exercise in the submitted exercise_sequence exactly once, in a order that minimizes transitions while preserving a sensible warm-up → main work → cool-down arc. Use the same spelling/casing as submitted names when possible. If reorder is already optimal, echo the current sequence.
- transition_issues: short bullets naming the problem pairs or ranges (e.g. "Exercises 3–4: prone → supine then back to prone").

When chunks describe program levels, templates, prerequisites, or sequencing, use them for client_progression, safety, and substitutions—do not invent from general knowledge alone.

Return ONLY valid JSON — no markdown, no preamble.
The JSON object MUST include exactly these nine top-level keys in any order: special_populations, alignment_and_form, breathing, cueing_clarity, client_progression, safety, session_flow_ergonomics, overall, suggested_adjustments.

{
  "special_populations": {
    "applies": boolean,
    "flags_detected": ["string"],
    "contraindications_this_session": "string",
    "exercises_modify_or_remove": ["string"],
    "curriculum_substitutions": ["string"],
    "trimester_or_condition_notes": "string or null"
  },
  "alignment_and_form": { "score": "sound|needs_adjustment|not_verified", "note": "string" },
  "breathing": { "score": "sound|needs_adjustment|not_verified", "note": "string" },
  "cueing_clarity": { "score": "clear|needs_refinement|not_verified", "note": "string" },
  "client_progression": { "score": "sound|needs_adjustment|not_verified", "note": "string" },
  "safety": {
    "score": "appropriate|caution|not_verified",
    "note": "string",
    "flags": [{"exercise_name": "string", "concern": "string", "recommendation": "string"}]
  },
  "session_flow_ergonomics": {
    "score": "sound|needs_adjustment|not_verified",
    "note": "string",
    "transition_issues": ["string"],
    "suggested_reorder": ["string"]
  },
  "overall": "string",
  "suggested_adjustments": ["string"]
}

Do not omit special_populations or session_flow_ergonomics. If neither applies, still return them with applies false / empty arrays and sound or not_verified scores as appropriate.

If source material is missing for a claim, use not_verified on that dimension.

Exercise names in safety.flags: Title Case, not ALL CAPS manual headers.

${OUT_OF_SCOPE_INSTRUCTION}`;

const SESSION_DRAFT_GENERATOR_SYSTEM = `You are a Balanced Body Comprehensive educator. Propose one teaching-ready session draft (warm-up + main sequence) for the apparatus and client context given.

If client_notes mention contraindications, pain, or pathology, choose conservative selections and document modifications in exercise "notes".

Return ONLY valid JSON — no markdown, no preamble:

{
  "warm_up": [ { "move_name": "string", "sets": number, "reps": number } ],
  "exercise_sequence": [ { "exercise_name": "string", "sets": number, "reps": number, "notes"?: "string" } ]
}

At least 2 warm-up moves and at least 4 main exercises. Each main exercise should include "notes" with at least one concrete cue.

${OUT_OF_SCOPE_INSTRUCTION}`;

function formatChunksForPrompt(chunks: RagChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${stripBalancedBodyExerciseHeadersFromText(c.content)}`
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

export function parseWarmUpMoves(raw: unknown): WarmUpMove[] {
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
    const row: WarmUpMove = { move_name: o.move_name, sets: o.sets, reps: o.reps };
    if (o.notes !== undefined) {
      if (typeof o.notes !== "string") {
        throw new Error("Invalid warm_up entry: notes must be a string");
      }
      const n = o.notes.trim();
      if (n) row.notes = n;
    }
    out.push(row);
  }
  return out;
}

export function parseExerciseItems(raw: unknown): ExerciseItem[] {
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
    if (o.apparatus !== undefined && o.apparatus !== null) {
      if (typeof o.apparatus !== "string") {
        throw new Error("Invalid exercise_sequence entry: apparatus must be a string");
      }
      const a = o.apparatus.trim();
      if (a) row.apparatus = a;
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
  client_notes?: string | null;
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

  let client_notes: string | null | undefined;
  if (b.client_notes !== undefined && b.client_notes !== null) {
    if (typeof b.client_notes !== "string") {
      throw new Error("Invalid field: client_notes");
    }
    client_notes = b.client_notes;
  }

  const warm_up = parseWarmUpMoves(b.warm_up);
  const exercise_sequence = parseExerciseItems(b.exercise_sequence);

  return {
    mode: b.mode,
    session_type: b.session_type,
    apparatus: b.apparatus,
    client_level,
    client_notes,
    warm_up,
    exercise_sequence,
  };
}

export type SessionDraftInput = {
  apparatus: string;
  client_level: string | null;
  session_type: SessionType;
  client_notes?: string | null;
};

/**
 * AI-generated warm-up and exercise sequence (user may edit before saving).
 */
export async function generateSessionDraft(
  input: SessionDraftInput
): Promise<{ warm_up: WarmUpMove[]; exercise_sequence: ExerciseItem[] }> {
  const userMessage = `apparatus: ${input.apparatus}
session_type: ${input.session_type}
client_level: ${input.client_level ?? "(not specified)"}
client_notes: ${input.client_notes?.trim() || "(none)"}`;

  const response = await anthropic.messages.create({
    model: SESSIONS_MODEL,
    max_tokens: 4096,
    system: SESSION_DRAFT_GENERATOR_SYSTEM,
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

  const parsed = parseJsonFromResponse<Record<string, unknown>>(text);
  const warm_up = parseWarmUpMoves(parsed.warm_up);
  const exercise_sequence = parseExerciseItems(parsed.exercise_sequence);
  return { warm_up, exercise_sequence };
}

export type SessionEvaluationInput = {
  mode: SessionMode;
  session_type: SessionType;
  apparatus: string;
  client_level?: string;
  client_notes?: string | null;
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
client_notes: ${input.client_notes?.trim() || "(none)"}

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
