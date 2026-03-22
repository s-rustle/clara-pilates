import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateAnswer } from "@/lib/anthropic/agents/examiner";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { success: false, error: "Unauthorized" },
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

    const { error } = await supabase
      .from("quiz_questions")
      .update(updatePayload)
      .eq("id", questionId);

    if (error) {
      return Response.json(
        {
          success: false,
          error: `Failed to update question: ${error.message}`,
        },
        { status: 500 }
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
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to evaluate answer",
      },
      { status: 500 }
    );
  }
}
