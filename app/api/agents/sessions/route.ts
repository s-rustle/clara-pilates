import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const origin = request.nextUrl.origin;
    const cookie = request.headers.get("cookie") ?? "";
    const patchRes = await fetch(`${origin}/api/sessions`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        id,
        feedback,
      }),
    });

    const patchBody = (await patchRes.json()) as {
      success?: boolean;
      error?: string;
      data?: unknown;
    };

    if (!patchRes.ok || !patchBody.success) {
      const errMsg =
        typeof patchBody.error === "string"
          ? patchBody.error
          : "Failed to save feedback to session plan";
      return jsonResponse(
        { success: false, error: errMsg },
        patchRes.status >= 400 ? patchRes.status : 500
      );
    }

    return jsonResponse({ success: true, data: feedback });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to evaluate session";
    const status = isClientErrorMessage(message) ? 400 : 500;
    return jsonResponse({ success: false, error: message }, status);
  }
}
