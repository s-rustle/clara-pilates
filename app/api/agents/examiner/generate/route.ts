import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestion } from "@/lib/anthropic/agents/examiner";

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
    const apparatus = body?.apparatus ?? "Mat";
    const topic = body?.topic ?? null;
    const difficulty = body?.difficulty ?? "Foundational";
    const format = body?.format ?? "mixed";
    const previousQuestions = Array.isArray(body?.previous_questions)
      ? body.previous_questions
      : [];
    const sessionId = body?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: session_id" },
        { status: 400 }
      );
    }

    const result = await generateQuestion(
      apparatus,
      topic,
      difficulty,
      previousQuestions,
      user.id,
      format
    );

    if ("error" in result) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabase
      .from("quiz_questions")
      .insert({
        session_id: sessionId,
        question: result.question,
      })
      .select("id")
      .single();

    if (error) {
      return Response.json(
        {
          success: false,
          error: `Failed to save question: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: {
        format: result.format,
        question: result.question,
        question_id: inserted.id,
        expected_answer_elements: result.expected_answer_elements,
        options: result.options,
        correct_id: result.correct_id,
        correct_answer: result.correct_answer,
        pairs: result.pairs,
        left_items: result.left_items,
        right_items: result.right_items,
        image_file_name: result.image_file_name,
        folder_name: result.folder_name,
      },
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to generate question",
      },
      { status: 500 }
    );
  }
}
