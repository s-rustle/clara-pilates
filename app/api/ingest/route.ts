import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  AUTH_REQUIRED,
  GOOGLE_DRIVE_NOT_CONNECTED,
  REAUTH_REQUIRED,
} from "@/lib/api/messages";
import { ensureGoogleAccessToken } from "@/lib/google/ensureAccessToken";
import {
  listFilesInFolder,
  downloadFile,
  isGoogleDriveReauthRequiredError,
} from "@/lib/google/drive";
import type { ContentChunk } from "@/types";
import {
  processImage,
  processPdf,
  chunkContent,
  embedAndStore,
  countChunksForUploadFile,
} from "@/lib/google/ingest";

/**
 * Vercel Pro (or equivalent) — raises the serverless cap above the default ~10s.
 * @see https://vercel.com/docs/functions/configuring-functions/duration
 */
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

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

  const tokenResult = await ensureGoogleAccessToken(supabase, userId);
  if (!tokenResult.ok) {
    if (tokenResult.error === "not_connected") {
      return jsonResponse(
        { success: false, error: GOOGLE_DRIVE_NOT_CONNECTED },
        400
      );
    }
    return jsonResponse({ error: REAUTH_REQUIRED }, 401);
  }
  let accessToken = tokenResult.accessToken;

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

  try {
    const filesResult = await listFilesInFolder(accessToken, drive_folder_id);

    if ("error" in filesResult) {
      await serviceClient
        .from("curriculum_uploads")
        .update({ status: "failed", error_message: filesResult.error })
        .eq("id", uploadId);

      if (filesResult.error === REAUTH_REQUIRED) {
        return jsonResponse({ error: REAUTH_REQUIRED }, 401);
      }
      return jsonResponse(
        { success: false, error: filesResult.error },
        400
      );
    }

    const files = filesResult as {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
    }[];

    const allChunks: ContentChunk[] = [];
    const fileErrors: string[] = [];
    const skipped_files: string[] = [];
    const skipped_oversized: string[] = [];
    let files_processed = 0;
    let files_failed = 0;

    const isPdf = (mime: string, name: string) =>
      mime === "application/pdf" ||
      name.toLowerCase().endsWith(".pdf");

    type DriveFile = {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
    };
    const filesToIngest: DriveFile[] = [];

    for (const file of files) {
      const listedSize = parseInt(file.size ?? "0", 10);
      if (
        Number.isFinite(listedSize) &&
        listedSize > MAX_FILE_BYTES
      ) {
        console.warn(
          `[INGEST] Skipping oversized file "${file.name}" (${(listedSize / (1024 * 1024)).toFixed(1)}MB > 20MB limit)`
        );
        skipped_oversized.push(file.name);
        continue;
      }

      let existingCount = 0;
      try {
        existingCount = await countChunksForUploadFile(uploadId, file.name);
      } catch (countErr) {
        const msg =
          countErr instanceof Error ? countErr.message : String(countErr);
        console.error(
          "[INGEST] curriculum_chunks count failed for",
          file.name,
          msg
        );
        fileErrors.push(
          `${file.name}: could not check existing chunks (${msg})`
        );
        files_failed += 1;
        continue;
      }

      if (existingCount > 0) {
        console.log(
          `[INGEST] Skipping already-ingested file "${file.name}" (upload_id=${uploadId}, chunks=${existingCount})`
        );
        skipped_files.push(file.name);
        continue;
      }

      filesToIngest.push(file);
    }

    /** One file at a time — isolates failures and avoids parallel memory spikes. */
    for (const file of filesToIngest) {
      const treatAsPdf = isPdf(file.mimeType, file.name);
      try {
        let buffer: Buffer;
        try {
          buffer = await downloadFile(accessToken, file.id);
        } catch (downErr) {
          if (isGoogleDriveReauthRequiredError(downErr)) {
            const again = await ensureGoogleAccessToken(supabase, userId, {
              forceRefresh: true,
            });
            if (!again.ok) {
              await serviceClient
                .from("curriculum_uploads")
                .update({ status: "failed", error_message: REAUTH_REQUIRED })
                .eq("id", uploadId);
              return jsonResponse({ error: REAUTH_REQUIRED }, 401);
            }
            accessToken = again.accessToken;
            buffer = await downloadFile(accessToken, file.id);
          } else {
            throw downErr;
          }
        }

        if (buffer.length > MAX_FILE_BYTES) {
          console.warn(
            `[INGEST] Skipping oversized download "${file.name}" (${(buffer.length / (1024 * 1024)).toFixed(1)}MB > 20MB limit)`
          );
          skipped_oversized.push(file.name);
          continue;
        }

        const extracted = treatAsPdf
          ? await processPdf(buffer, file.name, folder_name)
          : await processImage(buffer, file.name, folder_name);

        if ("error" in extracted) {
          console.error(
            "[INGEST] processPdf/processImage failed for",
            file.name,
            ":",
            extracted.error
          );
          fileErrors.push(`${file.name}: ${extracted.error}`);
          files_failed += 1;
          continue;
        }

        const chunks = chunkContent(
          extracted,
          uploadId,
          folder_name,
          file.name,
          {
            driveFileId: file.id,
            mimeType: file.mimeType,
          }
        );
        allChunks.push(...chunks);
        files_processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[INGEST] file pipeline failed:", file.name, message);
        fileErrors.push(`${file.name}: ${message}`);
        files_failed += 1;
      }
    }

    const skipped_count = skipped_files.length;
    const skipped_oversized_count = skipped_oversized.length;

    /** All Drive files were skipped (already in DB, over limit, etc.); nothing new to embed */
    if (
      allChunks.length === 0 &&
      files.length > 0 &&
      fileErrors.length === 0
    ) {
      const { count: totalChunks, error: totalErr } = await serviceClient
        .from("curriculum_chunks")
        .select("*", { count: "exact", head: true })
        .eq("upload_id", uploadId);

      if (totalErr) {
        await serviceClient
          .from("curriculum_uploads")
          .update({
            status: "failed",
            error_message: `Could not read chunk total: ${totalErr.message}`,
          })
          .eq("id", uploadId);
        return jsonResponse(
          {
            success: false,
            upload_id: uploadId,
            error: totalErr.message,
            chunks_stored: 0,
            skipped_files,
            skipped_count,
            skipped_oversized,
            skipped_oversized_count,
            files_succeeded: 0,
            files_failed,
            files_processed: 0,
            partial: false,
            errors: fileErrors,
          },
          500
        );
      }

      await serviceClient
        .from("curriculum_uploads")
        .update({
          status: "complete",
          last_ingested_at: new Date().toISOString(),
          file_count: totalChunks ?? 0,
          error_message: null,
        })
        .eq("id", uploadId);

      return jsonResponse({
        success: true,
        upload_id: uploadId,
        chunks_stored: 0,
        skipped_files,
        skipped_count,
        skipped_oversized,
        skipped_oversized_count,
        files_succeeded: 0,
        files_failed: 0,
        files_processed: 0,
        partial: false,
        errors: [],
        message: `${skipped_count} file(s) already up to date, ${skipped_oversized_count} over 20MB skipped, 0 new files ingested`,
      });
    }

    if (allChunks.length === 0 && files.length > 0) {
      const errorSummary =
        fileErrors.length > 0
          ? fileErrors.slice(0, 3).join("; ") +
            (fileErrors.length > 3 ? "..." : "")
          : "All files failed to process";

      const { count: failTotal } = await serviceClient
        .from("curriculum_chunks")
        .select("*", { count: "exact", head: true })
        .eq("upload_id", uploadId);

      await serviceClient
        .from("curriculum_uploads")
        .update({
          status: "failed",
          error_message: errorSummary,
          file_count: failTotal ?? 0,
        })
        .eq("id", uploadId);

      return jsonResponse(
        {
          success: false,
          upload_id: uploadId,
          error: `Ingestion failed: ${errorSummary}`,
          chunks_stored: 0,
          skipped_files,
          skipped_count,
          skipped_oversized,
          skipped_oversized_count,
          files_succeeded: 0,
          files_failed,
          files_processed: 0,
          partial: false,
          errors: fileErrors,
        },
        500
      );
    }

    const result = await embedAndStore(allChunks, userId, uploadId);

    const { count: totalAfter, error: totalAfterErr } = await serviceClient
      .from("curriculum_chunks")
      .select("*", { count: "exact", head: true })
      .eq("upload_id", uploadId);

    if (!totalAfterErr) {
      await serviceClient
        .from("curriculum_uploads")
        .update({ file_count: totalAfter ?? 0 })
        .eq("id", uploadId);
    }

    const combinedErrors = fileErrors.concat(result.errors);
    const hadFileLevelIssues =
      fileErrors.length > 0 || skipped_oversized_count > 0;
    const partialSuccess =
      result.chunks_stored > 0 &&
      (hadFileLevelIssues || !result.success);
    /** At least one file produced stored chunks → 200; total embedding failure stays 500. */
    const statusCode =
      result.chunks_stored > 0 ? 200 : 500;
    const responseSuccess = result.chunks_stored > 0;
    const newSummary = `${files_processed} file(s) processed, ${skipped_count} already up to date, ${skipped_oversized_count} skipped (over 20MB limit)`;
    const errorForClient =
      responseSuccess && partialSuccess && combinedErrors.length > 0
        ? combinedErrors.slice(0, 5).join("; ") +
          (combinedErrors.length > 5 ? "…" : "")
        : !responseSuccess && combinedErrors.length > 0
          ? combinedErrors.slice(0, 5).join("; ") +
            (combinedErrors.length > 5 ? "…" : "")
          : !responseSuccess
            ? newSummary
            : undefined;

    return jsonResponse(
      {
        success: responseSuccess,
        partial: partialSuccess,
        error: errorForClient,
        upload_id: uploadId,
        chunks_stored: result.chunks_stored,
        skipped_files,
        skipped_count,
        skipped_oversized,
        skipped_oversized_count,
        files_succeeded: files_processed,
        files_failed,
        files_processed,
        errors: combinedErrors,
        message: newSummary,
      },
      statusCode
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[INGEST] Unhandled error:", message);
    await serviceClient
      .from("curriculum_uploads")
      .update({
        status: "failed",
        error_message: `Ingestion interrupted: ${message}`,
      })
      .eq("id", uploadId);
    return jsonResponse(
      {
        success: false,
        upload_id: uploadId,
        error: `Ingestion failed: ${message}`,
        skipped_files: [] as string[],
        skipped_count: 0,
        skipped_oversized: [] as string[],
        skipped_oversized_count: 0,
        files_succeeded: 0,
        files_failed: 0,
        files_processed: 0,
        partial: false,
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
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
    return jsonResponse({ success: false, error: AUTH_REQUIRED }, 401);
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
