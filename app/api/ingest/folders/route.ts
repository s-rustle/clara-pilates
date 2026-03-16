import { createClient } from "@/lib/supabase/server";
import { listFolders, listFoldersInFolder } from "@/lib/google/drive";
import type { DriveFolder } from "@/types";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
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
        error:
          "Google Drive not connected. Please connect your Drive account first.",
      },
      400
    );
  }

  const rootResult = await listFolders(accessToken, refreshToken);

  if ("error" in rootResult) {
    return jsonResponse(
      { success: false, error: rootResult.error },
      500
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

  return jsonResponse({ folders: allFolders });
}
