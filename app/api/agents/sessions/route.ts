import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateSession } from "@/lib/anthropic/agents/sessions";

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
    const result = await evaluateSession(body ?? {}, user.id);
    return Response.json({ success: true, feedback: result });
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
