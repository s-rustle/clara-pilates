import { google } from "googleapis";
import type { DriveFolder, DriveFile } from "@/types";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { REAUTH_REQUIRED } from "@/lib/api/messages";

export type DriveFileMetadata = {
  mimeType: string;
  name: string;
};

/** Thrown when Drive returns 401 after a fresh token (revoked scope / invalid grant in flight). */
export class GoogleDriveReauthRequiredError extends Error {
  constructor() {
    super(REAUTH_REQUIRED);
    this.name = "GoogleDriveReauthRequiredError";
  }
}

export function isGoogleDriveReauthRequiredError(
  e: unknown
): e is GoogleDriveReauthRequiredError {
  return e instanceof GoogleDriveReauthRequiredError;
}

const SUPPORTED_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/pdf",
];

function is401Error(err: unknown): boolean {
  if (err && typeof err === "object") {
    const obj = err as { code?: number; response?: { status?: number } };
    if (obj.code === 401) return true;
    if (obj.response?.status === 401) return true;
  }
  if (err instanceof Error && /401|unauthorized/i.test(err.message)) return true;
  return false;
}

function reauthListError(): { error: string } {
  return { error: REAUTH_REQUIRED };
}

/**
 * Lists all folders in the user's Drive root.
 * Returns `{ error: REAUTH_REQUIRED }` on 401 — caller should prompt Drive reconnect.
 */
export async function listFolders(
  accessToken: string
): Promise<DriveFolder[] | { error: string }> {
  try {
    const auth = getAuthenticatedClient(accessToken);
    const drive = google.drive({ version: "v3", auth });

    const { data, status, statusText } = await drive.files.list({
      q: "'root' in parents and mimeType='application/vnd.google-apps.folder'",
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (status !== 200) {
      if (status === 401) return reauthListError();
      return {
        error: `Drive API listFolders failed: ${status} ${statusText}`,
      };
    }

    const files = data.files ?? [];
    return files
      .filter((f): f is { id: string; name?: string } => !!f.id)
      .map((f) => ({ id: f.id, name: f.name ?? "" }));
  } catch (err) {
    if (is401Error(err)) return reauthListError();
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Drive API listFolders failed: ${message}` };
  }
}

/**
 * Lists subfolders within a parent folder.
 */
export async function listFoldersInFolder(
  accessToken: string,
  parentFolderId: string
): Promise<DriveFolder[] | { error: string }> {
  try {
    const auth = getAuthenticatedClient(accessToken);
    const drive = google.drive({ version: "v3", auth });

    const { data, status, statusText } = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: "files(id, name)",
      spaces: "drive",
    });

    if (status !== 200) {
      if (status === 401) return reauthListError();
      return {
        error: `Drive API listFoldersInFolder failed: ${status} ${statusText}`,
      };
    }

    const files = data.files ?? [];
    return files
      .filter((f): f is { id: string; name?: string } => !!f.id)
      .map((f) => ({ id: f.id, name: f.name ?? "" }));
  } catch (err) {
    if (is401Error(err)) return reauthListError();
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Drive API listFoldersInFolder failed: ${message}` };
  }
}

/**
 * Lists image/PDF files in a folder.
 */
export async function listFilesInFolder(
  accessToken: string,
  folderId: string
): Promise<DriveFile[] | { error: string }> {
  const mimeQuery = SUPPORTED_FILE_MIME_TYPES.map(
    (m) => `mimeType='${m}'`
  ).join(" or ");
  const q = `'${folderId}' in parents and (${mimeQuery})`;

  try {
    const auth = getAuthenticatedClient(accessToken);
    const drive = google.drive({ version: "v3", auth });

    const { data, status, statusText } = await drive.files.list({
      q,
      fields: "files(id, name, mimeType, size)",
      spaces: "drive",
    });

    if (status !== 200) {
      if (status === 401) return reauthListError();
      return {
        error: `Drive API listFilesInFolder failed: ${status} ${statusText}`,
      };
    }

    const files = data.files ?? [];
    return files
      .filter((f): f is { id: string; name?: string; mimeType?: string; size?: string } =>
        !!f.id
      )
      .map((f) => ({
        id: f.id,
        name: f.name ?? "",
        mimeType: f.mimeType ?? "application/octet-stream",
        size: f.size ?? "0",
      }));
  } catch (err) {
    if (is401Error(err)) return reauthListError();
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Drive API listFilesInFolder failed: ${message}`,
    };
  }
}

/**
 * Returns Drive file metadata (mime type, name). Used for Content-Type when proxying files.
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMetadata> {
  const auth = getAuthenticatedClient(accessToken);
  const drive = google.drive({ version: "v3", auth });

  try {
    const { data, status, statusText } = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    if (status === 401) throw new GoogleDriveReauthRequiredError();

    if (status !== 200 || !data.mimeType) {
      throw new Error(
        `Drive API getFileMetadata failed for fileId ${fileId}: ${status} ${statusText}`
      );
    }

    return { mimeType: data.mimeType, name: data.name ?? "" };
  } catch (err) {
    if (is401Error(err)) throw new GoogleDriveReauthRequiredError();
    throw err;
  }
}

/**
 * Downloads a file by ID and returns it as a Buffer.
 */
export async function downloadFile(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const auth = getAuthenticatedClient(accessToken);
  const drive = google.drive({ version: "v3", auth });

  try {
    const { data, status, statusText } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    if (status === 401) throw new GoogleDriveReauthRequiredError();

    if (status !== 200) {
      throw new Error(
        `Drive API downloadFile failed for fileId ${fileId}: ${status} ${statusText}`
      );
    }

    return Buffer.from(data as ArrayBuffer);
  } catch (err) {
    if (is401Error(err)) throw new GoogleDriveReauthRequiredError();
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Drive API downloadFile failed for fileId ${fileId}: ${message}`
    );
  }
}
