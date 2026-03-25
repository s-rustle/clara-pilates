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
  REAUTH_REQUIRED,
} from "@/lib/api/messages";
import { ensureGoogleAccessToken } from "@/lib/google/ensureAccessToken";
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

    const tokenResult = await ensureGoogleAccessToken(supabase, user.id);
    if (!tokenResult.ok) {
      if (tokenResult.error === "not_connected") {
        return jsonResponse(
          { success: false, error: GOOGLE_DRIVE_NOT_CONNECTED },
          400
        );
      }
      return jsonResponse({ error: REAUTH_REQUIRED }, 401);
    }
    const { accessToken } = tokenResult;

    const rootResult = await listFolders(accessToken);

    if ("error" in rootResult) {
      if (rootResult.error === REAUTH_REQUIRED) {
        return jsonResponse({ error: REAUTH_REQUIRED }, 401);
      }
      return jsonResponse({ success: false, error: rootResult.error }, 502);
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
        balancedBodyFolder.id
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
