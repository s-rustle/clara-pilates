import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  SESSION_PLAN_SAVE_FAILED,
  STUDY_ASSISTANT_UNAVAILABLE,
} from "@/lib/api/messages";
import { evaluateSession } from "@/lib/anthropic/agents/sessions";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function isClientErrorMessage(message: string): boolean {
  if (
    message.startsWith("Invalid SessionFeedback from model") ||
    message.includes("Claude") ||
    message.includes("parse Claude response")
  ) {
    return false;
  }
  return (
    message.startsWith("Missing ") ||
    message.startsWith("Invalid ") ||
    message.includes("expected array")
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }

    const record = body as Record<string, unknown>;
    const id = record.id;
    if (!id || typeof id !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: id (session plan id)" },
        400
      );
    }

    const { id: _omit, ...sessionPayload } = record;
    const feedback = await evaluateSession(sessionPayload, user.id);

    // Persist feedback with the same user-scoped client (avoid server → self HTTP fetch,
    // which can hang or fail in dev / serverless).
    const { data: updated, error: saveErr } = await supabase
      .from("session_plans")
      .update({ feedback })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (saveErr) {
      if (saveErr.code === "PGRST116") {
        return jsonResponse(
          { success: false, error: "Session plan not found" },
          404
        );
      }
      console.error("[api/agents/sessions] save feedback:", saveErr);
      return jsonResponse(
        { success: false, error: SESSION_PLAN_SAVE_FAILED },
        500
      );
    }

    if (!updated) {
      return jsonResponse(
        { success: false, error: "Session plan not found" },
        404
      );
    }

    return jsonResponse({ success: true, data: feedback });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to evaluate session";
    const status = isClientErrorMessage(message) ? 400 : 503;
    if (status === 400) {
      return jsonResponse({ success: false, error: message }, status);
    }
    console.error("[api/agents/sessions]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      status
    );
  }
}
