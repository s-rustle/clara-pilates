import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  STUDY_ASSISTANT_UNAVAILABLE,
  WEAK_SPOT_LOAD_FAILED,
  WEAK_SPOT_SAVE_FAILED,
} from "@/lib/api/messages";
import { analyzeWeakSpots } from "@/lib/anthropic/agents/weakspot";
import type { WeakSpotAnalysis, WeakSpotResult } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function rowToResult(row: {
  insufficient_data: boolean;
  sessions_needed: number | null;
  top_three: unknown;
  sessions_analyzed: number;
}): WeakSpotResult {
  if (row.insufficient_data) {
    return {
      insufficient_data: true,
      sessions_needed: row.sessions_needed ?? undefined,
    };
  }
  const top = Array.isArray(row.top_three) ? row.top_three : [];
  return {
    insufficient_data: false,
    top_three: top as WeakSpotResult["top_three"],
    sessions_analyzed: row.sessions_analyzed,
  };
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
    const { count: completedQuizSessions, error: countErr } = await supabase
      .from("quiz_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("completed_at", "is", null);

    if (countErr) {
      return jsonResponse(
        { success: false, error: WEAK_SPOT_LOAD_FAILED },
        500
      );
    }

    const { data: row, error: fetchErr } = await supabase
      .from("weak_spot_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      return jsonResponse(
        { success: false, error: WEAK_SPOT_LOAD_FAILED },
        500
      );
    }

    const analysis = row as WeakSpotAnalysis | null;
    const result: WeakSpotResult | null = analysis
      ? rowToResult({
          insufficient_data: analysis.insufficient_data,
          sessions_needed: analysis.sessions_needed,
          top_three: analysis.top_three,
          sessions_analyzed: analysis.sessions_analyzed,
        })
      : null;

    return jsonResponse({
      success: true,
      data: {
        result,
        analysis,
        completed_quiz_sessions: completedQuizSessions ?? 0,
      },
    });
  } catch (err) {
    console.error("[api/agents/weakspot GET]", err);
    return jsonResponse({ success: false, error: WEAK_SPOT_LOAD_FAILED }, 500);
  }
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    const weakSpotResult = await analyzeWeakSpots(user.id);

    const insertPayload = {
      user_id: user.id,
      insufficient_data: weakSpotResult.insufficient_data,
      sessions_needed: weakSpotResult.sessions_needed ?? null,
      sessions_analyzed: weakSpotResult.sessions_analyzed ?? 0,
      top_three: weakSpotResult.top_three ?? [],
    };

    const { data: saved, error: insertErr } = await supabase
      .from("weak_spot_analyses")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      return jsonResponse(
        { success: false, error: WEAK_SPOT_SAVE_FAILED },
        500
      );
    }

    return jsonResponse({
      success: true,
      data: {
        result: weakSpotResult,
        analysis: saved as WeakSpotAnalysis,
      },
    });
  } catch (err) {
    console.error("[api/agents/weakspot POST]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}
