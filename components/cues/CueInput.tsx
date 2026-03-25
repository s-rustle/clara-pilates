"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Select from "@/components/ui/Select";
import {
  EXERCISES_BY_APPARATUS,
  type Apparatus,
} from "@/constants/exerciseList";

const APPARATUS_KEYS = Object.keys(EXERCISES_BY_APPARATUS) as Apparatus[];

const APPARATUS_OPTIONS = APPARATUS_KEYS.map((k) => ({
  value: k,
  label: k,
}));

const CLIENT_LEVEL_OPTIONS = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

interface CueInputProps {
  onSubmit: (
    cue: string,
    apparatus: string,
    exerciseName: string,
    clientLevel: string
  ) => void;
  isLoading: boolean;
  /** Increment to clear only the cue textarea (e.g. after "Try again"). */
  resetCueNonce?: number;
}

export default function CueInput({
  onSubmit,
  isLoading,
  resetCueNonce = 0,
}: CueInputProps) {
  const [cue, setCue] = useState("");
  const [apparatus, setApparatus] = useState<Apparatus>(
    APPARATUS_KEYS[0] ?? "Mat"
  );
  const [exerciseName, setExerciseName] = useState("");
  const [clientLevel, setClientLevel] = useState(
    CLIENT_LEVEL_OPTIONS[0]?.value ?? "Beginner"
  );

  const exerciseOptions = useMemo(() => {
    const names = EXERCISES_BY_APPARATUS[apparatus] ?? [];
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [apparatus]);

  useEffect(() => {
    setExerciseName("");
  }, [apparatus]);

  useEffect(() => {
    if (resetCueNonce > 0) {
      setCue("");
    }
  }, [resetCueNonce]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCue = cue.trim();
    if (!trimmedCue || !exerciseName || isLoading) return;
    onSubmit(trimmedCue, apparatus, exerciseName, clientLevel);
  };

  const exerciseSelectOptions = [
    {
      value: "",
      label:
        exerciseOptions.length === 0
          ? "No exercises for this apparatus"
          : "Select an exercise…",
    },
    ...exerciseOptions.map((name) => ({ value: name, label: name })),
  ];

  const canPickExercise = exerciseOptions.length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Apparatus"
          options={APPARATUS_OPTIONS}
          value={apparatus}
          onChange={(e) => {
            setApparatus(e.target.value as Apparatus);
          }}
          disabled={isLoading}
        />
        <Select
          label="Client level"
          options={CLIENT_LEVEL_OPTIONS}
          value={clientLevel}
          onChange={(e) => setClientLevel(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div>
        <Select
          label="Exercise name"
          options={exerciseSelectOptions}
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          disabled={isLoading || !canPickExercise}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-clara-deep">
          Your cue
        </label>
        <textarea
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="Write your cue here..."
          rows={6}
          disabled={isLoading}
          className="w-full resize-y rounded-none border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-primary focus:outline-none focus:ring-1 focus:ring-clara-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div>
        <Button
          type="submit"
          disabled={isLoading || !exerciseName.trim()}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Getting feedback…
            </span>
          ) : (
            "Get Feedback"
          )}
        </Button>
      </div>
    </form>
  );
}
