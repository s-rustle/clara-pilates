import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { generateTutorial, getExerciseList } from "@/lib/anthropic/agents/learn";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  const { searchParams } = new URL(request.url);
  const apparatus = searchParams.get("apparatus");

  if (!apparatus || typeof apparatus !== "string" || !apparatus.trim()) {
    return jsonResponse(
      { success: false, error: "Missing or invalid query param: apparatus" },
      400
    );
  }

  try {
    const { exercises, chunkCount } = await getExerciseList(
      apparatus.trim(),
      user.id
    );
    return jsonResponse({ success: true, data: { exercises, chunkCount } });
  } catch (err) {
    console.error("[api/agents/learn GET]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return jsonResponse(
        { success: false, error: "Invalid request body" },
        400
      );
    }

    const apparatus = (body as Record<string, unknown>).apparatus;
    const exercise_or_muscle = (body as Record<string, unknown>)
      .exercise_or_muscle;

    if (typeof apparatus !== "string" || !apparatus.trim()) {
      return jsonResponse(
        { success: false, error: "Missing or invalid field: apparatus" },
        400
      );
    }

    if (typeof exercise_or_muscle !== "string" || !exercise_or_muscle.trim()) {
      return jsonResponse(
        {
          success: false,
          error: "Missing or invalid field: exercise_or_muscle",
        },
        400
      );
    }

    const tutorial = await generateTutorial(
      apparatus.trim(),
      exercise_or_muscle.trim(),
      user.id
    );

    if (tutorial.error) {
      return jsonResponse(
        { success: false, error: tutorial.error, data: { tutorial } },
        400
      );
    }

    return jsonResponse({ success: true, data: { tutorial } });
  } catch (err) {
    console.error("[api/agents/learn POST]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}
