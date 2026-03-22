"use client";

import type { SessionMode, SessionType } from "@/types";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CalendarPicker from "@/components/hours/CalendarPicker";

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "teaching", label: "Teaching" },
  { value: "personal", label: "Personal Practice" },
];

const APPARATUS_OPTIONS = [
  { value: "Mat", label: "Mat" },
  { value: "Reformer", label: "Reformer" },
  { value: "Trapeze Cadillac", label: "Trapeze Cadillac" },
  { value: "Chair", label: "Chair" },
  { value: "Barrels", label: "Barrels" },
];

const CLIENT_LEVEL_OPTIONS = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

export interface SessionPlannerFormProps {
  mode: SessionMode;
  onModeChange: (mode: SessionMode) => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isLoading: boolean;
  isSavingDraft?: boolean;
  sessionType: SessionType;
  onSessionTypeChange: (v: SessionType) => void;
  apparatus: string;
  onApparatusChange: (v: string) => void;
  clientLevel: string | null;
  onClientLevelChange: (v: string | null) => void;
  sessionDate: string;
  onSessionDateChange: (v: string) => void;
  loggedDates?: string[];
  children?: React.ReactNode;
}

export default function SessionPlannerForm({
  mode,
  onModeChange,
  onSubmit,
  onSaveDraft,
  isLoading,
  isSavingDraft = false,
  sessionType,
  onSessionTypeChange,
  apparatus,
  onApparatusChange,
  clientLevel,
  onClientLevelChange,
  sessionDate,
  onSessionDateChange,
  loggedDates = [],
  children,
}: SessionPlannerFormProps) {
  const busy = isLoading || isSavingDraft;

  return (
    <div className="space-y-6">
      <div className="flex gap-0 rounded-md border border-clara-border bg-clara-elevated p-0.5">
        {(["plan", "log"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            disabled={busy}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-clara-primary text-white underline decoration-clara-highlight decoration-2 underline-offset-4"
                : "text-clara-deep hover:bg-clara-highlight/60"
            } disabled:opacity-50`}
          >
            {m === "plan" ? "Plan" : "Log"}
          </button>
        ))}
      </div>

      <Select
        label="Session type"
        options={SESSION_TYPE_OPTIONS}
        value={sessionType}
        onChange={(e) => onSessionTypeChange(e.target.value as SessionType)}
        disabled={busy}
      />

      <Select
        label="Apparatus"
        options={APPARATUS_OPTIONS}
        value={apparatus}
        onChange={(e) => onApparatusChange(e.target.value)}
        disabled={busy}
      />

      {sessionType === "teaching" && (
        <Select
          label="Client level"
          options={CLIENT_LEVEL_OPTIONS}
          value={clientLevel ?? "Beginner"}
          onChange={(e) => onClientLevelChange(e.target.value)}
          disabled={busy}
        />
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-clara-deep">
          Date
        </label>
        <CalendarPicker
          value={sessionDate}
          onChange={onSessionDateChange}
          loggedDates={loggedDates}
        />
      </div>

      {children}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="primary"
          onClick={onSubmit}
          disabled={busy}
          className="sm:min-w-[140px]"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Getting feedback…
            </span>
          ) : (
            "Get Feedback"
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onSaveDraft}
          disabled={busy}
          className="sm:min-w-[140px]"
        >
          {isSavingDraft ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" />
              Saving…
            </span>
          ) : (
            "Save Draft"
          )}
        </Button>
      </div>
    </div>
  );
}
