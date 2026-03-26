import type {
  SessionFeedback,
  SessionFlowErgonomics,
  SessionSpecialPopulationsWarning,
} from "@/types";

function assertString(v: unknown, path: string): asserts v is string {
  if (typeof v !== "string") {
    throw new Error(`Invalid SessionFeedback from model: ${path} must be a string`);
  }
}

function validateDimension2(raw: unknown, name: string): void {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid SessionFeedback from model: ${name}`);
  }
  const d = raw as Record<string, unknown>;
  assertString(d.score, `${name}.score`);
  assertString(d.note, `${name}.note`);
}

export function defaultSpecialPopulations(): SessionSpecialPopulationsWarning {
  return {
    applies: false,
    flags_detected: [],
    contraindications_this_session: "",
    exercises_modify_or_remove: [],
    curriculum_substitutions: [],
    trimester_or_condition_notes: null,
  };
}

export function defaultSessionFlowErgonomics(): SessionFlowErgonomics {
  return {
    score: "not_verified",
    note: "",
    transition_issues: [],
    suggested_reorder: [],
  };
}

function coerceStringArray(v: unknown, path: string): string[] {
  if (!Array.isArray(v)) {
    throw new Error(`Invalid SessionFeedback from model: ${path} must be an array`);
  }
  for (const item of v) {
    if (typeof item !== "string") {
      throw new Error(`Invalid SessionFeedback from model: ${path} must be strings`);
    }
  }
  return v;
}

function validateSpecialPopulations(
  raw: unknown,
  path: string
): SessionSpecialPopulationsWarning {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid SessionFeedback from model: ${path}`);
  }
  const sp = raw as Record<string, unknown>;
  if (typeof sp.applies !== "boolean") {
    throw new Error(`Invalid SessionFeedback from model: ${path}.applies must be a boolean`);
  }
  const flags_detected = coerceStringArray(sp.flags_detected, `${path}.flags_detected`);
  assertString(
    sp.contraindications_this_session,
    `${path}.contraindications_this_session`
  );
  const exercises_modify_or_remove = coerceStringArray(
    sp.exercises_modify_or_remove,
    `${path}.exercises_modify_or_remove`
  );
  const curriculum_substitutions = coerceStringArray(
    sp.curriculum_substitutions,
    `${path}.curriculum_substitutions`
  );
  let trimester_or_condition_notes: string | null = null;
  if (sp.trimester_or_condition_notes !== undefined && sp.trimester_or_condition_notes !== null) {
    assertString(
      sp.trimester_or_condition_notes,
      `${path}.trimester_or_condition_notes`
    );
    trimester_or_condition_notes = sp.trimester_or_condition_notes;
  }
  return {
    applies: sp.applies,
    flags_detected,
    contraindications_this_session: sp.contraindications_this_session,
    exercises_modify_or_remove,
    curriculum_substitutions,
    trimester_or_condition_notes,
  };
}

function validateFlowErgonomics(raw: unknown, path: string): SessionFlowErgonomics {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid SessionFeedback from model: ${path}`);
  }
  const f = raw as Record<string, unknown>;
  assertString(f.score, `${path}.score`);
  assertString(f.note, `${path}.note`);
  const transition_issues = coerceStringArray(f.transition_issues, `${path}.transition_issues`);
  const suggested_reorder = coerceStringArray(f.suggested_reorder, `${path}.suggested_reorder`);
  return {
    score: f.score,
    note: f.note,
    transition_issues,
    suggested_reorder,
  };
}

export function validateSessionFeedback(raw: unknown): SessionFeedback {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid SessionFeedback from model: root must be an object");
  }
  const o = raw as Record<string, unknown>;

  const special_populations =
    o.special_populations !== undefined && o.special_populations !== null
      ? validateSpecialPopulations(o.special_populations, "special_populations")
      : defaultSpecialPopulations();

  validateDimension2(o.alignment_and_form, "alignment_and_form");
  validateDimension2(o.breathing, "breathing");
  validateDimension2(o.cueing_clarity, "cueing_clarity");
  validateDimension2(o.client_progression, "client_progression");

  const sf = o.safety;
  if (!sf || typeof sf !== "object") {
    throw new Error("Invalid SessionFeedback from model: safety");
  }
  const sfObj = sf as Record<string, unknown>;
  assertString(sfObj.score, "safety.score");
  assertString(sfObj.note, "safety.note");
  if (!Array.isArray(sfObj.flags)) {
    throw new Error("Invalid SessionFeedback from model: safety.flags");
  }
  for (const f of sfObj.flags) {
    if (!f || typeof f !== "object") {
      throw new Error("Invalid SessionFeedback from model: safety.flags entry");
    }
    const fe = f as Record<string, unknown>;
    assertString(fe.exercise_name, "safety.flag.exercise_name");
    assertString(fe.concern, "safety.flag.concern");
    assertString(fe.recommendation, "safety.flag.recommendation");
  }

  const session_flow_ergonomics =
    o.session_flow_ergonomics !== undefined && o.session_flow_ergonomics !== null
      ? validateFlowErgonomics(o.session_flow_ergonomics, "session_flow_ergonomics")
      : defaultSessionFlowErgonomics();

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

  return {
    special_populations,
    alignment_and_form: o.alignment_and_form as SessionFeedback["alignment_and_form"],
    breathing: o.breathing as SessionFeedback["breathing"],
    cueing_clarity: o.cueing_clarity as SessionFeedback["cueing_clarity"],
    client_progression: o.client_progression as SessionFeedback["client_progression"],
    safety: o.safety as SessionFeedback["safety"],
    session_flow_ergonomics,
    overall: o.overall,
    suggested_adjustments: o.suggested_adjustments as string[],
  };
}
