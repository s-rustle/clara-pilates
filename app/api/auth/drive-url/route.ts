import { createClient } from "@/lib/supabase/server";
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
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const url = generateAuthUrl();
    return jsonResponse({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { error: message || "Failed to get auth URL" },
      500
    );
  }
}
