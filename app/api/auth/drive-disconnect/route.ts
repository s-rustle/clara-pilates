import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED } from "@/lib/api/messages";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function PATCH() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
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
        {
          success: false,
          error:
            "Could not disconnect Google Drive. Please try again in a moment.",
        },
        500
      );
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("[api/auth/drive-disconnect]", err);
    return jsonResponse(
      {
        success: false,
        error:
          "Could not disconnect Google Drive. Please try again in a moment.",
      },
      500
    );
  }
}
