import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, CURRICULUM_UPLOADS_LOAD_FAILED } from "@/lib/api/messages";
import type { CurriculumUpload } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
    }

    const { data, error } = await supabase
      .from("curriculum_uploads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonResponse(
        { success: false, error: CURRICULUM_UPLOADS_LOAD_FAILED },
        500
      );
    }

    return jsonResponse({ success: true, uploads: data as CurriculumUpload[] });
  } catch (err) {
    console.error("[api/ingest/status]", err);
    return jsonResponse(
      { success: false, error: CURRICULUM_UPLOADS_LOAD_FAILED },
      500
    );
  }
}
