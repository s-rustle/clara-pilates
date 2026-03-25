import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_REQUIRED, GOOGLE_DRIVE_NOT_CONNECTED } from "@/lib/api/messages";
import { listFilesInFolder, downloadFile } from "@/lib/google/drive";

/** Hardcoded visual-quiz source folders (user-provided Drive IDs). */
const ALLOWED_FOLDER_IDS = new Set([
  "17nIjfkN73yVju53b1yFiWPa2FRfq9Jka",
  "1-UeK3mlSReqezP_M6_r0s3XwzcR5a4T9",
]);

export async function GET(request: NextRequest) {
  const folderId = request.nextUrl.searchParams.get("folderId");
  if (!folderId || !ALLOWED_FOLDER_IDS.has(folderId)) {
    return Response.json(
      { error: "Invalid or missing folderId" },
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

  const listed = await listFilesInFolder(accessToken, folderId, refreshToken);
  if ("error" in listed) {
    return Response.json({ error: listed.error }, { status: 502 });
  }

  const pdfs = listed.filter((f) => f.mimeType === "application/pdf");
  if (pdfs.length === 0) {
    return Response.json(
      {
        error:
          "No PDF files found in this folder. Confirm the folder is shared with your connected Google account.",
      },
      { status: 404 }
    );
  }

  const pick = pdfs[Math.floor(Math.random() * pdfs.length)]!;

  try {
    const buffer = await downloadFile(accessToken, pick.id, refreshToken);
    const base64 = buffer.toString("base64");
    return Response.json({
      fileName: pick.name,
      base64,
      mimeType: "application/pdf",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/quiz/visual-page]", message);
    return Response.json(
      { error: "Failed to download PDF from Drive" },
      { status: 502 }
    );
  }
}
