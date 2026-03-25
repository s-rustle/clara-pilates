import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { routeUserMessage } from "@/lib/anthropic/agents/coordinatorRouting";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
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
    const msg =
      body && typeof body === "object" && typeof body.message === "string"
        ? body.message
        : null;

    if (!msg || !msg.trim()) {
      return jsonResponse(
        { success: false, error: "Missing required field: message" },
        400
      );
    }

    const result = await routeUserMessage(msg);
    return jsonResponse({ success: true, data: result });
  } catch (err) {
    console.error("[api/agents/coordinator]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}
