import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, GOOGLE_DRIVE_CONNECT_FAILED } from "@/lib/api/messages";
import { generateAuthUrl } from "@/lib/google/auth";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ error: AUTH_REQUIRED }, 401);
  }

  try {
    const url = generateAuthUrl();
    return jsonResponse({ url });
  } catch (err) {
    console.error("[api/auth/drive-url]", err);
    return jsonResponse({ error: GOOGLE_DRIVE_CONNECT_FAILED }, 502);
  }
}
