"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ExerciseItem } from "@/types";
import { formatExerciseNameForDisplay } from "@/lib/curriculum/exerciseNames";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export interface ExerciseSequenceProps {
  exercises: ExerciseItem[];
  onChange: (exercises: ExerciseItem[]) => void;
  apparatusLabel: string;
  disabled?: boolean;
}

export default function ExerciseSequence({
  exercises,
  onChange,
  apparatusLabel,
  disabled = false,
}: ExerciseSequenceProps) {
  const [draftName, setDraftName] = useState("");

  function addExercise() {
    const name = draftName.trim();
    if (!name) return;
    onChange([
      ...exercises,
      { exercise_name: name, sets: 1, reps: 10, notes: "" },
    ]);
    setDraftName("");
  }

  function updateExercise(index: number, patch: Partial<ExerciseItem>) {
    onChange(
      exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))
    );
  }

  function removeExercise(index: number) {
    onChange(exercises.filter((_, i) => i !== index));
  }

  function moveIndex(from: number, to: number) {
    if (to < 0 || to >= exercises.length) return;
    const next = [...exercises];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-clara-deep">Main Sequence</h2>
        <span className="text-right text-xs text-clara-muted">
          (Standard: 8–12 reps)
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-clara-deep">
            Exercise name
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExercise();
              }
            }}
            disabled={disabled}
            placeholder={`e.g. Footwork (${apparatusLabel})`}
            className="w-full rounded-none border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-primary focus:outline-none focus:ring-1 focus:ring-clara-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={addExercise}
          disabled={disabled || !draftName.trim()}
        >
          Add exercise
        </Button>
      </div>

      {exercises.length === 0 ? (
        <p className="rounded-none border border-dashed border-clara-border bg-clara-bg/50 px-3 py-6 text-center text-sm text-clara-muted">
          Add at least one exercise
        </p>
      ) : (
        <ul className="space-y-3">
          {exercises.map((ex, index) => (
            <li
              key={`${ex.exercise_name}-${index}`}
              className="rounded-none border border-clara-border bg-clara-bg p-3"
            >
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-clara-deep">
                      {formatExerciseNameForDisplay(ex.exercise_name)}
                    </span>
                    {ex.apparatus?.trim() ? (
                      <span className="rounded-none border border-clara-border bg-clara-surface px-2 py-0.5 text-xs text-clara-muted">
                        {ex.apparatus.trim()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="w-20">
                  <Input
                    label="Sets"
                    type="number"
                    value={String(ex.sets)}
                    onChange={(e) =>
                      updateExercise(index, {
                        sets: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="w-20">
                  <Input
                    label="Reps"
                    type="number"
                    value={String(ex.reps)}
                    onChange={(e) =>
                      updateExercise(index, {
                        reps: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center gap-0.5 pb-0.5">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={disabled || index === 0}
                    onClick={() => moveIndex(index, index - 1)}
                    className="rounded p-1 text-clara-deep hover:bg-clara-border disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={disabled || index === exercises.length - 1}
                    onClick={() => moveIndex(index, index + 1)}
                    className="rounded p-1 text-clara-deep hover:bg-clara-border disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    disabled={disabled}
                    onClick={() => removeExercise(index)}
                    className="rounded p-1 text-clara-deep hover:bg-clara-border"
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
              </div>
              <ExerciseNotesRow
                exercise={ex}
                index={index}
                disabled={disabled}
                onUpdate={updateExercise}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExerciseNotesRow({
  exercise,
  index,
  disabled,
  onUpdate,
}: {
  exercise: ExerciseItem;
  index: number;
  disabled: boolean;
  onUpdate: (index: number, patch: Partial<ExerciseItem>) => void;
}) {
  const [expanded, setExpanded] = useState(Boolean(exercise.notes?.trim()));

  return (
    <div className="mt-2 border-t border-clara-border/80 pt-2">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs font-medium text-clara-primary hover:underline"
      >
        {expanded ? "Hide notes" : "Notes (optional)"}
      </button>
      {expanded && (
        <textarea
          value={exercise.notes ?? ""}
          onChange={(e) => onUpdate(index, { notes: e.target.value })}
          disabled={disabled}
          rows={2}
          placeholder="Cues, springs, modifications…"
          className="mt-1 w-full rounded-none border border-clara-border bg-clara-surface px-3 py-2 text-sm text-clara-deep placeholder:text-clara-deep/60 focus:border-clara-primary focus:outline-none focus:ring-1 focus:ring-clara-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
      )}
    </div>
  );
}
