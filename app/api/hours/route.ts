import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { HourLog } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
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
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const date_from = searchParams.get("date_from");
    const date_to = searchParams.get("date_to");

    let query = supabase
      .from("hour_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("session_date", { ascending: false });

    if (category) query = query.eq("category", category);
    if (status) query = query.eq("status", status);
    if (date_from) query = query.gte("session_date", date_from);
    if (date_to) query = query.lte("session_date", date_to);

    const { data, error } = await query;

    if (error) {
      return jsonResponse(
        { success: false, error: error.message },
        500
      );
    }

    return jsonResponse({ success: true, data: data as HourLog[] });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch hour logs",
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

    const category = body.category;
    const sub_type = body.sub_type;
    const session_date = body.session_date;
    const duration_minutes = body.duration_minutes;

    if (!category || typeof category !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: category" },
        400
      );
    }
    if (!sub_type || typeof sub_type !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: sub_type" },
        400
      );
    }
    if (!session_date || typeof session_date !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: session_date" },
        400
      );
    }
    if (
      duration_minutes === undefined ||
      duration_minutes === null ||
      typeof duration_minutes !== "number"
    ) {
      return jsonResponse(
        { success: false, error: "Missing required field: duration_minutes" },
        400
      );
    }

    let status = body.status;
    if (!status) {
      const sessionDate = new Date(session_date);
      const today = new Date();
      sessionDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      status = sessionDate <= today ? "logged" : "scheduled";
    }

    const notes = body.notes ?? null;

    // Ensure profile exists — hour_logs.user_id references profiles(id)
    const service = createServiceClient();
    await service
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name ?? user.email ?? null,
        },
        { onConflict: "id" }
      );

    const { data, error } = await supabase
      .from("hour_logs")
      .insert({
        user_id: user.id,
        category,
        sub_type,
        session_date,
        duration_minutes,
        notes,
        status,
      })
      .select()
      .single();

    if (error) {
      return jsonResponse(
        { success: false, error: error.message },
        500
      );
    }

    return jsonResponse({ success: true, data: data as HourLog });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to create hour log",
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
    const status = body.status;

    if (!id || typeof id !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: id" },
        400
      );
    }
    if (!status || typeof status !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: status" },
        400
      );
    }

    if (status === "complete") {
      const { data: existing, error: fetchError } = await supabase
        .from("hour_logs")
        .select("session_date")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        return jsonResponse(
          { success: false, error: "Hour log not found" },
          404
        );
      }

      const sessionDate = new Date((existing as { session_date: string }).session_date);
      const today = new Date();
      sessionDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (today < sessionDate) {
        return jsonResponse(
          {
            success: false,
            error:
              "Cannot mark as complete until on or after the session date",
          },
          400
        );
      }
    }

    const { data, error } = await supabase
      .from("hour_logs")
      .update({ status })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return jsonResponse(
        { success: false, error: error.message },
        500
      );
    }

    return jsonResponse({ success: true, data: data as HourLog });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Failed to update hour log",
      },
      500
    );
  }
}
