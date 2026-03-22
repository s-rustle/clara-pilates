"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Select from "@/components/ui/Select";

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
  const [apparatus, setApparatus] = useState(APPARATUS_OPTIONS[0]?.value ?? "Mat");
  const [exerciseName, setExerciseName] = useState("");
  const [clientLevel, setClientLevel] = useState(
    CLIENT_LEVEL_OPTIONS[0]?.value ?? "Beginner"
  );

  useEffect(() => {
    if (resetCueNonce > 0) {
      setCue("");
    }
  }, [resetCueNonce]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCue = cue.trim();
    const trimmedExercise = exerciseName.trim();
    if (!trimmedCue || !trimmedExercise || isLoading) return;
    onSubmit(trimmedCue, apparatus, trimmedExercise, clientLevel);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Apparatus"
          options={APPARATUS_OPTIONS}
          value={apparatus}
          onChange={(e) => setApparatus(e.target.value)}
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
      <Input
        label="Exercise name"
        placeholder="e.g. The Hundred"
        value={exerciseName}
        onChange={(e) => setExerciseName(e.target.value)}
        disabled={isLoading}
      />
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
          className="w-full resize-y rounded-md border border-clara-border bg-clara-elevated px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-warm focus:outline-none focus:ring-1 focus:ring-clara-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div>
        <Button type="submit" disabled={isLoading}>
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
