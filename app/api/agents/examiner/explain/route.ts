import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { explainCorrectAnswer } from "@/lib/anthropic/agents/examiner";

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
    const question = body?.question;
    const format = body?.format ?? "open_ended";
    const correctAnswer = body?.correct_answer;
    const correctId = body?.correct_id;
    const options = Array.isArray(body?.options) ? body.options : undefined;
    const pairs = Array.isArray(body?.pairs) ? body.pairs : undefined;
    const expectedElements = Array.isArray(body?.expected_elements)
      ? body.expected_elements
      : undefined;

    if (!question || typeof question !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: question" },
        { status: 400 }
      );
    }

    const explanation = await explainCorrectAnswer(question, {
      format,
      correct_answer: correctAnswer,
      correct_id: correctId,
      options,
      pairs,
      expected_elements: expectedElements,
    });

    return Response.json({
      success: true,
      data: { explanation },
    });
  } catch (err) {
    console.error("[api/agents/examiner/explain]", err);
    return Response.json(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      { status: 503 }
    );
  }
}
