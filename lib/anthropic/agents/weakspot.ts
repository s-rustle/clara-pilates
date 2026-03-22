import { anthropic } from "@/lib/anthropic/client";
import { createServiceClient } from "@/lib/supabase/server";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import type { WeakSpotItem, WeakSpotResult } from "@/types";

const WEAKSPOT_MODEL = "claude-sonnet-4-20250514";

const MIN_COMPLETED_SESSIONS = 5;
const MIN_QUESTIONS_PER_GROUP = 3;

const WEAKSPOT_SYSTEM = `You are Clara's Weak Spot analyst for Balanced Body Comprehensive exam prep.
Given grouped quiz statistics (apparatus, topic label, accuracy %, question count, counts of correct vs incorrect vs partial), write for EACH group:
- pattern_description: one plain-language sentence (second person). Mention accuracy and question count. Example tone: "You consistently miss questions about contraindications on the Cadillac (40% accuracy across 8 questions)."
- recommended_action: one specific study action tied to that area (curriculum review, quiz focus, etc.).

Return ONLY valid JSON — no markdown, no preamble:
{ "items": [ { "index": 0, "pattern_description": "string", "recommended_action": "string" } ] }

The "index" must match the input row index (0-based).

${OUT_OF_SCOPE_INSTRUCTION}`;

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

function formatArea(apparatus: string, topic: string | null): string {
  const t = topic?.trim() || "General";
  return `${apparatus} — ${t}`;
}

type GroupAgg = {
  apparatus: string;
  topic: string | null;
  total: number;
  correct: number;
};

/**
 * Fetches quiz history from Supabase (service role), groups by session apparatus + topic,
 * finds the three weakest groups (min 3 attempted questions each), and enriches with Claude.
 */
export async function analyzeWeakSpots(userId: string): Promise<WeakSpotResult> {
  const supabase = createServiceClient();

  const { data: completedSessions, error: sessErr } = await supabase
    .from("quiz_sessions")
    .select("id, apparatus, topic")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  if (sessErr) {
    throw new Error(`Failed to load quiz sessions: ${sessErr.message}`);
  }

  const sessions = completedSessions ?? [];
  const completedCount = sessions.length;

  if (completedCount < MIN_COMPLETED_SESSIONS) {
    return {
      insufficient_data: true,
      sessions_needed: MIN_COMPLETED_SESSIONS - completedCount,
    };
  }

  const sessionMeta = new Map<
    string,
    { apparatus: string; topic: string | null }
  >();
  for (const s of sessions) {
    sessionMeta.set(s.id, {
      apparatus: s.apparatus,
      topic: s.topic,
    });
  }

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    return {
      insufficient_data: true,
      sessions_needed: MIN_COMPLETED_SESSIONS,
    };
  }

  const { data: questionRows, error: qErr } = await supabase
    .from("quiz_questions")
    .select("session_id, result")
    .in("session_id", sessionIds);

  if (qErr) {
    throw new Error(`Failed to load quiz questions: ${qErr.message}`);
  }

  const groupMap = new Map<string, GroupAgg>();

  for (const row of questionRows ?? []) {
    const meta = sessionMeta.get(row.session_id);
    if (!meta) continue;

    if (row.result === null || row.result === undefined) continue;

    const key = `${meta.apparatus}\x00${meta.topic ?? ""}`;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        apparatus: meta.apparatus,
        topic: meta.topic,
        total: 0,
        correct: 0,
      };
      groupMap.set(key, g);
    }
    g.total += 1;
    if (row.result === "correct") {
      g.correct += 1;
    }
  }

  const eligible = [...groupMap.values()].filter(
    (g) => g.total >= MIN_QUESTIONS_PER_GROUP
  );

  eligible.sort((a, b) => {
    const accA = a.correct / a.total;
    const accB = b.correct / b.total;
    if (accA !== accB) return accA - accB;
    return b.total - a.total;
  });

  const topGroups = eligible.slice(0, 3);

  if (topGroups.length === 0) {
    return {
      insufficient_data: false,
      top_three: [],
      sessions_analyzed: completedCount,
    };
  }

  const statsPayload = topGroups.map((g, index) => ({
    index,
    apparatus: g.apparatus,
    topic_label: g.topic ?? "General",
    question_count: g.total,
    correct: g.correct,
    incorrect_and_partial: g.total - g.correct,
    accuracy_percent: Math.round((g.correct / g.total) * 100),
  }));

  const response = await anthropic.messages.create({
    model: WEAKSPOT_MODEL,
    max_tokens: 2048,
    system: WEAKSPOT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Grouped quiz statistics (weakest areas first):\n${JSON.stringify(statsPayload, null, 2)}`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  if (!text.trim()) {
    throw new Error("Claude returned an empty response");
  }

  const parsed = parseJsonFromResponse<{ items?: unknown }>(text);
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error("Invalid weak spot model output: missing items array");
  }

  const byIndex = new Map<number, { pattern_description: string; recommended_action: string }>();
  for (const raw of parsed.items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.index !== "number") continue;
    if (typeof o.pattern_description !== "string" || typeof o.recommended_action !== "string") {
      continue;
    }
    byIndex.set(o.index, {
      pattern_description: o.pattern_description,
      recommended_action: o.recommended_action,
    });
  }

  const top_three: WeakSpotItem[] = topGroups.map((g, index) => {
    const acc = Math.round((g.correct / g.total) * 100);
    const fromModel = byIndex.get(index);
    return {
      area: formatArea(g.apparatus, g.topic),
      accuracy_percent: acc,
      question_count: g.total,
      pattern_description:
        fromModel?.pattern_description ??
        `In ${formatArea(g.apparatus, g.topic)}, you answered ${g.correct} of ${g.total} questions correctly (${acc}%).`,
      recommended_action:
        fromModel?.recommended_action ??
        `Review your ${g.apparatus} curriculum materials and take another focused quiz in this area.`,
    };
  });

  return {
    insufficient_data: false,
    top_three,
    sessions_analyzed: completedCount,
  };
}
