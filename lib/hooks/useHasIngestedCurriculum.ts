"use client";

import { useEffect, useState } from "react";

/**
 * `true` if the user has at least one completed upload with chunks;
 * `false` if loaded and none; `null` while loading or on failure.
 */
export function useHasIngestedCurriculum(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ingest/status", {
          credentials: "same-origin",
        });
        const j = (await res.json()) as {
          success?: boolean;
          uploads?: Array<{ status?: string; file_count?: number | null }>;
        };
        if (cancelled) return;
        if (!res.ok || j.success !== true) {
          setReady(null);
          return;
        }
        const uploads = j.uploads ?? [];
        const has = uploads.some(
          (u) => u.status === "complete" && (u.file_count ?? 0) > 0
        );
        setReady(has);
      } catch {
        if (!cancelled) setReady(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
