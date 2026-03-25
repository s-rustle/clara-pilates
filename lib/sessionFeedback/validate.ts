import type { SessionFeedback } from "@/types";

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

export function validateSessionFeedback(raw: unknown): SessionFeedback {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid SessionFeedback from model: root must be an object");
  }
  const o = raw as Record<string, unknown>;

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
