import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, GOOGLE_DRIVE_NOT_CONNECTED } from "@/lib/api/messages";
import { downloadFile, getFileMetadata } from "@/lib/google/drive";

/**
 * Proxies a Google Drive file the user has previously ingested (curriculum_chunks.drive_file_id).
 * Use for <img src="..."> in Study so textbook photos render without public Drive links.
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");
  if (!fileId || fileId.length < 10) {
    return Response.json({ error: "Missing or invalid fileId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: allowed } = await serviceClient
    .from("curriculum_chunks")
    .select("id")
    .eq("user_id", user.id)
    .eq("drive_file_id", fileId)
    .limit(1)
    .maybeSingle();

  if (!allowed) {
    return Response.json(
      {
        error:
          "That file is not part of your ingested curriculum, or you do not have access.",
      },
      { status: 403 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token")
    .eq("id", user.id)
    .single();

  const accessToken = profile?.google_access_token ?? null;
  const refreshToken = profile?.google_refresh_token ?? null;

  if (!accessToken || !refreshToken) {
    return Response.json({ error: GOOGLE_DRIVE_NOT_CONNECTED }, { status: 400 });
  }

  try {
    const meta = await getFileMetadata(accessToken, fileId, refreshToken);
    const buffer = await downloadFile(accessToken, fileId, refreshToken);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive-media]", message);
    return Response.json({ error: "Failed to load file from Drive" }, { status: 502 });
  }
}
