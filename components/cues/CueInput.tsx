"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
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
  const [exerciseOptions, setExerciseOptions] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [clientLevel, setClientLevel] = useState(
    CLIENT_LEVEL_OPTIONS[0]?.value ?? "Beginner"
  );

  const fetchExercises = useCallback(async (app: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/agents/learn?apparatus=${encodeURIComponent(app)}`,
        { credentials: "same-origin" }
      );
      const data = await res.json();
      if (!res.ok) {
        setExerciseOptions([]);
        setListError(
          typeof data.error === "string"
            ? data.error
            : "Could not load exercises."
        );
        return;
      }
      if (data.success && Array.isArray(data.data?.exercises)) {
        const names = data.data.exercises as string[];
        setExerciseOptions([...names].sort((a, b) => a.localeCompare(b)));
      } else {
        setExerciseOptions([]);
      }
    } catch {
      setExerciseOptions([]);
      setListError("Could not load exercises.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    setExerciseName("");
    void fetchExercises(apparatus);
  }, [apparatus, fetchExercises]);

  useEffect(() => {
    if (resetCueNonce > 0) {
      setCue("");
    }
  }, [resetCueNonce]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCue = cue.trim();
    if (!trimmedCue || !exerciseName || isLoading || listLoading) return;
    onSubmit(trimmedCue, apparatus, exerciseName, clientLevel);
  };

  const exerciseSelectOptions = [
    {
      value: "",
      label: listLoading
        ? "Loading exercises…"
        : listError
          ? "Could not load list"
          : exerciseOptions.length === 0
            ? "No exercises in curriculum"
            : "Select an exercise…",
    },
    ...exerciseOptions.map((name) => ({ value: name, label: name })),
  ];

  const canPickExercise =
    !listLoading && !listError && exerciseOptions.length > 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Apparatus"
          options={APPARATUS_OPTIONS}
          value={apparatus}
          onChange={(e) => {
            setApparatus(e.target.value);
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
        {listError ? (
          <p className="mt-1.5 text-xs text-clara-primary">{listError}</p>
        ) : null}
        {!listLoading && !listError && exerciseOptions.length === 0 ? (
          <p className="mt-1.5 text-xs text-clara-muted">
            No exercise names were found for this apparatus in your curriculum.
            Check the Curriculum manager or try{" "}
            <Link
              href="/learn"
              className="font-bold text-clara-accent underline-offset-2 hover:underline"
            >
              Learn
            </Link>{" "}
            after uploading manual content.
          </p>
        ) : null}
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
          className="w-full resize-y rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div>
        <Button
          type="submit"
          disabled={isLoading || listLoading || !exerciseName.trim()}
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
