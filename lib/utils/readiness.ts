import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function distinctStrings(
  rows: { folder_name: string | null }[] | null
): Set<string> {
  const names = new Set<string>();
  for (const row of rows ?? []) {
    const fn = row.folder_name;
    if (fn != null && String(fn).trim() !== "") {
      names.add(String(fn).trim());
    }
  }
  return names;
}

/**
 * Score = (distinct folders touched in quiz / distinct folders ingested) × 100.
 * Returns 0 if no folders ingested.
 */
export async function calculateCurriculumScore(userId: string): Promise<number> {
  try {
    const supabase = createServiceClient();

    const { data: chunkRows, error: chunkErr } = await supabase
      .from("curriculum_chunks")
      .select("folder_name")
      .eq("user_id", userId);

    if (chunkErr) {
      throw new Error(chunkErr.message);
    }

    const ingested = distinctStrings(
      chunkRows as { folder_name: string | null }[] | null
    );
    if (ingested.size === 0) {
      return 0;
    }

    const { data: sessions, error: sessErr } = await supabase
      .from("quiz_sessions")
      .select("id")
      .eq("user_id", userId);

    if (sessErr) {
      throw new Error(sessErr.message);
    }

    const sessionIds = (sessions ?? []).map((s) => (s as { id: string }).id);
    const queriedNames = await distinctQuizQuestionFolders(supabase, sessionIds);

    const queried = queriedNames.size;
    const score = (queried / ingested.size) * 100;
    return roundToOneDecimal(score);
  } catch (err) {
    console.error("[readiness] calculateCurriculumScore failed:", err);
    return 0;
  }
}

async function distinctQuizQuestionFolders(
  supabase: SupabaseClient,
  sessionIds: string[]
): Promise<Set<string>> {
  const names = new Set<string>();
  if (sessionIds.length === 0) {
    return names;
  }

  const chunkSize = 200;
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize);
    const { data: questions, error: qErr } = await supabase
      .from("quiz_questions")
      .select("folder_name")
      .in("session_id", chunk);

    if (qErr) {
      throw new Error(qErr.message);
    }
    for (const n of distinctStrings(
      questions as { folder_name: string | null }[] | null
    )) {
      names.add(n);
    }
  }
  return names;
}

/**
 * Average score_percent over the last 10 completed quiz sessions.
 */
export async function calculateQuizScore(userId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("score_percent")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as { score_percent: number | null }[];
    if (rows.length < 1) {
      return 0;
    }

    const percents = rows
      .map((r) => r.score_percent)
      .filter((p): p is number => p != null && !Number.isNaN(p));

    if (percents.length < 1) {
      return 0;
    }

    const avg =
      percents.reduce((sum, p) => sum + p, 0) / percents.length;
    return roundToOneDecimal(avg);
  } catch (err) {
    console.error("[readiness] calculateQuizScore failed:", err);
    return 0;
  }
}

const HOURS_TARGET = 536;

/**
 * Logged + completed hours as % of 536 target (not capped). Can exceed 100%.
 */
export async function calculateHoursProgressPercentUncapped(
  userId: string
): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("hour_logs")
      .select("duration_minutes")
      .eq("user_id", userId)
      .in("status", ["logged", "complete"]);

    if (error) {
      throw new Error(error.message);
    }

    let totalMinutes = 0;
    for (const row of data ?? []) {
      const m = (row as { duration_minutes: number | null }).duration_minutes;
      if (typeof m === "number" && !Number.isNaN(m)) {
        totalMinutes += m;
      }
    }

    const totalHours = totalMinutes / 60;
    return roundToOneDecimal((totalHours / HOURS_TARGET) * 100);
  } catch (err) {
    console.error("[readiness] calculateHoursProgressPercentUncapped failed:", err);
    return 0;
  }
}

/**
 * Logged + completed hours vs 536 target, capped at 100%.
 */
export async function calculateHoursScore(userId: string): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("hour_logs")
      .select("duration_minutes")
      .eq("user_id", userId)
      .in("status", ["logged", "complete"]);

    if (error) {
      throw new Error(error.message);
    }

    let totalMinutes = 0;
    for (const row of data ?? []) {
      const m = (row as { duration_minutes: number | null }).duration_minutes;
      if (typeof m === "number" && !Number.isNaN(m)) {
        totalMinutes += m;
      }
    }

    const totalHours = totalMinutes / 60;
    const raw = (totalHours / HOURS_TARGET) * 100;
    const score = Math.min(100, raw);
    return roundToOneDecimal(score);
  } catch (err) {
    console.error("[readiness] calculateHoursScore failed:", err);
    return 0;
  }
}

/**
 * Weighted overall: curriculum 33%, quiz 34%, hours 33%.
 */
export function calculateOverallScore(
  curriculum: number,
  quiz: number,
  hours: number
): number {
  const overall = curriculum * 0.33 + quiz * 0.34 + hours * 0.33;
  return roundToOneDecimal(overall);
}
