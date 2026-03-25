import { createClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  HOUR_LOG_LOAD_FAILED,
} from "@/lib/api/messages";
import type { HourLog } from "@/types";
import {
  calculateGaps,
  calculatePracticalHours,
  calculateTotalHours,
  resolveHourTargets,
} from "@/lib/utils/hours";
import { calculateHoursProgressPercentUncapped } from "@/lib/utils/readiness";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/**
 * Read-only hour-tracking context for agents / dashboard helpers (no duplicate writes).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    const { data: logs, error: logErr } = await supabase
      .from("hour_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false });

    if (logErr) {
      return jsonResponse({ success: false, error: HOUR_LOG_LOAD_FAILED }, 500);
    }

    const list = (logs ?? []) as HourLog[];

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("hour_targets")
      .eq("id", user.id)
      .maybeSingle();

    const hourTargets =
      (profileRow?.hour_targets as Parameters<typeof resolveHourTargets>[0]) ??
      null;

    const targets = resolveHourTargets(hourTargets);
    const hours_progress_percent_uncapped =
      await calculateHoursProgressPercentUncapped(user.id);

    return jsonResponse({
      success: true,
      data: {
        total_logged_hours: calculateTotalHours(list),
        mat_pr_hours: calculatePracticalHours(list, "mat"),
        reformer_pr_hours: calculatePracticalHours(list, "reformer"),
        apparatus_pr_hours: calculatePracticalHours(list, "apparatus"),
        targets,
        gaps: calculateGaps(list, hourTargets),
        hours_progress_percent_uncapped,
        log_count: list.length,
      },
    });
  } catch (err) {
    console.error("[api/agents/hours]", err);
    return jsonResponse({ success: false, error: HOUR_LOG_LOAD_FAILED }, 500);
  }
}
