"use client";

import { useState, useEffect, useCallback } from "react";
import type { HourLog } from "@/types";
import HourLogForm from "@/components/hours/HourLogForm";
import HoursProgressPanel from "@/components/hours/HoursProgressPanel";
import HourLogTable from "@/components/hours/HourLogTable";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function HoursPage() {
  const [logs, setLogs] = useState<HourLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/hours");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Unable to load your hours. Please refresh the page.");
        setLogs([]);
        return;
      }

      if (data.success && Array.isArray(data.data)) {
        setLogs(data.data);
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
      <h1 className="mb-6 text-2xl font-bold text-clara-strong">
        Hour Tracking
      </h1>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <HourLogForm
            onSuccess={fetchLogs}
            loggedDates={loggedDates}
          />
        </div>
        <div className="lg:col-span-3">
          <HoursProgressPanel logs={logs} />
        </div>
      </div>

      <div className="mt-8">
        <ErrorMessage message={error} />
        <HourLogTable logs={logs} onStatusUpdate={fetchLogs} />
      </div>
    </div>
  );
}
