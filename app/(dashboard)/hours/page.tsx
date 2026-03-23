"use client";

import { useState, useEffect, useCallback } from "react";
import type { HourLog, HourTargets } from "@/types";
import HourLogForm from "@/components/hours/HourLogForm";
import HoursProgressPanel from "@/components/hours/HoursProgressPanel";
import HourLogTable from "@/components/hours/HourLogTable";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function HoursPage() {
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

      const hoursData = await hoursRes.json();
      if (!hoursRes.ok) {
        setError(
          hoursData.error ?? "Unable to load your hours. Please refresh the page."
        );
        setLogs([]);
        return;
      }

      if (hoursData.success && Array.isArray(hoursData.data)) {
        setLogs(hoursData.data);
      } else {
        setLogs([]);
      }

      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.success && profileData.data) {
        setHourTargets(
          (profileData.data.hour_targets as HourTargets | null) ?? null
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
    fetchLogs();
  }, [fetchLogs]);

  const loggedDates = [...new Set(logs.map((log) => log.session_date))];

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <HourLogForm
            onSuccess={fetchLogs}
            loggedDates={loggedDates}
          />
        </div>
        <div className="lg:col-span-3">
          <HoursProgressPanel logs={logs} hourTargets={hourTargets} />
        </div>
      </div>

      <div className="mt-8">
        <ErrorMessage message={error} />
        <HourLogTable logs={logs} onStatusUpdate={fetchLogs} />
      </div>
    </div>
  );
}
