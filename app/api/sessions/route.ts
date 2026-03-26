import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  SESSION_PLAN_LOAD_FAILED,
  SESSION_PLAN_SAVE_FAILED,
  STUDY_ASSISTANT_UNAVAILABLE,
} from "@/lib/api/messages";
import { generateFullSessionPlan } from "@/lib/anthropic/agents/sessionPlannerAgent";
import {
  GENERATE_PLAN_APPARATUS_VALUES,
  GENERATE_PLAN_DURATIONS,
  GENERATE_PLAN_FOCUS_AREAS,
  GENERATE_PLAN_SESSION_GOALS,
  type GeneratePlanDuration,
} from "@/lib/sessions/generatePlanForm";
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
    const row: WarmUpMove = { move_name: o.move_name, sets: o.sets, reps: o.reps };
    if (o.notes !== undefined) {
      if (typeof o.notes !== "string") return null;
      const n = o.notes.trim();
      if (n) row.notes = n;
    }
    out.push(row);
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
    if (o.apparatus !== undefined && o.apparatus !== null) {
      if (typeof o.apparatus !== "string") return null;
      const a = o.apparatus.trim();
      if (a) row.apparatus = a;
    }
    out.push(row);
  }
  return out;
}

const ALLOWED_GENERATE_APPARATUS = new Set<string>([...GENERATE_PLAN_APPARATUS_VALUES]);

function isGeneratePlanDuration(n: number): n is GeneratePlanDuration {
  return (GENERATE_PLAN_DURATIONS as readonly number[]).includes(n);
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
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
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
      return jsonResponse({ success: false, error: SESSION_PLAN_LOAD_FAILED }, 500);
    }

    return jsonResponse({ success: true, data: data as SessionPlan[] });
  } catch (err) {
    console.error("[api/sessions GET]", err);
    return jsonResponse({ success: false, error: SESSION_PLAN_LOAD_FAILED }, 500);
  }
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
    const rec = body as Record<string, unknown>;

    if (rec.action === "generatePlan") {
      if (!isSessionType(rec.session_type)) {
        return jsonResponse(
          { success: false, error: "Missing or invalid field: session_type" },
          400
        );
      }
      if (typeof rec.client_level !== "string" || !rec.client_level.trim()) {
        return jsonResponse(
          { success: false, error: "Missing or invalid field: client_level" },
          400
        );
      }
      const dur = rec.session_duration_minutes;
      if (typeof dur !== "number" || !isGeneratePlanDuration(dur)) {
        return jsonResponse(
          { success: false, error: "Invalid field: session_duration_minutes" },
          400
        );
      }
      const avail = rec.apparatus_available;
      if (!Array.isArray(avail) || avail.length === 0) {
        return jsonResponse(
          { success: false, error: "Invalid field: apparatus_available" },
          400
        );
      }
      const apparatus_available: string[] = [];
      for (const a of avail) {
        if (typeof a !== "string" || !ALLOWED_GENERATE_APPARATUS.has(a)) {
          return jsonResponse(
            { success: false, error: "Invalid apparatus in apparatus_available" },
            400
          );
        }
        if (!apparatus_available.includes(a)) apparatus_available.push(a);
      }

      let client_notes_gp: string | null = null;
      if (rec.client_notes !== undefined && rec.client_notes !== null) {
        if (typeof rec.client_notes !== "string") {
          return jsonResponse(
            { success: false, error: "Invalid field: client_notes" },
            400
          );
        }
        client_notes_gp = rec.client_notes;
      }

      let focus_area: string | null = null;
      if (rec.focus_area !== undefined && rec.focus_area !== null) {
        if (typeof rec.focus_area !== "string") {
          return jsonResponse(
            { success: false, error: "Invalid field: focus_area" },
            400
          );
        }
        const f = rec.focus_area.trim();
        if (f.length > 0) {
          if (!(GENERATE_PLAN_FOCUS_AREAS as readonly string[]).includes(f)) {
            return jsonResponse(
              { success: false, error: "Invalid field: focus_area" },
              400
            );
          }
          focus_area = f;
        }
      }

      let session_goal: string | null = null;
      if (rec.session_goal !== undefined && rec.session_goal !== null) {
        if (typeof rec.session_goal !== "string") {
          return jsonResponse(
            { success: false, error: "Invalid field: session_goal" },
            400
          );
        }
        const g = rec.session_goal.trim();
        if (g.length > 0) {
          if (!(GENERATE_PLAN_SESSION_GOALS as readonly string[]).includes(g)) {
            return jsonResponse(
              { success: false, error: "Invalid field: session_goal" },
              400
            );
          }
          session_goal = g;
        }
      }

      await ensureProfile(user);
      try {
        const data = await generateFullSessionPlan(
          {
            client_level: rec.client_level.trim(),
            session_duration_minutes: dur,
            apparatus_available,
            client_notes: client_notes_gp,
            focus_area,
            session_goal,
            session_type: rec.session_type,
          },
          user.id
        );
        return jsonResponse({ success: true, data });
      } catch (err) {
        console.error("[api/sessions generatePlan]", err);
        return jsonResponse(
          { success: false, error: STUDY_ASSISTANT_UNAVAILABLE },
          503
        );
      }
    }

    const mode = rec.mode;
    const session_type = rec.session_type;
    const apparatus = rec.apparatus;

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

    const warm_up = parseWarmUp(rec.warm_up);
    if (warm_up === null) {
      return jsonResponse(
        { success: false, error: "Invalid or missing field: warm_up" },
        400
      );
    }

    const exercise_sequence = parseExerciseSequence(rec.exercise_sequence);
    if (exercise_sequence === null) {
      return jsonResponse(
        { success: false, error: "Invalid or missing field: exercise_sequence" },
        400
      );
    }

    let client_level: string | null = null;
    if (rec.client_level !== undefined && rec.client_level !== null) {
      if (typeof rec.client_level !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: client_level" },
          400
        );
      }
      client_level = rec.client_level;
    }

    let session_date: string | null = null;
    if (rec.session_date !== undefined && rec.session_date !== null) {
      if (typeof rec.session_date !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: session_date" },
          400
        );
      }
      session_date = rec.session_date;
    }

    let status: SessionStatus = "draft";
    if (rec.status !== undefined && rec.status !== null) {
      if (!isSessionStatus(rec.status)) {
        return jsonResponse(
          { success: false, error: "Invalid field: status" },
          400
        );
      }
      status = rec.status;
    }

    await ensureProfile(user);

    // Omit client_notes: column may be missing in DB until migration is applied;
    // evaluation still receives client_notes from the request body via POST /api/agents/sessions.
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

    const id = rec.id;
    if (id !== undefined && id !== null) {
      if (typeof id !== "string") {
        return jsonResponse({ success: false, error: "Invalid field: id" }, 400);
      }

      try {
        const { data, error } = await supabase
          .from("session_plans")
          .update(payload)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) {
          console.error("[api/sessions POST] session_plans update error:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          if (error.code === "PGRST116") {
            return jsonResponse(
              { success: false, error: "Session plan not found" },
              404
            );
          }
          return jsonResponse(
            { success: false, error: SESSION_PLAN_SAVE_FAILED },
            500
          );
        }

        if (!data) {
          return jsonResponse(
            { success: false, error: "Session plan not found" },
            404
          );
        }

        return jsonResponse({ success: true, data: data as SessionPlan });
      } catch (dbErr) {
        console.error("[api/sessions POST] session_plans update exception:", dbErr);
        return jsonResponse(
          { success: false, error: SESSION_PLAN_SAVE_FAILED },
          500
        );
      }
    }

    try {
      const { data, error } = await supabase
        .from("session_plans")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("[api/sessions POST] session_plans insert error:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        return jsonResponse(
          { success: false, error: SESSION_PLAN_SAVE_FAILED },
          500
        );
      }

      return jsonResponse({ success: true, data: data as SessionPlan });
    } catch (dbErr) {
      console.error("[api/sessions POST] session_plans insert exception:", dbErr);
      return jsonResponse(
        { success: false, error: SESSION_PLAN_SAVE_FAILED },
        500
      );
    }
  } catch (err) {
    console.error("[api/sessions POST]", err);
    return jsonResponse({ success: false, error: SESSION_PLAN_SAVE_FAILED }, 500);
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
          return jsonResponse(
            { success: false, error: SESSION_PLAN_SAVE_FAILED },
            500
          );
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

    if (body.client_notes !== undefined) {
      if (body.client_notes !== null && typeof body.client_notes !== "string") {
        return jsonResponse(
          { success: false, error: "Invalid field: client_notes" },
          400
        );
      }
      patch.client_notes = body.client_notes;
    }

    if (Object.keys(patch).length === 0) {
      return jsonResponse(
        {
          success: false,
          error:
            "At least one of status, linked_hour_log_id, feedback, or client_notes is required",
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
      return jsonResponse(
        { success: false, error: SESSION_PLAN_SAVE_FAILED },
        500
      );
    }

    if (!data) {
      return jsonResponse(
        { success: false, error: "Session plan not found" },
        404
      );
    }

    return jsonResponse({ success: true, data: data as SessionPlan });
  } catch (err) {
    console.error("[api/sessions PATCH]", err);
    return jsonResponse({ success: false, error: SESSION_PLAN_SAVE_FAILED }, 500);
  }
}
