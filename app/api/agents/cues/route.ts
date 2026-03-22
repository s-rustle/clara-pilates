import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { evaluateCue } from "@/lib/anthropic/agents/cues";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { success: false, error: AUTH_REQUIRED },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const cue = body?.cue;
    const apparatus = body?.apparatus;
    const exerciseName = body?.exercise_name;
    const clientLevel = body?.client_level ?? "";

    if (!cue || typeof cue !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: cue" },
        { status: 400 }
      );
    }

    if (!apparatus || typeof apparatus !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: apparatus" },
        { status: 400 }
      );
    }

    if (!exerciseName || typeof exerciseName !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: exercise_name" },
        { status: 400 }
      );
    }

    const data = await evaluateCue(
      cue,
      apparatus,
      exerciseName,
      clientLevel,
      user.id
    );

    return Response.json({ success: true, data });
  } catch (err) {
    console.error("[api/agents/cues]", err);
    return Response.json(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      { status: 503 }
    );
  }
}
