import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, QUIZ_QUESTION_SAVE_FAILED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { evaluateAnswer } from "@/lib/anthropic/agents/examiner";

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
    const questionId = body?.question_id;
    const question = body?.question;
    const userAnswer = body?.user_answer ?? "";
    const expectedElements = Array.isArray(body?.expected_elements)
      ? body.expected_elements
      : [];
    const isRetry = Boolean(body?.is_retry);
    const format = body?.format ?? "open_ended";
    const correctId = body?.correct_id;
    const correctAnswer = body?.correct_answer;
    const pairs = Array.isArray(body?.pairs) ? body.pairs : undefined;
    const options = Array.isArray(body?.options) ? body.options : undefined;
    const diagramSelectedMuscle =
      typeof body?.diagram_selected_muscle === "string"
        ? body.diagram_selected_muscle
        : body?.diagram_selected_muscle === null
          ? null
          : undefined;

    if (!questionId || typeof questionId !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: question_id" },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: question" },
        { status: 400 }
      );
    }

    const result = await evaluateAnswer(
      question,
      userAnswer,
      expectedElements,
      isRetry,
      user.id,
      {
        format,
        correct_id: correctId,
        correct_answer: correctAnswer,
        pairs,
        options,
        diagram_selected_muscle: diagramSelectedMuscle,
      }
    );

    const updatePayload: Record<string, unknown> = {
      result: result.result,
      feedback: result.feedback,
      correct_answer: result.correct_answer,
    };

    if (isRetry) {
      updatePayload.retry_answer = userAnswer;
    } else {
      updatePayload.user_answer = userAnswer;
    }

    const { data: updatedRow, error } = await supabase
      .from("quiz_questions")
      .update(updatePayload)
      .eq("id", questionId)
      .select("id")
      .maybeSingle();

    if (error) {
      return Response.json(
        { success: false, error: QUIZ_QUESTION_SAVE_FAILED },
        { status: 500 }
      );
    }

    if (!updatedRow) {
      return Response.json(
        {
          success: false,
          error:
            "Quiz question not found or you do not have access to update it.",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: {
        result: result.result,
        feedback: result.feedback,
        correct_answer: result.correct_answer,
      },
    });
  } catch (err) {
    console.error("[api/agents/examiner/evaluate]", err);
    return Response.json(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      { status: 503 }
    );
  }
}
