import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  PROFILE_LOAD_FAILED,
  PROFILE_SAVE_FAILED,
} from "@/lib/api/messages";
import type { HourTargets } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function ensureProfileRow(user: {
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

function parseHourTargetsPayload(input: unknown): HourTargets | null {
  if (input === null || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const mat = Number(o.mat_practical);
  const ref = Number(o.reformer_practical);
  const app = Number(o.apparatus_practical);
  const total = Number(o.total);
  if (
    !Number.isFinite(mat) ||
    !Number.isFinite(ref) ||
    !Number.isFinite(app) ||
    !Number.isFinite(total) ||
    mat <= 0 ||
    ref <= 0 ||
    app <= 0 ||
    total <= 0
  ) {
    return null;
  }
  return {
    mat_practical: mat,
    reformer_practical: ref,
    apparatus_practical: app,
    total,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    await ensureProfileRow(user);

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, exam_target_date, hour_targets")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      console.error("[api/profile GET]", error?.message);
      return jsonResponse({ success: false, error: PROFILE_LOAD_FAILED }, 500);
    }

    return jsonResponse({
      success: true,
      data: {
        email: user.email ?? "",
        full_name: data.full_name as string | null,
        exam_target_date: data.exam_target_date as string | null,
        hour_targets: data.hour_targets as HourTargets | null,
      },
    });
  } catch (err) {
    console.error("[api/profile GET]", err);
    return jsonResponse({ success: false, error: PROFILE_LOAD_FAILED }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
  }

  try {
    await ensureProfileRow(user);

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return jsonResponse(
        { success: false, error: "Invalid request body" },
        400
      );
    }

    const record = body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    if ("full_name" in record) {
      const v = record.full_name;
      updates.full_name =
        v === null || v === undefined || v === ""
          ? null
          : String(v).trim() || null;
    }

    if ("exam_target_date" in record) {
      const v = record.exam_target_date;
      if (v === null || v === undefined || v === "") {
        updates.exam_target_date = null;
      } else if (typeof v === "string") {
        const trimmed = v.trim();
        if (!trimmed) {
          updates.exam_target_date = null;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return jsonResponse(
            { success: false, error: "Invalid exam target date format." },
            400
          );
        } else {
          updates.exam_target_date = trimmed;
        }
      } else {
        return jsonResponse(
          { success: false, error: "Invalid exam target date." },
          400
        );
      }
    }

    if ("hour_targets" in record) {
      const parsed = parseHourTargetsPayload(record.hour_targets);
      if (!parsed) {
        return jsonResponse(
          {
            success: false,
            error:
              "Hour targets must be positive numbers for Mat, Reformer, Apparatus, and Total.",
          },
          400
        );
      }
      updates.hour_targets = parsed;
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(
        { success: false, error: "No valid fields to update." },
        400
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("[api/profile PATCH]", error.message);
      return jsonResponse({ success: false, error: PROFILE_SAVE_FAILED }, 500);
    }

    return jsonResponse({ success: true, data: { updated: true } });
  } catch (err) {
    console.error("[api/profile PATCH]", err);
    return jsonResponse({ success: false, error: PROFILE_SAVE_FAILED }, 500);
  }
}
