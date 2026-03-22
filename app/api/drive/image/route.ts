import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { downloadFile, getFileMetadata } from "@/lib/google/drive";

/**
 * Serves a curriculum image from Google Drive for quiz diagram questions.
 * Looks up drive_file_id from curriculum_chunks by file_name and folder_name.
 */
export async function GET(request: NextRequest) {
  const file_name = request.nextUrl.searchParams.get("file_name");
  const folder_name = request.nextUrl.searchParams.get("folder_name");

  if (!file_name || !folder_name) {
    return Response.json(
      { error: "Missing required query params: file_name and folder_name" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: chunk } = await serviceClient
    .from("curriculum_chunks")
    .select("drive_file_id")
    .eq("user_id", user.id)
    .eq("folder_name", folder_name)
    .eq("file_name", file_name)
    .not("drive_file_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!chunk?.drive_file_id) {
    return Response.json(
      { error: "File not found in your curriculum. Ensure the Anatomy folder is ingested." },
      { status: 404 }
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
    return Response.json(
      { error: "Google Drive not connected. Connect Drive in Curriculum settings." },
      { status: 400 }
    );
  }

  try {
    const meta = await getFileMetadata(
      accessToken,
      chunk.drive_file_id,
      refreshToken
    );
    if (!meta.mimeType.startsWith("image/")) {
      return Response.json(
        { error: "File is not an image" },
        { status: 400 }
      );
    }
    const buffer = await downloadFile(
      accessToken,
      chunk.drive_file_id,
      refreshToken
    );

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive/image]", message);
    return Response.json(
      { error: "Failed to load image from Drive" },
      { status: 502 }
    );
  }
}
