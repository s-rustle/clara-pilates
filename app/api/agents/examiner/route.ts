import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestion, evaluateAnswer } from "@/lib/anthropic/agents/examiner";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "generate") {
      const { apparatus, topic, difficulty, previous_questions } = body;
      const result = await generateQuestion(
        apparatus ?? "Mat",
        topic ?? null,
        difficulty ?? "Foundational",
        previous_questions ?? [],
        user.id
      );
      return Response.json({ success: true, ...result });
    }

    if (action === "evaluate") {
      const { question, user_answer, expected_elements, is_retry } = body;
      const result = await evaluateAnswer(
        question ?? "",
        user_answer ?? "",
        expected_elements ?? [],
        is_retry ?? false,
        user.id
      );
      return Response.json({ success: true, ...result });
    }

    return Response.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed",
      },
      { status: 500 }
    );
  }
}
