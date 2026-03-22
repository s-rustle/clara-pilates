import { createClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  READINESS_LOAD_FAILED,
  READINESS_SAVE_FAILED,
  STUDY_ASSISTANT_UNAVAILABLE,
} from "@/lib/api/messages";
import { generateReadinessBrief } from "@/lib/anthropic/agents/readiness";
import {
  calculateCurriculumScore,
  calculateHoursScore,
  calculateOverallScore,
  calculateQuizScore,
} from "@/lib/utils/readiness";
import type { ReadinessSnapshot, WeakSpotItem } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    const { data: row, error } = await supabase
      .from("readiness_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return jsonResponse(
        { success: false, error: READINESS_LOAD_FAILED },
        500
      );
    }

    return jsonResponse({
      success: true,
      data: { snapshot: (row as ReadinessSnapshot | null) ?? null },
    });
  } catch (err) {
    console.error("[api/agents/readiness GET]", err);
    return jsonResponse({ success: false, error: READINESS_LOAD_FAILED }, 500);
  }
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    const [curriculum_score, quiz_score, hours_score] = await Promise.all([
      calculateCurriculumScore(user.id),
      calculateQuizScore(user.id),
      calculateHoursScore(user.id),
    ]);

    const overall_score = calculateOverallScore(
      curriculum_score,
      quiz_score,
      hours_score
    );

    const { data: weakRow, error: weakErr } = await supabase
      .from("weak_spot_analyses")
      .select("top_three, insufficient_data")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weakErr) {
      return jsonResponse(
        { success: false, error: READINESS_SAVE_FAILED },
        500
      );
    }

    let weak_spots: WeakSpotItem[] | undefined;
    if (
      weakRow &&
      weakRow.insufficient_data === false &&
      Array.isArray(weakRow.top_three) &&
      weakRow.top_three.length > 0
    ) {
      weak_spots = weakRow.top_three as WeakSpotItem[];
    }

    const brief = await generateReadinessBrief(
      {
        curriculum_score,
        quiz_score,
        hours_score,
        overall_score,
        weak_spots,
      },
      user.id
    );

    const { data: saved, error: insertErr } = await supabase
      .from("readiness_snapshots")
      .insert({
        user_id: user.id,
        overall_score,
        curriculum_score,
        quiz_score,
        hours_score,
        narrative: brief.narrative,
        recommendations: brief.recommendations,
      })
      .select()
      .single();

    if (insertErr) {
      return jsonResponse(
        { success: false, error: READINESS_SAVE_FAILED },
        500
      );
    }

    return jsonResponse({
      success: true,
      data: {
        snapshot: saved as ReadinessSnapshot,
        brief,
        scores: {
          curriculum_score,
          quiz_score,
          hours_score,
          overall_score,
        },
      },
    });
  } catch (err) {
    console.error("[api/agents/readiness POST]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}
