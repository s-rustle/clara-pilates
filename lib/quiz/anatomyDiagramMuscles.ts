/**
 * Canonical muscle group labels for the interactive anatomy diagram quiz.
 * Must match `data-muscle` on SVG regions and examiner `target_muscle` output.
 */
export const ANATOMY_DIAGRAM_MUSCLE_IDS = [
  "Abdominals",
  "Spinal Extensors",
  "Glutes",
  "Hamstrings",
  "Quadriceps",
  "Hip Flexors",
  "Adductors",
  "Shoulder Stabilizers",
  "Latissimus Dorsi",
  "Pectorals",
  "Hip Rotators",
  "Core",
] as const;

export type AnatomyDiagramMuscleId = (typeof ANATOMY_DIAGRAM_MUSCLE_IDS)[number];

const LOWER = new Map(
  ANATOMY_DIAGRAM_MUSCLE_IDS.map((id) => [id.toLowerCase(), id])
);

/** Maps LLM output to canonical diagram id, or null if unknown. */
export function canonicalizeAnatomyDiagramMuscle(raw: string): AnatomyDiagramMuscleId | null {
  const t = raw.trim().toLowerCase();
  return LOWER.get(t) ?? null;
}

export const ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT = ANATOMY_DIAGRAM_MUSCLE_IDS.join(", ");
