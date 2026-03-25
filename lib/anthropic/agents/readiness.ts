import { anthropic } from "@/lib/anthropic/client";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type { ReadinessBrief, WeakSpotItem } from "@/types";

const READINESS_MODEL = "claude-sonnet-4-20250514";

const READINESS_SYSTEM = `You are Clara, a Pilates exam readiness advisor
Generate a plain-language readiness brief based only on the score data provided
Do not invent progress or fabricate details not present in the scores
Be honest — if scores are low, say so directly but constructively

Mandatory rule: If "hours_progress_percent_uncapped" is strictly less than 80, you MUST NOT state or imply that the user is fully exam-ready, ready to sit the exam, or "good to go" for certification. Acknowledge that required practice hours are not yet complete (even when curriculum_score or quiz_score are high).

Return ONLY valid JSON:

{
  "narrative": "2-3 sentence summary of overall readiness",
  "recommendations": ["specific action 1", "specific action 2", "specific action 3"]
}

Recommendations must be specific and actionable — not generic

${OUT_OF_SCOPE_INSTRUCTION}`;

export interface ReadinessBriefInput {
  curriculum_score: number;
  quiz_score: number;
  hours_score: number;
  /** Logged hours vs 536h target, uncapped (can exceed 100). */
  hours_progress_percent_uncapped: number;
  overall_score: number;
  weak_spots?: WeakSpotItem[];
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

function validateBrief(raw: unknown): ReadinessBrief {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid readiness brief: root must be an object");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.narrative !== "string") {
    throw new Error("Invalid readiness brief: narrative must be a string");
  }
  if (!Array.isArray(o.recommendations)) {
    throw new Error("Invalid readiness brief: recommendations must be an array");
  }
  for (const item of o.recommendations) {
    if (typeof item !== "string") {
      throw new Error("Invalid readiness brief: each recommendation must be a string");
    }
  }
  return {
    narrative: o.narrative,
    recommendations: o.recommendations as string[],
  };
}

/**
 * Produces narrative + three recommendations from score data only (optional weak spots for context).
 */
export async function generateReadinessBrief(
  scores: ReadinessBriefInput,
  userId: string
): Promise<ReadinessBrief> {
  const payload = {
    curriculum_score: scores.curriculum_score,
    quiz_score: scores.quiz_score,
    hours_score: scores.hours_score,
    hours_progress_percent_uncapped: scores.hours_progress_percent_uncapped,
    overall_score: scores.overall_score,
    weak_spots: scores.weak_spots?.map((w) => ({
      area: w.area,
      accuracy_percent: w.accuracy_percent,
      question_count: w.question_count,
      pattern_description: w.pattern_description,
      recommended_action: w.recommended_action,
    })),
  };

  const userMessage = `User id (for reference only): ${userId}

Score data (do not invent any other metrics):
${JSON.stringify(payload, null, 2)}`;

  const response = await anthropic.messages.create({
    model: READINESS_MODEL,
    max_tokens: 2048,
    system: READINESS_SYSTEM,
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
  return validateBrief(parsed);
}
