import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { listFilesInFolder, downloadFile } from "@/lib/google/drive";
import type { ContentChunk } from "@/types";
import {
  processImage,
  processPdf,
  chunkContent,
  embedAndStore,
} from "@/lib/google/ingest";

function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function runIngestion(
  request: NextRequest,
  userId: string
): Promise<Response> {
  const supabase = await createClient();
  const body = await request.json();
  const drive_folder_id = body.drive_folder_id;
  const folder_name = body.folder_name;

  if (!drive_folder_id || typeof drive_folder_id !== "string") {
    return jsonResponse(
      { success: false, error: "Missing required field: drive_folder_id" },
      400
    );
  }
  if (!folder_name || typeof folder_name !== "string") {
    return jsonResponse(
      { success: false, error: "Missing required field: folder_name" },
      400
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token")
    .eq("id", userId)
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

  const serviceClient = createServiceClient();

  const { data: existingUpload } = await serviceClient
    .from("curriculum_uploads")
    .select("id")
    .eq("user_id", userId)
    .eq("drive_folder_id", drive_folder_id)
    .single();

  let uploadId: string;

  if (existingUpload) {
    const { error: updateError } = await serviceClient
      .from("curriculum_uploads")
      .update({ status: "processing", error_message: null })
      .eq("id", existingUpload.id);

    if (updateError) {
      return jsonResponse(
        { success: false, error: `Failed to start ingestion: ${updateError.message}` },
        500
      );
    }
    uploadId = existingUpload.id;
  } else {
    const { data: newUpload, error: insertError } = await serviceClient
      .from("curriculum_uploads")
      .insert({
        user_id: userId,
        folder_name,
        drive_folder_id,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      return jsonResponse(
        { success: false, error: `Failed to create upload record: ${insertError.message}` },
        500
      );
    }
    if (!newUpload?.id) {
      return jsonResponse(
        { success: false, error: "Failed to create upload record: no id returned" },
        500
      );
    }
    uploadId = newUpload.id;
  }

  const filesResult = await listFilesInFolder(
    accessToken,
    drive_folder_id,
    refreshToken
  );

  if ("error" in filesResult) {
    await serviceClient
      .from("curriculum_uploads")
      .update({ status: "failed", error_message: filesResult.error })
      .eq("id", uploadId);

    const isAuthError = new RegExp("401|unauthorized|token|refresh", "i").test(
      filesResult.error
    );
    return jsonResponse(
      {
        success: false,
        error: isAuthError
          ? "Google Drive not connected. Please connect your Drive account first."
          : filesResult.error,
      },
      400
    );
  }

  const files = filesResult as { id: string; name: string; mimeType: string }[];

  const allChunks: ContentChunk[] = [];
  const fileErrors: string[] = [];

  const isPdf = (mime: string, name: string) =>
    mime === "application/pdf" ||
    name.toLowerCase().endsWith(".pdf");

  for (const file of files) {
    const treatAsPdf = isPdf(file.mimeType, file.name);
    try {
      const buffer = await downloadFile(
        accessToken,
        file.id,
        refreshToken
      );
      const extracted = treatAsPdf
        ? await processPdf(buffer, file.name, folder_name)
        : await processImage(buffer, file.name, folder_name);

      if ("error" in extracted) {
        console.error("[INGEST] processPdf/processImage failed for", file.name, ":", extracted.error);
        fileErrors.push(`${file.name}: ${extracted.error}`);
        continue;
      }

      const chunks = chunkContent(extracted, uploadId, folder_name, file.name);
      allChunks.push(...chunks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      fileErrors.push(`${file.name}: ${message}`);
    }
  }

  if (allChunks.length === 0 && files.length > 0) {
    const errorSummary =
      fileErrors.length > 0
        ? fileErrors.slice(0, 3).join("; ") +
          (fileErrors.length > 3 ? "..." : "")
        : "All files failed to process";

    await serviceClient
      .from("curriculum_uploads")
      .update({
        status: "failed",
        error_message: errorSummary,
        file_count: 0,
      })
      .eq("id", uploadId);

    return jsonResponse(
      {
        success: false,
        upload_id: uploadId,
        error: `Ingestion failed: ${errorSummary}`,
        chunks_stored: 0,
        errors: fileErrors,
      },
      500
    );
  }

  const result = await embedAndStore(allChunks, userId, uploadId);
  const statusCode = result.success ? 200 : 500;
  return jsonResponse(
    {
      success: result.success,
      upload_id: uploadId,
      chunks_stored: result.chunks_stored,
      errors: fileErrors.concat(result.errors),
    },
    statusCode
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    return await runIngestion(request, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { success: false, error: `Ingestion failed: ${message}` },
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const upload_id = body.upload_id;

    if (!upload_id || typeof upload_id !== "string") {
      return jsonResponse(
        { success: false, error: "Missing required field: upload_id" },
        400
      );
    }

    const serviceClient = createServiceClient();

    const { error: deleteError } = await serviceClient
      .from("curriculum_chunks")
      .delete()
      .eq("upload_id", upload_id)
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonResponse(
        { success: false, error: `Failed to delete chunks: ${deleteError.message}` },
        500
      );
    }

    const { error: updateError } = await serviceClient
      .from("curriculum_uploads")
      .update({
        status: "pending",
        last_ingested_at: null,
        file_count: null,
        error_message: null,
      })
      .eq("id", upload_id)
      .eq("user_id", user.id);

    if (updateError) {
      return jsonResponse(
        {
          success: false,
          error: `Failed to reset upload record: ${updateError.message}`,
        },
        500
      );
    }

    return jsonResponse({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { success: false, error: `Delete failed: ${message}` },
      500
    );
  }
}
