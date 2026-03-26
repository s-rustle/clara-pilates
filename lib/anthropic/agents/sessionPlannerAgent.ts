import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { stripBalancedBodyExerciseHeadersFromText } from "@/lib/curriculum/exerciseNames";
import { type GeneratePlanDuration } from "@/lib/sessions/generatePlanForm";
import { parseExerciseItems, parseWarmUpMoves } from "./sessions";
import type { ExerciseItem, RagChunk, SessionType, WarmUpMove } from "@/types";

const SESSION_PLANNER_MODEL = "claude-sonnet-4-20250514";

const FULL_SESSION_PLAN_SYSTEM = `You are a Balanced Body Comprehensive session planner for certified Pilates teachers.

NON-NEGOTIABLE ORDER OF WORK:
1) Read client_notes FIRST. Identify special populations (pregnancy trimester, postpartum, injury, osteoporosis, hypertension, scoliosis, balance/fall risk, cardiac/respiratory limits, diastasis, etc.).
2) INTERNALIZE contraindications and modifications before choosing ANY exercise. Do not pick exercises that violate those limits, then "fix" them later.
3) Design the full session in ONE pass with ergonomic sequencing: group by body position (supine, side-lying, seated, prone, quadruped, kneeling, standing) so you minimize unnecessary apparatus or mat transitions. Order exercises so the client flows logically — never "generate then critique."
4) Use only apparatus the teacher listed as available. If multiple stations are used, set "apparatus" on each main exercise to match.

STRUCTURE:
- warm_up: 2–3 moves (Pre-Pilates / prep). Each needs move_name, sets, reps, and "notes" with key cues.
- exercise_sequence: main work THEN 1–2 cool-down pieces at the END of the array (still as exercises, with notes marking cool-down intent). Each item: exercise_name, sets, reps, apparatus (string, one of the available list or closest match), "notes" with key teaching cues AND client-specific modifications.

TARGET VOLUMES BY duration_minutes (approximate total main slots including cool-down in exercise_sequence):
- 30 → 2–3 warm-up, ~4–5 main + 1 cool-down
- 45 → 2–3 warm-up, ~6–7 main + 1–2 cool-down
- 60 → 3 warm-up, ~8–10 main + 2 cool-down
- 75 → 3 warm-up, ~10–12 main + 2 cool-down
- 90 → 3 warm-up, ~12–14 main + 2 cool-down

Honor client_level (Beginner / Intermediate / Advanced), focus_area and session_goal when provided.

Ground exercise choices and order in retrieved curriculum chunks when they apply. If chunks are thin, choose conservative Balanced Body–aligned repertoire and avoid inventing elaborate choreography.

Return ONLY valid JSON — no markdown, no preamble:

{
  "why_this_plan": "string (2–3 sentences: why this sequence for this client profile)",
  "primary_apparatus": "string (must be exactly one of the apparatus_available list passed by the user — the main station for this session)",
  "warm_up": [ { "move_name": "string", "sets": number, "reps": number, "notes": "string" } ],
  "exercise_sequence": [
    { "exercise_name": "string", "apparatus": "string", "sets": number, "reps": number, "notes": "string" }
  ]
}

Exercise names: Title Case, not ALL CAPS manual headers. "notes" must always be non-empty on warm_up and exercise_sequence entries (include at least one concrete cue or modification).

${OUT_OF_SCOPE_INSTRUCTION}`;

function formatChunksForPrompt(chunks: RagChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${stripBalancedBodyExerciseHeadersFromText(c.content)}`
    )
    .join("\n\n---\n\n");
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Planner response did not contain valid JSON");
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Planner JSON root must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse planner response as JSON");
  }
}

export type { GeneratePlanDuration } from "@/lib/sessions/generatePlanForm";

export type GenerateFullPlanInput = {
  client_level: string;
  session_duration_minutes: GeneratePlanDuration;
  apparatus_available: string[];
  client_notes: string | null;
  focus_area: string | null;
  session_goal: string | null;
  session_type: SessionType;
};

export type GeneratedFullPlan = {
  why_this_plan: string;
  primary_apparatus: string;
  warm_up: WarmUpMove[];
  exercise_sequence: ExerciseItem[];
};

export async function generateFullSessionPlan(
  input: GenerateFullPlanInput,
  userId: string
): Promise<GeneratedFullPlan> {
  if (!input.apparatus_available.length) {
    throw new Error("At least one apparatus must be selected");
  }

  const ragQuery = [
    input.apparatus_available.join(" "),
    input.client_level,
    input.focus_area ?? "",
    input.session_goal ?? "",
    "Balanced Body session template sequencing progression",
    `minutes ${input.session_duration_minutes}`,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const { chunks } = await queryRAGWithContext(
    ragQuery,
    userId,
    [
      "session order warmup progression beginner intermediate advanced",
      "prenatal postpartum contraindication modification",
      "reformer mat cadillac chair exercise sequence",
    ],
    { folderFilter: null, minSimilarity: 0.4 }
  );

  const sourceBlock =
    chunks.length > 0
      ? formatChunksForPrompt(chunks)
      : "(No matching curriculum chunks retrieved. Choose conservative, widely taught Balanced Body repertoire; do not invent detailed choreography.)";

  const userMessage = `Plan inputs:
session_type: ${input.session_type}
client_level: ${input.client_level}
session_duration_minutes: ${input.session_duration_minutes}
apparatus_available (you MUST only use these; primary_apparatus must be one of them): ${JSON.stringify(input.apparatus_available)}
client_notes: ${input.client_notes?.trim() || "(none)"}
focus_area: ${input.focus_area ?? "(not specified)"}
session_goal: ${input.session_goal ?? "(not specified)"}

Curriculum context (ground selections and order here when relevant):
${sourceBlock}`;

  const response = await anthropic.messages.create({
    model: SESSION_PLANNER_MODEL,
    max_tokens: 8192,
    system: FULL_SESSION_PLAN_SYSTEM,
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

  const parsed = parseJsonObject(text);

  const whyRaw = parsed.why_this_plan;
  if (typeof whyRaw !== "string" || !whyRaw.trim()) {
    throw new Error("Invalid planner output: why_this_plan");
  }

  const primaryRaw = parsed.primary_apparatus;
  if (typeof primaryRaw !== "string" || !primaryRaw.trim()) {
    throw new Error("Invalid planner output: primary_apparatus");
  }
  const primary_apparatus = primaryRaw.trim();
  const allowed = new Set(input.apparatus_available.map((a) => a.trim()));
  if (!allowed.has(primary_apparatus)) {
    throw new Error(
      "Invalid planner output: primary_apparatus must be one of apparatus_available"
    );
  }

  const warm_up = parseWarmUpMoves(parsed.warm_up);
  const exercise_sequence = parseExerciseItems(parsed.exercise_sequence);

  if (warm_up.length < 2 || warm_up.length > 3) {
    throw new Error("Planner must return 2–3 warm-up moves (got " + warm_up.length + ")");
  }
  if (exercise_sequence.length < 4) {
    throw new Error("Planner must return a substantive main + cool-down sequence");
  }

  return {
    why_this_plan: whyRaw.trim(),
    primary_apparatus,
    warm_up,
    exercise_sequence,
  };
}
