"use client";

import { useEffect, useState } from "react";
import type { CurriculumUpload } from "@/types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface IngestionStatusProps {
  uploadId: string | null;
  onComplete: () => void;
}

export default function IngestionStatus({
  uploadId,
  onComplete,
}: IngestionStatusProps) {
  const [upload, setUpload] = useState<CurriculumUpload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;

    const fetchStatus = async () => {
      const res = await fetch("/api/ingest/status");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch status");
        return;
      }
      const found = (data.uploads ?? []).find(
        (u: CurriculumUpload) => u.id === uploadId
      );
      setUpload(found ?? null);
      if (found && found.status !== "processing") {
        onComplete();
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [uploadId, onComplete]);

  if (!uploadId) return null;
  if (error) return <ErrorMessage message={error} />;
  if (!upload) {
    return (
      <div className="flex items-center gap-2 text-clara-deep">
        <LoadingSpinner size="sm" />
        <span>Loading status...</span>
      </div>
    );
  }

  if (upload.status === "processing") {
    return (
      <div className="flex items-center gap-2 text-clara-deep">
        <LoadingSpinner size="sm" />
        <span>Processing files...</span>
      </div>
    );
  }

  if (upload.status === "complete") {
    const count = upload.file_count ?? 0;
    return (
      <p className="text-clara-strong font-medium">
        Complete — {count} chunks stored
      </p>
    );
  }

  if (upload.status === "failed") {
    return (
      <ErrorMessage
        message={upload.error_message ?? "Ingestion failed"}
      />
    );
  }

  return null;
}
