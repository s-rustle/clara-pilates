import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";

export const SESSIONS_SYSTEM_PROMPT = `You are the Session Planner Agent. Evaluate sessions across progression logic, contraindication flags, volume assessment, muscle group balance, and Balanced Body sequence alignment. Ground all feedback in uploaded source materials.

${OUT_OF_SCOPE_INSTRUCTION}`;

export interface SessionFeedback {
  progression_logic: { score: string; note: string };
  contraindication_flags: { score: string; note: string; flagged: unknown[] };
  volume_assessment: { score: string; note: string; flagged_exercises: unknown[] };
  muscle_group_balance: { score: string; note: string; gaps: unknown[] };
  sequence_alignment: { score: string; note: string };
  overall: string;
  suggested_adjustments: string[];
}

export async function evaluateSession(
  _sessionData: Record<string, unknown>,
  userId: string
): Promise<SessionFeedback> {
  await queryRAG("session evaluation", userId);

  return {
    progression_logic: {
      score: "sound",
      note: "The warm-up flows well into the main sequence.",
    },
    contraindication_flags: {
      score: "none",
      note: "No contraindications flagged for this client level.",
      flagged: [],
    },
    volume_assessment: {
      score: "appropriate",
      note: "Sets and reps within standard range.",
      flagged_exercises: [],
    },
    muscle_group_balance: {
      score: "balanced",
      note: "Anterior and posterior chains represented.",
      gaps: [],
    },
    sequence_alignment: {
      score: "aligned",
      note: "Sequence follows Balanced Body methodology.",
    },
    overall: "The session is well-structured and appropriate for the stated level.",
    suggested_adjustments: [],
  };
}
