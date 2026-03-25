import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  GOOGLE_DRIVE_NOT_CONNECTED,
  REAUTH_REQUIRED,
} from "@/lib/api/messages";
import { ensureGoogleAccessToken } from "@/lib/google/ensureAccessToken";
import {
  downloadFile,
  getFileMetadata,
  isGoogleDriveReauthRequiredError,
} from "@/lib/google/drive";

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
    return Response.json({ error: AUTH_REQUIRED }, { status: 401 });
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

  const tokenResult = await ensureGoogleAccessToken(supabase, user.id);
  if (!tokenResult.ok) {
    if (tokenResult.error === "not_connected") {
      return Response.json({ error: GOOGLE_DRIVE_NOT_CONNECTED }, { status: 400 });
    }
    return Response.json({ error: REAUTH_REQUIRED }, { status: 401 });
  }
  let accessToken = tokenResult.accessToken;

  try {
    let meta: Awaited<ReturnType<typeof getFileMetadata>>;
    try {
      meta = await getFileMetadata(accessToken, chunk.drive_file_id);
    } catch (e) {
      if (!isGoogleDriveReauthRequiredError(e)) throw e;
      const again = await ensureGoogleAccessToken(supabase, user.id, {
        forceRefresh: true,
      });
      if (!again.ok) {
        return Response.json(
          { error: REAUTH_REQUIRED },
          { status: 401 }
        );
      }
      accessToken = again.accessToken;
      meta = await getFileMetadata(accessToken, chunk.drive_file_id);
    }
    if (!meta.mimeType.startsWith("image/")) {
      return Response.json(
        { error: "File is not an image" },
        { status: 400 }
      );
    }
    let buffer: Buffer;
    try {
      buffer = await downloadFile(accessToken, chunk.drive_file_id);
    } catch (e) {
      if (!isGoogleDriveReauthRequiredError(e)) throw e;
      const again = await ensureGoogleAccessToken(supabase, user.id, {
        forceRefresh: true,
      });
      if (!again.ok) {
        return Response.json({ error: REAUTH_REQUIRED }, { status: 401 });
      }
      accessToken = again.accessToken;
      buffer = await downloadFile(accessToken, chunk.drive_file_id);
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    if (isGoogleDriveReauthRequiredError(e)) {
      return Response.json({ error: REAUTH_REQUIRED }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[drive/image]", message);
    return Response.json(
      { error: "Failed to load image from Drive" },
      { status: 502 }
    );
  }
}
