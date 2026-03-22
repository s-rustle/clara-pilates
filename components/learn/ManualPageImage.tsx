"use client";

import { useEffect, useState } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface ManualPageImageProps {
  fileName: string;
  folderName: string;
}

export default function ManualPageImage({
  fileName,
  folderName,
}: ManualPageImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const url = `/api/drive/image?file_name=${encodeURIComponent(fileName)}&folder_name=${encodeURIComponent(folderName)}`;

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [fileName, folderName]);

  if (error) {
    return (
      <ErrorMessage message="Could not load the manual page image. Check Drive connection and try again." />
    );
  }

  return (
    <div className="relative mx-auto min-h-[120px] max-w-full">
      {!loaded && (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-clara-deep">Loading manual page…</p>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={`mx-auto max-h-64 w-auto max-w-full rounded-sm border border-clara-highlight object-contain ${
          loaded ? "block" : "sr-only"
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
