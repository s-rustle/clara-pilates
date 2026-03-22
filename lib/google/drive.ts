import { google } from "googleapis";
import type { DriveFolder, DriveFile } from "@/types";
import {
  getAuthenticatedClient,
  refreshAccessToken,
} from "@/lib/google/auth";

export type DriveFileMetadata = {
  mimeType: string;
  name: string;
};

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

/**
 * Lists all folders in the user's Drive root.
 * Returns { error: string } on failure. Handles 401 by refreshing token and retrying once if refreshToken is provided.
 */
export async function listFolders(
  accessToken: string,
  refreshToken?: string
): Promise<DriveFolder[] | { error: string }> {
  const run = async (token: string): Promise<DriveFolder[] | { error: string }> => {
    try {
      const auth = getAuthenticatedClient(token);
      const drive = google.drive({ version: "v3", auth });

      const { data, status, statusText } = await drive.files.list({
        q: "'root' in parents and mimeType='application/vnd.google-apps.folder'",
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (status !== 200) {
        return {
          error: `Drive API listFolders failed: ${status} ${statusText}`,
        };
      }

      const files = data.files ?? [];
      return files
        .filter((f): f is { id: string; name?: string } => !!f.id)
        .map((f) => ({ id: f.id, name: f.name ?? "" }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      return { error: `Drive API listFolders failed: ${message}` };
    }
  };

  const result = await run(accessToken);

  if (!("error" in result)) return result;
  if (!/401|unauthorized/i.test(result.error)) return result;
  if (!refreshToken) return result;

  try {
    const newToken = await refreshAccessToken(refreshToken);
    return run(newToken);
  } catch {
    return { error: "Drive API listFolders failed: token refresh failed" };
  }
}

/**
 * Lists subfolders within a parent folder.
 * Returns { error: string } on failure. Handles 401 by refreshing token and retrying once if refreshToken is provided.
 */
export async function listFoldersInFolder(
  accessToken: string,
  parentFolderId: string,
  refreshToken?: string
): Promise<DriveFolder[] | { error: string }> {
  const run = async (
    token: string
  ): Promise<DriveFolder[] | { error: string }> => {
    try {
      const auth = getAuthenticatedClient(token);
      const drive = google.drive({ version: "v3", auth });

      const { data, status, statusText } = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (status !== 200) {
        return {
          error: `Drive API listFoldersInFolder failed: ${status} ${statusText}`,
        };
      }

      const files = data.files ?? [];
      return files
        .filter((f): f is { id: string; name?: string } => !!f.id)
        .map((f) => ({ id: f.id, name: f.name ?? "" }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      return { error: `Drive API listFoldersInFolder failed: ${message}` };
    }
  };

  const result = await run(accessToken);

  if (!("error" in result)) return result;
  if (!/401|unauthorized/i.test(result.error)) return result;
  if (!refreshToken) return result;

  try {
    const newToken = await refreshAccessToken(refreshToken);
    return run(newToken);
  } catch {
    return {
      error: "Drive API listFoldersInFolder failed: token refresh failed",
    };
  }
}

/**
 * Lists image files in a folder (jpeg, png, heic, webp).
 * Returns { error: string } on failure. Handles 401 by refreshing token and retrying once if refreshToken is provided.
 */
export async function listFilesInFolder(
  accessToken: string,
  folderId: string,
  refreshToken?: string
): Promise<DriveFile[] | { error: string }> {
  const mimeQuery = SUPPORTED_FILE_MIME_TYPES.map(
    (m) => `mimeType='${m}'`
  ).join(" or ");
  const q = `'${folderId}' in parents and (${mimeQuery})`;

  const run = async (
    token: string
  ): Promise<DriveFile[] | { error: string }> => {
    try {
      const auth = getAuthenticatedClient(token);
      const drive = google.drive({ version: "v3", auth });

      const { data, status, statusText } = await drive.files.list({
        q,
        fields: "files(id, name, mimeType, size)",
        spaces: "drive",
      });

      if (status !== 200) {
        return {
          error: `Drive API listFilesInFolder failed: ${status} ${statusText}`,
        };
      }

      const files = data.files ?? [];
      return files
        .filter((f): f is { id: string; name?: string; mimeType?: string; size?: string } => !!f.id)
        .map((f) => ({
          id: f.id,
          name: f.name ?? "",
          mimeType: f.mimeType ?? "application/octet-stream",
          size: f.size ?? "0",
        }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        error: `Drive API listFilesInFolder failed: ${message}`,
      };
    }
  };

  const result = await run(accessToken);

  if (!("error" in result)) return result;
  if (!/401|unauthorized/i.test(result.error)) return result;
  if (!refreshToken) return result;

  try {
    const newToken = await refreshAccessToken(refreshToken);
    return run(newToken);
  } catch {
    return {
      error: "Drive API listFilesInFolder failed: token refresh failed",
    };
  }
}

/**
 * Returns Drive file metadata (mime type, name). Used for Content-Type when proxying files.
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string,
  refreshToken?: string
): Promise<DriveFileMetadata> {
  const run = async (token: string): Promise<DriveFileMetadata> => {
    const auth = getAuthenticatedClient(token);
    const drive = google.drive({ version: "v3", auth });

    const { data, status, statusText } = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    if (status !== 200 || !data.mimeType) {
      throw new Error(
        `Drive API getFileMetadata failed for fileId ${fileId}: ${status} ${statusText}`
      );
    }

    return { mimeType: data.mimeType, name: data.name ?? "" };
  };

  try {
    return await run(accessToken);
  } catch (err) {
    if (!is401Error(err)) throw err;
    if (!refreshToken) throw err;

    const newToken = await refreshAccessToken(refreshToken);
    return run(newToken);
  }
}

/**
 * Downloads a file by ID and returns it as a Buffer.
 * Throws with explicit message including fileId on failure.
 * Handles 401 by refreshing token and retrying once if refreshToken is provided.
 */
export async function downloadFile(
  accessToken: string,
  fileId: string,
  refreshToken?: string
): Promise<Buffer> {
  const run = async (token: string): Promise<Buffer> => {
    try {
      const auth = getAuthenticatedClient(token);
      const drive = google.drive({ version: "v3", auth });

      const { data, status, statusText } = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      if (status !== 200) {
        throw new Error(
          `Drive API downloadFile failed for fileId ${fileId}: ${status} ${statusText}`
        );
      }

      return Buffer.from(data as ArrayBuffer);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      throw new Error(`Drive API downloadFile failed for fileId ${fileId}: ${message}`);
    }
  };

  try {
    return await run(accessToken);
  } catch (err) {
    if (!is401Error(err)) throw err;
    if (!refreshToken) throw err;

    const newToken = await refreshAccessToken(refreshToken);
    return run(newToken);
  }
}
