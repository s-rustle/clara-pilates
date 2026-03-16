import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askCurriculum } from "@/lib/anthropic/agents/curriculum";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const query = body?.query;
    const folder_filter = body?.folder_filter;

    if (!query || typeof query !== "string") {
      return Response.json(
        { success: false, error: "Missing required field: query" },
        { status: 400 }
      );
    }

    const data = await askCurriculum(query, user.id, folder_filter);
    return Response.json({ success: true, data });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to get answer",
      },
      { status: 500 }
    );
  }
}
