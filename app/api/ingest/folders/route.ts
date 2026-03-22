/**
 * Lists Google Drive folders for the curriculum folder picker.
 * File-level ingestion and deduplication (skip if chunks already exist for
 * upload_id + file_name) live in `app/api/ingest/route.ts` (POST).
 */
import { createClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  GOOGLE_DRIVE_CONNECT_FAILED,
  GOOGLE_DRIVE_NOT_CONNECTED,
} from "@/lib/api/messages";
import { listFolders, listFoldersInFolder } from "@/lib/google/drive";
import type { DriveFolder } from "@/types";

export const maxDuration = 60;

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token")
      .eq("id", user.id)
      .single();

    const accessToken = profile?.google_access_token ?? null;
    const refreshToken = profile?.google_refresh_token ?? null;

    if (!accessToken || !refreshToken) {
      return jsonResponse(
        {
          success: false,
          error: GOOGLE_DRIVE_NOT_CONNECTED,
        },
        400
      );
    }

    const rootResult = await listFolders(accessToken, refreshToken);

    if ("error" in rootResult) {
      const msg = rootResult.error;
      const isAuthError = new RegExp("401|unauthorized|token|refresh", "i").test(
        msg
      );
      return jsonResponse(
        {
          success: false,
          error: isAuthError ? GOOGLE_DRIVE_NOT_CONNECTED : msg,
        },
        isAuthError ? 400 : 502
      );
    }

    const allFolders: DriveFolder[] = [...rootResult];

    const balancedBodyFolder = rootResult.find(
      (f) =>
        f.name.toLowerCase() === "balanced body exam" ||
        f.name.toLowerCase() === "balanced body"
    );

    if (balancedBodyFolder) {
      const subResult = await listFoldersInFolder(
        accessToken,
        balancedBodyFolder.id,
        refreshToken
      );
      if (!("error" in subResult)) {
        allFolders.push(...subResult);
      }
    }

    return jsonResponse({ success: true, folders: allFolders });
  } catch (err) {
    console.error("[api/ingest/folders]", err);
    return jsonResponse(
      { success: false, error: GOOGLE_DRIVE_CONNECT_FAILED },
      502
    );
  }
}
