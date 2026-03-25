import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, STUDY_ASSISTANT_UNAVAILABLE } from "@/lib/api/messages";
import { generateSessionDraft } from "@/lib/anthropic/agents/sessions";
import type { SessionType } from "@/types";

const SESSION_TYPES: SessionType[] = ["teaching", "personal"];

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function isSessionType(v: unknown): v is SessionType {
  return typeof v === "string" && SESSION_TYPES.includes(v as SessionType);
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
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }
    const b = body as Record<string, unknown>;

    if (!b.apparatus || typeof b.apparatus !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: apparatus" },
        400
      );
    }
    if (!isSessionType(b.session_type)) {
      return jsonResponse(
        { success: false, error: "Missing or invalid field: session_type" },
        400
      );
    }

    let client_level: string | null = null;
    if (b.client_level !== undefined && b.client_level !== null) {
      if (typeof b.client_level !== "string") {
        return jsonResponse({ success: false, error: "Invalid field: client_level" }, 400);
      }
      client_level = b.client_level;
    }

    let client_notes: string | null = null;
    if (b.client_notes !== undefined && b.client_notes !== null) {
      if (typeof b.client_notes !== "string") {
        return jsonResponse({ success: false, error: "Invalid field: client_notes" }, 400);
      }
      client_notes = b.client_notes;
    }

    const draft = await generateSessionDraft({
      apparatus: b.apparatus.trim(),
      client_level,
      session_type: b.session_type,
      client_notes,
    });

    return jsonResponse({ success: true, data: draft });
  } catch (err) {
    console.error("[api/agents/sessions/plan]", err);
    return jsonResponse(
      { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
      503
    );
  }
}
