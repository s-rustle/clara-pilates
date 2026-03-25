"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import HoursProgressPanel from "@/components/hours/HoursProgressPanel";
import type { HourLog, HourTargets } from "@/types";

export default function HoursSummaryCard() {
  const [logs, setLogs] = useState<HourLog[]>([]);
  const [hourTargets, setHourTargets] = useState<Partial<HourTargets> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setError("");
    try {
      const [hoursRes, profileRes] = await Promise.all([
        fetch("/api/hours", { credentials: "same-origin" }),
        fetch("/api/profile", { credentials: "same-origin" }),
      ]);

      const [data, profileJson] = await Promise.all([
        hoursRes.json(),
        profileRes.json(),
      ]);

      if (!hoursRes.ok) {
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
      if (profileRes.ok && profileJson.success && profileJson.data) {
        setHourTargets(
          (profileJson.data.hour_targets as HourTargets | null) ?? null
        );
      } else {
        setHourTargets(null);
      }
    } catch {
      setError("Unable to load your hours. Please refresh the page.");
      setLogs([]);
      setHourTargets(null);
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
        <h2 className="mb-4 text-lg font-semibold text-clara-deep">Hours</h2>
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-clara-deep">Hours</h2>
        <Button href="/hours" variant="accent" className="px-3 py-1.5 text-[10px]">
          Log hours
        </Button>
      </div>
      {error ? (
        <ErrorMessage message={error} />
      ) : (
        <HoursProgressPanel logs={logs} hourTargets={hourTargets} />
      )}
    </Card>
  );
}
