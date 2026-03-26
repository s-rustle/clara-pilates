/** Shared options for AI session generation (client + server). */

export const GENERATE_PLAN_DURATIONS = [30, 45, 60, 75, 90] as const;
export type GeneratePlanDuration = (typeof GENERATE_PLAN_DURATIONS)[number];

export const GENERATE_PLAN_APPARATUS_VALUES = [
  "Mat",
  "Reformer",
  "Trapeze Cadillac",
  "Chair",
  "Barrels",
  "Tower",
  "Props",
] as const;

export type GeneratePlanApparatus = (typeof GENERATE_PLAN_APPARATUS_VALUES)[number];

const APPARATUS_LABELS: Record<GeneratePlanApparatus, string> = {
  Mat: "Mat",
  Reformer: "Reformer",
  "Trapeze Cadillac": "Cadillac",
  Chair: "Chair",
  Barrels: "Barrels",
  Tower: "Tower",
  Props: "Props",
};

export const GENERATE_PLAN_APPARATUS_OPTIONS = GENERATE_PLAN_APPARATUS_VALUES.map(
  (value) => ({ value, label: APPARATUS_LABELS[value] })
);

export const GENERATE_PLAN_FOCUS_AREAS = [
  "Core",
  "Spine mobility",
  "Hip stability",
  "Upper body",
  "Full body",
  "Flexibility",
] as const;

export const GENERATE_PLAN_SESSION_GOALS = [
  "Strength",
  "Rehabilitation",
  "Maintenance",
  "Assessment",
  "Introduction",
] as const;
