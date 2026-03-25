import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { evaluateVisualExerciseAnswer } from "@/lib/anthropic/agents/examiner";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: AUTH_REQUIRED }, { status: 401 });
  }

  try {
    const body = await request.json();
    const userAnswer = typeof body?.userAnswer === "string" ? body.userAnswer : "";
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";

    if (!userAnswer.trim() || !fileName.trim()) {
      return Response.json(
        { error: "userAnswer and fileName are required" },
        { status: 400 }
      );
    }

    const { result, correctName, feedback } = await evaluateVisualExerciseAnswer(
      fileName,
      userAnswer
    );

    return Response.json({
      result,
      correctName,
      feedback,
    });
  } catch (err) {
    console.error("[api/quiz/visual-eval]", err);
    return Response.json(
      { error: STUDY_ASSISTANT_UNAVAILABLE },
      { status: 502 }
    );
  }
}
