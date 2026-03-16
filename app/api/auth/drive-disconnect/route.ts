import { createClient } from "@/lib/supabase/server";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function PATCH() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      google_access_token: null,
      google_refresh_token: null,
    })
    .eq("id", user.id);

  if (error) {
    return jsonResponse(
      { success: false, error: `Failed to disconnect: ${error.message}` },
      500
    );
  }

  return jsonResponse({ success: true });
}
