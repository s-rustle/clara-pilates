"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import HoursProgressPanel from "@/components/hours/HoursProgressPanel";
import type { HourLog } from "@/types";

export default function HoursSummaryCard() {
  const [logs, setLogs] = useState<HourLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/hours", { credentials: "same-origin" });
      const data = await res.json();

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Unable to load your hours. Please refresh the page."
        );
        setLogs([]);
        return;
      }

      if (data.success && Array.isArray(data.data)) {
        setLogs(data.data as HourLog[]);
      } else {
        setLogs([]);
      }
    } catch {
      setError("Unable to load your hours. Please refresh the page.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  if (loading) {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-strong">
          Hours
        </h2>
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-clara-strong">
          Hours
        </h2>
        <Link
          href="/hours"
          className="text-sm font-medium text-clara-primary underline-offset-2 hover:underline"
        >
          Log hours
        </Link>
      </div>
      {error ? (
        <ErrorMessage message={error} />
      ) : (
        <HoursProgressPanel logs={logs} />
      )}
    </Card>
  );
}
