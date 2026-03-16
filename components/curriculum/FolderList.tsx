"use client";

import { useState, useEffect, useCallback } from "react";
import type { CurriculumUpload, DriveFolder } from "@/types";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import IngestionStatus from "./IngestionStatus";

const EXPECTED_FOLDERS = [
  "Anatomy",
  "Movement Principles",
  "Mat 1",
  "Mat 2",
  "Mat 3",
  "Reformer 1",
  "Reformer 2",
  "Reformer 3",
  "Trapeze Cadillac",
  "Chair",
  "Barrels",
  "Homework",
];

function statusBadgeVariant(
  status: string
): "grey" | "yellow" | "green" | "red" {
  switch (status) {
    case "processing":
      return "yellow";
    case "complete":
      return "green";
    case "failed":
      return "red";
    default:
      return "grey";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString();
}

/**
 * Extracts Google Drive folder ID from a URL or returns the string if it's already an ID.
 * Supports: drive.google.com/drive/folders/ID, drive.google.com/open?id=ID, /u/0/folders/ID
 */
function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const foldersMatch = trimmed.match(/drive\.google\.com\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch) return foldersMatch[1];

  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (openMatch) return openMatch[1];

  const pathMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

export default function FolderList() {
  const [uploads, setUploads] = useState<CurriculumUpload[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [ingestingFolder, setIngestingFolder] = useState<string | null>(null);
  const [folderUrls, setFolderUrls] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    const [statusRes, foldersRes] = await Promise.all([
      fetch("/api/ingest/status"),
      fetch("/api/ingest/folders"),
    ]);

    const statusData = await statusRes.json();
    const foldersData = await foldersRes.json();

    if (statusData.success && statusData.uploads) {
      setUploads(statusData.uploads);
    }
    if (foldersData.folders) {
      setFolders(foldersData.folders);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [statusRes, foldersRes] = await Promise.all([
        fetch("/api/ingest/status"),
        fetch("/api/ingest/folders"),
      ]);
      if (cancelled) return;

      const statusData = await statusRes.json();
      const foldersData = await foldersRes.json();
      if (cancelled) return;

      if (statusData.success && statusData.uploads) {
        setUploads(statusData.uploads);
      }
      if (foldersData.folders) {
        setFolders(foldersData.folders);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getUploadForFolder = (folderName: string): CurriculumUpload | null => {
    return (
      uploads.find(
        (u) =>
          u.folder_name.toLowerCase().trim() === folderName.toLowerCase().trim()
      ) ?? null
    );
  };

  const getDriveFolderId = (folderName: string): string | null => {
    const match = folders.find(
      (f) => f.name.toLowerCase().trim() === folderName.toLowerCase().trim()
    );
    return match?.id ?? null;
  };

  const handleIngest = async (
    folderName: string,
    manualUrl?: string,
    existingDriveFolderId?: string | null
  ) => {
    let driveFolderId: string | null = null;

    if (existingDriveFolderId) {
      driveFolderId = existingDriveFolderId;
    } else if (manualUrl?.trim()) {
      driveFolderId = extractFolderId(manualUrl);
      if (!driveFolderId) {
        alert(
          "Could not extract folder ID from the URL. Use a link like: https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
        );
        return;
      }
    } else {
      driveFolderId = getDriveFolderId(folderName);
      if (!driveFolderId) {
        alert(
          `Folder "${folderName}" not found in your Google Drive. Paste the folder URL above, or create a folder with this exact name in your Drive (or under "Balanced Body Exam").`
        );
        return;
      }
    }

    setIngestingFolder(folderName);
    setActiveUploadId(null);

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drive_folder_id: driveFolderId,
          folder_name: folderName,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Ingestion failed");
        setIngestingFolder(null);
        return;
      }

      if (data.upload_id) {
        setActiveUploadId(data.upload_id);
      }
      await fetchData();
      setIngestingFolder(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ingestion failed");
      setIngestingFolder(null);
    }
  };

  const handleReingest = async (
    folderName: string,
    uploadId: string,
    driveFolderId: string
  ) => {
    if (
      !confirm(
        `Re-ingest "${folderName}"? This will delete existing chunks and re-process all files.`
      )
    ) {
      return;
    }

    try {
      const deleteRes = await fetch("/api/ingest", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId }),
      });
      const deleteData = await deleteRes.json();

      if (!deleteRes.ok || !deleteData.success) {
        alert(deleteData.error ?? "Failed to clear existing data");
        return;
      }

      await handleIngest(
        folderName,
        folderUrls[folderName],
        driveFolderId
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Re-ingest failed");
    }
  };

  const handleIngestionComplete = useCallback(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-clara-deep">
        <LoadingSpinner size="sm" />
        <span>Loading folders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <IngestionStatus
        uploadId={activeUploadId}
        onComplete={handleIngestionComplete}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-clara-highlight">
                <th className="pb-2 pr-4 font-medium text-clara-strong">
                  Folder
                </th>
                <th className="pb-2 pr-4 font-medium text-clara-strong">
                  Folder URL or ID
                </th>
                <th className="pb-2 pr-4 font-medium text-clara-strong">
                  Status
                </th>
                <th className="pb-2 pr-4 font-medium text-clara-strong">
                  Last ingested
                </th>
                <th className="pb-2 pr-4 font-medium text-clara-strong">
                  Chunks
                </th>
                <th className="pb-2 font-medium text-clara-strong">Action</th>
              </tr>
            </thead>
            <tbody>
              {EXPECTED_FOLDERS.map((folderName) => {
                const upload = getUploadForFolder(folderName);
                const status = upload?.status ?? "pending";
                const isIngesting =
                  ingestingFolder?.toLowerCase() === folderName.toLowerCase();

                return (
                  <tr
                    key={folderName}
                    className="border-b border-clara-highlight last:border-0"
                  >
                    <td className="py-3 pr-4 text-clara-deep">{folderName}</td>
                    <td className="py-3 pr-4" style={{ minWidth: 280 }}>
                      <input
                        type="text"
                        placeholder="Paste Drive folder URL or ID"
                        value={folderUrls[folderName] ?? ""}
                        onChange={(e) =>
                          setFolderUrls((prev) => ({
                            ...prev,
                            [folderName]: e.target.value,
                          }))
                        }
                        className="w-full min-w-[200px] rounded border border-clara-highlight bg-clara-surface px-2 py-1.5 text-sm text-clara-deep placeholder:text-clara-deep/60 focus:border-clara-strong focus:outline-none"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusBadgeVariant(status)}>
                        {status === "pending"
                          ? "Not ingested"
                          : status === "processing"
                            ? "Processing"
                            : status === "complete"
                              ? "Complete"
                              : "Failed"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-clara-deep text-sm">
                      {formatDate(upload?.last_ingested_at ?? null)}
                    </td>
                    <td className="py-3 pr-4 text-clara-deep text-sm">
                      {upload?.file_count ?? "—"}
                    </td>
                    <td className="py-3">
                      {upload ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            handleReingest(
                              folderName,
                              upload.id,
                              upload.drive_folder_id
                            )
                          }
                          disabled={isIngesting || status === "processing"}
                        >
                          {isIngesting ? (
                            <span className="inline-flex items-center">
                              <LoadingSpinner size="sm" />
                              <span className="ml-2">Ingesting...</span>
                            </span>
                          ) : (
                            "Re-ingest"
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() =>
                            handleIngest(folderName, folderUrls[folderName])
                          }
                          disabled={isIngesting}
                        >
                          {isIngesting ? (
                            <span className="inline-flex items-center">
                              <LoadingSpinner size="sm" />
                              <span className="ml-2">Ingesting...</span>
                            </span>
                          ) : (
                            "Ingest"
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
