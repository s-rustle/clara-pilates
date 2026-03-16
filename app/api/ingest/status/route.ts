import { createClient } from "@/lib/supabase/server";
import type { CurriculumUpload } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const { data, error } = await supabase
    .from("curriculum_uploads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse(
      { success: false, error: error.message },
      500
    );
  }

  return jsonResponse({ success: true, uploads: data as CurriculumUpload[] });
}
