"use client";

import { useState } from "react";
import type { HourLog } from "@/types";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CalendarPicker from "./CalendarPicker";

export const HOUR_CATEGORY_OPTIONS = [
  { value: "Anatomy", label: "Anatomy" },
  { value: "Movement Principles", label: "Movement Principles" },
  { value: "Mat 1", label: "Mat 1" },
  { value: "Mat 2", label: "Mat 2" },
  { value: "Mat 3", label: "Mat 3" },
  { value: "Reformer 1", label: "Reformer 1" },
  { value: "Reformer 2", label: "Reformer 2" },
  { value: "Reformer 3", label: "Reformer 3" },
  { value: "Trapeze Cadillac", label: "Trapeze Cadillac" },
  { value: "Chair", label: "Chair" },
  { value: "Barrels", label: "Barrels" },
];

const CATEGORY_OPTIONS = HOUR_CATEGORY_OPTIONS;

const SUB_TYPE_OPTIONS = [
  { value: "Theory", label: "Theory" },
  { value: "Practical", label: "Practical" },
  { value: "Observation", label: "Observation" },
  { value: "Teaching", label: "Teaching" },
];

const MINUTES_OPTIONS = [
  { value: "0", label: "0" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStatusFromDate(dateStr: string): "logged" | "scheduled" {
  if (!dateStr) return "logged";
  const selected = new Date(dateStr);
  const today = new Date();
  selected.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return selected <= today ? "logged" : "scheduled";
}

interface HourLogFormProps {
  onSuccess?: () => void;
  /** Called with the created row after a successful POST (e.g. link session plan to hours). */
  onCreated?: (log: HourLog) => void;
  loggedDates?: string[];
  initialCategory?: string;
  initialSubType?: string;
  initialSessionDate?: string;
  initialNotes?: string;
}

export default function HourLogForm({
  onSuccess,
  onCreated,
  loggedDates = [],
  initialCategory,
  initialSubType,
  initialSessionDate,
  initialNotes,
}: HourLogFormProps) {
  const [category, setCategory] = useState(
    () => initialCategory ?? CATEGORY_OPTIONS[0].value
  );
  const [subType, setSubType] = useState(
    () => initialSubType ?? SUB_TYPE_OPTIONS[0].value
  );
  const [sessionDate, setSessionDate] = useState(
    () => initialSessionDate ?? getTodayISO()
  );
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [notes, setNotes] = useState(() => initialNotes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const status = getStatusFromDate(sessionDate);

  function resetForm() {
    setCategory(CATEGORY_OPTIONS[0].value);
    setSubType(SUB_TYPE_OPTIONS[0].value);
    setSessionDate(getTodayISO());
    setHours(0);
    setMinutes(0);
    setNotes("");
  }

  async function handleSubmit() {
    setError("");
    setSuccessMessage("");

    const durationMinutes = hours * 60 + minutes;
    if (durationMinutes === 0) {
      setError("Please enter a duration (hours and/or minutes).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          sub_type: subType,
          session_date: sessionDate,
          duration_minutes: durationMinutes,
          notes: notes.trim() || undefined,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to log hours");
        setLoading(false);
        return;
      }

      if (data.success && data.data) {
        onCreated?.(data.data as HourLog);
      }

      setSuccessMessage("Hours logged successfully");
      resetForm();
      onSuccess?.();

      setTimeout(() => setSuccessMessage(""), 3000);
    } catch {
      setError("Failed to log hours. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Select
        label="Category"
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={loading}
      />

      <Select
        label="Sub-type"
        options={SUB_TYPE_OPTIONS}
        value={subType}
        onChange={(e) => setSubType(e.target.value)}
        disabled={loading}
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-clara-deep">
          Date
        </label>
        <CalendarPicker
          value={sessionDate}
          onChange={setSessionDate}
          loggedDates={loggedDates}
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="w-24">
          <Input
            label="Hours"
            type="number"
            value={String(hours)}
            onChange={(e) =>
              setHours(Math.min(12, Math.max(0, parseInt(e.target.value, 10) || 0)))
            }
            disabled={loading}
          />
        </div>
        <Select
          label="Minutes"
          options={MINUTES_OPTIONS}
          value={String(minutes)}
          onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
          disabled={loading}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-clara-deep">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          placeholder="Optional notes..."
          rows={2}
          className="w-full rounded-sm border border-clara-highlight bg-clara-surface px-3 py-2 text-clara-deep placeholder:text-clara-deep/60 focus:border-clara-strong focus:outline-none focus:ring-1 focus:ring-clara-strong disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-clara-deep">Status:</span>
        <Badge variant={status === "logged" ? "green" : "yellow"}>
          {status}
        </Badge>
      </div>

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner size="sm" />
            Logging...
          </span>
        ) : (
          "Log Hours"
        )}
      </Button>

      {successMessage && (
        <p className="text-sm font-medium text-clara-strong">
          {successMessage}
        </p>
      )}

      <ErrorMessage message={error} />
    </div>
  );
}
