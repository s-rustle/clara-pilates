import type { IExerciseData, Muscle } from "react-body-highlighter";
import { MuscleType } from "react-body-highlighter";
import type { AnatomyDiagramMuscleId } from "@/lib/quiz/anatomyDiagramMuscles";

export type DiagramSide = "front" | "back";

/** RBH muscles that count as a Clara answer when clicked (others are ignored). */
const QUIZ_RBH_TO_CLARA: Partial<Record<Muscle, AnatomyDiagramMuscleId>> = {
  [MuscleType.ABS]: "Abdominals",
  [MuscleType.OBLIQUES]: "Core",
  [MuscleType.CHEST]: "Pectorals",
  [MuscleType.QUADRICEPS]: "Quadriceps",
  [MuscleType.ABDUCTORS]: "Hip Flexors",
  [MuscleType.FRONT_DELTOIDS]: "Shoulder Stabilizers",
  [MuscleType.TRAPEZIUS]: "Shoulder Stabilizers",
  [MuscleType.UPPER_BACK]: "Shoulder Stabilizers",
  [MuscleType.BACK_DELTOIDS]: "Latissimus Dorsi",
  [MuscleType.LOWER_BACK]: "Spinal Extensors",
  [MuscleType.GLUTEAL]: "Glutes",
  [MuscleType.HAMSTRING]: "Hamstrings",
  [MuscleType.ABDUCTOR]: "Adductors",
};

const FRONT_CLARA_TO_RBH: Partial<Record<AnatomyDiagramMuscleId, Muscle>> = {
  Abdominals: MuscleType.ABS,
  /** Spec: Core → abs (same center region as Abdominals on this model). */
  Core: MuscleType.ABS,
  Pectorals: MuscleType.CHEST,
  Quadriceps: MuscleType.QUADRICEPS,
  "Hip Flexors": MuscleType.ABDUCTORS,
  "Shoulder Stabilizers": MuscleType.FRONT_DELTOIDS,
};

const BACK_CLARA_TO_RBH: Partial<Record<AnatomyDiagramMuscleId, Muscle>> = {
  "Spinal Extensors": MuscleType.LOWER_BACK,
  Glutes: MuscleType.GLUTEAL,
  Hamstrings: MuscleType.HAMSTRING,
  "Shoulder Stabilizers": MuscleType.TRAPEZIUS,
  "Latissimus Dorsi": MuscleType.BACK_DELTOIDS,
  Adductors: MuscleType.ABDUCTOR,
  "Hip Rotators": MuscleType.GLUTEAL,
};

export function claraMuscleToRbh(
  clara: string,
  side: DiagramSide
): Muscle | null {
  const id = clara as AnatomyDiagramMuscleId;
  const map = side === "front" ? FRONT_CLARA_TO_RBH : BACK_CLARA_TO_RBH;
  return map[id] ?? null;
}

/** Null if this RBH region is not part of the 12 Clara quiz groups. */
export function rbhMuscleToClara(muscle: Muscle): AnatomyDiagramMuscleId | null {
  return QUIZ_RBH_TO_CLARA[muscle] ?? null;
}

export function buildHighlighterData(args: {
  side: DiagramSide;
  revealAnswer: boolean;
  correctMuscle?: string;
  selectedMuscle?: string;
}): { data: IExerciseData[]; highlightedColors: string[] } {
  const { side, revealAnswer, correctMuscle, selectedMuscle } = args;

  /** Clara accent (see tailwind `clara.accent`) — selected region on diagram */
  const FILL_SELECTED = "#D4A84B";
  const FILL_CORRECT = "#E8C84A";
  const FILL_INCORRECT = "#9B2335";

  if (revealAnswer) {
    const correctR = correctMuscle
      ? claraMuscleToRbh(correctMuscle, side)
      : null;
    const selR = selectedMuscle
      ? claraMuscleToRbh(selectedMuscle, side)
      : null;
    const wrongPick =
      selectedMuscle &&
      correctMuscle &&
      selectedMuscle !== correctMuscle;

    const data: IExerciseData[] = [];
    if (correctR) {
      data.push({ name: "correct", muscles: [correctR], frequency: 1 });
    }
    if (wrongPick && selR && selR !== correctR) {
      data.push({ name: "wrong", muscles: [selR], frequency: 2 });
    }

    const highlightedColors =
      wrongPick && selR && selR !== correctR
        ? [FILL_CORRECT, FILL_INCORRECT]
        : [FILL_CORRECT];

    return { data, highlightedColors };
  }

  if (selectedMuscle) {
    const s = claraMuscleToRbh(selectedMuscle, side);
    if (s) {
      return {
        data: [{ name: "selected", muscles: [s], frequency: 1 }],
        highlightedColors: [FILL_SELECTED],
      };
    }
  }

  return { data: [], highlightedColors: [] };
}
