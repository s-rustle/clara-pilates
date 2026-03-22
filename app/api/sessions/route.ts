import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type {
  ExerciseItem,
  SessionPlan,
  SessionMode,
  SessionStatus,
  SessionType,
  WarmUpMove,
} from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

const SESSION_MODES: SessionMode[] = ["plan", "log"];
const SESSION_TYPES: SessionType[] = ["teaching", "personal"];
const SESSION_STATUSES: SessionStatus[] = ["draft", "complete"];

function isSessionMode(v: unknown): v is SessionMode {
  return typeof v === "string" && SESSION_MODES.includes(v as SessionMode);
}

function isSessionType(v: unknown): v is SessionType {
  return typeof v === "string" && SESSION_TYPES.includes(v as SessionType);
}

function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === "string" && SESSION_STATUSES.includes(v as SessionStatus);
}

function parseWarmUp(raw: unknown): WarmUpMove[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WarmUpMove[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (
      typeof o.move_name !== "string" ||
      typeof o.sets !== "number" ||
      Number.isNaN(o.sets) ||
      typeof o.reps !== "number" ||
      Number.isNaN(o.reps)
    ) {
      return null;
    }
    out.push({ move_name: o.move_name, sets: o.sets, reps: o.reps });
  }
  return out;
}

function parseExerciseSequence(raw: unknown): ExerciseItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExerciseItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (
      typeof o.exercise_name !== "string" ||
      typeof o.sets !== "number" ||
      Number.isNaN(o.sets) ||
      typeof o.reps !== "number" ||
      Number.isNaN(o.reps)
    ) {
      return null;
    }
    const row: ExerciseItem = {
      exercise_name: o.exercise_name,
      sets: o.sets,
      reps: o.reps,
    };
    if (o.notes !== undefined) {
      if (typeof o.notes !== "string") return null;
      row.notes = o.notes;
    }
    out.push(row);
  }
  return out;
}

async function ensureProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string };
}) {
  const service = createServiceClient();
  await service.from("profiles").upsert(
    {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email ?? null,
    },
    { onConflict: "id" }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const status = searchParams.get("status");
    const apparatus = searchParams.get("apparatus");

    let query = supabase
      .from("session_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (mode) {
      if (!isSessionMode(mode)) {
        return jsonResponse(
          { success: false, error: "Invalid query param: mode" },
          400
        );
      }
      query = query.eq("mode", mode);
    }
    if (status) {
      if (!isSessionStatus(status)) {
        return jsonResponse(
          { success: false, error: "Invalid query param: status" },
          400
        );
      }
      query = query.eq("status", status);
    }
    if (apparatus) {
      query = query.eq("apparatus", apparatus);
    }

    const { data, error } = await query;

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    return jsonResponse({ success: true, data: data as SessionPlan[] });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to fetch session plans",
      },
      500
    );
  }
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

    const mode = body.mode;
    const session_type = body.session_type;
    const apparatus = body.apparatus;

    if (!isSessionMode(mode)) {
      return jsonResponse(
        { success: false, error: "Missing or invalid field: mode" },
        400
      );
    }
    if (!isSessionType(session_type)) {
      return jsonResponse(
        { success: false, error: "Missing or invalid field: session_type" },
        400
      );
    }
    if (!apparatus || typeof apparatus !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: apparatus" },
        400
      );
    }

    const warm_up = parseWarmUp(body.warm_up);
    if (warm_up === null) {
      return jsonResponse(
        { success: false, error: "Invalid or missing field: warm_up" },
        400
      );
    }

    const exercise_sequence = parseExerciseSequence(body.exercise_sequence);
    if (exercise_sequence === null) {
      return jsonResponse(
        { success: false, error: "Invalid or missing field: exercise_sequence" },
        400
      );
    }

    let client_level: string | null = null;
    if (body.client_level !== undefined && body.client_level !== null) {
      if (typeof body.client_level !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: client_level" },
          400
        );
      }
      client_level = body.client_level;
    }

    let session_date: string | null = null;
    if (body.session_date !== undefined && body.session_date !== null) {
      if (typeof body.session_date !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: session_date" },
          400
        );
      }
      session_date = body.session_date;
    }

    let status: SessionStatus = "draft";
    if (body.status !== undefined && body.status !== null) {
      if (!isSessionStatus(body.status)) {
        return jsonResponse(
          { success: false, error: "Invalid field: status" },
          400
        );
      }
      status = body.status;
    }

    await ensureProfile(user);

    const payload = {
      user_id: user.id,
      mode,
      session_type,
      apparatus,
      client_level,
      warm_up,
      exercise_sequence,
      session_date,
      status,
    };

    const id = body.id;
    if (id !== undefined && id !== null) {
      if (typeof id !== "string") {
        return jsonResponse({ success: false, error: "Invalid field: id" }, 400);
      }

      const { data, error } = await supabase
        .from("session_plans")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return jsonResponse(
            { success: false, error: "Session plan not found" },
            404
          );
        }
        return jsonResponse({ success: false, error: error.message }, 500);
      }

      if (!data) {
        return jsonResponse(
          { success: false, error: "Session plan not found" },
          404
        );
      }

      return jsonResponse({ success: true, data: data as SessionPlan });
    }

    const { data, error } = await supabase
      .from("session_plans")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    return jsonResponse({ success: true, data: data as SessionPlan });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to save session plan",
      },
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const id = body.id;

    if (!id || typeof id !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: id" },
        400
      );
    }

    const patch: Record<string, unknown> = {};

    if (body.status !== undefined) {
      if (body.status === null) {
        return jsonResponse(
          { success: false, error: "Invalid field: status" },
          400
        );
      }
      if (!isSessionStatus(body.status)) {
        return jsonResponse(
          { success: false, error: "Invalid field: status" },
          400
        );
      }
      patch.status = body.status;
    }

    if (body.linked_hour_log_id !== undefined) {
      const lid = body.linked_hour_log_id;
      if (lid !== null && typeof lid !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: linked_hour_log_id" },
          400
        );
      }
      if (lid !== null) {
        const { data: hourRow, error: hourErr } = await supabase
          .from("hour_logs")
          .select("id")
          .eq("id", lid)
          .eq("user_id", user.id)
          .maybeSingle();

        if (hourErr) {
          return jsonResponse({ success: false, error: hourErr.message }, 500);
        }
        if (!hourRow) {
          return jsonResponse(
            { success: false, error: "Hour log not found" },
            404
          );
        }
      }
      patch.linked_hour_log_id = lid;
    }

    if (body.feedback !== undefined) {
      if (body.feedback !== null && typeof body.feedback !== "object") {
        return jsonResponse(
          { success: false, error: "Invalid field: feedback" },
          400
        );
      }
      patch.feedback = body.feedback;
    }

    if (Object.keys(patch).length === 0) {
      return jsonResponse(
        {
          success: false,
          error:
            "At least one of status, linked_hour_log_id, or feedback is required",
        },
        400
      );
    }

    const { data, error } = await supabase
      .from("session_plans")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonResponse(
          { success: false, error: "Session plan not found" },
          404
        );
      }
      return jsonResponse({ success: false, error: error.message }, 500);
    }

    if (!data) {
      return jsonResponse(
        { success: false, error: "Session plan not found" },
        404
      );
    }

    return jsonResponse({ success: true, data: data as SessionPlan });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to update session plan",
      },
      500
    );
  }
}
