import type { SessionFeedback, SessionSafetyFlag } from "@/types";
import { validateSessionFeedback } from "@/lib/sessionFeedback/validate";

/**
 * Normalize session_plans.feedback JSON: current rubric, or legacy (pre–Mar 2026) shape.
 */
export function normalizeStoredSessionFeedback(raw: unknown): SessionFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.alignment_and_form && typeof o.alignment_and_form === "object") {
    try {
      return validateSessionFeedback(raw);
    } catch {
      return null;
    }
  }
  if (!o.progression_logic || typeof o.progression_logic !== "object") {
    return null;
  }

  const pl = o.progression_logic as Record<string, unknown>;
  const cf = o.contraindication_flags as Record<string, unknown> | undefined;
  const flagsRaw = Array.isArray(cf?.flags) ? cf.flags : [];
  const flags: SessionSafetyFlag[] = [];
  for (const f of flagsRaw) {
    if (!f || typeof f !== "object") continue;
    const fr = f as Record<string, unknown>;
    flags.push({
      exercise_name: String(fr.exercise_name ?? ""),
      concern: String(fr.flag ?? fr.concern ?? ""),
      recommendation: String(fr.recommendation ?? ""),
    });
  }

  const vol = o.volume_assessment as Record<string, unknown> | undefined;
  const bal = o.muscle_group_balance as Record<string, unknown> | undefined;
  const seq = o.sequence_alignment as Record<string, unknown> | undefined;

  const alignParts = [vol?.note, bal?.note].filter(
    (x): x is string => typeof x === "string" && x.trim() !== ""
  );

  return {
    alignment_and_form: {
      score: typeof vol?.score === "string" ? vol.score : "not_verified",
      note:
        alignParts.length > 0
          ? alignParts.join(" ")
          : "Recorded with a previous rubric. Generate new feedback for the current dimensions.",
    },
    breathing: {
      score: "not_verified",
      note: "Not separately scored in legacy feedback.",
    },
    cueing_clarity: {
      score: "not_verified",
      note: "Not separately scored in legacy feedback.",
    },
    client_progression: {
      score: typeof pl.score === "string" ? pl.score : "not_verified",
      note: [pl.note, seq?.note]
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .join("\n"),
    },
    safety: {
      score: typeof cf?.score === "string" ? cf.score : "not_verified",
      note:
        typeof vol?.note === "string" && vol.note.trim() !== ""
          ? String(vol.note)
          : "Legacy volume and contraindication assessment.",
      flags,
    },
    overall: typeof o.overall === "string" ? o.overall : "",
    suggested_adjustments: Array.isArray(o.suggested_adjustments)
      ? (o.suggested_adjustments as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : [],
  };
}
